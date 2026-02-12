import sys
import os

# Add backend directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import Column, Integer, String, DateTime, Text, JSON, Enum
from database import Base
from datetime import datetime
import enum

class MeetingSource(str, enum.Enum):
    UPLOAD = "upload"
    BOT = "bot"

class MeetingStatus(str, enum.Enum):
    PENDING = "pending"
    RECORDING = "recording"
    PROCESSING = "processing"
    COMPLETED = "completed"
    ERROR = "error"

class Meeting(Base):
    __tablename__ = "meetings"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    type = Column(String)
    timestamp = Column(DateTime, default=datetime.utcnow)
    transcript = Column(Text, nullable=True)
    ai_output = Column(JSON, nullable=True)
    file_path = Column(String, nullable=True)
    
    # Bot-related fields
    source = Column(String, default=MeetingSource.UPLOAD)
    meet_url = Column(String, nullable=True)
    status = Column(String, default=MeetingStatus.PENDING)
    bot_session_id = Column(String, nullable=True)
    scheduled_time = Column(DateTime, nullable=True)
