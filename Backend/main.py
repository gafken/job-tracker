import datetime
import os
from typing import List

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

import Backend.models as models
import Backend.schemas as schemas
import Backend.claude_agent as claude_agent
from Backend.database import engine, get_db, Base

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Job Tracker")

# Allow the browser extension (runs from an extension origin) to call the API,
# and allow the local dashboard to call it too.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten this if you deploy beyond localhost
    allow_methods=["*"],
    allow_headers=["*"],
)


def job_out(j: models.Job) -> dict:
    age = (datetime.datetime.utcnow() - j.date_added).days
    d = {c.name: getattr(j, c.name) for c in j.__table__.columns}
    d["platform"] = j.platform.value if hasattr(j.platform, "value") else j.platform
    d["status"] = j.status.value if hasattr(j.status, "value") else j.status
    d["age_days"] = age
    return d


def contact_out(c: models.Contact) -> dict:
    days_pending = (datetime.datetime.utcnow() - c.date_request_sent).days
    needs_follow_up = (
        c.status == models.ConnectionStatus.pending
        and not c.followed_up
        and days_pending >= c.follow_up_after_days
    )
    d = {col.name: getattr(c, col.name) for col in c.__table__.columns}
    d["status"] = c.status.value if hasattr(c.status, "value") else c.status
    d["days_pending"] = days_pending
    d["needs_follow_up"] = needs_follow_up
    return d


# ---------- Jobs ----------

@app.post("/api/jobs", response_model=schemas.JobOut)
def create_job(job: schemas.JobCreate, db: Session = Depends(get_db)):
    existing = db.query(models.Job).filter(models.Job.url == job.url).first()
    if existing:
        raise HTTPException(400, "Job with this URL is already tracked")
    db_job = models.Job(**job.model_dump())
    db.add(db_job)
    db.commit()
    db.refresh(db_job)
    return job_out(db_job)


@app.get("/api/jobs", response_model=List[schemas.JobOut])
def list_jobs(db: Session = Depends(get_db)):
    jobs = db.query(models.Job).order_by(models.Job.date_added.desc()).all()
    return [job_out(j) for j in jobs]


@app.patch("/api/jobs/{job_id}", response_model=schemas.JobOut)
def update_job(job_id: int, patch: schemas.JobUpdate, db: Session = Depends(get_db)):
    job = db.query(models.Job).filter(models.Job.id == job_id).first()
    if not job:
        raise HTTPException(404, "Job not found")
    for field, value in patch.model_dump(exclude_unset=True).items():
        setattr(job, field, value)
    job.last_updated = datetime.datetime.utcnow()
    db.commit()
    db.refresh(job)
    return job_out(job)


@app.delete("/api/jobs/{job_id}")
def delete_job(job_id: int, db: Session = Depends(get_db)):
    job = db.query(models.Job).filter(models.Job.id == job_id).first()
    if not job:
        raise HTTPException(404, "Job not found")
    db.delete(job)
    db.commit()
    return {"deleted": job_id}


# ---------- Contacts ----------

@app.post("/api/contacts", response_model=schemas.ContactOut)
def create_contact(contact: schemas.ContactCreate, db: Session = Depends(get_db)):
    db_contact = models.Contact(**contact.model_dump())
    db.add(db_contact)
    db.commit()
    db.refresh(db_contact)
    return contact_out(db_contact)


@app.get("/api/contacts", response_model=List[schemas.ContactOut])
def list_contacts(db: Session = Depends(get_db)):
    contacts = db.query(models.Contact).order_by(models.Contact.date_request_sent.desc()).all()
    return [contact_out(c) for c in contacts]


@app.patch("/api/contacts/{contact_id}", response_model=schemas.ContactOut)
def update_contact(contact_id: int, patch: schemas.ContactUpdate, db: Session = Depends(get_db)):
    contact = db.query(models.Contact).filter(models.Contact.id == contact_id).first()
    if not contact:
        raise HTTPException(404, "Contact not found")
    updates = patch.model_dump(exclude_unset=True)
    if updates.get("status") == "accepted" and contact.status != models.ConnectionStatus.accepted:
        contact.date_accepted = datetime.datetime.utcnow()
    for field, value in updates.items():
        setattr(contact, field, value)
    db.commit()
    db.refresh(contact)
    return contact_out(contact)


@app.delete("/api/contacts/{contact_id}")
def delete_contact(contact_id: int, db: Session = Depends(get_db)):
    contact = db.query(models.Contact).filter(models.Contact.id == contact_id).first()
    if not contact:
        raise HTTPException(404, "Contact not found")
    db.delete(contact)
    db.commit()
    return {"deleted": contact_id}


# ---------- Chat ----------

@app.post("/api/chat", response_model=schemas.ChatOut)
def chat(chat_in: schemas.ChatIn, db: Session = Depends(get_db)):
    history_rows = (
        db.query(models.ChatMessage).order_by(models.ChatMessage.timestamp.asc()).limit(40).all()
    )
    history = [{"role": r.role, "content": r.content} for r in history_rows]

    reply = claude_agent.chat(db, history, chat_in.message)

    db.add(models.ChatMessage(role="user", content=chat_in.message))
    db.add(models.ChatMessage(role="assistant", content=reply))
    db.commit()

    return {"reply": reply}


@app.get("/api/chat/history")
def chat_history(db: Session = Depends(get_db)):
    rows = db.query(models.ChatMessage).order_by(models.ChatMessage.timestamp.asc()).all()
    return [{"role": r.role, "content": r.content, "timestamp": r.timestamp.isoformat()} for r in rows]


@app.get("/api/chat/status")
def chat_status():
    raw = (os.environ.get("ANTHROPIC_API_KEY") or "").strip()
    sentinel = "your-claude-key-here"
    key_present = bool(raw) and raw.lower() != sentinel.lower()
    return {"configured": key_present}


# ---------- Frontend ----------

FRONTEND_DIR = "/app/Frontend"

app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")


@app.get("/")
def serve_dashboard():
    return FileResponse(f"{FRONTEND_DIR}/index.html")