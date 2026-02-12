# Meeting AI Recorder - Extension Documentation

## Overview
**Transformation**: Converting from a web application to a Chrome/Brave browser extension

**Purpose**: Allow users already in Google Meet meetings to record audio and generate AI-powered meeting summaries

---

## Architecture

### Current (Web App)
```
React Frontend → FastAPI Backend → Google Gemini AI
     ↓                ↓                  ↓
File Upload    Save & Process      Return Summary
```

### New (Browser Extension)
```
User in Google Meet
       ↓
Extension Popup (Start/Stop)
       ↓
Background Script (Audio Recording)
       ↓
FastAPI Backend (AI Processing)
       ↓
Google Gemini API
       ↓
Display Summary in Extension
```

---

## Audio-to-Summary Logic

### Flow Diagram
```
┌─────────────────────────────────────────────────────────────┐
│ 1. USER UPLOADS AUDIO / RECORDS FROM MEET                   │
└──────────────────┬──────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. FRONTEND/EXTENSION SENDS TO BACKEND                      │
│    Endpoint: POST /meeting/create                           │
│    Content-Type: multipart/form-data                        │
│    Fields:                                                  │
│      - file: audio_blob (webm/mp3/wav)                     │
│      - title: "Meeting Title"                              │
│      - type: "google_meet"                                 │
└──────────────────┬──────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. BACKEND SAVES FILE                                       │
│    Location: uploads/meeting-recording-{timestamp}.webm    │
│    Max Size: 100MB (configurable)                          │
└──────────────────┬──────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. AI PROCESSING (Google Gemini)                            │
│    SDK: google-genai v1.47.0                               │
│    Model: gemini-3-flash-preview                           │
│    Process:                                                 │
│      a. Upload file to Gemini API                          │
│      b. Send prompt with audio                             │
│      c. Gemini transcribes audio                           │
│      d. Gemini generates structured summary                │
└──────────────────┬──────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. RETURN STRUCTURED JSON                                   │
│    {                                                        │
│      "summary": "Brief overview...",                       │
│      "key_points": ["Point 1", "Point 2", "Point 3"],      │
│      "decisions": ["Decision 1", "Decision 2"],            │
│      "action_items": [                                     │
│        {"task": "Task 1", "owner": "Name", "status": "Pending"}
│      ],                                                     │
│      "agenda": ["Topic 1", "Topic 2"]                      │
│    }                                                        │
└──────────────────┬──────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. DISPLAY TO USER                                          │
│    - Save to database                                       │
│    - Show in extension popup                                │
│    - Allow download of summary                              │
└─────────────────────────────────────────────────────────────┘
```

### Technical Implementation

#### File: `backend/ai.py`
```python
# SDK Import
from google import genai
from google.genai import types

# Initialize Client (once at startup)
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

# Process Audio Function
def generate_meeting_summary(file_path=None, transcript=None):
    prompt = """
    Analyze this meeting and provide a comprehensive structured summary.
    
    Return ONLY valid JSON with:
    1. summary: 2-3 sentence overview
    2. key_points: List of main discussion points
    3. decisions: List of decisions made
    4. action_items: Tasks with owners and status
    5. agenda: Topics discussed
    """
    
    if file_path:
        # Upload audio file to Gemini
        myfile = client.files.upload(file=file_path)
        
        # Generate content with audio
        response = client.models.generate_content(
            model="gemini-3-flash-preview",
            contents=[prompt, myfile],
            config=types.GenerateContentConfig(
                response_mime_type="application/json"
            )
        )
    
    return json.loads(response.text)
```

#### File: `backend/main.py`
```python
@app.post("/meeting/create")
async def create_meeting(
    title: str = Form(...),
    type: str = Form(...),
    file: UploadFile = File(None)
):
    # Save uploaded file
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Process with AI
    ai_output = generate_meeting_summary(file_path=file_path)
    
    # Save to database
    db_meeting = models.Meeting(
        title=title,
        type=type,
        file_path=file_path,
        ai_output=ai_output
    )
    db.add(db_meeting)
    db.commit()
    
    return db_meeting
```

---

## Requirements

### Backend Requirements (Python)
```
# Core Framework
fastapi==0.115.7
uvicorn==0.34.0

# Database
sqlalchemy==2.0.37

# AI SDK
google-genai==1.47.0

# Environment Variables
python-dotenv==1.0.1

# File Upload
python-multipart==0.0.20

# CORS
fastapi-cors==0.0.6
```

