"""
AI Module - Using Google Gemini for meeting summarization
"""

import os
import json
from google import genai
from google.genai import types
from dotenv import load_dotenv

# Load API key from environment
API_KEY = os.getenv("GEMINI_API_KEY")
client = None

if API_KEY:
    client = genai.Client(api_key=API_KEY)
    print(f"[AI] Gemini client initialized successfully")
else:
    print("[AI] WARNING: GEMINI_API_KEY not found in environment")


def generate_meeting_summary(transcript: str = None, file_path: str = None) -> dict:
    """
    Generates a structured meeting summary using Google Gemini.
    Can process both audio files and text transcripts.
    
    Args:
        transcript: Meeting transcript text (optional)
        file_path: Path to audio file (optional)
    
    Returns:
        dict: Structured meeting summary with summary, key_points, decisions, action_items, agenda
    """
    print(f"[AI] generate_meeting_summary called")
    print(f"[AI] transcript provided: {transcript is not None}")
    print(f"[AI] file_path provided: {file_path is not None}")
    print(f"[AI] Client status: {'Initialized' if client else 'Not initialized'}")
    
    try:
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
        
        if file_path and os.path.exists(file_path):
            # Process audio file
            print(f"[Gemini] Uploading audio file: {file_path}")
            
            # Upload file to Gemini
            myfile = client.files.upload(file=file_path)
            print(f"[Gemini] File uploaded successfully")
            
            # Generate content with audio
            response = client.models.generate_content(
                model="gemini-3-flash-preview",
                contents=[prompt, myfile],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json"
                )
            )
            
        elif transcript:
            # Process text transcript
            print("[Gemini] Processing transcript...")
            
            full_prompt = f"{prompt}\n\nMeeting Transcript:\n{transcript}"
            
            response = client.models.generate_content(
                model="gemini-3-flash-preview",
                contents=[full_prompt],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json"
                )
            )
        else:
            # No content provided
            return _get_mock_data(error="No content provided for analysis.")
        
        # Parse JSON response
        try:
            result = json.loads(response.text)
            print(f"[Gemini] Raw result type: {type(result)}")
            print(f"[Gemini] Raw result: {result}")
            
            # Check if result is a list and extract the first element
            if isinstance(result, list) and len(result) > 0:
                result = result[0]
                print("[Gemini] Extracted first element from list")
            
            print("[Gemini] Successfully generated summary")
            return result
        except json.JSONDecodeError as e:
            print(f"[Gemini] JSON parse error: {e}")
            print(f"[Gemini] Raw response: {response.text}")
            return _get_mock_data(error=f"Failed to parse response: {str(e)}")
            
    except Exception as e:
        print(f"[Gemini] Error generating summary: {e}")
        return _get_mock_data(error=str(e))


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