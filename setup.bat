@echo off
setlocal EnableDelayedExpansion
title ColdOutreach - Full Setup and Environment Check

cls
echo.
echo  =======================================================================
echo    COLDOUTREACH -- One-Click Setup Script
echo    Works on any fresh Windows machine or server.
echo    Run once after cloning the repo, or to reset the environment.
echo  =======================================================================
echo.

:: Locate this script's own directory (works from anywhere)
set "ROOT=%~dp0"
set "ROOT=%ROOT:~0,-1%"
set "BACKEND=%ROOT%\backend"
set "FRONTEND=%ROOT%\frontend"

echo  Project root : %ROOT%
echo  Backend      : %BACKEND%
echo  Frontend     : %FRONTEND%
echo.

:: =======================================================================
::  STEP 1 OF 5 -- CHECK PREREQUISITES
:: =======================================================================
echo  -----------------------------------------------------------------------
echo   STEP 1 OF 5 -- Checking Prerequisites
echo  -----------------------------------------------------------------------
echo.

:: Python
set "PYTHON_OK=0"
where python >nul 2>&1
if %errorlevel%==0 (
    for /f "tokens=2" %%v in ('python --version 2^>^&1') do set "PY_VER=%%v"
    echo  [OK]  Python found : !PY_VER!
    for /f "tokens=1,2 delims=." %%a in ("!PY_VER!") do (
        if %%a GEQ 3 (
            if %%b GEQ 10 (
                set "PYTHON_OK=1"
            )
        )
    )
    if "!PYTHON_OK!"=="0" (
        echo  [WARN] Python version !PY_VER! is below the recommended 3.10.
        echo         The app may still work but an upgrade is strongly recommended.
        echo         Download: https://python.org/downloads
        echo.
        set "PYTHON_OK=1"
    )
) else (
    echo  [FAIL] Python is NOT installed or not on PATH.
    echo         Download from: https://python.org/downloads
    echo         Tick "Add Python to PATH" during installation.
    echo.
    goto :prereq_fail
)

:: pip
where pip >nul 2>&1
if %errorlevel%==0 (
    for /f "tokens=2" %%v in ('pip --version 2^>^&1') do set "PIP_VER=%%v"
    echo  [OK]  pip found : !PIP_VER!
) else (
    echo  [WARN] pip not found on PATH. Trying python -m pip ...
    python -m pip --version >nul 2>&1
    if !errorlevel! NEQ 0 (
        echo  [FAIL] pip is not available. Run: python -m ensurepip --upgrade
        goto :prereq_fail
    )
    echo  [OK]  pip available via python -m pip
)

:: Node.js
set "NODE_OK=0"
where node >nul 2>&1
if %errorlevel%==0 (
    for /f %%v in ('node --version 2^>^&1') do set "NODE_VER=%%v"
    echo  [OK]  Node.js found : !NODE_VER!
    set "NODE_OK=1"
) else (
    echo  [FAIL] Node.js is NOT installed or not on PATH.
    echo         Download from: https://nodejs.org  (use the LTS version)
    echo.
    goto :prereq_fail
)

:: npm
where npm >nul 2>&1
if %errorlevel%==0 (
    for /f %%v in ('npm --version 2^>^&1') do set "NPM_VER=%%v"
    echo  [OK]  npm found : !NPM_VER!
) else (
    echo  [FAIL] npm is NOT installed. It should come bundled with Node.js.
    echo         Re-install Node.js from: https://nodejs.org
    goto :prereq_fail
)

echo.
echo  All prerequisites satisfied.
echo.
goto :section2

:prereq_fail
echo.
echo  =======================================================================
echo   [SETUP HALTED] Install the missing tool(s) above, then re-run.
echo  =======================================================================
echo.
pause
exit /b 1

:: =======================================================================
::  STEP 2 OF 5 -- PYTHON VIRTUAL ENVIRONMENT
:: =======================================================================
:section2
echo  -----------------------------------------------------------------------
echo   STEP 2 OF 5 -- Python Virtual Environment
echo  -----------------------------------------------------------------------
echo.

