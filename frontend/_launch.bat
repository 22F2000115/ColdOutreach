@echo off
cd /d "%~dp0"
title ColdOutreach - Frontend Server
color 0B
echo.
echo  ===========================================================
echo    ColdOutreach FRONTEND  ^|  http://localhost:5173
echo  ===========================================================
echo.
npm run dev
echo.
echo  [STOPPED] Frontend server has exited.
pause
