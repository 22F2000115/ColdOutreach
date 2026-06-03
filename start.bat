@echo off
title Cold Email SaaS Startup
echo =======================================================================
echo               COLD EMAIL OUTREACH MICRO SAAS STARTUP                   
echo =======================================================================
echo.

:: Verify backend venv exists
if not exist "backend\venv\Scripts\activate" (
    echo [ERROR] Python Virtual Environment not found in backend/venv.
    echo Please run the installation steps first.
    pause
    exit /b 1
)

:: Verify frontend node_modules exists
if not exist "frontend\node_modules" (
    echo [ERROR] Frontend node_modules not found.
    echo Please run npm install inside frontend folder.
    pause
    exit /b 1
)

echo [1/2] Launching FastAPI Backend on http://localhost:8000 ...
start "Backend API Server" cmd /k "cd backend && venv\Scripts\uvicorn main:app --reload --host 127.0.0.1 --port 8000"

echo [2/2] Launching Vite Frontend on http://localhost:5173 ...
start "Frontend UI Server" cmd /k "cd frontend && npm run dev"

echo.
echo =======================================================================
echo SUCCESS: BOTH SERVERS LAUNCHED IN SEPARATE COMMAND WINDOWS!
echo.
echo - API Backend Swagger Docs: http://localhost:8000/docs
echo - Web User Interface:       http://localhost:5173
echo =======================================================================
echo.
pause
