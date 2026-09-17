from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import Backend.database.models as models
import Backend.database.schemas as schemas
from Backend.database.database import get_db
from Backend.services.documents import DocumentService

router = APIRouter(prefix="/api", tags=["documents"])


def document_out(doc: models.Document) -> dict:
    d = {c.name: getattr(doc, c.name) for c in doc.__table__.columns}
    d["document_type"] = doc.document_type.value if hasattr(doc.document_type, "value") else doc.document_type
    return d


@router.post("/documents", response_model=schemas.DocumentOut)
def create_document(document: schemas.DocumentCreate, db: Session = Depends(get_db)):
    service = DocumentService(db)
    db_document = service.create_document(document.model_dump())
    return document_out(db_document)


@router.get("/documents")
def list_documents(db: Session = Depends(get_db)):
    service = DocumentService(db)
    return [document_out(doc) for doc in service.list_documents()]


@router.patch("/documents/{document_id}", response_model=schemas.DocumentOut)
def update_document(document_id: int, patch: schemas.DocumentUpdate, db: Session = Depends(get_db)):
    service = DocumentService(db)
    document = service.update_document(document_id, patch.model_dump(exclude_unset=True))
    if not document:
        raise HTTPException(404, "Document not found")
    return document_out(document)


@router.delete("/documents/{document_id}")
def delete_document(document_id: int, db: Session = Depends(get_db)):
    service = DocumentService(db)
    document = service.delete_document(document_id)
    if not document:
        raise HTTPException(404, "Document not found")
    return {"deleted": document_id}
