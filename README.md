# 📧 ColdOutreach — Self-Hosted Cold Email SaaS

A self-hosted cold email campaign platform. Upload your contacts as a CSV, write personalized templates, configure your SMTP senders, and launch campaigns — all from a clean web dashboard. Built with **FastAPI** (Python) on the backend and **React + Vite** on the frontend.

---

## ✨ Features

- 📤 **Send personalized cold emails** via your own Gmail / SMTP account
- 📋 **Campaign management** — create, schedule, pause, and resume campaigns
- 📊 **Live progress tracking** — see sent, pending, and failed counts in real time
- 🔁 **Auto-retry** for failed emails
- 📎 **Attachment support** — attach files to your campaigns
- 📡 **Bounce sync** — scan your inbox via IMAP and automatically mark bounced emails
- 🔐 **JWT authentication** with silent token refresh
- 🌙 **Dark / Light mode** toggle
- 👑 **Admin Panel** — manage all users, campaigns, and global plan limits
- 💾 **SQLite database** — zero external database setup required

---

## 🗂️ Project Structure

```
ColdOutreach/
├── backend/                 # FastAPI (Python) REST API
│   ├── main.py              # Core app, all routes, middleware
│   ├── models.py            # SQLAlchemy database models
│   ├── auth.py              # JWT creation & verification
│   ├── config.py            # Plan limits configuration
│   ├── worker.py            # Background email sending logic
│   ├── requirements.txt     # Python dependencies
│   ├── alembic/             # Database migration scripts
│   └── .env.example         # ← copy this to .env and fill in your values
├── frontend/                # React + Vite web UI
│   ├── src/
│   │   ├── pages/           # Dashboard, Settings, CampaignDetail, AdminDashboard
│   │   ├── components/      # Shared UI components
│   │   └── config.js        # Frontend plan limits config
│   └── package.json
├── start.bat                # One-click start (Windows)
└── stop.bat                 # One-click stop (Windows)
```

---

## ✅ Prerequisites

Make sure these are installed before you begin:

| Tool | Minimum Version | Download |
|------|----------------|----------|
| **Python** | 3.10 or higher | https://python.org/downloads |
| **Node.js** | 18 or higher | https://nodejs.org |
| **Git** | Any recent | https://git-scm.com |

> **Quick check:** Run `python --version`, `pip --version`, `node --version`, and `npm --version` in your terminal. All four must work.

---

## 🚀 First-Time Setup

### Step 1 — Get the code

```bash
git clone <your-repo-url>
cd ColdOutreach
```

---

### Step 2 — Set up the Python backend

```bash
cd backend
```

**Create a virtual environment:**
```bash
python -m venv venv
```

**Activate it:**
```bash
# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate
```

**Install Python dependencies:**
```bash
pip install -r requirements.txt
```

---

### Step 3 — Configure your environment file

Copy the example `.env` file:
```bash
# Windows
copy .env.example .env

# macOS / Linux
cp .env.example .env
```

Now open `backend/.env` in a text editor and fill in all values:

```env
# Required — generate using the commands below
JWT_SECRET_KEY=<a long random secret string>
ENCRYPTION_KEY=<a Fernet encryption key>

# Required — define your admin account(s)
# Format: email:password  — separate multiple admins with commas
ADMIN_ACCOUNTS=admin@yourapp.com:yourStrongPassword123
```

**How to generate the secret values:**

Generate your `JWT_SECRET_KEY`:
```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

Generate your `ENCRYPTION_KEY`:
```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

> ⚠️ **Never share or commit your `.env` file.** It is already listed in `.gitignore`.

---

### Step 4 — Run database migrations

With your virtual environment still active, run:

```bash
python -m alembic upgrade head
```

This creates the SQLite database and applies all schema migrations automatically.

---

### Step 5 — Set up the frontend

```bash
cd ../frontend
npm install
```

---

## ▶️ Running the App

### Option A — One-click (Windows only)

From the `ColdOutreach/` root folder, double-click **`start.bat`**.

This launches two terminal windows automatically:
- **Backend API** → http://localhost:8000
- **Frontend UI** → http://localhost:5173

To stop everything, double-click **`stop.bat`**.

---

### Option B — Manual (Windows / macOS / Linux)

Open **two separate terminals** from the `ColdOutreach/` folder.

**Terminal 1 — Backend:**
```bash
cd backend
venv\Scripts\activate     # Windows
# source venv/bin/activate  # macOS/Linux
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```

Then open **http://localhost:5173** in your browser.

---

## 🌐 Available URLs

| URL | Description |
|-----|-------------|
| http://localhost:5173 | Main web application |
| http://localhost:8000/docs | Interactive API docs (Swagger UI) |
| http://localhost:8000/redoc | Alternative API docs (ReDoc) |

---

## 📋 How to Use

### 1. Register an account
Go to http://localhost:5173 → click **Register** → enter your email and password.

New accounts start on the **Trial** plan (3 campaigns, 1 SMTP account).

---

### 2. Add an SMTP sender
Go to **SMTP Settings** → **Add Sender Account**.

| Field | Example (Gmail) |
|-------|----------------|
| Host | `smtp.gmail.com` |
| Port | `465` |
| Username | `you@gmail.com` |
| Password | Your **App Password** (not your normal password) |
| From Name | `Your Name` |
| From Email | `you@gmail.com` |

