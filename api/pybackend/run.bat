@echo off
setlocal

REM Create venv if not exists
if not exist .venv (
    py -3 -m venv .venv
)

call .venv\Scripts\activate
pip install --upgrade pip
pip install -r requirements.txt

set PORT=%1
if "%PORT%"=="" set PORT=4000

echo Starting FastAPI on http://127.0.0.1:%PORT%
uvicorn app:app --reload --host 0.0.0.0 --port %PORT%
