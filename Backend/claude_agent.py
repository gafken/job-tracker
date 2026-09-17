"""
Claude-powered chat agent that can inspect and update your job/contact tracker
via tool use. Requires ANTHROPIC_API_KEY to be set in the environment.
"""
import os
import json
import datetime

import anthropic
from sqlalchemy.orm import Session

import Backend.models as models

api_key = (os.environ.get("ANTHROPIC_API_KEY") or "").strip()
client = anthropic.Anthropic(api_key=api_key) if api_key and api_key.lower() != "your-claude-key-here" else None

MODEL = "claude-sonnet-4-6"

SYSTEM_PROMPT = """You are a job-search assistant embedded in the user's personal job tracker app.
You have tools to look up and update their tracked job applications and LinkedIn connection requests.
Be concise and practical. When asked about "stale" or "old" jobs, use a threshold of 14 days
since date_added (or date_applied if set) with no status change, unless the user says otherwise.
When asked about connections needing follow-up, use each contact's needs_follow_up flag.
Never invent data - always call a tool to check before answering questions about the user's
tracked jobs or contacts."""

TOOLS = [
    {
        "name": "list_jobs",
        "description": "List tracked job applications, optionally filtered by status.",
        "input_schema": {
            "type": "object",
            "properties": {
                "status": {
                    "type": "string",
                    "description": "Filter by status (saved, applied, interviewing, offer, rejected, ghosted, withdrawn). Omit for all.",
                }
            },
        },
    },
    {
        "name": "get_stale_jobs",
        "description": "Get jobs with no status update in more than N days (default 14).",
        "input_schema": {
            "type": "object",
            "properties": {
                "days": {"type": "integer", "description": "Age threshold in days. Default 14."}
            },
        },
    },
    {
        "name": "update_job_status",
        "description": "Update the status and/or notes of a tracked job by its id.",
        "input_schema": {
            "type": "object",
            "properties": {
                "job_id": {"type": "integer"},
                "status": {"type": "string"},
                "notes": {"type": "string"},
            },
            "required": ["job_id"],
        },
    },
    {
        "name": "list_contacts",
        "description": "List LinkedIn connection requests, optionally filtered by status.",
        "input_schema": {
            "type": "object",
            "properties": {
                "status": {"type": "string", "description": "pending, accepted, or ignored. Omit for all."}
            },
        },
    },
    {
        "name": "get_contacts_needing_followup",
        "description": "Get pending LinkedIn connection requests that are past their follow-up window and haven't been followed up on yet.",
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "mark_contact_followed_up",
        "description": "Mark a contact as having been followed up on.",
        "input_schema": {
            "type": "object",
            "properties": {"contact_id": {"type": "integer"}},
            "required": ["contact_id"],
        },
    },
]


def _job_to_dict(j: models.Job) -> dict:
    age = (datetime.datetime.utcnow() - j.date_added).days
    return {
        "id": j.id,
        "title": j.title,
        "company": j.company,
        "url": j.url,
        "platform": j.platform.value if hasattr(j.platform, "value") else j.platform,
        "status": j.status.value if hasattr(j.status, "value") else j.status,
        "age_days": age,
        "date_added": j.date_added.isoformat(),
        "date_applied": j.date_applied.isoformat() if j.date_applied else None,
        "notes": j.notes,
    }


def _contact_to_dict(c: models.Contact) -> dict:
    days_pending = (datetime.datetime.utcnow() - c.date_request_sent).days
    needs_follow_up = (
        c.status == models.ConnectionStatus.pending
        and not c.followed_up
        and days_pending >= c.follow_up_after_days
    )
    return {
        "id": c.id,
        "name": c.name,
        "linkedin_url": c.linkedin_url,
        "company": c.company,
        "role": c.role,
        "status": c.status.value if hasattr(c.status, "value") else c.status,
        "days_pending": days_pending,
        "follow_up_after_days": c.follow_up_after_days,
        "needs_follow_up": needs_follow_up,
        "notes": c.notes,
    }


def _execute_tool(db: Session, name: str, tool_input: dict) -> dict:
    if name == "list_jobs":
        q = db.query(models.Job)
        if tool_input.get("status"):
            q = q.filter(models.Job.status == tool_input["status"])
        return {"jobs": [_job_to_dict(j) for j in q.all()]}

    if name == "get_stale_jobs":
        days = tool_input.get("days", 14)
        cutoff = datetime.datetime.utcnow() - datetime.timedelta(days=days)
        active_statuses = [
            models.JobStatus.saved,
            models.JobStatus.applied,
            models.JobStatus.interviewing,
        ]
        q = db.query(models.Job).filter(
            models.Job.last_updated < cutoff, models.Job.status.in_(active_statuses)
        )
        return {"stale_jobs": [_job_to_dict(j) for j in q.all()]}

    if name == "update_job_status":
        job = db.query(models.Job).filter(models.Job.id == tool_input["job_id"]).first()
        if not job:
            return {"error": "job not found"}
        if tool_input.get("status"):
            job.status = tool_input["status"]
        if tool_input.get("notes") is not None:
            job.notes = tool_input["notes"]
        job.last_updated = datetime.datetime.utcnow()
        db.commit()
        db.refresh(job)
        return {"updated": _job_to_dict(job)}

    if name == "list_contacts":
        q = db.query(models.Contact)
        if tool_input.get("status"):
            q = q.filter(models.Contact.status == tool_input["status"])
        return {"contacts": [_contact_to_dict(c) for c in q.all()]}

    if name == "get_contacts_needing_followup":
        contacts = db.query(models.Contact).filter(
            models.Contact.status == models.ConnectionStatus.pending,
            models.Contact.followed_up == False,  # noqa: E712
        ).all()
        result = [_contact_to_dict(c) for c in contacts]
        result = [c for c in result if c["needs_follow_up"]]
        return {"contacts_needing_followup": result}

    if name == "mark_contact_followed_up":
        c = db.query(models.Contact).filter(models.Contact.id == tool_input["contact_id"]).first()
        if not c:
            return {"error": "contact not found"}
        c.followed_up = True
        db.commit()
        return {"updated": _contact_to_dict(c)}

    return {"error": f"unknown tool {name}"}


def chat(db: Session, history: list[dict], user_message: str) -> str:
    """
    history: list of {"role": "user"|"assistant", "content": str}
    Returns the assistant's final text reply. Handles multi-turn tool use internally.
    """
    if client is None:
        raise RuntimeError("ANTHROPIC_API_KEY is not configured.")

    messages = history + [{"role": "user", "content": user_message}]

    while True:
        response = client.messages.create(
            model=MODEL,
            max_tokens=1500,
            system=SYSTEM_PROMPT,
            tools=TOOLS,
            messages=messages,
        )

        if response.stop_reason != "tool_use":
            # Concatenate any text blocks
            text_parts = [b.text for b in response.content if b.type == "text"]
            return "\n".join(text_parts).strip()

        # Append assistant's tool-use turn to the conversation
        messages.append({"role": "assistant", "content": response.content})

        tool_results = []
        for block in response.content:
            if block.type == "tool_use":
                result = _execute_tool(db, block.name, block.input)
                tool_results.append(
                    {
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": json.dumps(result, default=str),
                    }
                )

        messages.append({"role": "user", "content": tool_results})