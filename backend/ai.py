"""
AI Module - Google Gemini meeting summarization.
Uses inline bytes for audio (no Files API polling needed).
"""

import os
import json
import time
import logging
from typing import Optional, Dict, Any
from dotenv import load_dotenv

# Load environment variables
backend_dir = os.path.dirname(os.path.abspath(__file__))
env_path = os.path.join(backend_dir, '.env')
load_dotenv(dotenv_path=env_path, override=True)

from google import genai
from google.genai import types

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

API_KEY = os.getenv("GEMINI_API_KEY")
client = None

if API_KEY:
    try:
        client = genai.Client(api_key=API_KEY)
        logger.info(f"Gemini client initialized with key: {API_KEY[:10]}...")
    except Exception as e:
        logger.error(f"Failed to initialize Gemini client: {e}")
else:
    logger.error("GEMINI_API_KEY not found in environment")

MAX_RETRIES = 3
RETRY_DELAY = 3

SUMMARY_PROMPT = """
Analyze this meeting and provide a comprehensive structured summary.

Return ONLY valid JSON in this exact structure:
{
    "summary": "Brief 2-3 sentence overview of the meeting",
    "key_points": ["Point 1", "Point 2", "Point 3"],
    "decisions": ["Decision 1", "Decision 2"],
    "action_items": [
        {"task": "Task description", "owner": "Person Name", "status": "Pending"}
    ],
    "agenda": ["Topic 1", "Topic 2", "Topic 3"]
}
"""

# Map file extensions to MIME types
MIME_TYPES = {
    '.webm': 'audio/webm',
    '.mp3': 'audio/mpeg',
    '.mp4': 'audio/mp4',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.m4a': 'audio/mp4',
    '.flac': 'audio/flac',
}


def generate_meeting_summary(transcript: Optional[str] = None, file_path: Optional[str] = None) -> Dict[str, Any]:
    """
    Generate structured meeting summary using Gemini.
    Audio files are sent as inline bytes (no Files API).
    """
    logger.info(f"[AI] generate_meeting_summary called | transcript={transcript is not None} | file={file_path}")

    if not client:
        return _get_mock_data(error="Gemini client not initialized. Check API key.")

    for attempt in range(MAX_RETRIES):
        try:
            if file_path and os.path.exists(file_path):
                return _process_audio_file(file_path)
            elif transcript:
                return _process_transcript(transcript)
            else:
                return _get_mock_data(error="No content provided for analysis.")
        except Exception as e:
            logger.error(f"[AI] Error (attempt {attempt + 1}/{MAX_RETRIES}): {e}")
            if attempt < MAX_RETRIES - 1:
                time.sleep(RETRY_DELAY)
            else:
                return _get_mock_data(error=str(e))

    return _get_mock_data(error="Unknown error")


def _process_audio_file(file_path: str) -> Dict[str, Any]:
    """Read audio file as bytes and send inline to Gemini."""
    file_size_mb = os.path.getsize(file_path) / (1024 * 1024)
    ext = os.path.splitext(file_path)[1].lower()
    mime_type = MIME_TYPES.get(ext, 'audio/webm')

    logger.info(f"[AI] Processing audio: {file_path} ({file_size_mb:.1f}MB, {mime_type})")

    # Read the file as bytes
    with open(file_path, 'rb') as f:
        audio_bytes = f.read()

    logger.info(f"[AI] Read {len(audio_bytes)} bytes, sending inline to Gemini...")

    # Send as inline bytes — no file upload, no polling
    response = client.models.generate_content(
        model="gemini-3-flash-preview",
        contents=[
            SUMMARY_PROMPT,
            types.Part.from_bytes(data=audio_bytes, mime_type=mime_type)
        ],
        config=types.GenerateContentConfig(
            response_mime_type="application/json"
        )
    )

    logger.info("[AI] Content generation successful")
    return _parse_response(response)


def _process_transcript(transcript: str) -> Dict[str, Any]:
    """Send transcript text to Gemini."""
    logger.info("[AI] Processing transcript...")

    response = client.models.generate_content(
        model="gemini-3-flash-preview",
        contents=[f"{SUMMARY_PROMPT}\n\nMeeting Transcript:\n{transcript}"],
        config=types.GenerateContentConfig(
            response_mime_type="application/json"
        )
    )

    logger.info("[AI] Content generation successful")
    return _parse_response(response)


def _parse_response(response) -> Dict[str, Any]:
    """Parse JSON from Gemini response."""
    try:
        result = json.loads(response.text)
        if isinstance(result, list) and len(result) > 0:
            result = result[0]
        logger.info("[AI] Successfully parsed response")
        return result
    except json.JSONDecodeError as e:
        logger.error(f"[AI] JSON parse error: {e}")
        logger.error(f"[AI] Raw response: {response.text[:500]}")
        return _get_mock_data(error=f"Failed to parse AI response: {e}")


def _get_mock_data(error=None):
    """Fallback data when AI processing fails."""
    summary = "AI generation failed."
    if error:
        summary += f" Error: {error}"

    return {
        "summary": summary,
        "key_points": ["Unable to process meeting content", "Check API configuration", "Ensure audio file is valid"],
        "decisions": ["Review API key and try again"],
        "action_items": [
            {"task": "Check Gemini API Key", "owner": "Developer", "status": "Pending"},
            {"task": "Verify audio format", "owner": "Developer", "status": "Pending"}
        ],
        "agenda": ["API Configuration", "File Format"]
    }