### Extension Requirements (JavaScript)
```json
{
  "manifest_version": 3,
  "permissions": [
    "tabCapture",      // For audio recording
    "activeTab",       // For current tab access
    "storage",         // For local storage
    "downloads"        // For saving files
  ],
  "host_permissions": [
    "https://meet.google.com/*",  // Google Meet access
    "http://localhost:8000/*"     // Backend API access
  ]
}
```

### System Requirements
- **OS**: macOS 10.15+ / Windows 10+ / Linux
- **Browser**: Chrome 88+ or Brave 1.20+
- **Backend**: Python 3.9+
- **API Key**: Google Gemini API Key (free tier available)

---

## SDK Information

### Google Generative AI SDK (google-genai)

**Installation:**
```bash
pip install google-genai
```

**Key Features:**
- ✅ Audio file upload and processing
- ✅ Built-in speech-to-text
- ✅ Structured JSON output
- ✅ 1 million tokens free per month

**API Key Setup:**
1. Go to https://ai.google.dev/
2. Create an API key
3. Add to `backend/.env`:
   ```
   GEMINI_API_KEY=your_api_key_here
   ```

**Model Used:**
- **Name**: `gemini-3-flash-preview`
- **Capabilities**: Audio understanding, transcription, summarization
- **Max File Size**: 20MB per file
- **Supported Formats**: MP3, WAV, MP4, WEBM, M4A

---

## Extension Components

### 1. Manifest Configuration
**File**: `extension/manifest.json`
```json
{
  "manifest_version": 3,
  "name": "Meeting AI Recorder",
  "version": "1.0.0",
  "description": "Record Google Meet audio and get AI summaries",
  
  "permissions": [
    "tabCapture",        // Core: Audio recording
    "activeTab",         // Core: Access current tab
    "storage",           // Optional: Save settings
    "downloads"          // Optional: Download recordings
  ],
  
  "host_permissions": [
    "https://meet.google.com/*",
    "http://localhost:8000/*"
  ],
  
  "background": {
    "service_worker": "background.js"
  },
  
  "content_scripts": [{
    "matches": ["https://meet.google.com/*"],
    "js": ["content.js"]
  }],
  
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  }
}
```

### 2. Background Script (Audio Recording)
**File**: `extension/background.js`
- **Purpose**: Handle audio capture and processing
- **Key APIs**: `chrome.tabCapture`, `MediaRecorder`
- **Functions**:
  - `startRecording()`: Begin audio capture
  - `stopRecording()`: Stop and create audio blob
  - `uploadToBackend()`: Send audio to API

### 3. Popup UI (User Interface)
**File**: `extension/popup.html`
- **Purpose**: Extension control panel
- **Features**:
  - Start/Stop recording buttons
  - Recording timer
  - Status indicator
  - Summary display area
  - Upload file option

### 4. Content Script (Page Detection)
**File**: `extension/content.js`
- **Purpose**: Detect Google Meet page
- **Features**:
  - Detect when user joins meeting
  - Notify background script
  - Optional: Inject UI elements

---

## Audio Recording Technical Details

### Method: Chrome tabCapture API

**How it works:**
1. User clicks "Start Recording"
2. Extension requests `chrome.tabCapture.capture()`
3. Chrome prompts user to select tab
4. User selects Google Meet tab
5. `MediaRecorder` captures audio stream
6. Audio saved in chunks
7. User clicks "Stop"
8. Chunks combined into WebM blob

**Code Example:**
```javascript
// Capture audio stream
const stream = await chrome.tabCapture.capture({
  audio: true,
  video: false
});

// Create recorder
const mediaRecorder = new MediaRecorder(stream, {
  mimeType: 'audio/webm;codecs=opus'
});

// Collect chunks
const chunks = [];
mediaRecorder.ondataavailable = (e) => {
  chunks.push(e.data);
};

// Start recording
mediaRecorder.start(1000); // 1-second chunks

// Stop and create blob
mediaRecorder.onstop = () => {
  const audioBlob = new Blob(chunks, { type: 'audio/webm' });
};
```

---

## Data Flow Summary

### Recording Flow
```
User Clicks Start
    ↓
Background: chrome.tabCapture.capture()
    ↓
Chrome: User selects Meet tab
    ↓
MediaRecorder: Start capturing
    ↓
Collect audio chunks (1-second intervals)
    ↓
User Clicks Stop
    ↓
Combine chunks → WebM Blob
    ↓
Upload to Backend API
    ↓
Gemini AI processes audio
    ↓
Return JSON summary
    ↓
Display in Extension Popup
```

### Upload Flow (Existing Feature)
```
User Selects Audio File
    ↓
Extension reads file
    ↓
Upload to /meeting/create
    ↓
Backend saves file
    ↓
Gemini AI processes
    ↓
Return summary
    ↓
Display results
```

