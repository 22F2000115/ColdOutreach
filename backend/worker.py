import asyncio
import datetime
import logging
import smtplib
from email import encoders
from email.mime.base import MIMEBase
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path

from sqlalchemy.orm import Session

from activity import log_activity
from database import SessionLocal
from models import Campaign, Recipient, SMTPSettings, User
from security import decrypt_password

logger = logging.getLogger("worker")
logger.setLevel(logging.INFO)

# Directory where campaign attachments are saved
UPLOADS_DIR = Path(__file__).parent / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)


def get_smtp_connection(host: str, port: int, username: str, password_decrypted: str):
    """Establish and return an authenticated SMTP connection."""
    if port == 465:
        server = smtplib.SMTP_SSL(host, port, timeout=30)
    else:
        server = smtplib.SMTP(host, port, timeout=30)
        server.ehlo()
        server.starttls()
        server.ehlo()
    server.login(username, password_decrypted)
    return server


def build_message(
    sender_name: str,
    sender_email: str,
    recipient_email: str,
    recipient,
    subject_template: str,
    body_template: str,
    attachment_path: Path | None = None,
    attachment_display_name: str | None = None
) -> MIMEMultipart:
    """Build MIME message with personalizations."""
    import json
    import re

    # Build replacement dictionary
    replacements = {
        "company": recipient.company or "",
        "first_name": recipient.first_name or "",
        "last_name": recipient.last_name or "",
        "role": recipient.role or "",
    }

    if recipient.extra_data:
        try:
            extra = json.loads(recipient.extra_data)
            if isinstance(extra, dict):
                for extra_key, extra_value in extra.items():
                    replacements[extra_key.strip().lower()] = str(extra_value) if extra_value is not None else ""
        except Exception:
            pass

    # Helper function to substitute variables using case-insensitive lookup
    def substitute(template: str) -> str:
        if not template:
            return ""
        # Find all {{placeholder}} patterns
        placeholders = re.findall(r'\{\{([^}]+)\}\}', template)
        replaced_text = template
        for placeholder in placeholders:
            key = placeholder.strip().lower()
            replacement_value = replacements.get(key, "")
            replaced_text = replaced_text.replace("{{" + placeholder + "}}", replacement_value)

        # Fallback for old single bracket {placeholder} patterns
        single_placeholders = re.findall(r'(?<!\{)\{([^{}]+)\}(?!\})', replaced_text)
        for single_placeholder in single_placeholders:
            key = single_placeholder.strip().lower()
            replacement_value = replacements.get(key, "")
            replaced_text = replaced_text.replace("{" + single_placeholder + "}", replacement_value)

        return replaced_text

    subject = substitute(subject_template)
    body = substitute(body_template)

    mime_message = MIMEMultipart()
    mime_message["From"] = f"{sender_name} <{sender_email}>"
    mime_message["To"] = recipient_email
    mime_message["Subject"] = subject
    mime_message.attach(MIMEText(body, "html"))

    if attachment_path and attachment_path.exists():
        with attachment_path.open("rb") as attachment_file:
            part = MIMEBase("application", "octet-stream")
            part.set_payload(attachment_file.read())
        encoders.encode_base64(part)

        display_name = attachment_display_name or attachment_path.name.split("_", 1)[-1]
        part.add_header(
            "Content-Disposition",
            f'attachment; filename="{display_name}"',
        )
        mime_message.attach(part)

    return mime_message


