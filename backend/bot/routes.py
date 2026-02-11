"""
Bot API Routes
Endpoints for controlling the Google Meet bot
"""

from fastapi import APIRouter, HTTPException, UploadFile, File, Form, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.orm import Session
from typing import Optional
import asyncio
import os
from datetime import datetime
from pydantic import BaseModel
from .meet_bot import bot_manager
from .. import models, schemas
from ..database import SessionLocal
import aiofiles

router = APIRouter(prefix="/bot", tags=["bot"])

# Directory for bot recordings
BOT_RECORDINGS_DIR = "bot_recordings"
os.makedirs(BOT_RECORDINGS_DIR, exist_ok=True)

# Store audio chunks temporarily
audio_sessions = {}


class BotStartRequest(BaseModel):
    meet_url: str
    meeting_title: str
    meeting_type: str = "team_meeting"


class BotResponse(BaseModel):
    success: bool
    meeting_id: Optional[int] = None
    message: str
    error: Optional[str] = None


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/join", response_model=BotResponse)
async def start_bot_session(
    request: BotStartRequest,
    db: Session = Depends(get_db)
):
    """
    Start a bot session to join a Google Meet meeting
    
    - Creates a meeting record in database
    - Launches Playwright bot
    - Bot joins the meeting and starts recording
    """
    try:
        # Validate meet URL
        if not request.meet_url.startswith("https://meet.google.com/"):
            raise HTTPException(
                status_code=400, 
                detail="Invalid Google Meet URL"
            )
        
        # Create meeting record
        meeting = models.Meeting(
            title=request.meeting_title,
            type=request.meeting_type,
            source=models.MeetingSource.BOT,
            meet_url=request.meet_url,
            status=models.MeetingStatus.RECORDING,
            scheduled_time=datetime.utcnow()
        )
        db.add(meeting)
        db.commit()
        db.refresh(meeting)
        
        # Start bot in background
        await bot_manager.start_bot(
            meeting_id=meeting.id,
            meet_url=request.meet_url,
            meeting_title=request.meeting_title
        )
        
        return BotResponse(
            success=True,
            meeting_id=meeting.id,
            message="Bot started successfully and is joining the meeting"
        )
        
    except Exception as e:
        return BotResponse(
            success=False,
            message="Failed to start bot",
            error=str(e)
        )


@router.post("/leave/{meeting_id}", response_model=BotResponse)
async def stop_bot_session(
    meeting_id: int,
    db: Session = Depends(get_db)
):
    """
    Stop a bot session and process the recording
    
    - Stops the recording
    - Bot leaves the meeting
    - Transcribes audio using Whisper
    - Generates summary using GPT-4o
    """
    try:
        meeting = db.query(models.Meeting).filter(
            models.Meeting.id == meeting_id
        ).first()
        
        if not meeting:
            raise HTTPException(status_code=404, detail="Meeting not found")
        
        if meeting.source != models.MeetingSource.BOT:
            raise HTTPException(
                status_code=400, 
                detail="This is not a bot session"
            )
        
        # Stop the bot
        await bot_manager.stop_bot(meeting_id)
        
        # Update status
        meeting.status = models.MeetingStatus.PROCESSING
        db.commit()
        
        # Check if audio file exists
        audio_path = os.path.join(BOT_RECORDINGS_DIR, f"meeting_{meeting_id}.webm")
        
        if os.path.exists(audio_path):
            meeting.file_path = audio_path
            
            # Generate summary using AI
            from ..ai import generate_meeting_summary
            ai_output = generate_meeting_summary(file_path=audio_path)
            
            meeting.ai_output = ai_output
            meeting.status = models.MeetingStatus.COMPLETED
        else:
            meeting.status = models.MeetingStatus.ERROR
            meeting.ai_output = {
                "summary": "No audio was recorded. The meeting may have ended before recording started.",
                "key_points": [],
                "decisions": [],
                "action_items": [],
                "agenda": []
            }
        
        db.commit()
        
        return BotResponse(
            success=True,
            meeting_id=meeting_id,
            message="Bot stopped and summary generated"
        )
        
    except Exception as e:
        # Update error status
        meeting = db.query(models.Meeting).filter(
            models.Meeting.id == meeting_id
        ).first()
        if meeting:
            meeting.status = models.MeetingStatus.ERROR
            db.commit()
        
        return BotResponse(
            success=False,
            meeting_id=meeting_id,
            message="Failed to stop bot",
            error=str(e)
        )


@router.get("/status/{meeting_id}")
async def get_bot_status(meeting_id: int):
    """Get the current status of a bot session"""
    try:
        status = bot_manager.get_bot_status(meeting_id)
        return status
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/audio-chunk")
async def receive_audio_chunk(
    audio: UploadFile = File(...),
    session_id: str = Form(...)
):
    """
    Receive audio chunks from the Chrome extension
    Stores chunks temporarily for real-time processing
    """
    try:
        if session_id not in audio_sessions:
            audio_sessions[session_id] = []
        
        # Read and store chunk
        content = await audio.read()
        audio_sessions[session_id].append(content)
        
        return {"success": True, "chunks_received": len(audio_sessions[session_id])}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/save-audio")
async def save_final_audio(
    audio: UploadFile = File(...),
    meeting_id: int = Form(...),
    final: bool = Form(False)
):
    """
    Save the final audio file when recording stops
    """
    try:
        file_path = os.path.join(
            BOT_RECORDINGS_DIR, 
            f"meeting_{meeting_id}.webm"
        )
        
        # Append to existing file or create new
        mode = "ab" if os.path.exists(file_path) else "wb"
        
        async with aiofiles.open(file_path, mode) as f:
            content = await audio.read()
            await f.write(content)
        
        return {
            "success": True, 
            "file_path": file_path,
            "size": os.path.getsize(file_path)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.websocket("/ws/{meeting_id}")
async def websocket_endpoint(websocket: WebSocket, meeting_id: int):
    """
    WebSocket for real-time bot status updates
    """
    await websocket.accept()
    
    try:
        while True:
            # Send bot status every 2 seconds
            status = bot_manager.get_bot_status(meeting_id)
            await websocket.send_json(status)
            await asyncio.sleep(2)
            
    except WebSocketDisconnect:
        print(f"WebSocket disconnected for meeting {meeting_id}")
    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        await websocket.close()