if exist "%BACKEND%\venv\Scripts\activate" (
    echo  [OK]  Virtual environment already exists at backend\venv
    echo        Skipping creation.
) else (
    echo  [..] Creating Python virtual environment in backend\venv ...
    python -m venv "%BACKEND%\venv"
    if !errorlevel! NEQ 0 (
        echo  [FAIL] Could not create virtual environment. Check your Python install.
        pause
        exit /b 1
    )
    echo  [OK]  Virtual environment created.
)
echo.

echo  [..] Installing / upgrading Python packages from requirements.txt ...
echo       (This may take a minute on a fresh machine)
echo.
"%BACKEND%\venv\Scripts\python.exe" -m pip install --upgrade pip --quiet
"%BACKEND%\venv\Scripts\pip.exe" install -r "%BACKEND%\requirements.txt"
if !errorlevel! NEQ 0 (
    echo.
    echo  [FAIL] pip install failed. Common fixes:
    echo         - Run: python -m pip install --upgrade pip
    echo         - Make sure you have internet access
    echo         - On Windows, install Microsoft C++ Build Tools if crypto fails
    pause
    exit /b 1
)
echo.
echo  [OK]  Python packages installed.
echo.

:: =======================================================================
::  STEP 3 OF 5 -- ENVIRONMENT FILE (.env)
:: =======================================================================
:section3
echo  -----------------------------------------------------------------------
echo   STEP 3 OF 5 -- Environment Configuration (.env)
echo  -----------------------------------------------------------------------
echo.

if exist "%BACKEND%\.env" (
    echo  [OK]  backend\.env already exists.
    echo.
    echo        Current keys (values hidden):
    echo        -------------------------------------------
    findstr /r /c:"^JWT_SECRET_KEY" "%BACKEND%\.env" >nul && echo        JWT_SECRET_KEY = [set]
    findstr /r /c:"^ENCRYPTION_KEY" "%BACKEND%\.env" >nul && echo        ENCRYPTION_KEY = [set]
    findstr /r /c:"^ADMIN_ACCOUNTS" "%BACKEND%\.env" >nul && echo        ADMIN_ACCOUNTS = [set]
    echo        -------------------------------------------
    echo.
    choice /c YN /m "  Regenerate .env with fresh secrets? (Y=Yes, N=Skip)"
    if "!errorlevel!"=="1" goto :gen_env
    echo  [SKIP] Keeping existing .env file.
    echo.
    goto :check_env_values
)

:gen_env
echo.
echo  [..] Generating backend\.env with fresh cryptographic secrets ...
echo.

for /f %%s in ('"%BACKEND%\venv\Scripts\python.exe" -c "import secrets; print(secrets.token_hex(32))"') do set "JWT_SECRET=%%s"
for /f %%k in ('"%BACKEND%\venv\Scripts\python.exe" -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"') do set "FERNET_KEY=%%k"

echo  Enter your admin account details:
echo.
set /p "ADMIN_EMAIL=       Admin email address : "
set /p "ADMIN_PASS=        Admin password      : "

if "!ADMIN_EMAIL!"=="" set "ADMIN_EMAIL=admin@yourapp.com"
if "!ADMIN_PASS!"=="" set "ADMIN_PASS=ChangeMe123!"

(
    echo JWT_SECRET_KEY=!JWT_SECRET!
    echo ENCRYPTION_KEY=!FERNET_KEY!
    echo ADMIN_ACCOUNTS=!ADMIN_EMAIL!:!ADMIN_PASS!
) > "%BACKEND%\.env"

echo.
echo  [OK]  backend\.env generated.
echo        JWT_SECRET_KEY  = [64-char hex secret]
echo        ENCRYPTION_KEY  = [Fernet key]
echo        ADMIN_ACCOUNTS  = !ADMIN_EMAIL!:[password set]
echo.
echo  WARNING: Never commit backend\.env to version control.
echo           It is already listed in .gitignore.
echo.