async def send_campaign_emails(campaign_id: int):
    """Background runner function to process campaign recipients."""
    db_session: Session = SessionLocal()

    try:
        # 1. Fetch Campaign and verify status atomically with is_being_processed
        campaign = db_session.query(Campaign).filter(
            Campaign.id == campaign_id,
            Campaign.status == "running",
            Campaign.is_being_processed == False
        ).first()

        if not campaign:
            logger.info(f"Campaign {campaign_id} not found, not running, or already being processed by another runner.")
            return

        campaign.is_being_processed = True
        db_session.commit()

        # Fetch and verify Owner status (suspension & trial expiry)
        owner = db_session.query(User).filter(User.id == campaign.user_id).first()
        if not owner or not owner.is_active:
            campaign.status = "paused"
            db_session.commit()
            logger.warning(f"Campaign {campaign_id} owner is suspended or not found. Pausing campaign.")
            return

        if owner.plan == "trial" and owner.trial_expires_at and datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None) > owner.trial_expires_at:
            campaign.status = "paused"
            db_session.commit()
            logger.warning(f"Campaign {campaign_id} owner trial has expired. Pausing campaign.")
            return

        # 2. Fetch User SMTP Settings
        if campaign.sender_id:
            smtp_settings = db_session.query(SMTPSettings).filter(SMTPSettings.id == campaign.sender_id).first()
        else:
            smtp_settings = db_session.query(SMTPSettings).filter(SMTPSettings.user_id == campaign.user_id).first()

        if not smtp_settings:
            campaign.status = "paused"
            db_session.commit()
            logger.error(f"No SMTP settings found for campaign {campaign_id}.")
            return

        # Decrypt password
        try:
            password_decrypted = decrypt_password(smtp_settings.encrypted_password)
        except Exception as error:
            campaign.status = "paused"
            db_session.commit()
            logger.exception(f"Failed to decrypt SMTP password: {error}")
            return

        # 3. Test SMTP connection upfront
        try:
            smtp_conn = await asyncio.to_thread(
                get_smtp_connection,
                smtp_settings.host,
                smtp_settings.port,
                smtp_settings.username,
                password_decrypted
            )
        except Exception as error:
            campaign.status = "paused"
            db_session.commit()
            logger.exception(f"Failed to establish initial SMTP connection: {error}")
            return

        # 4. Fetch pending/failed recipients
        recipients = db_session.query(Recipient).filter(
            Recipient.campaign_id == campaign_id,
            Recipient.status.in_(["pending", "failed"])
        ).all()

        attachment_path = None
        if campaign.attachment_name:
            attachment_path = UPLOADS_DIR / f"{campaign_id}_{campaign.attachment_name}"

        # 5. Process loop
        for recipient in recipients:
            # Refresh campaign from db to check if user paused or stopped it
            db_session.refresh(campaign)
            if campaign.status != "running":
                logger.info(f"Campaign {campaign_id} status changed to {campaign.status}. Stopping runner.")
                break

            # Re-verify campaign owner status dynamically (in case of mid-run suspension/expiration)
            owner = db_session.query(User).filter(User.id == campaign.user_id).first()
            if not owner or not owner.is_active:
                campaign.status = "paused"
                db_session.commit()
                logger.warning(f"Campaign {campaign_id} owner suspended. Pausing runner.")
                break
            if owner.plan == "trial" and owner.trial_expires_at and datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None) > owner.trial_expires_at:
                campaign.status = "paused"
                db_session.commit()
                logger.warning(f"Campaign {campaign_id} owner trial has expired. Pausing runner.")
                break

            # Mark recipient as sending
            recipient.status = "sending"
            db_session.commit()

            # Format and build email
            try:
                mime_message = build_message(
                    sender_name=smtp_settings.from_name,
                    sender_email=smtp_settings.from_email,
                    recipient_email=recipient.email,
                    recipient=recipient,
                    subject_template=campaign.subject_template,
                    body_template=campaign.body_template,
                    attachment_path=attachment_path,
                    attachment_display_name=campaign.attachment_display_name
                )
            except Exception as error:
                recipient.status = "failed"
                recipient.error_message = f"Message generation failed: {error}"
                db_session.commit()
                continue

            # Send email with retries
            success = False
            error_msg = ""
            for attempt in range(2):  # Try twice
                try:
                    # Make sure SMTP connection is alive, reconnect if closed
                    try:
                        await asyncio.to_thread(smtp_conn.noop)
                    except Exception:
                        smtp_conn = await asyncio.to_thread(
                            get_smtp_connection,
                            smtp_settings.host,
                            smtp_settings.port,
                            smtp_settings.username,
                            password_decrypted
                        )

                    await asyncio.to_thread(smtp_conn.sendmail, smtp_settings.from_email, recipient.email, mime_message.as_string())
                    success = True
                    break
                except smtplib.SMTPRecipientsRefused:
                    error_msg = "Recipient address refused by server."
                    break  # No point in retrying invalid email
                except Exception as error:
                    error_msg = f"Attempt {attempt + 1} failed: {error}"
                    await asyncio.sleep(2)

            if success:
                recipient.status = "sent"
                recipient.error_message = None
                recipient.sent_at = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)
            else:
                recipient.status = "failed"
                recipient.error_message = error_msg
                recipient.retry_count += 1

            db_session.commit()

            # Delay to comply with limits (dynamic send_delay_seconds from smtp_settings, clamped to [1, 60], fallback to 3)
            delay = 3
            if smtp_settings and smtp_settings.send_delay_seconds is not None:
                delay = max(1, min(smtp_settings.send_delay_seconds, 60))
            await asyncio.sleep(delay)

        # 6. Check if all completed
        db_session.refresh(campaign)
        if campaign.status == "running":
            # Check if any remaining pending or failed
            remaining = db_session.query(Recipient).filter(
                Recipient.campaign_id == campaign_id,
                Recipient.status.in_(["pending", "failed"])
            ).count()
            if remaining == 0:
                campaign.status = "completed"
                db_session.commit()
                sent_count = db_session.query(Recipient).filter(
                    Recipient.campaign_id == campaign_id,
                    Recipient.status == "sent"
                ).count()
                failed_count = db_session.query(Recipient).filter(
                    Recipient.campaign_id == campaign_id,
                    Recipient.status == "failed"
                ).count()
                log_activity(
                    db_session,
                    campaign.user_id,
                    "campaign",
                    f"Campaign completed: {campaign.name}",
                    {
                        "campaign_id": campaign.id,
                        "campaign_name": campaign.name,
                        "sent_count": sent_count,
                        "failed_count": failed_count
                    }
                )
            else:
                campaign.status = "paused"
                db_session.commit()

        # Quit SMTP
        try:
            await asyncio.to_thread(smtp_conn.quit)
        except Exception:
            pass

    except Exception as error:
        db_session.rollback()
        logger.exception(f"Unhandled error in campaign runner {campaign_id}: {error}")
    finally:
        try:
            # Re-fetch campaign to reset processing status
            campaign = db_session.query(Campaign).filter(Campaign.id == campaign_id).first()
            if campaign:
                campaign.is_being_processed = False
                db_session.commit()
        except Exception as reset_error:
            db_session.rollback()
            logger.exception(f"Error resetting is_being_processed for campaign {campaign_id}: {reset_error}")
        db_session.close()


