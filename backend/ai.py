"""
AI Module - Using Google Gemini for meeting summarization
"""

import os
import json
import time
import logging
from typing import Optional, Dict, Any
from dotenv import load_dotenv

# Load environment variables FIRST before reading API key
load_dotenv()

from google import genai
from google.genai import types
from google.genai.exceptions import GoogleGenerativeAIError

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Load API key from environment
API_KEY = os.getenv("GEMINI_API_KEY")
client = None

# Validate API key and initialize client
if API_KEY:
    try:
        client = genai.Client(api_key=API_KEY)
        logger.info(f"Gemini client initialized successfully with API key: {API_KEY[:10]}...")
    except Exception as e:
        logger.error(f"Failed to initialize Gemini client: {e}")
        client = None
else:
    logger.error("GEMINI_API_KEY not found in environment")

MAX_RETRIES = 3
RETRY_DELAY = 2  # seconds


def generate_meeting_summary(transcript: Optional[str] = None, file_path: Optional[str] = None) -> Dict[str, Any]:
    """
    Generates a structured meeting summary using Google Gemini.
    Can process both audio files and text transcripts.
    
    Args:
        transcript: Meeting transcript text (optional)
        file_path: Path to audio file (optional)
    
    Returns:
        dict: Structured meeting summary with summary, key_points, decisions, action_items, agenda
    """
    logger.info("[AI] generate_meeting_summary called")
    logger.info(f"[AI] transcript provided: {transcript is not None}")
    logger.info(f"[AI] file_path provided: {file_path is not None}")
    logger.info(f"[AI] Client status: {'Initialized' if client else 'Not initialized'}")
    
    # Validate client initialization
    if not client:
        logger.error("[AI] Gemini client not initialized. Cannot proceed with AI operations.")
        return _get_mock_data(error="Gemini client not initialized. Check API key configuration.")
    
    # Define the prompt for structured output
    prompt = """
    Analyze this meeting and provide a comprehensive structured summary.
    
    Please extract and return the following information in valid JSON format:
    
    1. summary: A concise 2-3 sentence overview of the entire meeting
    2. key_points: List of 3-5 main discussion points or important information shared
    3. decisions: List of decisions made during the meeting
    4. action_items: List of tasks with owners and status (always set status to "Pending")
    5. agenda: List of topics or agenda items discussed
    
    Return ONLY valid JSON in this exact structure:
    {
        "summary": "Brief overview of what was discussed",
        "key_points": ["Point 1", "Point 2", "Point 3"],
        "decisions": ["Decision 1", "Decision 2"],
        "action_items": [
            {"task": "Task description", "owner": "Person Name", "status": "Pending"}
        ],
        "agenda": ["Topic 1", "Topic 2", "Topic 3"]
    }
    """
    
    # Retry logic for failed operations
    for attempt in range(MAX_RETRIES):
        try:
            if file_path and os.path.exists(file_path):
                # Process audio file
                logger.info(f"[AI] Uploading audio file: {file_path}")
                
                # Upload file to Gemini
                try:
                    myfile = client.files.upload(file=file_path)
                    logger.info("[AI] File uploaded successfully")
                except GoogleGenerativeAIError as e:
                    logger.error(f"[AI] File upload failed: {e}")
                    if attempt < MAX_RETRIES - 1:
                        logger.info(f"[AI] Retrying file upload... (Attempt {attempt + 1}/{MAX_RETRIES})")
                        time.sleep(RETRY_DELAY)
                        continue
                    else:
                        return _get_mock_data(error=f"File upload failed: {str(e)}")
                
                # Generate content with audio
                try:
                    response = client.models.generate_content(
                        model="gemini-3-flash-preview",
                        contents=[prompt, myfile],
                        config=types.GenerateContentConfig(
                            response_mime_type="application/json"
                        )
                    )
                    logger.info("[AI] Content generation successful")
                except GoogleGenerativeAIError as e:
                    logger.error(f"[AI] Content generation failed: {e}")
                    if attempt < MAX_RETRIES - 1:
                        logger.info(f"[AI] Retrying content generation... (Attempt {attempt + 1}/{MAX_RETRIES})")
                        time.sleep(RETRY_DELAY)
                        continue
                    else:
                        return _get_mock_data(error=f"Content generation failed: {str(e)}")
                
            elif transcript:
                # Process text transcript
                logger.info("[AI] Processing transcript...")
                
                full_prompt = f"{prompt}\n\nMeeting Transcript:\n{transcript}"
                
                try:
                    response = client.models.generate_content(
                        model="gemini-3-flash-preview",
                        contents=[full_prompt],
                        config=types.GenerateContentConfig(
                            response_mime_type="application/json"
                        )
                    )
                    logger.info("[AI] Content generation successful")
                except GoogleGenerativeAIError as e:
                    logger.error(f"[AI] Content generation failed: {e}")
                    if attempt < MAX_RETRIES - 1:
                        logger.info(f"[AI] Retrying content generation... (Attempt {attempt + 1}/{MAX_RETRIES})")
                        time.sleep(RETRY_DELAY)
                        continue
                    else:
                        return _get_mock_data(error=f"Content generation failed: {str(e)}")
            else:
                # No content provided
                logger.warning("[AI] No content provided for analysis")
                return _get_mock_data(error="No content provided for analysis.")
            
            # Parse JSON response
            try:
                result = json.loads(response.text)
                logger.info(f"[AI] Raw result type: {type(result)}")
                logger.info("[AI] Successfully generated summary")
                
                # Check if result is a list and extract the first element
                if isinstance(result, list) and len(result) > 0:
                    result = result[0]
                    logger.info("[AI] Extracted first element from list")
                
                return result
            except json.JSONDecodeError as e:
                logger.error(f"[AI] JSON parse error: {e}")
                logger.error(f"[AI] Raw response: {response.text}")
                return _get_mock_data(error=f"Failed to parse response: {str(e)}")
                
        except Exception as e:
            logger.error(f"[AI] Unexpected error: {e}")
            if attempt < MAX_RETRIES - 1:
                logger.info(f"[AI] Retrying operation... (Attempt {attempt + 1}/{MAX_RETRIES})")
                time.sleep(RETRY_DELAY)
            else:
                logger.error("[AI] All retry attempts failed")
                return _get_mock_data(error=f"Unexpected error: {str(e)}")
    
    # Should never reach here, but just in case
    return _get_mock_data(error="Unknown error occurred during AI processing")


def _get_mock_data(error=None):
    """
    Returns mock data when API is unavailable or errors occur.
    """
    summary_text = "AI generation failed. This is a mock summary."
    if error:
        summary_text += f" (Error: {error})"
    
    return {
        "summary": summary_text,
        "key_points": [
            "Mock Point 1: Unable to process meeting content",
            "Mock Point 2: Please check API configuration",
            "Mock Point 3: Ensure audio file or transcript is valid"
        ],
        "decisions": [
            "Mock Decision: Review API key and try again"
        ],
        "action_items": [
            {
                "task": "Check Gemini API Key configuration",
                "owner": "Developer",
                "status": "Pending"
            },
            {
                "task": "Verify audio file format (MP3, WAV, MP4 supported)",
                "owner": "Developer",
                "status": "Pending"
            }
        ],
        "agenda": [
            "Topic A: API Configuration",
            "Topic B: File Format Verification"
        ]
    }