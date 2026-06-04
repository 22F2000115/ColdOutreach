# 📧 Cold Email Outreach — Micro SaaS

A self-hosted cold email campaign tool. Upload your contact list as a CSV, write personalized email templates, configure your SMTP sender, and launch campaigns — all from a clean web UI.

---

## 🗂️ Project Structure

```
ColdOutreach/
├── backend/          # FastAPI (Python) REST API
│   ├── main.py
│   ├── requirements.txt
│   └── .env.example  ← copy this to .env and fill in your secrets
├── frontend/         # React + Vite UI
│   ├── src/
│   └── package.json
├── start.bat         # One-click start (Windows)
└── stop.bat          # One-click stop (Windows)
```

---

## ✅ Prerequisites

Make sure these are installed before you begin:

| Tool | Version | Download |
|------|---------|----------|
| **Python** | 3.10 or higher | https://python.org/downloads |
| **Node.js** | 18 or higher | https://nodejs.org |
| **Git** | Any recent | https://git-scm.com |

> **Tip:** After installing Python, make sure `python --version` and `pip --version` both work in your terminal. Same for `node --version` and `npm --version`.

---

## 🚀 First-Time Setup

### Step 1 — Clone the repository

```bash
git clone <your-repo-url>
cd ColdOutreach
```

---

### Step 2 — Set up the Backend

```bash
cd backend
```

**Create a virtual environment:**

```bash
python -m venv venv
```

**Activate it:**

- Windows:
  ```bash
  venv\Scripts\activate
  ```
- macOS / Linux:
  ```bash
  source venv/bin/activate
  ```

**Install Python dependencies:**

```bash
pip install -r requirements.txt
```

---

### Step 3 — Configure environment variables

Copy the example file and fill in your values:

```bash
# Windows
copy .env.example .env

# macOS / Linux
cp .env.example .env
```

Now open `backend/.env` in any text editor and set:

```env
JWT_SECRET_KEY=<a long random secret string>
ENCRYPTION_KEY=<a Fernet encryption key>
```

**How to generate these values:**

```bash
# While your venv is active, run Python:
python -c "import secrets; print(secrets.token_hex(32))"
```
→ Paste the output as your `JWT_SECRET_KEY`.

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```
→ Paste the output as your `ENCRYPTION_KEY`.

> ⚠️ **Never share or commit your `.env` file.** It is already in `.gitignore`.

---

### Step 4 — Set up the Frontend

```bash
cd ../frontend
npm install
```

---

## ▶️ Running the App

### Option A — One-click (Windows only)

From the `ColdOutreach/` root folder, double-click **`start.bat`**.

This opens two terminal windows automatically:
- Backend API at **http://localhost:8000**
- Frontend UI at **http://localhost:5173**

To stop both servers, double-click **`stop.bat`**.

---

### Option B — Manual (Windows, macOS, Linux)

Open **two separate terminals** from the `ColdOutreach/` folder:

**Terminal 1 — Backend:**

```bash
cd backend
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux

uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

**Terminal 2 — Frontend:**

```bash
cd frontend
npm run dev
```

Then open your browser at **http://localhost:5173**

---

## 🌐 Available URLs

| URL | What it is |
|-----|-----------|
| http://localhost:5173 | Web application (main UI) |
| http://localhost:8000/docs | Interactive API docs (Swagger UI) |
| http://localhost:8000/redoc | Alternative API docs |

---

## 📋 How to Use

### 1. Create an account
Go to http://localhost:5173 → click **Register** → enter your email and password.

### 2. Add an SMTP sender
Go to **Settings** → **Add Sender Account** and fill in your SMTP details.

| Field | Example (Gmail) |
|-------|----------------|
| Host | `smtp.gmail.com` |
| Port | `587` |
| Username | `you@gmail.com` |
| Password | Your **App Password** (not your normal password) |
| From Name | `Your Name` |
| From Email | `you@gmail.com` |

> **Gmail users:** You must use an [App Password](https://myaccount.google.com/apppasswords), not your regular Gmail password. Enable 2-Step Verification first, then generate an App Password.

Click **Test Connection** to verify it works before saving.

### 3. Create a campaign
Go to **Campaigns** → **New Campaign** and fill in:
- **Campaign name**
- **Email subject** — supports `{{company}}` placeholder
- **Email body** — supports `{{company}}` placeholder
- **Sender account** — select the SMTP sender you added
- **Contacts CSV** — upload a CSV file with your contacts

### 4. CSV format

Your contacts file must have at minimum an `email` column. A `company` column is optional but enables personalization:

```csv
email,company
ceo@acmecorp.com,Acme Corp
founder@startupxyz.com,Startup XYZ
```

> You can download a sample CSV from inside the app (Campaigns → Sample CSV button).

### 5. Personalization placeholders

Use these in your subject and body templates:

| Placeholder | Replaced with |
|-------------|--------------|
| `{{company}}` | The company name from your CSV |

Example subject: `Quick question for {{company}}`

### 6. Launch the campaign
Open your campaign → click **Start**. The app sends emails in the background with a delay between each one to avoid spam filters. You can **Pause** and **Resume** at any time.

---

## 📁 CSV Column Names Recognized

The app automatically detects these column names (case-insensitive):

| Data | Recognized column names |
|------|------------------------|
| Email | `email`, `email address`, `mail` |
| Company | `company`, `company name`, `org`, `organization` |

---

## 🔒 Security Notes

- Passwords for your SMTP accounts are **encrypted at rest** using Fernet symmetric encryption.
- User authentication uses **JWT tokens** with a configurable secret key.
- The SQLite database (`database.db`) is created automatically on first run — it stays local on your machine.

---

## 🛠️ Troubleshooting

**`venv\Scripts\activate` is not recognized**
→ Make sure Python is installed and added to your PATH. Re-run `python -m venv venv`.

**`pip install` fails with cryptography errors**
→ Upgrade pip first: `python -m pip install --upgrade pip`, then retry.

**`npm install` fails**
→ Make sure you're inside the `frontend/` folder and Node.js ≥ 18 is installed.

**Backend starts but frontend can't connect**
→ Make sure both servers are running. The backend must be on port `8000` and the frontend on port `5173`.

**SMTP Authentication failed**
→ For Gmail: use an App Password, not your regular password. Make sure 2FA is enabled on your Google account.

**`ENCRYPTION_KEY` error on startup**
→ Your `.env` file is missing or the key is invalid. Re-run the Fernet key generation command above.

---

## 📄 License

MIT — free to use, modify, and distribute.
