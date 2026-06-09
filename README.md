# ColdOutreach

Self-hosted cold email campaign automation platform. Built for founders, sales teams, and agencies who want complete ownership of their outreach infrastructure — no recurring software fees, no third-party data storage.

---

## What It Does

ColdOutreach lets you run personalized cold email campaigns from your own machine or server using your own SMTP accounts. You control the data, the sending rate, and the infrastructure.

---

## Features

**Campaign Management**
- Create, start, pause, resume, and delete campaigns from a central dashboard
- Live delivery tracking - sent, delivered, bounced, and failed counts updated in real time
- Auto-retry mechanism for transient SMTP failures
- Campaign worker locks prevent race conditions during concurrent send operations

**SMTP and Email**
- Connect any SMTP server - Gmail, Outlook, custom domains
- Fully editable Gmail App Password and address fields with connection testing before saving
- SMTP passwords encrypted at rest using Fernet symmetric cryptography
- Attachment support per campaign
- Custom send delay (1-60 seconds) per SMTP account to adjust pacing between outgoing emails

**Lead Management**
- Import contacts via CSV upload (up to 6 MB)
- Add contacts individually with strict email regex validation
- Personalization placeholders: `{{first_name}}`, `{{last_name}}`, `{{email}}`, `{{company}}`, `{{role}}`

**Bounce Sync**
- Connect sender accounts via IMAP
- Scan inboxes and mark bounced records automatically as non-blocking background tasks

**Outreach AI (Pro Plan)**
- AI email generator powered by Groq (`llama-3.3-70b-versatile`)
- Generates multiple subject line options and three full email variations per request
- Rate limited dynamically (15 requests/hour for trial tier, 20 requests/hour for pro tier)
- Controls: tone, writing style, email length, formality level, CTA strength
- Quick-start presets for Job Seeker, SaaS Pitch, Freelancer, B2B Sales
- Spam phrase detection with flagged word highlighting
- Subject line effectiveness scoring (personalization, character count, power words)
- Save generated templates to a reusable library
- Inject templates directly into draft campaigns

**Activity History**
- Per-user action log - campaign runs, sends, SMTP changes, plan updates
- Filter by event type and date range
- CSV export

**Authentication**
- JWT-based session management
- 1-hour access tokens with silent rotation
- HTTP-only refresh cookies (7-day duration)
- Rate limiting on login (10/min) and registration (5/min) endpoints
- Secure change password modal with current password verification, length checks, and matching validations

**Admin Panel**
- System stats overview - users, campaigns, daily email volume
- User management - search, promote, change plan, suspend, delete with server-side pagination
- Global campaign log with ownership records and server-side pagination
- Live plan limit editor - adjust SMTP, campaign, and recipient quotas per tier stored in database
- Support contact configuration

**UI**
- Full dark and light mode with persistent preference
- Responsive layout - desktop and mobile
- Theme-adaptive component styling using CSS custom properties
- Unified sidebar user profile card at the bottom displaying user initials avatar, email, plan badge (Pro/Trial), and action buttons for Change Password and Sign Out

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI, SQLAlchemy, SQLite, Alembic, Uvicorn |
| Rate Limiting | SlowAPI |
| AI | Google GenAI SDK, Groq Python SDK |
| Encryption | Python `cryptography` (Fernet) |
| Auth | `python-jose`, `passlib[bcrypt]` |
| Frontend | React 18, React Router 7, Vite |
| Styling | Vanilla CSS with design tokens |

---

## Project Structure

