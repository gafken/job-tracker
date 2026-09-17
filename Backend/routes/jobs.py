import datetime
import math

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import Backend.database.models as models
import Backend.database.schemas as schemas
from Backend.database.database import get_db

router = APIRouter(prefix="/api", tags=["jobs"])


def job_out(j: models.Job) -> dict:
    age = (datetime.datetime.utcnow() - j.date_added).days
    d = {c.name: getattr(j, c.name) for c in j.__table__.columns}
    d["platform"] = j.platform.value if hasattr(j.platform, "value") else j.platform
    d["status"] = j.status.value if hasattr(j.status, "value") else j.status
    d["age_days"] = age
    return d


@router.post("/jobs", response_model=schemas.JobOut)
def create_job(job: schemas.JobCreate, db: Session = Depends(get_db)):
    existing = db.query(models.Job).filter(models.Job.url == job.url).first()
    if existing:
        raise HTTPException(400, "Job with this URL is already tracked")
    db_job = models.Job(**job.model_dump())
    db.add(db_job)
    db.commit()
    db.refresh(db_job)
    return job_out(db_job)


@router.get("/jobs")
def list_jobs(
    db: Session = Depends(get_db),
    page: int | None = None,
    page_size: int | None = None,
):
    query = db.query(models.Job).order_by(models.Job.date_added.desc())
    if page is None and page_size is None:
        return [job_out(j) for j in query.all()]

    page = page or 1
    page_size = page_size or 20
    page = max(1, page)
    page_size = max(1, min(page_size, 200))

    total = query.count()
    jobs = query.offset((page - 1) * page_size).limit(page_size).all()
    return {
        "items": [job_out(j) for j in jobs],
        "page": page,
        "page_size": page_size,
        "total": total,
        "pages": max(1, math.ceil(total / page_size)) if total else 1,
    }


@router.patch("/jobs/{job_id}", response_model=schemas.JobOut)
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


@router.delete("/jobs/{job_id}")
def delete_job(job_id: int, db: Session = Depends(get_db)):
    job = db.query(models.Job).filter(models.Job.id == job_id).first()
    if not job:
        raise HTTPException(404, "Job not found")
    db.delete(job)
    db.commit()
    return {"deleted": job_id}