:check_env_values
set "ENV_VALID=1"
findstr /r /c:"^JWT_SECRET_KEY=." "%BACKEND%\.env" >nul 2>&1 || (
    echo  [WARN] JWT_SECRET_KEY is missing or empty in .env
    set "ENV_VALID=0"
)
findstr /r /c:"^ENCRYPTION_KEY=." "%BACKEND%\.env" >nul 2>&1 || (
    echo  [WARN] ENCRYPTION_KEY is missing or empty in .env
    set "ENV_VALID=0"
)
findstr /r /c:"^ADMIN_ACCOUNTS=." "%BACKEND%\.env" >nul 2>&1 || (
    echo  [WARN] ADMIN_ACCOUNTS is missing or empty in .env
    set "ENV_VALID=0"
)

if "!ENV_VALID!"=="0" (
    echo.
    echo  [FAIL] Your .env file is incomplete. Re-run this script and choose
    echo         to regenerate, or manually edit: %BACKEND%\.env
    pause
    exit /b 1
)
echo  [OK]  All required .env keys are present.
echo.

:: =======================================================================
::  STEP 4 OF 5 -- DATABASE MIGRATIONS
:: =======================================================================
:section4
echo  -----------------------------------------------------------------------
echo   STEP 4 OF 5 -- Database Setup (Alembic Migrations)
echo  -----------------------------------------------------------------------
echo.
echo  [..] Running: python -m alembic upgrade head
echo       (Creates or updates the SQLite database schema)
echo.

pushd "%BACKEND%"
"%BACKEND%\venv\Scripts\python.exe" -m alembic upgrade head
set "ALEMBIC_RC=!errorlevel!"
popd

if "!ALEMBIC_RC!" NEQ "0" (
    echo.
    echo  [FAIL] Alembic migration failed (exit code !ALEMBIC_RC!).
    echo         Common fixes:
    echo          - Make sure backend\.env exists with all required values
    echo          - Make sure no other backend instance is running
    pause
    exit /b 1
)
echo.
echo  [OK]  Database schema is up to date.
echo.

:: =======================================================================
::  STEP 5 OF 5 -- FRONTEND npm install
:: =======================================================================
:section5
echo  -----------------------------------------------------------------------
echo   STEP 5 OF 5 -- Frontend Dependencies (npm install)
echo  -----------------------------------------------------------------------
echo.

if exist "%FRONTEND%\node_modules" (
    echo  [OK]  frontend\node_modules already exists.
    choice /c YN /m "  Re-run npm install anyway? (Y=Yes, N=Skip)"
    if "!errorlevel!"=="2" goto :npm_skip
)

echo  [..] Running: npm install inside frontend\
echo       (Downloads all React / Vite packages -- may take a minute)
echo.
pushd "%FRONTEND%"
call npm install
set "NPM_RC=!errorlevel!"
popd

if "!NPM_RC!" NEQ "0" (
    echo.
    echo  [FAIL] npm install failed (exit code !NPM_RC!).
    echo         Common fixes:
    echo          - Make sure you have internet access
    echo          - Make sure Node.js >= 18 is installed
    echo          - Try: npm cache clean --force  then re-run this script
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
::  DONE
:: =======================================================================
:done
echo  =======================================================================
echo.
echo   SETUP COMPLETE -- Everything is ready!
echo.
echo   What was configured:
echo    [OK]  Python virtual environment  (backend\venv)
echo    [OK]  Python packages             (requirements.txt)
echo    [OK]  Environment secrets         (backend\.env)
echo    [OK]  SQLite database schema      (alembic upgrade head)
echo    [OK]  Frontend packages           (frontend\node_modules)
echo.
echo   Next steps:
echo    - To START the app   run start.bat
echo    - To STOP  the app   run stop.bat
echo.
echo   URLs after starting:
echo    - Web Interface  : http://localhost:5173
echo    - API Docs       : http://localhost:8000/docs
echo.
echo  =======================================================================
echo.

choice /c YN /m "  Launch the app right now? (Y=Yes, N=Exit)"
if "!errorlevel!"=="1" (
    echo.
    echo  [..] Launching servers ...
    start "" "%ROOT%\start.bat"
)

echo.
pause
endlocal
