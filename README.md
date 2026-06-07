# ColdOutreach — Self-Hosted Cold Email SaaS

ColdOutreach is a powerful, self-hosted cold email campaign automation platform and SaaS. Designed for businesses, founders, and sales teams who want complete ownership of their outreach data and operations, ColdOutreach runs locally or on your own server, allowing you to send highly personalized outreach sequences using your own email domains with zero recurring software fees.

---

## Features

- **Cold Email Campaign Management**: Create, start, pause, resume, and delete email campaigns from a clean, central dashboard.
- **Gmail & SMTP Configuration**: Connect custom SMTP accounts with support for Gmail App Passwords and real-time connectivity testing.
- **Lead Import & Management**: Import contacts seamlessly via CSV file uploads or add individual prospects manually.
- **Personalized Templates**: Write custom templates with a rich text editor supporting dynamic personalization placeholders:
  - `{{company}}`
  - `{{first_name}}`
  - `{{last_name}}`
  - `{{email}}`
  - `{{role}}`
- **Live Progress Tracking**: Monitor active campaigns in real time with counts for total sent, delivered, and bounced/failed emails.
- **Auto-Retry Mechanism**: Automatically retries sending emails in the background during transient mailbox failures.
- **Bounce Synchronization**: Connect your sender accounts via secure IMAP to scan and synchronize bounces, marking failed records in a single database transaction.
- **Attachment Support**: Upload and attach files to your cold outreach sequences.
- **Outreach AI (Pro Plan Only)**: Write highly converting copy using an AI-powered email generator powered by Groq's `llama-3.3-70b-versatile` model. Instantly generates subject line options and email bodies tailored to prospect details, tone, and campaign goals. Features a premium outcome-focused **Email Length** selector in dark mode with responsive card grids (`Quick & Punchy`, `Balanced & Persuasive`, `Detailed & Technical`) and hover-glow effects.
- **Activity History**: A per-user logs timeline that tracks important actions (campaign runs, email sends, SMTP modifications, and billing tier updates) alongside detailed campaign stats and accordions.
- **Secure Authentication**: JWT-based session management with silent access token refreshes and HTTP-only cookie security.
- **Vibrant Modern UI**: Sleek user experience with full dark and light mode toggle support. Includes custom individual color indicators on metric cards, dynamic theme-compatible badges, and a premium SaaS dark mode (deep blue-black `#07080f` background, `#111318` cards, and `#00e5a0` green glow accent).
- **High legibility Typography**: All page elements, form labels, secondary muted texts, and input placeholders are optimized with high-contrast color values for maximum legibility in both light and dark mode.
- **Admin Panel**: Dedicated dashboard for system administration (Metrics Stats, User Search & Actions, global Plan Limits, and Support Contacts).
- **Embedded Database**: Local SQLite database storage—zero external SQL engine configuration required.
- **System Robustness**: 
  - API endpoint rate-limiting protecting sensitive routes.
  - Thread-safe concurrency database and user-level locks preventing billing quota bypasses.
  - Strict input validations and file size constraints on uploads.
  - SMTP passwords encrypted at rest using Fernet symmetric cryptography.

---

## Tech Stack

- **Backend**: FastAPI (Python), SQLAlchemy ORM, SQLite database, Alembic migrations, Uvicorn, SlowAPI (Rate Limiting), Groq Python SDK, Cryptography (Fernet)
- **Frontend**: React (v18), React Router (v7), Vite, Tailwind CSS (Design Tokens & Utility Classes)

---

## Project Structure

The project code is organized into clean backend and frontend directories:

```
ColdOutreach/
├── backend/
│   ├── main.py              # Application entrypoint (FastAPI routes, middleware, API logic)
│   ├── models.py            # SQLAlchemy database models
│   ├── auth.py              # JWT authentication & session helper
│   ├── config.py            # Plan limits & global configurations
│   ├── database.py          # SQLAlchemy database engine connection setup
│   ├── worker.py            # Background worker threads & campaign sending logic
│   ├── security.py          # SMTP password encryption (Fernet) helpers
│   ├── activity.py          # Activity logger utility functions
│   ├── requirements.txt     # Python package dependencies
│   ├── alembic.ini          # Alembic database migration configuration
│   ├── alembic/             # Version migrations scripts directory
│   ├── .env.example         # Template environment file
│   └── test_api.py          # Backend test suite
├── frontend/
│   ├── src/
│   │   ├── pages/           # Application views
│   │   │   ├── Login.jsx            # User sign-in page
│   │   │   ├── Register.jsx         # User registration page
│   │   │   ├── Dashboard.jsx        # Campaigns index & statistics page
│   │   │   ├── CampaignDetail.jsx   # Specific campaign editor, contacts list, and worker dashboard
│   │   │   ├── Settings.jsx         # SMTP sender account setup page
│   │   │   ├── OutreachAI.jsx       # AI email generator page (Outreach AI)
│   │   │   ├── History.jsx          # Log timeline, activity filters, and CSV exporter
│   │   │   ├── Contact.jsx          # Support contact & billing upgrade page
│   │   │   └── AdminDashboard.jsx   # Central administration tabbed panel
│   │   ├── components/      # Shared components
│   │   │   ├── RichEditor.jsx         # Wysiwyg template text area
│   │   │   ├── FailedContactsTab.jsx  # Segmented worker retry logs
│   │   │   └── TrialExpiredModal.jsx  # Floating billing tier block
│   │   ├── App.jsx          # Main client router & sidebar layout definition
│   │   ├── main.jsx         # Vite react rendering entrypoint
│   │   └── index.css        # Global CSS variables & layout definitions
│   └── package.json         # Node package configuration
├── setup.bat                # Automated one-click environment installer
├── start.bat                # Automation script to start backend & frontend servers
└── stop.bat                 # Automation script to terminate active processes
```

---

## Prerequisites

