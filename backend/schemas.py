from pydantic import BaseModel
from datetime import datetime
from typing import Optional, Any

class MeetingBase(BaseModel):
    title: str
    type: str
    transcript: Optional[str] = None
    ai_output: Optional[Any] = None

class MeetingCreate(MeetingBase):
    pass

class Meeting(MeetingBase):
    id: int
    timestamp: datetime
    file_path: Optional[str] = None
    source: Optional[str] = "upload"
    meet_url: Optional[str] = None
    status: Optional[str] = "pending"
    scheduled_time: Optional[datetime] = None

    class Config:
        from_attributes = True
