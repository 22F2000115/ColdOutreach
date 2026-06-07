@echo off
setlocal EnableDelayedExpansion
title ColdOutreach - Starting Servers

cls
echo.
echo  =======================================================================
echo   ColdOutreach  ^|  Self-Hosted Cold Email Platform
echo  =======================================================================
echo.

:: Resolve project root from script location
set "ROOT=%~dp0"
set "ROOT=%ROOT:~0,-1%"
set "BACKEND=%ROOT%\backend"
set "FRONTEND=%ROOT%\frontend"

:: -----------------------------------------------------------------------
::  Pre-flight checks
:: -----------------------------------------------------------------------
echo  Running pre-flight checks ...
echo.

:: Check: Python virtual environment
if not exist "%BACKEND%\venv\Scripts\activate" (
    echo  [FAIL] Python virtual environment not found at backend\venv
    echo.
    echo         Run setup.bat first to install the environment.
    echo.
    pause
    exit /b 1
)
echo  [OK]  Python virtual environment found.

:: Check: uvicorn is installed
if not exist "%BACKEND%\venv\Scripts\uvicorn.exe" (
    echo  [WARN] uvicorn not found in virtual environment. Re-installing packages ...
    "%BACKEND%\venv\Scripts\pip.exe" install -r "%BACKEND%\requirements.txt" --quiet
    if !errorlevel! NEQ 0 (
        echo  [FAIL] Package install failed. Run setup.bat to repair the environment.
        pause
        exit /b 1
    )
)
echo  [OK]  Backend packages present.

:: Check: .env file
if not exist "%BACKEND%\.env" (
    echo  [FAIL] backend\.env is missing.
    echo.
    echo         Run setup.bat -- it generates the secrets and .env file.
    echo.
    pause
    exit /b 1
)
echo  [OK]  backend\.env found.

:: Check: frontend node_modules
if not exist "%FRONTEND%\node_modules" (
    echo  [FAIL] frontend\node_modules not found.
    echo.
    echo         Run setup.bat -- it runs npm install for you.
    echo.
    pause
    exit /b 1
)
echo  [OK]  Frontend node_modules found.

echo.
echo  All checks passed. Launching servers ...
echo.

:: -----------------------------------------------------------------------
::  Launch servers
:: -----------------------------------------------------------------------

:: Backend -- FastAPI via uvicorn
echo  [1/2] Starting FastAPI backend on http://localhost:8000 ...
start "ColdOutreach Backend" cmd /k "cd /d "%BACKEND%" && "%BACKEND%\venv\Scripts\uvicorn.exe" main:app --reload --host 127.0.0.1 --port 8000"

:: Brief pause to give the backend a head start before the frontend connects
timeout /t 2 /nobreak >nul

:: Frontend -- Vite dev server
echo  [2/2] Starting Vite frontend on http://localhost:5173 ...
start "ColdOutreach Frontend" cmd /k "cd /d "%FRONTEND%" && npm run dev"

echo.
echo  =======================================================================
echo.
echo   Both servers are starting in separate terminal windows.
echo.
echo   Web Interface     :  http://localhost:5173
echo   API Swagger Docs  :  http://localhost:8000/docs
echo   API ReDoc         :  http://localhost:8000/redoc
echo.
echo   Allow 5 seconds for both servers to fully initialize,
echo   then open the web interface in your browser.
echo.
echo   To stop all servers, run stop.bat
echo.
echo  =======================================================================
echo.

:: Open the browser after a brief delay
timeout /t 5 /nobreak >nul
echo  Opening browser ...
start "" "http://localhost:5173"

echo.
pause
endlocal
