from openai import OpenAI
import os
from dotenv import load_dotenv
import json
import typing_extensions as typing

# Load environment variables from .env file
load_dotenv()

API_KEY = os.getenv("OPENAI_API_KEY")
CLIENT = None

if API_KEY:
    CLIENT = OpenAI(api_key=API_KEY)

def generate_meeting_summary(transcript: str = None, file_path: str = None) -> dict:
    """
    Generates a structured meeting summary using OpenAI (GPT-4o).
    If a file path is provided, it first transcribes the audio using Whisper-1.
    """
    if not CLIENT:
        print("Warning: OPENAI_API_KEY not found. Returning mock data.")
        return _get_mock_data()

    try:
        # Step 1: Transcribe if file is provided and no transcript
        current_transcript = transcript
        if not current_transcript and file_path and os.path.exists(file_path):
            try:
                with open(file_path, "rb") as audio_file:
                    transcription = CLIENT.audio.transcriptions.create(
                        model="whisper-1",
                        file=audio_file
                    )
                    current_transcript = transcription.text
            except Exception as e:
                print(f"Transcription failed: {e}")
                # Fallback or return partial error
                return _get_mock_data(error=f"Transcription failed: {str(e)}")

        if not current_transcript:
             return _get_mock_data(error="No content to analyze.")

        # Step 2: Generate Summary
        system_prompt = """
        You are an expert meeting assistant. Analyze the provided meeting content and extract the following structured information:
        1. A concise summary of the meeting.
        2. Key points discussed.
        3. Decisions made.
        4. Action items with owners, status (default to Pending), and due dates if mentioned.
        5. The agenda or topic breakdown.
        
        Output must be strictly valid JSON matching this schema:
        {
            "summary": "string",
            "key_points": ["string"],
            "decisions": ["string"],
            "action_items": [{"task": "string", "owner": "string", "status": "string", "due_date": "string"}],
            "agenda": ["string"]
        }
        """

        response = CLIENT.chat.completions.create(
            model="gpt-4o",  # Using GPT-4o for best structured output
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Here is the meeting transcript:\n\n{current_transcript}"}
            ],
            response_format={"type": "json_object"},
            temperature=0.2
        )
        
        content = response.choices[0].message.content
        return json.loads(content)

    except Exception as e:
        print(f"Error generating summary: {e}")
        return _get_mock_data(error=str(e))

def _get_mock_data(error=None):
    summary_text = "AI generation failed. This is a mock summary."
    if error:
        summary_text += f" (Error: {error})"
        
    return {
        "summary": summary_text,
        "key_points": ["Mock Point 1", "Mock Point 2"],
        "decisions": ["Mock Decision 1"],
        "action_items": [
            {"task": "Check API Key", "owner": "Developer", "status": "Pending", "due_date": "ASAP"}
        ],
        "agenda": ["Topic A", "Topic B"]
    }
