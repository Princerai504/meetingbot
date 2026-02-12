# Meeting Summarizer App Setup Guide (Hinglish)

## Windows Laptop Par Setup Kaise Karein

Is app ko run karne ke liye niche diye gaye steps follow karein:

---

## Step 1: Zaroori Software Install Karein

### 1. Python Install Karein
- Website se download karein: https://www.python.org/downloads/
- Version 3.9 ya usse upar choose karein
- **Important**: Install karte waqt "Add Python to PATH" option check karna na bhoolen!
- Install hone ke baad terminal mein ye command chalayein:
  ```
  python --version
  ```

### 2. Node.js Install Karein
- Website se download karein: https://nodejs.org/
- LTS version choose karein
- Install hone ke baad terminal mein ye command chalayein:
  ```
  node --version
  ```

### 3. Google Chrome Install Karein
- Agar already installed nahi hai toh download karein: https://www.google.com/chrome/

---

## Step 2: Project Setup Karein

### Backend Setup
1. Folder extract karein aur usme jaayein
2. Terminal open karein aur ye commands likhein:

```
cd backend
python -m venv venv_new
venv_new\Scripts\activate
pip install -r requirements.txt
```

### Frontend Setup
1. Backend setup hone ke baad, root folder mein wapas jaayein
2. Ye command chalayein:

```
npm install
```

---

## Step 3: Environment Variables Set Karein
me zip krke bhej rha huuin to usme env file pehle se hai aur api key bhi to is step ko skip krdena
<!-- 1. `backend` folder mein jaayein
2. `.env` naam ki file create karein
3. Usme ye likhein:

```
GEMINI_API_KEY=your_api_key_here
``` -->

<!-- **API Key Kaise Milega:**
- Google AI Studio website par jaayein: https://aistudio.google.com/app/apikey
- Apna Google account se login karein
- "Create API Key" click karke nayi key generate karein
- Uski value copy karke .env file mein paste karein -->

---

## Step 4: App Run Karein


### Terminal 1 (Backend):
```
cd backend
venv_new\Scripts\activate
python -m uvicorn main:app --reload
```

Chrome Extension Setup (Bot Ke Liye)

Agar Google Meet Bot feature use karna hai toh:

1. Chrome browser open karein
2. Address bar mein ye likhein: `chrome://extensions/`
3. Upar "Developer mode" toggle on karein
4. "Load unpacked" button click karein
5. Project folder se `backend/extension/` folder select karein

Extension load ho jayega!

---

##常见 Problems aur Solutions

### Problem: "python command not found"
- **Solution**: Python properly install hua hai aur PATH mein add hua hai, check karein

### Problem: "Module not found" error
- **Solution**: Virtual environment activate hai aur requirements install hai, verify karein

### Problem: API error aata hai
- **Solution**: .env file mein GEMINI_API_KEY sahi hai, check karein

### Problem: Frontend/Backend connect nahi ho raha
- **Solution**: Dono terminals alag-alg chal rahe hain, port 8000 aur 5173 free hain, verify karein

---

## Summary

Bas itna hi karna hai:
1. Python aur Node.js install karein
2. `npm install` chalayein
3. `.env` file mein API key dalen
4. Do terminals open karke backend aur frontend start karein
5. Browser mein localhost:5173 open karein

Bas ready! 🎉

Koi bhi problem ho toh README.md file check karein ya mujhse poochhein!