def get_imap_host(smtp_host: str) -> str:
    smtp_host_lower = smtp_host.lower().strip()
    if "gmail" in smtp_host_lower:
        return "imap.gmail.com"
    if "outlook" in smtp_host_lower or "office365" in smtp_host_lower or "hotmail" in smtp_host_lower:
        return "outlook.office365.com"
    if "ethereal" in smtp_host_lower:
        return "imap.ethereal.email"
    if smtp_host_lower.startswith("smtp."):
        return smtp_host_lower.replace("smtp.", "imap.", 1)
    return f"imap.{smtp_host_lower}"


def parse_header_str(header_value) -> str:
    if not header_value:
        return ""
    from email.header import decode_header
    decoded = decode_header(header_value)
    parts = []
    for content, charset in decoded:
        if isinstance(content, bytes):
            try:
                parts.append(content.decode(charset or 'utf-8', errors='ignore'))
            except Exception:
                parts.append(content.decode('latin1', errors='ignore'))
        else:
            parts.append(str(content))
    return "".join(parts)


def run_bounce_sync(campaign_id: int, smtp_settings_id: int):
    """Sync bounces in the background by logging into the IMAP server and parsing bounce messages."""
    import email
    import imaplib
    import re

    db_session: Session = SessionLocal()
    try:
        campaign = db_session.query(Campaign).filter(Campaign.id == campaign_id).first()
        if not campaign:
            logger.info(f"Campaign {campaign_id} not found for bounce sync.")
            return

        smtp_settings = db_session.query(SMTPSettings).filter(SMTPSettings.id == smtp_settings_id).first()
        if not smtp_settings:
            logger.info(f"SMTP Settings {smtp_settings_id} not found for bounce sync.")
            return

        sent_recipients = db_session.query(Recipient).filter(
            Recipient.campaign_id == campaign_id,
            Recipient.status == "sent"
        ).all()

        if not sent_recipients:
            logger.info(f"No sent recipients to scan for bounces in campaign {campaign_id}.")
            return

        recipient_map = {recipient.email.lower().strip(): recipient for recipient in sent_recipients}

        try:
            password_decrypted = decrypt_password(smtp_settings.encrypted_password)
        except Exception as error:
            logger.exception(f"Failed to decrypt mailbox password: {error}")
            return

        imap_host = get_imap_host(smtp_settings.host)
        imap_port = 993

        new_bounces_count = 0

        try:
            imap_client = imaplib.IMAP4_SSL(imap_host, imap_port, timeout=15)
            imap_client.login(smtp_settings.username, password_decrypted)
            imap_client.select("INBOX")

            since_date = campaign.created_at.strftime("%d-%b-%Y")
            status, messages = imap_client.search(
                None,
                f'OR FROM "mailer-daemon" FROM "postmaster" SINCE {since_date}'
            )
            if status != "OK" or not messages[0]:
                imap_client.logout()
                logger.info(f"No email messages returned for search query in IMAP.")
                return

            mail_ids = messages[0].split()
            last_ids_to_process = mail_ids[-100:]

            for mail_id in reversed(last_ids_to_process):
                status, data = imap_client.fetch(mail_id, "(RFC822)")
                if status != "OK" or not data or not data[0]:
                    continue

                raw_email = data[0][1]
                if isinstance(raw_email, str):
                    email_message = email.message_from_string(raw_email)
                else:
                    email_message = email.message_from_bytes(raw_email)

                subject = parse_header_str(email_message.get("Subject", "")).lower()
                sender = parse_header_str(email_message.get("From", "")).lower()

                is_bounce = False
                if any(keyword in sender for keyword in ["mailer-daemon", "postmaster", "bounce", "delivery"]):
                    is_bounce = True
                elif any(keyword in subject for keyword in ["undeliverable", "delivery status", "failed", "returned", "failure", "bounce"]):
                    is_bounce = True

                if not is_bounce:
                    continue

                body_text = ""
                if email_message.is_multipart():
                    for part in email_message.walk():
                        content_type = part.get_content_type()
                        content_disposition = str(part.get("Content-Disposition"))

                        if content_type == "text/plain" and "attachment" not in content_disposition:
                            payload = part.get_payload(decode=True)
                            if payload:
                                body_text += payload.decode("utf-8", errors="ignore")
                        elif content_type == "message/delivery-status":
                            payload = part.get_payload()
                            if isinstance(payload, list):
                                for subpart in payload:
                                    body_text += str(subpart)
                            else:
                                body_text += str(payload)
                else:
                    payload = email_message.get_payload(decode=True)
                    if payload:
                        body_text += payload.decode("utf-8", errors="ignore")

                body_text = body_text.lower()

                for email_addr, recipient in list(recipient_map.items()):
                    if email_addr in body_text or email_addr in subject:
                        recipient.status = "failed"

                        diag_match = re.search(r'(?:diagnostic-code|status|error|reason):\s*([^\r\n]+)', body_text, re.IGNORECASE)
                        if diag_match:
                            recipient.error_message = f"Asynchronous bounce: {diag_match.group(1).strip()}"
                        else:
                            recipient.error_message = "Asynchronous bounce: Delivery failed (returned to sender)."

                        recipient.sent_at = None
                        recipient_map.pop(email_addr)
                        new_bounces_count += 1

            db_session.commit()
            imap_client.logout()
            logger.info(f"Bounce sync complete. Synced {new_bounces_count} bounces for campaign {campaign_id}.")
        except Exception as error:
            logger.exception(f"Failed to synchronize bounces: {error}")
    finally:
        db_session.close()


