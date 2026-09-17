import datetime
from typing import Optional
from pydantic import BaseModel


class JobCreate(BaseModel):
    title: str
    company: str
    url: str
    platform: str = "other"
    location: Optional[str] = None
    date_applied: Optional[datetime.datetime] = None
    description_snippet: Optional[str] = None


class JobUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None
    date_applied: Optional[datetime.datetime] = None


class JobOut(BaseModel):
    id: int
    title: str
    company: str
    url: str
    platform: str
    location: Optional[str]
    status: str
    date_added: datetime.datetime
    date_applied: Optional[datetime.datetime]
    last_updated: datetime.datetime
    notes: Optional[str]
    description_snippet: Optional[str]
    age_days: int

    class Config:
        from_attributes = True


class DocumentCreate(BaseModel):
    title: str
    document_type: str = "resume"
    file_name: Optional[str] = None
    url: Optional[str] = None
    notes: Optional[str] = None


class DocumentUpdate(BaseModel):
    title: Optional[str] = None
    document_type: Optional[str] = None
    file_name: Optional[str] = None
    url: Optional[str] = None
    notes: Optional[str] = None


class DocumentOut(BaseModel):
    id: int
    title: str
    document_type: str
    file_name: Optional[str]
    url: Optional[str]
    notes: Optional[str]
    date_added: datetime.datetime

    class Config:
        from_attributes = True


class ContactCreate(BaseModel):
    name: str
    linkedin_url: Optional[str] = None
    company: Optional[str] = None
    role: Optional[str] = None
    follow_up_after_days: int = 10
    notes: Optional[str] = None


class ContactUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None
    followed_up: Optional[bool] = None


class ContactOut(BaseModel):
    id: int
    name: str
    linkedin_url: Optional[str]
    company: Optional[str]
    role: Optional[str]
    status: str
    date_request_sent: datetime.datetime
    date_accepted: Optional[datetime.datetime]
    follow_up_after_days: int
    followed_up: bool
    notes: Optional[str]
    days_pending: int
    needs_follow_up: bool

    class Config:
        from_attributes = True


class ChatIn(BaseModel):
    message: str


class ChatOut(BaseModel):
    reply: str