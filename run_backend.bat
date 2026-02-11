@echo off
REM Get the directory where this script is located
cd /d "%~dp0"

REM Activate the virtual environment if it exists in backend/venv
if exist "backend\venv\Scripts\activate.bat" (
    call backend\venv\Scripts\activate.bat
)

REM Run the server from the root directory
echo Starting FastAPI Backend...
python -m uvicorn backend.main:app --reload

pause
