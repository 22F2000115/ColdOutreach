@echo off
setlocal EnableDelayedExpansion
title ColdOutreach - Stopping Servers

cls
echo.
echo  =======================================================================
echo   ColdOutreach  ^|  Stopping All Servers
echo  =======================================================================
echo.

:: -----------------------------------------------------------------------
::  Stop FastAPI backend (uvicorn)
:: -----------------------------------------------------------------------
echo  [1/3] Stopping FastAPI backend ...
powershell -NoProfile -Command ^
  "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*uvicorn*' -or $_.CommandLine -like '*main:app*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue; Write-Host ('        Stopped PID ' + $_.ProcessId) }" 2>nul
echo  [OK]  Backend stopped.

:: -----------------------------------------------------------------------
::  Stop Vite frontend (node / npm)
:: -----------------------------------------------------------------------
echo.
echo  [2/3] Stopping Vite frontend ...
powershell -NoProfile -Command ^
  "Get-CimInstance Win32_Process | Where-Object { ($_.CommandLine -like '*vite*' -or $_.CommandLine -like '*npm*') -and $_.Name -eq 'node.exe' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue; Write-Host ('        Stopped PID ' + $_.ProcessId) }" 2>nul
echo  [OK]  Frontend stopped.

:: -----------------------------------------------------------------------
::  Close terminal windows opened by start.bat
:: -----------------------------------------------------------------------
echo.
echo  [3/3] Closing server terminal windows ...
taskkill /F /FI "WINDOWTITLE eq ColdOutreach Backend"   >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq ColdOutreach Frontend"  >nul 2>&1
echo  [OK]  Terminal windows closed.

echo.
echo  =======================================================================
echo.
echo   All ColdOutreach servers have been stopped.
echo.
echo   To start again, run start.bat
echo.
echo  =======================================================================
echo.

timeout /t 3 /nobreak >nul
endlocal