---

## File Structure

```
meeting/
├── backend/                    # FastAPI Backend
│   ├── main.py                # API endpoints
│   ├── ai.py                  # Gemini AI integration
│   ├── models.py              # Database models
│   ├── schemas.py             # Pydantic schemas
│   ├── database.py            # DB connection
│   ├── requirements.txt       # Python dependencies
│   └── .env                   # API keys (not in git)
│
├── extension/                 # Browser Extension
│   ├── manifest.json          # Extension config
│   ├── background.js          # Service worker
│   ├── popup.html             # Popup UI
│   ├── popup.js               # Popup logic
│   ├── content.js             # Content script
│   ├── styles.css             # Extension styles
│   └── icons/                 # Extension icons
│       ├── icon16.png
│       ├── icon48.png
│       └── icon128.png
│
├── uploads/                   # Audio storage (created at runtime)
├── meetings.db               # SQLite database (created at runtime)
└── README.md                 # User documentation
```

---

## API Endpoints

### Current Endpoints (Keep)
- `POST /meeting/create` - Upload audio & generate summary
- `GET /meetings` - List all meetings
- `GET /meetings/{id}` - Get specific meeting
- `DELETE /meetings/{id}` - Delete meeting

### Removed Endpoints (Bot)
- ~~`POST /bot/join`~~ - Bot join meeting
- ~~`POST /bot/leave/{id}`~~ - Bot leave meeting
- ~~`GET /bot/status/{id}`~~ - Bot status

---

## Security & Privacy

### Data Handling
- ✅ Audio files stored locally in `uploads/` folder
- ✅ Sent to Google Gemini API for processing only
- ✅ API key stored in `.env` (not in code)
- ✅ No audio stored in cloud (unless configured)

### Permissions
- ✅ `tabCapture`: Only captures when user clicks "Start"
- ✅ User must select which tab to record
- ✅ Chrome shows recording indicator
- ✅ Can stop anytime

### Privacy Best Practices
- Delete recordings after processing (optional)
- Inform users audio is sent to Google AI
- Allow local-only processing (future feature)

---

## Testing Checklist

### Extension Testing
- [ ] Extension installs in Chrome/Brave
- [ ] Icon appears when on meet.google.com
- [ ] Clicking icon opens popup
- [ ] "Start Recording" button works
- [ ] Chrome prompts for tab selection
- [ ] Recording indicator shows
- [ ] "Stop Recording" button works
- [ ] Audio file created successfully
- [ ] Upload to backend works
- [ ] Summary displays in popup
- [ ] Meeting saved to history

### Upload Feature Testing
- [ ] Can select audio file in popup
- [ ] Upload works via extension
- [ ] AI processes file
- [ ] Summary displayed
- [ ] File appears in meeting list

### Backend Testing
- [ ] Backend starts without errors
- [ ] Can receive POST /meeting/create
- [ ] Saves files correctly
- [ ] Gemini API responds
- [ ] Returns valid JSON
- [ ] Database saves meeting

---

## Next Steps

### Phase 1: Cleanup ✅
- [x] Remove bot code
- [x] Update main.py
- [x] Remove test files
- [x] Create documentation (this file)

### Phase 2: Extension Setup
- [ ] Update manifest.json
- [ ] Create popup.html
- [ ] Create popup.js
- [ ] Add icons

### Phase 3: Audio Recording
- [ ] Implement background.js
- [ ] Add tabCapture logic
- [ ] Test audio recording
- [ ] Handle start/stop

### Phase 4: Backend Integration
- [ ] Connect extension to backend
- [ ] Upload recorded audio
- [ ] Display summary
- [ ] Save to history

### Phase 5: Polish
- [ ] Add styling
- [ ] Error handling
- [ ] Loading states
- [ ] User feedback

---

## Troubleshooting

### Common Issues

**1. Extension not detecting Meet**
- Check manifest.json host_permissions
- Reload extension in chrome://extensions

**2. Audio not recording**
- Check tabCapture permission
- Ensure user selects correct tab
- Check MediaRecorder support

**3. Backend not receiving audio**
- Check CORS settings
- Verify backend running on localhost:8000
- Check network tab for errors

**4. AI not processing**
- Check GEMINI_API_KEY in .env
- Verify file size < 20MB
- Check supported audio formats

---

## Support

For issues or questions:
1. Check this documentation
2. Review browser console for errors
3. Check backend logs
4. Verify API key is valid

---

**Document Version**: 1.0  
**Last Updated**: 2026-02-13  
**Author**: AI Assistant