async def auto_bounce_sync_loop():
    """Run bounce synchronization for all running campaigns periodically."""
    # Wait 10 seconds after server start before running the first check
    await asyncio.sleep(10)

    while True:
        db_session: Session = SessionLocal()
        try:
            running_campaigns = db_session.query(Campaign).filter(Campaign.status == "running").all()
            if running_campaigns:
                logger.info(f"Auto-bounce sync: checking {len(running_campaigns)} running campaigns...")
                for campaign in running_campaigns:
                    if campaign.sender_id:
                        smtp_settings = db_session.query(SMTPSettings).filter(SMTPSettings.id == campaign.sender_id).first()
                    else:
                        smtp_settings = db_session.query(SMTPSettings).filter(SMTPSettings.user_id == campaign.user_id).first()

                    if smtp_settings:
                        # Stagger mailbox connections
                        await asyncio.sleep(5)
                        logger.info(f"Auto-bounce sync: running check for campaign {campaign.id}")
                        await asyncio.to_thread(run_bounce_sync, campaign.id, smtp_settings.id)
        except asyncio.CancelledError:
            logger.info("Auto-bounce sync loop cancelled.")
            break
        except Exception as err:
            logger.error(f"Error in auto_bounce_sync_loop: {err}", exc_info=True)
        finally:
            db_session.close()

        # Run every 30 minutes (1800 seconds)
        await asyncio.sleep(1800)
