from sqlalchemy import Column, Integer, String, DateTime, Text, JSON
from .database import Base
from datetime import datetime

class Meeting(Base):
    __tablename__ = "meetings"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    type = Column(String)
    timestamp = Column(DateTime, default=datetime.utcnow)
    transcript = Column(Text, nullable=True)
    ai_output = Column(JSON, nullable=True)
    file_path = Column(String, nullable=True)