Ensure you have the following installed on your machine:
- **Python**: Version `3.10` or higher (available at [python.org](https://www.python.org/downloads/))
- **Node.js**: Version `18` or higher (available at [nodejs.org](https://nodejs.org/))
- **Git**: [git-scm.com](https://git-scm.com/)

Verify the installations by running:
```bash
python --version
pip --version
node --version
npm --version
```

---

## First-Time Setup

1. **Clone the Repository**:
   ```bash
   git clone <your-repo-url>
   cd ColdOutreach
   ```

2. **Run the Automated Setup Script**:
   Double-click the **`setup.bat`** file in the root folder, or execute it in a terminal:
   ```bash
   setup.bat
   ```
   
   The installer script handles the following steps:
   - Verifies the installation of prerequisites on your system PATH.
   - Installs a local Python virtual environment (`backend/venv`) and installs packages from `requirements.txt`.
   - Generates a local `backend/.env` file with secure, randomly generated secrets and guides you to register the initial system admin login credentials.
   - Applies database migrations to create the SQLite file.
   - Runs `npm install` inside the `frontend/` folder.

---

## Environment File

The file **`backend/.env`** holds your environment keys. It should contain the following fields:

```env
JWT_SECRET_KEY=b19d33169b8486c2259477d49bd0ead836f5ed79e9df934915cd70684d5554f9
ENCRYPTION_KEY=l-oyTTaCBbT-RBYIchpTBqdioFgU8tXQ1ScwzJGpHwI=
ADMIN_ACCOUNTS=admin@yourapp.com:YourStrongPassword123
ENV=development
ALLOWED_ORIGINS=http://localhost:5173
GROQ_API_KEY=your_groq_api_key_here
```

- **GROQ_API_KEY**: Required to activate **Outreach AI** features. Acquire your key from the Groq console.
- **ADMIN_ACCOUNTS**: A comma-separated list of administrative accounts in the format `email:password`.

---

## Running the App

### 1. Simple Run
Double-click the **`start.bat`** script in the root directory. It launches the Python server and Vite dev environment in separate windows. Your browser will automatically navigate to the dashboard at:
- **Web Interface**: `http://localhost:5173`

### 2. Manual Start (Alternative)
If you prefer starting the processes manually:

**Terminal 1 (Backend API)**:
```bash
cd backend
venv\Scripts\activate      # On Windows
# source venv/bin/activate # On macOS / Linux
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

**Terminal 2 (Frontend Client)**:
```bash
cd frontend
npm run dev
```

### Stopping the App
Double-click **`stop.bat`** in the root directory to safely shut down both backend and frontend server processes.

---

## Available URLs

| Component | URL |
|---|---|
| Main Web Interface | [http://localhost:5173](http://localhost:5173) |
| Swagger API Documentation | [http://localhost:8000/docs](http://localhost:8000/docs) |
| ReDoc API Documentation | [http://localhost:8000/redoc](http://localhost:8000/redoc) |

---

## Plan Tiers

System resource limits are dictated by the user's plan tier:

| Feature | Trial | Pro |
|---|---|---|
| **SMTP Accounts Limit** | 1 | 10 |
| **Campaigns Limit** | 3 | 50 |
| **Outreach AI (AI Writer)** | 🔒 Locked | 🔓 Unlocked |
| **Trial Duration** | 30 days | Unlimited |

*Note: Admins can modify global thresholds per tier dynamically via the App Limits admin tab.*

---

## How to Use

1. **Register**: Sign up at [http://localhost:5173/register](http://localhost:5173/register). New users start on the Trial tier.
2. **Setup SMTP**: Navigate to **SMTP Settings > Add Sender Account**. Input your server credentials (Gmail users should use an [App Password](https://myaccount.google.com/apppasswords)). Click **Test Connection** and save.
3. **Outreach AI (For Pro Users)**: Go to the **Outreach AI** tab. Specify prospect company, role, email type, tone, and campaign goal to generate high-converting copy. Copy the copy or apply it directly to a draft campaign.
4. **Create a Campaign**: Go to **Campaigns > New Campaign**. Provide the campaign name, subject, rich-text body, SMTP sender, and attachments.
5. **Import Leads**: Inside your campaign setup, upload a contact list via a CSV file (maximum 6 MB size constraint) or enter addresses manually.
6. **Apply Personalization**: Use brackets like `{{first_name}}` or `{{company}}` in the subject or body to personalize emails dynamically with details from the columns of your CSV.
7. **Start Sending**: Click **Start Campaign**. The worker process will begin sending emails sequentially.
8. **Track History**: Open the **History** page to review logs of campaign completions, sent messages, account events, and export them as a CSV.
9. **Sync Bounces**: Under the **History** header, click **Sync Bounces** to query mailboxes via IMAP, automatically updating bounce records.

---

## Admin Panel

Admins can access the dashboard tabs at [http://localhost:5173/admin](http://localhost:5173/admin) to manage system-wide settings:

- **Stats Overview**: Tracks total registered users, active campaigns, today's email volume, and system health metrics.
- **Users Management**: Search, promote roles (User/Admin), toggle tiers (Trial/Pro), suspend/activate, and delete accounts.
- **Campaigns Log**: A global, read-only list showing campaign status, progression, and ownership records.
- **App Limits**: Instantly update allowed quotas (Max SMTP accounts, Max campaigns) for both Trial and Pro plan tiers.
- **Contact Details**: Configure system support emails and external contact URLs.

---

## Security & Robustness

- **SMTP Password Encryption**: Sender account passwords are encrypted at rest using Fernet symmetric cryptography (`ENCRYPTION_KEY`).
- **Endpoint Protection**: Rate limits on registration (`5 requests/min`) and login (`10 requests/min`) endpoints defend against brute-force attacks.
- **JWT Session Safety**: Integrates 1-hour access token rotation with secure, HTTP-only refresh cookies (7-day duration).
- **Billing Quota Locks**: Concurrent requests are serialized through memory locks, preventing concurrent attempts to bypass SMTP or Campaign limits.
- **Campaign Worker Locks**: Active campaign pipelines are marked using `is_being_processed` DB locks to prevent race conditions during email generation.
- **Upload Constraints**: Enforces a strict 6 MB limit validation on CSV file uploads.

---

## Troubleshooting

- **Outreach AI generates errors or doesn't respond**:
  Ensure you have configured `GROQ_API_KEY` inside your `backend/.env` file and restarted the servers. The platform loads environment variables with override enabled (`load_dotenv(override=True)`) to ensure this configuration takes precedence.
- **Gmail SMTP issues / Authentication Failed**:
  Gmail blocks standard password access. Enable 2-Step Verification on your Google Account and configure an **App Password** for SMTP.
- **setup.bat fails to complete**:
  Ensure Python, Node.js, and git are properly installed and added to your system PATH. Close the terminal window and start `setup.bat` in a new window.
- **Alembic migration conflicts**:
  Ensure your `backend/.env` contains valid values. Delete `backend/database.db` and run `setup.bat` to rebuild the schema from scratch if database corruption occurs.

---

## Running Tests

To run the unit and integration tests, run the following commands inside the virtual environment:

```bash
cd backend
venv\Scripts\activate      # Activate virtual environment
python test_api.py         # Execute test suite
```

This validates registration flow, JWT token refresh, plan restrictions, admin controls, and encryption utilities.

---

## License

This software is released under the **MIT License**. Feel free to use, modify, and distribute it for personal or commercial projects.
