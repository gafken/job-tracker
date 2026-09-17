from sqlalchemy.orm import Session

from Backend.database import models


class DocumentService:
    def __init__(self, db: Session):
        self.db = db

    def list_documents(self):
        return self.db.query(models.Document).order_by(models.Document.date_added.desc()).all()

    def create_document(self, payload: dict):
        db_document = models.Document(**payload)
        self.db.add(db_document)
        self.db.commit()
        self.db.refresh(db_document)
        return db_document

    def update_document(self, document_id: int, payload: dict):
        document = self.db.query(models.Document).filter(models.Document.id == document_id).first()
        if not document:
            return None

        for field, value in payload.items():
            setattr(document, field, value)

        self.db.commit()
        self.db.refresh(document)
        return document

    def delete_document(self, document_id: int):
        document = self.db.query(models.Document).filter(models.Document.id == document_id).first()
        if not document:
            return None
        self.db.delete(document)
        self.db.commit()
        return document
