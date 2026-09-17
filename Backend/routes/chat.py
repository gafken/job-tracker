import os

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

import Backend.services.agent as agent
import Backend.database.models as models
import Backend.database.schemas as schemas
from Backend.database.database import get_db

router = APIRouter(prefix="/api", tags=["chat"])


@router.post("/chat", response_model=schemas.ChatOut)
def chat(chat_in: schemas.ChatIn, db: Session = Depends(get_db)):
    history_rows = (
        db.query(models.ChatMessage).order_by(models.ChatMessage.timestamp.asc()).limit(40).all()
    )
    history = [{"role": r.role, "content": r.content} for r in history_rows]

    reply = agent.chat(db, history, chat_in.message)

    db.add(models.ChatMessage(role="user", content=chat_in.message))
    db.add(models.ChatMessage(role="assistant", content=reply))
    db.commit()

    return {"reply": reply}


@router.get("/chat/history")
def chat_history(db: Session = Depends(get_db)):
    rows = db.query(models.ChatMessage).order_by(models.ChatMessage.timestamp.asc()).all()
    return [{"role": r.role, "content": r.content, "timestamp": r.timestamp.isoformat()} for r in rows]


@router.get("/chat/status")
def chat_status():
    raw = (os.environ.get("GOOGLE_API_KEY") or os.environ.get("ANTHROPIC_API_KEY") or "").strip()
    sentinel_values = {"your-google-key-here", "your-claude-key-here", "placeholder123"}
    key_present = bool(raw) and raw.lower() not in {value.lower() for value in sentinel_values}
    return {"configured": key_present}
