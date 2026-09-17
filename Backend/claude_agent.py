"""Google Gemini-powered chat agent for the job tracker.

This file keeps the historical module name for compatibility with the rest of the app,
while switching the actual provider to Google Gemini.
"""
import datetime
import os
from typing import Any

try:
    import google.generativeai as genai
except ModuleNotFoundError:  # pragma: no cover - handled at runtime
    genai = None
from sqlalchemy.orm import Session

import Backend.models as models

PROVIDER = "google"
GOOGLE_API_KEY_ENV = "GOOGLE_API_KEY"
LEGACY_API_KEY_ENV = "ANTHROPIC_API_KEY"
PLACEHOLDER_VALUES = {
    "your-google-key-here",
    "your-claude-key-here",
    "placeholder123",
}

MODEL = "gemini-2.0-flash"

SYSTEM_PROMPT = """You are a job-search assistant embedded in the user's personal job tracker app.
Be concise and practical. When asked about stale or old jobs, use a threshold of 14 days
since date_added unless the user says otherwise. When asked about connections needing follow-up,
use the follow-up status and pending dates already in the tracker. Never invent data.
"""


def get_api_key() -> str:
    for env_name in (GOOGLE_API_KEY_ENV, LEGACY_API_KEY_ENV):
        value = (os.environ.get(env_name) or "").strip()
        if value and value.lower() not in {item.lower() for item in PLACEHOLDER_VALUES}:
            return value
    return ""


def has_valid_api_key() -> bool:
    return bool(get_api_key())


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


def _tracker_snapshot(db: Session) -> str:
    jobs = db.query(models.Job).all()
    contacts = db.query(models.Contact).all()

    job_lines = [
        f"- {j.id}: {j.title} @ {j.company} | status={j.status.value if hasattr(j.status, 'value') else j.status} | age_days={max((datetime.datetime.utcnow() - j.date_added).days, 0)}"
        for j in jobs[:20]
    ]
    contact_lines = [
        f"- {c.id}: {c.name} ({c.company or c.role or 'unknown'}) | status={c.status.value if hasattr(c.status, 'value') else c.status} | days_pending={max((datetime.datetime.utcnow() - c.date_request_sent).days, 0)} | followed_up={c.followed_up}"
        for c in contacts[:20]
    ]

    return "\n".join([
        "Tracked jobs:",
        *(job_lines or ["- none"]),
        "",
        "Tracked contacts:",
        *(contact_lines or ["- none"]),
    ])


def _extract_text(response: Any) -> str:
    if hasattr(response, "text") and response.text:
        return response.text.strip()

    parts: list[str] = []
    candidates = getattr(response, "candidates", []) or []
    for candidate in candidates:
        content = getattr(candidate, "content", None)
        if not content:
            continue
        for part in getattr(content, "parts", []) or []:
            text = getattr(part, "text", None)
            if text:
                parts.append(text)
    return "\n".join(parts).strip()


def _get_model():
    if genai is None:
        return None
    api_key = get_api_key()
    if not api_key:
        return None
    genai.configure(api_key=api_key)
    return genai.GenerativeModel(MODEL)


client = _get_model()


def chat(db: Session, history: list[dict], user_message: str) -> str:
    model = _get_model()
    if model is None:
        raise RuntimeError("GOOGLE_API_KEY is not configured.")

    transcript = "\n".join(f"{entry.get('role', 'user')}: {entry.get('content', '')}" for entry in history)
    prompt = f"{SYSTEM_PROMPT}\n\nTracker snapshot:\n{_tracker_snapshot(db)}\n\nConversation:\n{transcript}\n\nUser: {user_message}"
    response = model.generate_content(prompt)
    return _extract_text(response)
