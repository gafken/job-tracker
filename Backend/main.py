import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from Backend.database.database import Base, engine
from Backend.routes import chat as chat_routes
from Backend.routes import contacts as contacts_routes
from Backend.routes import documents as documents_routes
from Backend.routes import jobs as jobs_routes

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Job Tracker")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(jobs_routes.router)
app.include_router(contacts_routes.router)
app.include_router(documents_routes.router)
app.include_router(chat_routes.router)

FRONTEND_DIR = "/app/Frontend"
app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")


@app.get("/")
def serve_dashboard():
    return FileResponse(f"{FRONTEND_DIR}/index.html")