> **Gmail users:** You must use an [App Password](https://myaccount.google.com/apppasswords). Enable 2-Step Verification on your Google account first, then generate an App Password specifically for this app.

Click **Test Connection** to verify before saving.

---

### 3. Create a campaign
Go to **Campaigns** → **New Campaign** and fill in:
- **Campaign name**
- **Email subject** — supports `{{company}}`, `{{first_name}}` and other placeholders
- **Email body** — full rich text editor with placeholder support
- **Sender account** — select the SMTP account you added
- **Recipients** — upload a CSV file or add contacts manually
- **Attachment** — optional file to attach to every email

---

### 4. CSV contact format

Your CSV must have at minimum an `email` column. Any extra columns become placeholders automatically:

```csv
email,company,first_name
ceo@acmecorp.com,Acme Corp,John
founder@startupxyz.com,Startup XYZ,Sarah
```

> Download a sample CSV from inside the app via **Campaigns → Download Sample CSV**.

---

### 5. Email personalization placeholders

Use these in your subject and body templates:

| Placeholder | Replaced with |
|-------------|---------------|
| `{{company}}` | Company name from CSV |
| `{{first_name}}` | First name from CSV |
| `{{last_name}}` | Last name from CSV |
| `{{email}}` | Recipient's email address |
| `{{role}}` | Job title/role from CSV |

Any column in your CSV automatically becomes a `{{column_name}}` placeholder.

---

### 6. Launch the campaign
Open your campaign → click **Start Now** or **Schedule for later**.

The app sends emails in the background with a delay between each send to avoid spam filters. You can **Pause** and **Resume** at any time.

---

### 7. Bounce sync
Open a campaign → scroll to **Bounce Sync** → click **Sync Bounces**.

The app connects to your inbox via IMAP, scans for bounce notifications, and automatically marks those recipients as `failed`.

---

## 👑 Admin Panel

The first admin account(s) are defined in your `.env` file and are automatically created the first time the app starts.

### Setting up admins

In `backend/.env`, add:
```env
# Single admin
ADMIN_ACCOUNTS=admin@yourapp.com:StrongPassword123

# Multiple admins (comma-separated)
ADMIN_ACCOUNTS=admin@yourapp.com:StrongPassword123,boss@yourapp.com:AnotherPass456
```

Restart the app and these accounts will be created automatically with the `admin` role and `pro` plan.

### Accessing the Admin Panel

1. Log in with your admin credentials.
2. Click **Admin Panel** in the sidebar (only visible to admins).
3. Navigate to **http://localhost:5173/admin**.

### Admin Dashboard tabs

| Tab | What you can do |
|-----|----------------|
| 📊 **Stats** | View system metrics: total users, active campaigns, emails sent today, current plan limits |
| 👥 **Users** | Search users, change plan (Trial/Pro), change role (User/Admin), suspend/activate, delete accounts |
| 📧 **Campaigns** | Read-only log of all campaigns across all users |
| ⚙️ **App Limits** | Edit the max SMTP accounts and max campaigns allowed per plan tier |

### Promoting an existing user to admin

From the **Users** tab → find the user → change their role dropdown from `User` to `Admin`. No restart required.

> 🔒 **Safety:** Admins cannot delete or demote their own account from the panel. Admin accounts are also exempt from trial expiry checks.

---

## 📊 Plan Tiers

| Feature | Trial | Pro |
|---------|-------|-----|
| SMTP Accounts | 1 | 3 |
| Campaigns | 3 | Unlimited |
| Trial Duration | 30 days | — |

Admins can change any user's plan instantly from the Admin Panel, or adjust the global limits from the App Limits tab.

---

## 🔒 Security

- SMTP passwords are **encrypted at rest** using Fernet symmetric encryption (`ENCRYPTION_KEY`).
- User sessions use **JWT access tokens** (1-hour expiry) + **HTTP-only refresh token cookies** (7-day rotation).
- Plan limits and account suspension are enforced **server-side** on every request.
- Admin routes are protected by a dedicated `get_current_admin_user` FastAPI dependency.
- The SQLite database (`backend/database.db`) stays entirely local on your machine.

---

## 🛠️ Troubleshooting

**`venv\Scripts\activate` is not recognized**
→ Make sure Python is installed and added to PATH. Re-run `python -m venv venv` from inside the `backend/` folder.

**`pip install` fails with cryptography errors**
→ Upgrade pip first: `python -m pip install --upgrade pip`, then retry `pip install -r requirements.txt`.

**`alembic upgrade head` fails**
→ Make sure your virtual environment is activated and you are inside the `backend/` folder.

**`npm install` fails**
→ Make sure you are inside the `frontend/` folder and Node.js ≥ 18 is installed.

**Backend starts but frontend shows blank page or errors**
→ Make sure both servers are running simultaneously. Backend must be on port `8000`, frontend on `5173`.

**SMTP "Authentication failed"**
→ For Gmail: use an App Password (not your regular password). Make sure 2FA is enabled on your Google account first.

**`ENCRYPTION_KEY` error on startup**
→ Your `.env` file is missing or the key format is wrong. Regenerate it with the Fernet command above.

**Admin Panel link not visible**
→ Your account does not have the `admin` role. Check that `ADMIN_ACCOUNTS` in `.env` matches the email you logged in with, then restart the backend.

**Admin login returns 401**
→ The admin account may already exist with a different password. Use the Admin Panel's Users tab from another admin account to update it, or delete the DB and re-seed.

---

## 🧪 Running Tests

From inside the `backend/` folder with the virtual environment active:

```bash
python test_api.py
```

This runs the full programmatic test suite covering registration, login, SMTP limits, campaign limits, trial expiry, token refresh, account suspension, and all admin endpoints.

---

## 📄 License

MIT — free to use, modify, and distribute.
