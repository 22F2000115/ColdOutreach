@echo off
setlocal EnableDelayedExpansion
title ColdOutreach - Setup

cls
echo.
echo  =======================================================================
echo   ColdOutreach  ^|  Environment Setup
echo   Run this once after cloning. Safe to re-run at any time.
echo  =======================================================================
echo.

:: Resolve project root from script location
set "ROOT=%~dp0"
set "ROOT=%ROOT:~0,-1%"
set "BACKEND=%ROOT%\backend"
set "FRONTEND=%ROOT%\frontend"

echo  Project root : %ROOT%
echo.

:: =======================================================================
::  STEP 1 -- Prerequisites
:: =======================================================================
echo  -----------------------------------------------------------------------
echo   Step 1 of 5  --  Checking Prerequisites
echo  -----------------------------------------------------------------------
echo.

:: Python
where python >nul 2>&1
if %errorlevel% NEQ 0 (
    echo  [FAIL] Python is not installed or not on PATH.
    echo         Download from: https://python.org/downloads
    echo         Select "Add Python to PATH" during installation.
    echo.
    goto :prereq_fail
)
for /f "tokens=2" %%v in ('python --version 2^>^&1') do set "PY_VER=%%v"
echo  [OK]  Python %PY_VER%

:: pip
python -m pip --version >nul 2>&1
if %errorlevel% NEQ 0 (
    echo  [FAIL] pip is not available. Run: python -m ensurepip --upgrade
    goto :prereq_fail
)
echo  [OK]  pip available

:: Node.js
where node >nul 2>&1
if %errorlevel% NEQ 0 (
    echo  [FAIL] Node.js is not installed or not on PATH.
    echo         Download from: https://nodejs.org  (use the LTS release)
    echo.
    goto :prereq_fail
)
for /f %%v in ('node --version 2^>^&1') do set "NODE_VER=%%v"
echo  [OK]  Node.js %NODE_VER%

:: npm
where npm >nul 2>&1
if %errorlevel% NEQ 0 (
    echo  [FAIL] npm is not found. Re-install Node.js from: https://nodejs.org
    goto :prereq_fail
)
for /f %%v in ('npm --version 2^>^&1') do set "NPM_VER=%%v"
echo  [OK]  npm %NPM_VER%

echo.
goto :step2

:prereq_fail
echo.
echo  [HALTED] Install the missing tool(s) listed above, then re-run setup.bat
echo.
pause
exit /b 1

:: =======================================================================
::  STEP 2 -- Python Virtual Environment
:: =======================================================================
:step2
echo  -----------------------------------------------------------------------
echo   Step 2 of 5  --  Python Virtual Environment
echo  -----------------------------------------------------------------------
echo.

if exist "%BACKEND%\venv\Scripts\activate" (
    echo  [OK]  Virtual environment already exists at backend\venv
    echo        Skipping creation.
) else (
    echo  [..] Creating Python virtual environment at backend\venv ...
    python -m venv "%BACKEND%\venv"
    if !errorlevel! NEQ 0 (
        echo  [FAIL] Could not create virtual environment. Check your Python installation.
        pause
        exit /b 1
    )
    echo  [OK]  Virtual environment created.
)
echo.

echo  [..] Installing Python packages from requirements.txt ...
echo       This may take a moment on a fresh machine.
echo.
"%BACKEND%\venv\Scripts\python.exe" -m pip install --upgrade pip --quiet
"%BACKEND%\venv\Scripts\pip.exe" install -r "%BACKEND%\requirements.txt"
if !errorlevel! NEQ 0 (
    echo.
    echo  [FAIL] pip install failed. Common fixes:
    echo          - Check your internet connection
    echo          - Run: python -m pip install --upgrade pip
    echo          - On Windows: install Microsoft C++ Build Tools if cryptography fails
    pause
    exit /b 1
)
echo.
echo  [OK]  Python packages installed.
echo.

