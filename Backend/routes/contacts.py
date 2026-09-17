import datetime
import math

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import Backend.database.models as models
import Backend.database.schemas as schemas
from Backend.database.database import get_db

router = APIRouter(prefix="/api", tags=["contacts"])


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


@router.post("/contacts", response_model=schemas.ContactOut)
def create_contact(contact: schemas.ContactCreate, db: Session = Depends(get_db)):
    db_contact = models.Contact(**contact.model_dump())
    db.add(db_contact)
    db.commit()
    db.refresh(db_contact)
    return contact_out(db_contact)


@router.get("/contacts")
def list_contacts(
    db: Session = Depends(get_db),
    page: int | None = None,
    page_size: int | None = None,
):
    query = db.query(models.Contact).order_by(models.Contact.date_request_sent.desc())
    if page is None and page_size is None:
        return [contact_out(c) for c in query.all()]

    page = page or 1
    page_size = page_size or 20
    page = max(1, page)
    page_size = max(1, min(page_size, 200))

    total = query.count()
    contacts = query.offset((page - 1) * page_size).limit(page_size).all()
    return {
        "items": [contact_out(c) for c in contacts],
        "page": page,
        "page_size": page_size,
        "total": total,
        "pages": max(1, math.ceil(total / page_size)) if total else 1,
    }


@router.patch("/contacts/{contact_id}", response_model=schemas.ContactOut)
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


@router.delete("/contacts/{contact_id}")
def delete_contact(contact_id: int, db: Session = Depends(get_db)):
    contact = db.query(models.Contact).filter(models.Contact.id == contact_id).first()
    if not contact:
        raise HTTPException(404, "Contact not found")
    db.delete(contact)
    db.commit()
    return {"deleted": contact_id}
