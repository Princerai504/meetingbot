from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List, Optional
import shutil
import os
import json
from datetime import datetime
from . import models, schemas, database
from .bot.routes import router as bot_router

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

# Include bot routes
app.include_router(bot_router)

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
    print(f"\n[BACKEND] Received create_meeting request")
    print(f"[BACKEND] Title: {title}")
    print(f"[BACKEND] Type: {type}")
    print(f"[BACKEND] Has transcript: {transcript is not None}")
    print(f"[BACKEND] Has file: {file is not None}")
    
    file_path = None
    if file:
        file_path = os.path.join(UPLOAD_DIR, file.filename)
        print(f"[BACKEND] Saving file to: {file_path}")
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        print(f"[BACKEND] File saved successfully")

    # Generate AI Output
    from .ai import generate_meeting_summary
    
    # Check if we have content to process
    if not transcript and not file_path:
        print("[BACKEND] No content provided, using fallback")
        ai_output = {
            "summary": "No content provided for analysis.",
            "key_points": [],
            "decisions": [],
            "action_items": [],
            "agenda": []
        }
    else:
        print(f"[BACKEND] Calling Gemini AI...")
        try:
            ai_output = generate_meeting_summary(transcript=transcript, file_path=file_path)
            print(f"[BACKEND] AI output received: {ai_output}")
        except Exception as e:
            print(f"[BACKEND] ERROR in AI generation: {e}")
            import traceback
            traceback.print_exc()
            ai_output = {
                "summary": f"Error generating summary: {str(e)}",
                "key_points": [],
                "decisions": [],
                "action_items": [],
                "agenda": []
            }

    print(f"[BACKEND] Creating meeting record...")
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
    print(f"[BACKEND] Meeting created with ID: {db_meeting.id}")
    print(f"[BACKEND] Meeting AI output: {db_meeting.ai_output}\n")
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