```
ColdOutreach/
├── backend/
│   ├── main.py              -- FastAPI application startup and middleware registration
│   ├── models.py            -- SQLAlchemy ORM models
│   ├── auth.py              -- JWT token creation and validation
│   ├── worker.py            -- Background campaign sending threads and IMAP sync
│   ├── security.py          -- Fernet encryption helpers for SMTP passwords
│   ├── activity.py          -- Activity log writer utility
│   ├── database.py          -- SQLAlchemy engine and session setup
│   ├── config.py            -- Configuration constants
│   ├── schemas.py           -- Pydantic validation schemas
│   ├── seed.py              -- Database seeders for defaults
│   ├── dependencies.py      -- FastAPI dependencies, database helpers, and rate limiter definitions
│   ├── routers/             -- Modular APIRouter endpoint controllers
│   │   ├── auth.py          -- Auth and profile endpoints
│   │   ├── smtp.py          -- SMTP CRUD and testing endpoints
│   │   ├── campaigns.py     -- Campaign CRUD and recipient management
│   │   ├── ai.py            -- Google Gemini and Groq AI template generation
│   │   ├── templates.py     -- Saved email template library endpoints
│   │   ├── activity.py      -- User logs and metrics
│   │   ├── admin.py         -- Server-side paginated admin endpoints
│   │   └── contact.py       -- Contact and CSV details
│   ├── alembic.ini          -- Alembic migration configuration
│   ├── alembic/             -- Migration version scripts
│   ├── requirements.txt     -- Python package dependencies
│   ├── .env.example         -- Environment variable template
│   └── test_api.py          -- Backend integration test suite
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Login.jsx              -- Sign-in page
│   │   │   ├── Register.jsx           -- Account registration page
│   │   │   ├── Dashboard.jsx          -- Campaigns overview and stats
│   │   │   ├── CampaignDetail.jsx     -- Campaign editor, contacts, and worker panel
│   │   │   ├── Settings.jsx           -- SMTP sender account configuration with send delays
│   │   │   ├── OutreachAI.jsx         -- AI template generator and library
│   │   │   ├── History.jsx            -- Activity log timeline and CSV export
│   │   │   ├── Contact.jsx            -- Support and plan upgrade page
│   │   │   └── AdminDashboard.jsx     -- Admin control panel with server-side pagination
│   │   ├── components/
│   │   │   ├── RichEditor.jsx         -- WYSIWYG template editor
│   │   │   ├── FailedContactsTab.jsx  -- Failed delivery retry log
│   │   │   ├── TrialExpiredModal.jsx  -- Plan restriction overlay
│   │   │   └── ChangePasswordModal.jsx -- Overlay modal for updating user passwords
│   │   ├── App.jsx          -- Router configuration and sidebar layout
│   │   ├── main.jsx         -- React render entry point
│   │   └── index.css        -- Global design tokens and component styles
│   └── package.json
├── setup.bat                -- One-click environment installer (run once)
├── start.bat                -- Launches backend and frontend servers
├── stop.bat                 -- Terminates all running server processes
└── test_contacts.csv        -- Sample CSV for testing contact imports
```

---

## Prerequisites

Install the following before running setup:

| Tool | Minimum Version | Download |
|---|---|---|
| Python | 3.10 | https://python.org/downloads |
| Node.js | 18 LTS | https://nodejs.org |
| Git | Any | https://git-scm.com |

During Python installation, select "Add Python to PATH".

Verify your installations:

```
python --version
node --version
npm --version
```

---

## First-Time Setup

**Step 1 — Clone the repository**

```
git clone https://github.com/22F2000115/ColdOutreach.git
cd ColdOutreach
```

**Step 2 — Run the setup script**

Double-click `setup.bat` in the project root, or run it from a terminal:

```
setup.bat
```

The script performs these steps in sequence:

1. Verifies Python, pip, Node.js, and npm are installed and on PATH
2. Creates a Python virtual environment at `backend/venv`
3. Installs all Python packages from `backend/requirements.txt`
4. Generates `backend/.env` with cryptographically secure secrets
5. Prompts you to set the initial admin account email and password
6. Applies database migrations via Alembic (creates `backend/database.db`)
7. Runs `npm install` inside the `frontend/` directory

Run `setup.bat` once on a fresh machine. Re-running it is safe — it skips steps that are already complete and prompts before overwriting existing configuration.

---

## Environment File

The setup script creates `backend/.env` automatically. To configure it manually, copy the template:

```
copy backend\.env.example backend\.env
```

Then edit `backend/.env` with your values:

```
JWT_SECRET_KEY=<64-character hex string>
ENCRYPTION_KEY=<Fernet base64 key>
ADMIN_ACCOUNTS=admin@example.com:YourStrongPassword123
ENV=development
ALLOWED_ORIGINS=http://localhost:5173
GOOGLE_API_KEY=<your Google Gemini API key>
GEMINI_API_KEY=<alternative/fallback Google Gemini API key>
GROQ_API_KEY=<your Groq API key>
```

**Key notes:**

- `JWT_SECRET_KEY` — Generate with: `python -c "import secrets; print(secrets.token_hex(32))"`
- `ENCRYPTION_KEY` — Generate with: `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`
- `ADMIN_ACCOUNTS` — Comma-separated list of `email:password` pairs for admin accounts
- `GOOGLE_API_KEY` — Google Gemini API key. Recommended as the primary provider. Get your key at https://aistudio.google.com
- `GEMINI_API_KEY` — Alternative key for Google Gemini API (will be used if GOOGLE_API_KEY is not set)
- `GROQ_API_KEY` — Required to enable Outreach AI fallback or if Google API key is not set. Get your key at https://console.groq.com
- `ALLOWED_ORIGINS` — Set to your frontend URL. Default is `http://localhost:5173`

Do not commit `backend/.env` to version control. It is already listed in `.gitignore`.

---

## Starting the App

Double-click `start.bat` or run from a terminal:

```
start.bat
```

This launches:
- The FastAPI backend on `http://localhost:8000`
- The Vite frontend on `http://localhost:5173`