:: =======================================================================
::  STEP 3 -- Environment File (.env)
:: =======================================================================
:step3
echo  -----------------------------------------------------------------------
echo   Step 3 of 5  --  Environment Configuration  (backend\.env)
echo  -----------------------------------------------------------------------
echo.

if exist "%BACKEND%\.env" (
    echo  [OK]  backend\.env already exists.
    echo.
    echo        Current keys (values hidden):
    echo        -------------------------------------------
    findstr /r /c:"^JWT_SECRET_KEY" "%BACKEND%\.env" >nul && echo        JWT_SECRET_KEY  = [set]
    findstr /r /c:"^ENCRYPTION_KEY" "%BACKEND%\.env" >nul && echo        ENCRYPTION_KEY  = [set]
    findstr /r /c:"^ADMIN_ACCOUNTS" "%BACKEND%\.env" >nul && echo        ADMIN_ACCOUNTS  = [set]
    findstr /r /c:"^GROQ_API_KEY"   "%BACKEND%\.env" >nul && echo        GROQ_API_KEY    = [set]
    echo        -------------------------------------------
    echo.
    choice /c YN /m "  Regenerate .env with fresh secrets? (Y = Yes, N = Keep existing)"
    if "!errorlevel!"=="1" goto :gen_env
    echo  [SKIP] Keeping existing backend\.env
    echo.
    goto :validate_env
)

:gen_env
echo.
echo  [..] Generating backend\.env with new cryptographic secrets ...
echo.

for /f %%s in ('"%BACKEND%\venv\Scripts\python.exe" -c "import secrets; print(secrets.token_hex(32))"') do set "JWT_SECRET=%%s"
for /f %%k in ('"%BACKEND%\venv\Scripts\python.exe" -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"') do set "FERNET_KEY=%%k"

echo  Enter admin account credentials for this installation:
echo.
set /p "ADMIN_EMAIL=   Admin email    : "
set /p "ADMIN_PASS=    Admin password : "

if "!ADMIN_EMAIL!"=="" set "ADMIN_EMAIL=admin@yourapp.com"
if "!ADMIN_PASS!"=="" set "ADMIN_PASS=ChangeMe123!"

(
    echo JWT_SECRET_KEY=!JWT_SECRET!
    echo ENCRYPTION_KEY=!FERNET_KEY!
    echo ADMIN_ACCOUNTS=!ADMIN_EMAIL!:!ADMIN_PASS!
    echo ENV=development
    echo ALLOWED_ORIGINS=http://localhost:5173
    echo GROQ_API_KEY=your_groq_api_key_here
    echo GOOGLE_API_KEY=your_google_api_key_here
    echo GEMINI_API_KEY=your_gemini_api_key_here
) > "%BACKEND%\.env"

echo.
echo  [OK]  backend\.env generated successfully.
echo        JWT_SECRET_KEY  = [64-char hex]
echo        ENCRYPTION_KEY  = [Fernet key]
echo        ADMIN_ACCOUNTS  = !ADMIN_EMAIL! : [password set]
echo        GOOGLE_API_KEY  = Replace the placeholder value (Gemini - primary AI)
echo        GROQ_API_KEY    = Replace the placeholder value (Groq - fallback AI)
echo.
echo  NOTE: Do not commit backend\.env to version control.
echo        It is already excluded by .gitignore.
echo.

:validate_env
set "ENV_VALID=1"
findstr /r /c:"^JWT_SECRET_KEY=." "%BACKEND%\.env" >nul 2>&1 || (
    echo  [WARN] JWT_SECRET_KEY is missing or empty in backend\.env
    set "ENV_VALID=0"
)
findstr /r /c:"^ENCRYPTION_KEY=." "%BACKEND%\.env" >nul 2>&1 || (
    echo  [WARN] ENCRYPTION_KEY is missing or empty in backend\.env
    set "ENV_VALID=0"
)
findstr /r /c:"^ADMIN_ACCOUNTS=." "%BACKEND%\.env" >nul 2>&1 || (
    echo  [WARN] ADMIN_ACCOUNTS is missing or empty in backend\.env
    set "ENV_VALID=0"
)

