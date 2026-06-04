@echo off
title Stopping Cold Email SaaS Startup
echo =======================================================================
echo               STOPPING COLD EMAIL OUTREACH SERVERS                      
echo =======================================================================
echo.
echo [1/2] Terminating Vite and FastAPI processes...
powershell -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*uvicorn*' -or $_.CommandLine -like '*node*' -or $_.CommandLine -like '*main:app*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"

echo [2/2] Closing server terminal windows...
taskkill /F /FI "WINDOWTITLE eq Backend API Server" >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq Frontend UI Server" >nul 2>&1

echo.
echo =======================================================================
echo SUCCESS: SERVERS TERMINATED AND WINDOWS CLOSED!
echo =======================================================================
echo.
timeout /t 3
