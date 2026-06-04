@echo off
cd /d "%~dp0"
title ColdOutreach - Backend Server
color 0A
echo.
echo  ===========================================================
echo    ColdOutreach BACKEND  ^|  http://localhost:8000/docs
echo  ===========================================================
echo.
venv\Scripts\uvicorn main:app --reload --host 127.0.0.1 --port 8000
echo.
echo  [STOPPED] Backend server has exited.
pause
