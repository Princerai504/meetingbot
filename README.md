# Meeting Summarizer with Google Meet Bot

An AI-powered meeting summarization application that automatically generates structured summaries from meeting recordings. Features both file upload and Google Meet bot integration using Google's Gemini AI.

## ✨ Features

- **🎙️ Audio Upload**: Upload MP3, WAV, MP4 files for instant transcription and summary
- **🤖 Google Meet Bot**: Automated bot that joins Google Meet meetings and records audio
- **📝 Text Transcription**: Paste meeting transcripts for quick analysis
- **🤖 AI-Powered**: Uses Google Gemini 3 Flash for transcription and summarization
- **📊 Structured Output**: Generates summaries with key points, decisions, and action items
- **📜 Meeting History**: View and manage all past meeting summaries
- **💾 Local Storage**: All data stored locally in SQLite database

## 🏗️ Tech Stack

### Frontend
- **React 19** with Vite
- **Framer Motion** for animations
- **Lucide React** for icons
- **CSS Modules** for styling

### Backend
- **FastAPI** (Python)
- **SQLAlchemy** with SQLite
- **Google Gemini AI** for transcription and summarization
- **Playwright** for browser automation (Google Meet bot)

### Browser Extension
- **Chrome Extension** for audio capture from Google Meet

## 🚀 Quick Start

### Prerequisites
- Python 3.9+
- Node.js 18+
- Google Gemini API Key

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd meeting
   ```

2. **Set up Backend**
   ```bash
   cd backend
   python -m venv venv_new
   source venv_new/bin/activate  # On Windows: venv_new\Scripts\activate
   pip install -r requirements.txt
   ```

3. **Configure Environment**
   ```bash
   # Create backend/.env file
   echo "GEMINI_API_KEY=your_api_key_here" > backend/.env
   ```

4. **Set up Frontend**
   ```bash
   cd ..
   npm install
   ```

5. **Load Chrome Extension** (for bot functionality)
   - Open Chrome → `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select `backend/extension/` folder

### Running the Application

**Terminal 1 - Backend:**
```bash
cd backend
source venv_new/bin/activate
python -m uvicorn main:app --reload
```

**Terminal 2 - Frontend:**
```bash
npm run dev
```

Open browser: http://localhost:5173

## 📖 Usage

### Method 1: Upload Audio File
1. Go to "Create New Meeting"
2. Fill in meeting title and type
3. Click "Upload / Paste" tab
4. Drag & drop audio file or click to browse
5. Click "Generate Summary"
6. View structured summary

### Method 2: Google Meet Bot
1. Go to "Create New Meeting"
2. Fill in meeting details
3. Click "Google Meet Bot" tab
4. Enter Google Meet URL
5. Click "Join & Record Meeting"
6. Bot joins as guest and records
7. Click "Stop & Generate Summary" when done

### Method 3: Paste Transcript
1. Go to "Create New Meeting"
2. Click "Upload / Paste" tab
3. Paste meeting transcript
4. Click "Generate Summary"

## 🏛️ Architecture

```
meeting/
├── backend/
│   ├── bot/                 # Google Meet automation
│   │   ├── meet_bot.py     # Playwright bot logic
│   │   └── routes.py       # Bot API endpoints
│   ├── extension/          # Chrome extension
│   │   ├── manifest.json
│   │   ├── background.js
│   │   └── content.js
│   ├── main.py            # FastAPI app
│   ├── ai.py              # Gemini integration
│   ├── models.py          # Database models
│   └── .env               # API keys (not in git)
├── src/
│   ├── components/        # React components
│   ├── pages/            # Page components
│   └── services/         # API services
└── uploads/              # File uploads (gitignored)
```

## 🔧 API Endpoints

### Meetings
- `POST /meeting/create` - Create meeting with file/transcript
- `GET /meetings` - List all meetings
- `GET /meetings/{id}` - Get specific meeting
- `DELETE /meetings/{id}` - Delete meeting

### Bot
- `POST /bot/join` - Start bot session
- `POST /bot/leave/{id}` - Stop bot and process recording
- `GET /bot/status/{id}` - Get bot status

## 📝 Output Format

The AI generates structured JSON:
```json
{
  "summary": "Meeting overview...",
  "key_points": ["Point 1", "Point 2"],
  "decisions": ["Decision 1"],
  "action_items": [
    {"task": "Task", "owner": "Name", "status": "Pending"}
  ],
  "agenda": ["Topic 1", "Topic 2"]
}
```

## ⚠️ Important Notes

- **Chrome Extension Required**: Bot functionality requires the extension to be loaded
- **API Key Security**: Never commit your Gemini API key to git
- **File Size**: Large audio files may take longer to process
- **Local Only**: Designed for local machine use
- **One Bot at a Time**: Only one Google Meet bot session can run simultaneously

## 🐛 Troubleshooting

### Backend won't start
```bash
# Reinstall dependencies
pip install -r requirements.txt
```

### CORS errors
- Ensure backend is running on port 8000
- Check CORS origins in `backend/main.py`

### Bot not working
- Verify Chrome extension is loaded
- Check that Google Meet URL is valid
- Ensure extension has required permissions

### No AI output
- Verify Gemini API key is set in `.env`
- Check backend logs for errors
- Ensure audio file format is supported

## 📄 License

MIT License - feel free to use and modify!

## 🤝 Contributing

Contributions welcome! Please feel free to submit issues and pull requests.

## 🙏 Acknowledgments

- Google Gemini AI for transcription and summarization
- FastAPI for the backend framework
- React and Vite for the frontend
- Playwright for browser automation