if "!ENV_VALID!"=="0" (
    echo.
    echo  [FAIL] backend\.env is incomplete. Re-run setup.bat and choose to
    echo         regenerate, or manually edit: %BACKEND%\.env
    pause
    exit /b 1
)
echo  [OK]  All required .env keys are present.
echo.

:: =======================================================================
::  STEP 4 -- Database Migrations
:: =======================================================================
:step4
echo  -----------------------------------------------------------------------
echo   Step 4 of 5  --  Database Schema  (Alembic Migrations)
echo  -----------------------------------------------------------------------
echo.
echo  [..] Running: alembic upgrade head
echo       Creates or updates the SQLite database schema.
echo.

pushd "%BACKEND%"
"%BACKEND%\venv\Scripts\python.exe" -m alembic upgrade head
set "ALEMBIC_RC=!errorlevel!"
popd

if "!ALEMBIC_RC!" NEQ "0" (
    echo.
    echo  [FAIL] Alembic migration failed (exit code !ALEMBIC_RC!).
    echo         Common fixes:
    echo          - Verify all keys in backend\.env are set and non-empty
    echo          - Ensure no other backend server is running on port 8000
    pause
    exit /b 1
)
echo.
echo  [OK]  Database schema is up to date.
echo.

:: =======================================================================
::  STEP 5 -- Frontend Dependencies
:: =======================================================================
:step5
echo  -----------------------------------------------------------------------
echo   Step 5 of 5  --  Frontend Dependencies  (npm install)
echo  -----------------------------------------------------------------------
echo.

if exist "%FRONTEND%\node_modules" (
    echo  [OK]  frontend\node_modules already exists.
    choice /c YN /m "  Re-run npm install anyway? (Y = Yes, N = Skip)"
    if "!errorlevel!"=="2" goto :npm_skip
)

echo  [..] Running npm install inside frontend\ ...
echo       This may take a minute.
echo.
pushd "%FRONTEND%"
call npm install
set "NPM_RC=!errorlevel!"
popd

if "!NPM_RC!" NEQ "0" (
    echo.
    echo  [FAIL] npm install failed (exit code !NPM_RC!).
    echo         Common fixes:
    echo          - Check your internet connection
    echo          - Ensure Node.js 18 or higher is installed
    echo          - Run: npm cache clean --force  then re-run setup.bat
    pause
    exit /b 1
)
echo.
echo  [OK]  Frontend packages installed.
echo.
goto :done

:npm_skip
echo  [SKIP] npm install skipped.
echo.

:: =======================================================================
::  Done
:: =======================================================================
:done
echo  =======================================================================
echo.
echo   Setup complete. All components are ready.
echo.
echo   Configured:
echo    backend\venv          Python virtual environment
echo    requirements.txt      Python packages installed
echo    backend\.env          Environment secrets generated
echo    database.db           SQLite schema applied (alembic upgrade head)
echo    frontend\node_modules Frontend packages installed
echo.
echo   Next steps:
echo    - Edit backend\.env and set GOOGLE_API_KEY (Gemini) or GROQ_API_KEY to enable Outreach AI
echo    - Run start.bat to launch the application
echo    - Run stop.bat to shut everything down
echo.
echo   URLs after starting:
echo    Web Interface    :  http://localhost:5173
echo    API Swagger Docs :  http://localhost:8000/docs
echo.
echo  =======================================================================
echo.

choice /c YN /m "  Launch the application now? (Y = Yes, N = Exit)"
if "!errorlevel!"=="1" (
    echo.
    echo  [..] Launching servers ...
    start "" "%ROOT%\start.bat"
)

echo.
pause
endlocal
