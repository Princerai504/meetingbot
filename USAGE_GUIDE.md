# Meeting Summarizer Bot - Complete Usage Guide

## 🎯 What This App Does

This application automatically joins Google Meet meetings, records the audio, and generates AI-powered summaries including:
- Executive Summary
- Key Discussion Points
- Decisions Made
- Action Items with Owners
- Meeting Agenda

## 🚀 How to Use This Application

### Prerequisites

1. **Install Chrome Extension (Required for Bot)**
   ```bash
   # The extension is located at:
   backend/extension/
   
   # Load it in Chrome:
   1. Open Chrome and go to: chrome://extensions/
   2. Enable "Developer mode" (toggle in top right)
   3. Click "Load unpacked"
   4. Select the folder: backend/extension/
   5. The extension should now appear in your Chrome toolbar
   ```

2. **Set Up Environment Variables**
   ```bash
   # Edit backend/.env and add your OpenAI API key:
   OPENAI_API_KEY=sk-your-api-key-here
   ```

### Starting the Application

**Terminal 1 - Backend:**
```bash
cd /Users/apple/Downloads/meeting
source backend/venv_new/bin/activate
python -m uvicorn backend.main:app --reload
```

**Terminal 2 - Frontend:**
```bash
cd /Users/apple/Downloads/meeting
npm run dev
```

**Open Browser:**
Navigate to: http://localhost:5173

---

## 📋 Usage Methods

### Method 1: Google Meet Bot (NEW FEATURE)

1. **Go to "Create New Meeting"**
2. **Fill in Meeting Details:**
   - Meeting Title (e.g., "Weekly Team Sync")
   - Meeting Type (Team Meeting, Interview, Client Call, Stand Up)
3. **Click "Google Meet Bot" Tab**
4. **Enter Google Meet URL:**
   - Copy the meeting link from Google Calendar or Meet
   - Paste it in the format: `https://meet.google.com/abc-defg-hij`
5. **Click "Join & Record Meeting"**
   - A Chrome browser window will open automatically
   - The bot joins as a guest (no Google account needed)
   - Camera and microphone are turned off
   - Recording starts automatically
6. **During the Meeting:**
   - Keep the web app open
   - The bot records audio in the background
   - A red "Recording..." indicator shows in the app
7. **When Meeting Ends:**
   - Click "Stop & Generate Summary"
   - The bot leaves the meeting
   - Audio is transcribed using Whisper AI
   - Summary is generated using GPT-4o
   - You'll be redirected to the summary page

### Method 2: Upload Audio Recording

1. **Go to "Create New Meeting"**
2. **Fill in Meeting Details**
3. **Click "Upload / Paste" Tab**
4. **Upload Audio File:**
   - Drag and drop MP3, WAV, or MP4 file
   - Or click to browse files
   - Maximum file size: 100MB
5. **Click "Generate Summary"**
6. **Wait for Processing:**
   - Audio is transcribed using Whisper AI
   - Summary is generated
   - Redirected to summary page

### Method 3: Paste Transcript

1. **Go to "Create New Meeting"**
2. **Fill in Meeting Details**
3. **Click "Upload / Paste" Tab**
4. **Paste Transcript:**
   - Copy meeting transcript from Zoom, Teams, etc.
   - Paste into the text area
5. **Click "Generate Summary"**
6. **Instant Results:**
   - No audio transcription needed
   - Summary generated directly
   - Redirected to summary page

---

## 📊 Viewing Meeting History

1. **Click "History" in Navigation**
2. **Browse All Meetings:**
   - List view with title, date, time, and type
   - Search by meeting title
   - Filter by meeting type
3. **View Meeting Details:**
   - Click the eye icon 👁️
   - See full summary with all sections
4. **Download Summary:**
   - Click "Download Summary" button
   - Saves as TXT file
5. **Delete Meeting:**
   - Click trash icon 🗑️
   - Confirm deletion
   - Meeting record and audio file removed

---

## 🎨 Understanding the Summary Output

The summary page displays:

### Executive Summary
A concise paragraph summarizing the entire meeting.

### Action Items Table
| Task | Owner | Status |
|------|-------|--------|
| Complete Q4 report | John | Pending |
| Schedule follow-up | Sarah | In Progress |

### Key Points
- Bullet list of main discussion topics
- Important information shared
- Context and background

### Decisions Made
- List of agreements reached
- Action items decided upon
- Direction set during meeting

---

## ⚠️ Important Notes

