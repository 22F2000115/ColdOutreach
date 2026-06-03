"""
Cold Email Sender — Automated personalized outreach via Gmail SMTP.

Usage:
    python cold_email_sender.py [--csv contacts.csv] [--attachment file.pdf] [--dry-run]

Setup:
    1. Enable 2FA on your Google account.
    2. Generate an App Password: Google Account → Security → App Passwords.
    3. Copy config.example.env → config.env and fill in your credentials.
"""

import csv
import logging
import os
import smtplib
import sys
import time
import argparse
from datetime import date, datetime
from email import encoders
from email.mime.base import MIMEBase
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path

# ── Configuration ────────────────────────────────────────────────────────────

# Load config.env if it exists
config_path = Path("config.env")
if config_path.exists():
    with config_path.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                key, val = line.split("=", 1)
                os.environ[key.strip()] = val.strip()

GMAIL_USER     = os.getenv("GMAIL_USER", "[EMAIL_ADDRESS]")
GMAIL_PASSWORD = os.getenv("GMAIL_PASSWORD", "xlpw avsn bejz sgua")   # App Password, NOT your login password

EMAIL_SUBJECT  = os.getenv("EMAIL_SUBJECT", "Exploring a Potential Partnership with {company}")

body_file = Path("email_body.txt")
if body_file.exists():
    EMAIL_BODY_TEMPLATE = body_file.read_text(encoding="utf-8")
else:
    EMAIL_BODY_TEMPLATE = os.getenv("EMAIL_BODY", """\
Hi,

I hope this message finds you well. I came across {company} and was genuinely impressed
by the work your team is doing in the space.

I'd love to explore whether there's a mutually beneficial opportunity for us to collaborate.
I've attached a short overview that explains what we do and the value we've delivered for
similar companies.

Would you be open to a brief 20-minute call this week or next? I'm happy to work around
your schedule.

Looking forward to hearing from you.

Best regards,
[Your Name]
[Your Title]
[Your Company]
[Your Phone]
""")

DAILY_LIMIT        = 100          # Gmail's safe sending ceiling
DELAY_BETWEEN_SEND = 3            # seconds between each email (be polite to Gmail)
MAX_RETRIES        = 2            # retry attempts for transient failures
RETRY_DELAY        = 10           # seconds to wait before a retry

STATUS_SENT        = "Sent"
STATUS_FAILED      = "Failed"
STATUS_SKIPPED     = "Skipped"    # already sent in a previous run

CSV_EMAIL_COL      = "email"      # column header in the CSV
CSV_COMPANY_COL    = "company"    # column header in the CSV
CSV_STATUS_COL     = "status"     # column header written/updated by this script

# ── Logging setup ─────────────────────────────────────────────────────────────

log_dir  = Path("logs")
log_dir.mkdir(exist_ok=True)
log_file = log_dir / f"email_run_{date.today()}.log"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[
        logging.FileHandler(log_file, encoding="utf-8"),
        logging.StreamHandler(sys.stdout),
    ],
)
log = logging.getLogger(__name__)


# ── Helpers ───────────────────────────────────────────────────────────────────

def load_contacts(csv_path: Path) -> list[dict]:
    """Return all rows from the CSV as a list of dicts."""
    with csv_path.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    # Normalise column names (strip whitespace, lowercase)
    normalised = []
    for row in rows:
        normalised.append({k.strip().lower(): v.strip() for k, v in row.items()})
    return normalised


def save_contacts(csv_path: Path, contacts: list[dict]) -> None:
    """Write contacts back to the CSV, preserving all original columns."""
    if not contacts:
        return
    fieldnames = list(contacts[0].keys())
    if CSV_STATUS_COL not in fieldnames:
        fieldnames.append(CSV_STATUS_COL)

    with csv_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(contacts)


def build_message(
    sender: str,
    recipient: str,
    company: str,
    attachment_path: Path | None,
    dry_run: bool = False,
) -> MIMEMultipart:
    """Construct the MIME email message."""
    subject = EMAIL_SUBJECT.format(company=company)
    body    = EMAIL_BODY_TEMPLATE.format(company=company)

    msg = MIMEMultipart()
    msg["From"]    = sender
    msg["To"]      = recipient
    msg["Subject"] = subject
    msg.attach(MIMEText(body, "plain"))

    if attachment_path and attachment_path.exists():
        with attachment_path.open("rb") as fp:
            part = MIMEBase("application", "octet-stream")
            part.set_payload(fp.read())
        encoders.encode_base64(part)
        part.add_header(
            "Content-Disposition",
            f'attachment; filename="{attachment_path.name}"',
        )
        msg.attach(part)
        if not dry_run:
            log.debug("Attached %s", attachment_path.name)
    elif attachment_path:
        log.warning("Attachment not found, skipping: %s", attachment_path)

    return msg


def send_email(
    smtp: smtplib.SMTP_SSL,
    sender: str,
    recipient: str,
    msg: MIMEMultipart,
) -> bool:
    """Send one email; return True on success, False on failure."""
    smtp.sendmail(sender, recipient, msg.as_string())
    return True


# ── Main logic ────────────────────────────────────────────────────────────────