Both servers open in separate terminal windows. Your browser opens automatically after 5 seconds.

**Manual start (alternative):**

Backend — open a terminal in the project root:

```
cd backend
venv\Scripts\activate
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Frontend — open a second terminal:

```
cd frontend
npm run dev
```

---

## Stopping the App

Double-click `stop.bat` or run from a terminal:

```
stop.bat
```

This terminates all uvicorn and Vite/Node processes and closes their terminal windows.

---

## Available URLs

| Service | URL |
|---|---|
| Web Interface | http://localhost:5173 |
| Swagger API Docs | http://localhost:8000/docs |
| ReDoc API Docs | http://localhost:8000/redoc |

---

## How to Use

**1. Register an account**

Visit http://localhost:5173/register. New accounts start on the Trial tier.

**2. Configure an SMTP sender**

Go to Settings > SMTP Accounts. Add your server credentials. For Gmail, generate an App Password at https://myaccount.google.com/apppasswords — standard Gmail passwords will not work. Click "Test Connection" before saving.

**3. Create a campaign**

Go to Campaigns > New Campaign. Provide a name, subject line, email body, and assign a sender account. Attachments are optional.

**4. Import contacts**

Inside the campaign, upload a CSV file or add contacts manually. Required column: `email`. Optional columns for personalization: `first_name`, `last_name`, `company`, `role`.

**5. Personalize your template**

Use placeholders in the subject or body. Example: `Hi {{first_name}}, I noticed {{company}} recently...`

**6. Start sending**

Click Start Campaign. The background worker begins sending sequentially. Track progress on the campaign detail page.

**7. Use Outreach AI (Pro accounts)**

Go to the Outreach AI tab. Fill in your role, objective, target audience, and offer details. Select tone, writing style, email length, formality, and CTA strength. Click Generate Template. Review, edit, and copy the result or push it directly into a draft campaign.

**8. Review activity**

Open the History page to see a chronological log of all account actions. Filter by type or date range. Export records as CSV.

**9. Sync bounces**

A background task automatically runs every 30 minutes to check all active campaigns for bounces via IMAP and mark bounced contacts. You can also trigger this check manually at any time by clicking Sync Bounces on the History page or the Campaign details page.

---

## Plan Tiers

| Feature | Trial | Pro |
|---|---|---|
| SMTP Accounts | 1 | 3 |
| Campaigns | 3 | Unlimited |
| Outreach AI | Locked | Unlocked |
| Duration | 30 days | Unlimited |

Admins can adjust these limits at any time from the Admin Panel > App Limits tab.

---

## Admin Panel

Access the admin panel at http://localhost:5173/admin (admin accounts only).

| Tab | Description |
|---|---|
| Stats | Total users, active campaigns, today's email volume, system health |
| Users | Search, promote, change plan tier, suspend, or delete accounts |
| Campaigns | Read-only log of all campaigns across all users |
| App Limits | Edit SMTP and campaign quotas for Trial and Pro tiers |
| Contact | Configure system support email and external contact URLs |

---

## Security

- SMTP passwords are encrypted at rest using Fernet before database storage
- JWT access tokens expire after 1 hour with automatic silent rotation
- Refresh tokens are stored in HTTP-only cookies (7-day expiry)
- Rate limiting: 10 requests/min on login, 5 requests/min on registration
- Billing quota checks use in-memory locks to prevent concurrent bypass attempts
- Campaign workers use `is_being_processed` flags to prevent parallel execution on the same campaign
- CSV uploads are capped at 6 MB

---

## Troubleshooting

**Outreach AI returns errors**
Verify `GROQ_API_KEY` is set in `backend/.env` and restart the servers. Environment variables are loaded with `override=True` — a server restart is required after any `.env` change.

**Gmail SMTP authentication fails**
Standard Gmail passwords are blocked for SMTP. Enable 2-Step Verification on your Google account and create an App Password specifically for SMTP use.

**setup.bat fails**
Confirm Python and Node.js are installed and available on your system PATH. Open a new terminal window and re-run `setup.bat`.

**Alembic migration fails**
Ensure `backend/.env` contains valid, non-empty values for all required keys. If the database is corrupted, delete `backend/database.db` and re-run `setup.bat` to rebuild the schema from scratch.

**Servers fail to start after setup**
Check that no other process is using port 8000 or 5173. The backend binds to `127.0.0.1:8000` and the frontend to `localhost:5173`.

---

## Running Tests

Activate the virtual environment and run the test suite:

```
cd backend
venv\Scripts\activate
python test_api.py
```

The suite covers registration, login, JWT refresh, plan restrictions, admin controls, and encryption utilities.

---

## License

MIT License. Use, modify, and distribute freely for personal or commercial projects.