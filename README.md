# ColdOutreach — Self-Hosted Cold Email SaaS

A self-hosted cold email campaign platform. Upload contacts as CSV, write personalized templates, configure SMTP senders, and launch campaigns from a clean web dashboard. Built with FastAPI (Python) on the backend and React + Vite on the frontend.

---

## Features

- Send personalized cold emails via your own Gmail or SMTP account
- Campaign management — create, schedule, pause, and resume campaigns
- Live progress tracking — see sent, pending, and failed counts in real time
- Auto-retry for failed emails
- Attachment support — attach files to your campaigns
- Bounce sync — scan your inbox via IMAP and automatically mark bounced emails
- JWT authentication with silent token refresh
- Dark / Light mode toggle
- Admin Panel — manage all users, campaigns, and global plan limits
- SQLite database — zero external database setup required

---

## Project Structure

```
ColdOutreach/
├── backend/
│   ├── main.py              # Core app, all routes, middleware
│   ├── models.py            # SQLAlchemy database models
│   ├── auth.py              # JWT creation & verification
│   ├── config.py            # Plan limits configuration
│   ├── worker.py            # Background email sending logic
│   ├── requirements.txt     # Python dependencies
│   ├── alembic/             # Database migration scripts
│   └── .env.example         # Copy this to .env and fill in your values
├── frontend/
│   ├── src/
│   │   ├── pages/           # Dashboard, Settings, CampaignDetail, AdminDashboard
│   │   ├── components/      # Shared UI components
│   │   └── config.js        # Frontend plan limits config
│   └── package.json
├── setup.bat                # Run once to install and configure everything
├── start.bat                # Start both servers
└── stop.bat                 # Stop both servers
```

---

## Prerequisites

Make sure the following are installed before you begin:

| Tool       | Minimum Version | Download                        |
|------------|----------------|---------------------------------|
| Python     | 3.10 or higher | https://python.org/downloads    |
| Node.js    | 18 or higher   | https://nodejs.org              |
| Git        | Any recent     | https://git-scm.com             |

Quick check — run the following in a terminal. All four must return a version number:

```
python --version
pip --version
node --version
npm --version
```

---

## First-Time Setup

### Step 1 — Get the code

```bash
git clone <your-repo-url>
cd ColdOutreach
```

### Step 2 — Run the setup script

Double-click **`setup.bat`** from inside the `ColdOutreach/` folder, or run it from a terminal:

```
setup.bat
```

The script runs through five steps automatically:

| Step | What it does |
|------|-------------|
| 1 — Prerequisites | Verifies Python, pip, Node.js, and npm are installed and on PATH |
| 2 — Python venv | Creates `backend\venv` and installs all packages from `requirements.txt` |
| 3 — Environment file | Generates `backend\.env` with cryptographically secure secrets; prompts you for an admin email and password |
| 4 — Database | Runs `alembic upgrade head` to create or update the SQLite schema |
| 5 — Frontend | Runs `npm install` inside the `frontend/` folder |

At the end it offers to launch the app immediately.

> Re-running `setup.bat` on an existing installation is safe. It skips steps that are already complete and applies any new migrations or packages.

---

## Environment File

The setup script generates `backend/.env` for you. If you need to edit it manually:

```env
JWT_SECRET_KEY=<64-character hex string>
ENCRYPTION_KEY=<Fernet base64 key>
ADMIN_ACCOUNTS=admin@yourapp.com:YourStrongPassword123
```

To generate values manually:

```bash
# JWT secret
python -c "import secrets; print(secrets.token_hex(32))"

# Fernet encryption key
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

For multiple admins, separate them with commas:

```env
ADMIN_ACCOUNTS=admin@yourapp.com:Password123,boss@yourapp.com:AnotherPass456
```

> Never commit `backend/.env` to version control. It is already listed in `.gitignore`.

---

## Running the App

### Start

Double-click **`start.bat`** from the `ColdOutreach/` folder.

The script checks that the environment is properly configured before launching. It then opens two terminal windows:

- Backend API on http://localhost:8000
- Frontend UI on http://localhost:5173

Your browser will open automatically after five seconds.

### Stop

Double-click **`stop.bat`** to cleanly terminate both servers and close their terminal windows.

### Manual start (alternative)

Open two separate terminals from the `ColdOutreach/` folder.

**Terminal 1 — Backend:**
```bash
cd backend
venv\Scripts\activate          # Windows
# source venv/bin/activate     # macOS / Linux
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```

---

## Available URLs

| URL                            | Description                   |
|-------------------------------|-------------------------------|
| http://localhost:5173          | Main web application          |
| http://localhost:8000/docs     | Interactive API docs (Swagger) |
| http://localhost:8000/redoc    | Alternative API docs (ReDoc)  |

---

## How to Use

### 1. Register an account

Go to http://localhost:5173, click **Register**, and enter your email and password.

New accounts start on the Trial plan (3 campaigns, 1 SMTP account).

### 2. Add an SMTP sender

Go to **SMTP Settings** > **Add Sender Account**.

| Field      | Example (Gmail)         |
|-----------|-------------------------|
| Host       | smtp.gmail.com          |
| Port       | 465                     |
| Username   | you@gmail.com           |
| Password   | Your App Password       |
| From Name  | Your Name               |
| From Email | you@gmail.com           |

Gmail users must use an App Password, not their regular password. Enable 2-Step Verification on your Google account first, then generate an App Password at https://myaccount.google.com/apppasswords.

Click **Test Connection** to verify before saving.

### 3. Create a campaign

Go to **Campaigns** > **New Campaign** and fill in:

- Campaign name
- Email subject — supports `{{company}}`, `{{first_name}}`, and other placeholders
- Email body — full rich text editor with placeholder support
- Sender account — select the SMTP account you added
- Recipients — upload a CSV file or add contacts manually
- Attachment — optional file to attach to every email

### 4. CSV contact format

Your CSV must have at minimum an `email` column. Any extra columns become placeholders automatically:

```csv
email,company,first_name
ceo@acmecorp.com,Acme Corp,John
founder@startupxyz.com,Startup XYZ,Sarah
```

Download a sample CSV from inside the app via **Campaigns > Download Sample CSV**.

### 5. Email personalization placeholders

| Placeholder      | Replaced with                  |
|-----------------|-------------------------------|
| `{{company}}`    | Company name from CSV          |
| `{{first_name}}` | First name from CSV            |
| `{{last_name}}`  | Last name from CSV             |
| `{{email}}`      | Recipient's email address      |
| `{{role}}`       | Job title / role from CSV      |

Any column in your CSV automatically becomes a `{{column_name}}` placeholder.

### 6. Launch the campaign

Open your campaign and click **Start Now** or **Schedule for later**.

The app sends emails in the background with a delay between each send to avoid spam filters. You can pause and resume at any time.

### 7. Bounce sync

Open a campaign, scroll to **Bounce Sync**, and click **Sync Bounces**.

The app connects to your inbox via IMAP, scans for bounce notifications, and automatically marks those recipients as failed.

---

## Admin Panel

The first admin account is defined in `backend/.env` and created automatically the first time the app starts.

### Accessing the Admin Panel

1. Log in with your admin credentials.
2. Click **Admin Panel** in the sidebar (only visible to admins).
3. Navigate directly to http://localhost:5173/admin.

### Admin Dashboard tabs

| Tab        | What you can do |
|-----------|-----------------|
| Stats      | View system metrics: total users, active campaigns, emails sent today, current plan limits |
| Users      | Search users, change plan (Trial/Pro), change role (User/Admin), suspend/activate, delete accounts |
| Campaigns  | Read-only log of all campaigns across all users |
| App Limits | Edit the max SMTP accounts and max campaigns allowed per plan tier |

### Promoting an existing user to admin

From the **Users** tab, find the user and change their role dropdown from User to Admin. No restart required.

> Admins cannot delete or demote their own account from the panel. Admin accounts are exempt from trial expiry checks.

---

## Plan Tiers

| Feature         | Trial    | Pro       |
|----------------|---------|-----------|
| SMTP Accounts   | 1        | 3         |
| Campaigns       | 3        | Unlimited |
| Trial Duration  | 30 days  | —         |

Admins can change any user's plan instantly from the Admin Panel, or adjust the global limits from the App Limits tab.

---

## Security

- SMTP passwords are encrypted at rest using Fernet symmetric encryption (`ENCRYPTION_KEY`).
- User sessions use JWT access tokens (1-hour expiry) with HTTP-only refresh token cookies (7-day rotation).
- Plan limits and account suspension are enforced server-side on every request.
- Admin routes are protected by a dedicated `get_current_admin_user` FastAPI dependency.
- The SQLite database (`backend/database.db`) stays entirely local on your machine.

---

## Troubleshooting

**`setup.bat` halts at the Prerequisites step**
Ensure Python and Node.js are installed and that you ticked "Add to PATH" during installation. Open a new terminal after installing and try again.

**`venv\Scripts\activate` is not recognized**
Re-run `setup.bat`. It will recreate the virtual environment automatically.

**`pip install` fails with cryptography errors**
On Windows, install Microsoft C++ Build Tools from https://visualstudio.microsoft.com/visual-cpp-build-tools, then re-run `setup.bat`.

**`alembic upgrade head` fails**
Make sure `backend\.env` exists with all three required values. Run `setup.bat` and choose to regenerate the `.env` if needed.

**`npm install` fails**
Ensure you are on Node.js version 18 or higher. Run `npm cache clean --force` then re-run `setup.bat`.

**Backend starts but frontend shows a blank page or errors**
Both servers must be running simultaneously. Backend must be on port 8000, frontend on 5173.

**SMTP "Authentication failed"**
For Gmail, use an App Password, not your regular password. Make sure 2-Step Verification is enabled on your Google account first.

**`ENCRYPTION_KEY` error on startup**
Your `.env` is missing or the key format is wrong. Re-run `setup.bat` and choose to regenerate the `.env`.

**Admin Panel link not visible**
Your account does not have the admin role. Verify that `ADMIN_ACCOUNTS` in `.env` matches the email you logged in with, then restart the backend.

**Admin login returns 401**
The admin account may already exist in the database with a different password. Delete `backend/database.db`, re-run `setup.bat` (it will re-run migrations and recreate the admin), then log in again.

---

## Running Tests

From inside the `backend/` folder with the virtual environment active:

```bash
python test_api.py
```

This runs the full test suite covering registration, login, SMTP limits, campaign limits, trial expiry, token refresh, account suspension, and all admin endpoints.

---

## License

MIT — free to use, modify, and distribute.
