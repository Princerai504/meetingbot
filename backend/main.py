from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List, Optional
import shutil
import os
import json
from datetime import datetime
from . import models, schemas, database

from fastapi.middleware.cors import CORSMiddleware

models.Base.metadata.create_all(bind=database.engine)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dependency
def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Directory for uploaded files
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@app.post("/meeting/create", response_model=schemas.Meeting)
async def create_meeting(
    title: str = Form(...),
    type: str = Form(...),
    transcript: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db)
):
    file_path = None
    if file:
        file_path = os.path.join(UPLOAD_DIR, file.filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

    # Generate AI Output
    from .ai import generate_meeting_summary
    
    # Check if we have content to process
    if not transcript and not file_path:
        # Fallback if nothing provided
        ai_output = {
            "summary": "No content provided for analysis.",
            "key_points": [],
            "decisions": [],
            "action_items": [],
            "agenda": []
        }
    else:
        # call Gemini
        ai_output = generate_meeting_summary(transcript=transcript, file_path=file_path)

    db_meeting = models.Meeting(
        title=title,
        type=type,
        transcript=transcript,
        file_path=file_path,
        ai_output=ai_output,
        timestamp=datetime.utcnow()
    )
    db.add(db_meeting)
    db.commit()
    db.refresh(db_meeting)
    return db_meeting

@app.get("/meetings", response_model=List[schemas.Meeting])
def read_meetings(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    meetings = db.query(models.Meeting).offset(skip).limit(limit).all()
    return meetings

@app.get("/meetings/{meeting_id}", response_model=schemas.Meeting)
def read_meeting(meeting_id: int, db: Session = Depends(get_db)):
    db_meeting = db.query(models.Meeting).filter(models.Meeting.id == meeting_id).first()
    if db_meeting is None:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return db_meeting

@app.delete("/meetings/{meeting_id}")
def delete_meeting(meeting_id: int, db: Session = Depends(get_db)):
    db_meeting = db.query(models.Meeting).filter(models.Meeting.id == meeting_id).first()
    if db_meeting is None:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    # Optional: Delete associated file
    if db_meeting.file_path and os.path.exists(db_meeting.file_path):
        os.remove(db_meeting.file_path)

    db.delete(db_meeting)
    db.commit()
    return {"ok": True}
