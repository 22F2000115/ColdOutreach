@echo off
setlocal EnableDelayedExpansion
title ColdOutreach - Starting Servers

cls
echo.
echo  =======================================================================
echo           ColdOutreach  ^|  Self-Hosted Cold Email SaaS
echo  =======================================================================
echo.

:: Locate project root (works no matter where you run this from)
set "ROOT=%~dp0"
set "ROOT=%ROOT:~0,-1%"
set "BACKEND=%ROOT%\backend"
set "FRONTEND=%ROOT%\frontend"

:: Pre-flight checks
echo  Running pre-flight checks ...
echo.

:: Check: venv
if not exist "%BACKEND%\venv\Scripts\activate" (
    echo  [FAIL] Python virtual environment not found at backend\venv
    echo.
    echo         Have you run setup.bat yet?
    echo         Run setup.bat to install everything first.
    echo.
    pause
    exit /b 1
)
echo  [OK]  Python venv found.

:: Check: uvicorn installed
if not exist "%BACKEND%\venv\Scripts\uvicorn.exe" (
    echo  [WARN] uvicorn not found in venv. Re-installing packages ...
    "%BACKEND%\venv\Scripts\pip.exe" install -r "%BACKEND%\requirements.txt" --quiet
    if !errorlevel! NEQ 0 (
        echo  [FAIL] pip install failed. Run setup.bat to fix the environment.
        pause
        exit /b 1
    )
)
echo  [OK]  Backend packages present.

:: Check: .env
if not exist "%BACKEND%\.env" (
    echo  [FAIL] backend\.env is missing.
    echo.
    echo         Run setup.bat -- it will generate your secrets and .env file.
    echo.
    pause
    exit /b 1
)
echo  [OK]  backend\.env found.

:: Check: frontend node_modules
if not exist "%FRONTEND%\node_modules" (
    echo  [FAIL] frontend\node_modules not found.
    echo.
    echo         Run setup.bat -- it will run npm install for you.
    echo.
    pause
    exit /b 1
)
echo  [OK]  Frontend node_modules found.

echo.
echo  All checks passed. Launching servers ...
echo.

:: Launch backend via helper script (avoids command-line length limits)
echo  [1/2] Starting FastAPI backend on http://localhost:8000 ...
start "ColdOutreach Backend" cmd /k ""%BACKEND%\_launch.bat""

:: Give the backend a 2-second head start
timeout /t 2 /nobreak >nul

:: Launch frontend via helper script
echo  [2/2] Starting Vite frontend on http://localhost:5173 ...
start "ColdOutreach Frontend" cmd /k ""%FRONTEND%\_launch.bat""

echo.
echo  =======================================================================
echo.
echo   Both servers are launching in separate windows.
echo.
echo   Web Interface    :  http://localhost:5173
echo   API Swagger Docs :  http://localhost:8000/docs
echo   API ReDoc        :  http://localhost:8000/redoc
echo.
echo   Give it ~5 seconds for both servers to fully start,
echo   then open the web interface in your browser.
echo.
echo   To STOP everything -- run stop.bat
echo.
echo  =======================================================================
echo.

:: Auto-open browser after a short delay
timeout /t 5 /nobreak >nul
echo  Opening browser ...
start "" "http://localhost:5173"

echo.
pause
endlocal
