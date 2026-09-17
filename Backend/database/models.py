import datetime
import enum

from sqlalchemy import Column, Integer, String, DateTime, Text, Enum, Boolean
from Backend.database.database import Base


class Platform(str, enum.Enum):
    linkedin = "linkedin"
    indeed = "indeed"
    dice = "dice"
    wellfound = "wellfound"
    other = "other"


class JobStatus(str, enum.Enum):
    saved = "saved"
    applied = "applied"
    interviewing = "interviewing"
    offer = "offer"
    rejected = "rejected"
    ghosted = "ghosted"  # no response after a while - set manually or inferred by age
    withdrawn = "withdrawn"


class ConnectionStatus(str, enum.Enum):
    pending = "pending"
    accepted = "accepted"
    ignored = "ignored"  # you marked it as not going to happen


class DocumentType(str, enum.Enum):
    resume = "resume"
    recommendation_letter = "recommendation_letter"
    certificate = "certificate"
    other = "other"


class Job(Base):
    __tablename__ = "jobs"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    company = Column(String, nullable=False)
    url = Column(String, nullable=False, unique=True)
    platform = Column(Enum(Platform), default=Platform.other)
    location = Column(String, nullable=True)
    status = Column(Enum(JobStatus), default=JobStatus.saved)
    date_added = Column(DateTime, default=datetime.datetime.utcnow)
    date_applied = Column(DateTime, nullable=True)
    last_updated = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    notes = Column(Text, nullable=True)
    description_snippet = Column(Text, nullable=True)


class Contact(Base):
    __tablename__ = "contacts"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    linkedin_url = Column(String, nullable=True)
    company = Column(String, nullable=True)
    role = Column(String, nullable=True)
    status = Column(Enum(ConnectionStatus), default=ConnectionStatus.pending)
    date_request_sent = Column(DateTime, default=datetime.datetime.utcnow)
    date_accepted = Column(DateTime, nullable=True)
    follow_up_after_days = Column(Integer, default=10)
    followed_up = Column(Boolean, default=False)
    notes = Column(Text, nullable=True)


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    document_type = Column(Enum(DocumentType), default=DocumentType.resume)
    file_name = Column(String, nullable=True)
    url = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    date_added = Column(DateTime, default=datetime.datetime.utcnow)


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    role = Column(String, nullable=False)  # "user" or "assistant"
    content = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)