### Google Meet Bot
- **Chrome Extension Required**: Must be loaded in Chrome before using bot
- **Visible Chrome Window**: Browser runs in headed mode (not headless) to avoid detection
- **Guest Access Only**: Bot joins as guest; works for meetings allowing guests
- **One Meeting at a Time**: Only one bot session can run simultaneously
- **Local Audio Storage**: Audio files saved in `bot_recordings/` folder
- **Processing Time**: Summary generation takes 30-60 seconds after clicking "Stop"

### Audio Upload
- **Supported Formats**: MP3, WAV, MP4, WEBM
- **Language**: Works best with English audio
- **Quality**: Better audio quality = better transcription

### General
- **API Usage**: Uses OpenAI API (charges apply based on usage)
- **Data Storage**: All data stored locally in SQLite database (`meetings.db`)
- **Privacy**: No data sent to external servers except OpenAI API

---

## 🐛 Troubleshooting

### Bot Won't Join Meeting
**Problem**: "Failed to start bot" error
**Solutions**:
- Ensure Chrome extension is installed and enabled
- Check that Google Meet URL is valid
- Verify backend is running on port 8000
- Check browser console for errors

### No Audio Recorded
**Problem**: Bot joined but no audio file created
**Solutions**:
- Ensure Chrome has microphone permissions
- Check that meeting had audio
- Verify extension has "tabCapture" permission
- Look in `bot_recordings/` folder for files

### Extension Not Working
**Problem**: Extension not capturing audio
**Solutions**:
- Reload extension in chrome://extensions/
- Check extension permissions
- Ensure you're on meet.google.com domain
- Try refreshing the page

### CORS Errors
**Problem**: "Access-Control-Allow-Origin" errors in browser console
**Solutions**:
- Backend already configured for ports 5173 and 5174
- If using different port, add it to `backend/main.py` CORS origins
- Ensure both frontend and backend are running

### Backend Won't Start
**Problem**: "Module not found" errors
**Solutions**:
```bash
# Reinstall dependencies
cd backend
source venv_new/bin/activate
pip install -r requirements.txt  # if exists
pip install fastapi uvicorn sqlalchemy python-dotenv google-generativeai playwright asyncio websockets
playwright install chromium
```

---

## 📁 File Structure

```
/Users/apple/Downloads/meeting/
├── backend/
│   ├── bot/                    # Bot service
│   │   ├── meet_bot.py        # Playwright automation
│   │   └── routes.py          # API endpoints
│   ├── extension/             # Chrome extension
│   │   ├── manifest.json
│   │   ├── background.js
│   │   └── content.js
│   ├── main.py                # FastAPI app
│   ├── models.py              # Database models
│   ├── ai.py                  # OpenAI integration
│   └── .env                   # API keys
├── src/
│   ├── components/
│   │   └── BotController.jsx  # Bot UI
│   └── pages/
│       ├── CreateMeeting.jsx  # Main page with tabs
│       ├── MeetingSummary.jsx # Summary display
│       └── MeetingHistory.jsx # Dashboard
├── meetings.db                # SQLite database
├── bot_recordings/            # Bot audio files
└── uploads/                   # Manual upload files
```

---

## 🔐 Environment Variables

Create `backend/.env`:
```
OPENAI_API_KEY=sk-your-openai-api-key
```

Get your API key from: https://platform.openai.com/api-keys

---

## 🎓 Tips for Best Results

### For Bot Usage:
1. **Join Early**: Start bot 2-3 minutes before meeting
2. **Stable Internet**: Bot needs good connection
3. **Clear Audio**: Better microphone = better transcription
4. **English Works Best**: While other languages supported, English has best accuracy

### For Uploads:
1. **Minimize Background Noise**: Record in quiet environment
2. **Single Speaker**: Better than multiple overlapping speakers
3. **Good Microphone**: Invest in quality recording equipment
4. **Post-Processing**: Remove long silences before uploading

### For Transcripts:
1. **Clean Formatting**: Remove timestamps and speaker labels if possible
2. **Complete Text**: Include entire conversation
3. **Grammar Matters**: Well-punctuated text gives better summaries

---

## 📞 Support

If you encounter issues:
1. Check browser console for error messages
2. Verify backend logs in terminal
3. Ensure all dependencies are installed
4. Check that Chrome extension is loaded

---

## 🚀 Future Enhancements (Coming Soon)

- [ ] PDF download option
- [ ] Calendar integration (Google Calendar, Outlook)
- [ ] Automatic meeting detection
- [ ] Multi-language support
- [ ] Speaker diarization (who said what)
- [ ] Action item reminders
- [ ] Team collaboration features

---

**Last Updated**: 2026-02-11
**Version**: 2.0 (With Bot Support)