def run(csv_path: Path, attachment_path: Path | None, dry_run: bool) -> None:
    log.info("=" * 60)
    log.info("Cold Email Sender - %s", datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    log.info("CSV        : %s", csv_path)
    log.info("Attachment : %s", attachment_path or "none")
    log.info("Dry run    : %s", dry_run)
    log.info("Daily limit: %d", DAILY_LIMIT)
    log.info("=" * 60)

    contacts = load_contacts(csv_path)
    if not contacts:
        log.error("CSV is empty or could not be read.")
        return

    # Validate required columns
    for col in (CSV_EMAIL_COL, CSV_COMPANY_COL):
        if col not in contacts[0]:
            log.error("Required column '%s' not found in CSV. Headers: %s", col, list(contacts[0].keys()))
            return

    # Count how many have already been sent today (from previous runs)
    already_sent = sum(1 for c in contacts if c.get(CSV_STATUS_COL) == STATUS_SENT)
    remaining_quota = DAILY_LIMIT - already_sent
    log.info("Already sent (prior runs today): %d  |  Remaining quota: %d", already_sent, remaining_quota)

    if remaining_quota <= 0:
        log.warning("Daily limit of %d already reached. No emails will be sent.", DAILY_LIMIT)
        return

    # Determine which contacts still need emails
    pending = [
        c for c in contacts
        if c.get(CSV_STATUS_COL) not in (STATUS_SENT, STATUS_SKIPPED)
    ]
    log.info("Pending contacts: %d", len(pending))

    sent_this_run = 0
    failed_this_run = 0

    if dry_run:
        log.info("[DRY RUN] No emails will actually be sent.")

    smtp_conn = None
    if not dry_run:
        try:
            log.info("Connecting to Gmail SMTP...")
            smtp_conn = smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=30)
            smtp_conn.login(GMAIL_USER, GMAIL_PASSWORD)
            log.info("SMTP login successful.")
        except smtplib.SMTPAuthenticationError:
            log.critical(
                "Gmail authentication failed. "
                "Make sure you are using an App Password and that 2FA is enabled."
            )
            return
        except Exception as exc:
            log.critical("Could not connect to Gmail SMTP: %s", exc)
            return

    try:
        for contact in pending:
            if sent_this_run >= remaining_quota:
                log.warning(
                    "Daily limit reached after %d emails this run. "
                    "Remaining contacts will be sent tomorrow.",
                    sent_this_run,
                )
                break

            email   = contact.get(CSV_EMAIL_COL, "").strip()
            company = contact.get(CSV_COMPANY_COL, "").strip()

            if not email or "@" not in email:
                log.warning("Invalid email skipped: '%s' (company: %s)", email, company)
                contact[CSV_STATUS_COL] = STATUS_FAILED
                failed_this_run += 1
                continue

            msg = build_message(GMAIL_USER, email, company, attachment_path, dry_run)

            success = False
            for attempt in range(1, MAX_RETRIES + 2):          # attempts = retries + first try
                try:
                    if dry_run:
                        log.info("[DRY RUN] Would send -> %s (%s)", email, company)
                        success = True
                        break
                    else:
                        send_email(smtp_conn, GMAIL_USER, email, msg)
                        log.info("Sent -> %s (%s)", email, company)
                        success = True
                        break
                except smtplib.SMTPRecipientsRefused:
                    log.warning("Recipient refused (invalid address): %s", email)
                    break                                        # no point retrying
                except smtplib.SMTPException as exc:
                    if attempt <= MAX_RETRIES:
                        log.warning(
                            "Attempt %d failed for %s: %s - retrying in %ds...",
                            attempt, email, exc, RETRY_DELAY,
                        )
                        time.sleep(RETRY_DELAY)
                    else:
                        log.error("All %d attempts failed for %s: %s", attempt, email, exc)
                except Exception as exc:
                    log.error("Unexpected error sending to %s: %s", email, exc)
                    break

            if success:
                if not dry_run:
                    contact[CSV_STATUS_COL] = STATUS_SENT
                sent_this_run += 1
            else:
                contact[CSV_STATUS_COL] = STATUS_FAILED
                failed_this_run += 1

            # Be polite — don't hammer Gmail
            if not dry_run:
                time.sleep(DELAY_BETWEEN_SEND)

    finally:
        if smtp_conn:
            try:
                smtp_conn.quit()
            except Exception:
                pass

    # Always write results back to the CSV
    save_contacts(csv_path, contacts)

    log.info("=" * 60)
    log.info("Run complete - Sent: %d  |  Failed: %d  |  Log: %s", sent_this_run, failed_this_run, log_file)
    log.info("=" * 60)


# ── CLI ───────────────────────────────────────────────────────────────────────

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Automated Gmail cold-email sender.")
    parser.add_argument(
        "--csv",
        default="contacts.csv",
        help="Path to the contacts CSV file (default: contacts.csv)",
    )
    parser.add_argument(
        "--attachment",
        default=None,
        help="Optional path to an attachment (e.g., brochure.pdf)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview what would be sent without actually sending anything",
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()

    csv_path        = Path(args.csv)
    attachment_path = Path(args.attachment) if args.attachment else None

    if not csv_path.exists():
        log.error("CSV file not found: %s", csv_path)
        sys.exit(1)

    run(csv_path, attachment_path, dry_run=args.dry_run)
