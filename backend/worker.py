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
                for k, v in extra.items():
                    replacements[k.strip().lower()] = str(v) if v is not None else ""
        except Exception:
            pass

    # Helper function to substitute variables using case-insensitive lookup
    def substitute(template: str) -> str:
        if not template:
            return ""
        # Find all {{placeholder}} patterns
        placeholders = re.findall(r'\{\{([^}]+)\}\}', template)
        res = template
        for placeholder in placeholders:
            key = placeholder.strip().lower()
            val = replacements.get(key, "")
            res = res.replace("{{" + placeholder + "}}", val)
            
        # Fallback for old single bracket {placeholder} patterns
        single_placeholders = re.findall(r'(?<!\{)\{([^{}]+)\}(?!\})', res)
        for sp in single_placeholders:
            key = sp.strip().lower()
            val = replacements.get(key, "")
            res = res.replace("{" + sp + "}", val)
            
        return res

    subject = substitute(subject_template)
    body = substitute(body_template)

    msg = MIMEMultipart()
    msg["From"] = f"{sender_name} <{sender_email}>"
    msg["To"] = recipient_email
    msg["Subject"] = subject
    msg.attach(MIMEText(body, "html"))

    if attachment_path and attachment_path.exists():
        with attachment_path.open("rb") as fp:
            part = MIMEBase("application", "octet-stream")
            part.set_payload(fp.read())
        encoders.encode_base64(part)
        
        display_name = attachment_display_name or attachment_path.name.split("_", 1)[-1]
        part.add_header(
            "Content-Disposition",
            f'attachment; filename="{display_name}"',
        )
        msg.attach(part)
        
    return msg

async def send_campaign_emails(campaign_id: int):
    """Background runner function to process campaign recipients."""
    db: Session = SessionLocal()

    try:
        # 1. Fetch Campaign and verify status atomically with is_being_processed
        campaign = db.query(Campaign).filter(
            Campaign.id == campaign_id,
            Campaign.status == "running",
            Campaign.is_being_processed == False
        ).first()
        
        if not campaign:
            logger.info(f"Campaign {campaign_id} not found, not running, or already being processed by another runner.")
            return

        campaign.is_being_processed = True
        db.commit()

        # Fetch and verify Owner status (suspension & trial expiry)
        owner = db.query(User).filter(User.id == campaign.user_id).first()
        if not owner or not owner.is_active:
            campaign.status = "paused"
            db.commit()
            logger.warning(f"Campaign {campaign_id} owner is suspended or not found. Pausing campaign.")
            return

        if owner.plan == "trial" and owner.trial_expires_at and datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None) > owner.trial_expires_at:
            campaign.status = "paused"
            db.commit()
            logger.warning(f"Campaign {campaign_id} owner trial has expired. Pausing campaign.")
            return

        # 2. Fetch User SMTP Settings
        if campaign.sender_id:
            smtp_settings = db.query(SMTPSettings).filter(SMTPSettings.id == campaign.sender_id).first()
        else:
            smtp_settings = db.query(SMTPSettings).filter(SMTPSettings.user_id == campaign.user_id).first()
            
        if not smtp_settings:
            campaign.status = "paused"
            db.commit()
            logger.error(f"No SMTP settings found for campaign {campaign_id}.")
            return

        # Decrypt password
        try:
            password_decrypted = decrypt_password(smtp_settings.encrypted_password)
        except Exception as e:
            campaign.status = "paused"
            db.commit()
            logger.error(f"Failed to decrypt SMTP password: {e}")
            return

        # 3. Test SMTP connection upfront
        try:
            smtp_conn = get_smtp_connection(
                smtp_settings.host,
                smtp_settings.port,
                smtp_settings.username,
                password_decrypted
            )
        except Exception as e:
            campaign.status = "paused"
            db.commit()
            logger.error(f"Failed to establish initial SMTP connection: {e}")
            return

        # 4. Fetch pending/failed recipients
        recipients = db.query(Recipient).filter(
            Recipient.campaign_id == campaign_id,
            Recipient.status.in_(["pending", "failed"])
        ).all()

        attachment_path = None
        if campaign.attachment_name:
            attachment_path = UPLOADS_DIR / f"{campaign_id}_{campaign.attachment_name}"

        # 5. Process loop
        for recipient in recipients:
            # Refresh campaign from db to check if user paused or stopped it
            db.refresh(campaign)
            if campaign.status != "running":
                logger.info(f"Campaign {campaign_id} status changed to {campaign.status}. Stopping runner.")
                break

            # Re-verify campaign owner status dynamically (in case of mid-run suspension/expiration)
            owner = db.query(User).filter(User.id == campaign.user_id).first()
            if not owner or not owner.is_active:
                campaign.status = "paused"
                db.commit()
                logger.warning(f"Campaign {campaign_id} owner suspended. Pausing runner.")
                break
            if owner.plan == "trial" and owner.trial_expires_at and datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None) > owner.trial_expires_at:
                campaign.status = "paused"
                db.commit()
                logger.warning(f"Campaign {campaign_id} owner trial has expired. Pausing runner.")
                break

            # Mark recipient as sending
            recipient.status = "sending"
            db.commit()

            # Format and build email
            try:
                msg = build_message(
                    sender_name=smtp_settings.from_name,
                    sender_email=smtp_settings.from_email,
                    recipient_email=recipient.email,
                    recipient=recipient,
                    subject_template=campaign.subject_template,
                    body_template=campaign.body_template,
                    attachment_path=attachment_path,
                    attachment_display_name=campaign.attachment_display_name
                )
            except Exception as e:
                recipient.status = "failed"
                recipient.error_message = f"Message generation failed: {e}"
                db.commit()
                continue

            # Send email with retries
            success = False
            error_msg = ""
            for attempt in range(2):  # Try twice
                try:
                    # Make sure SMTP connection is alive, reconnect if closed
                    try:
                        smtp_conn.noop()
                    except Exception:
                        smtp_conn = get_smtp_connection(
                            smtp_settings.host,
                            smtp_settings.port,
                            smtp_settings.username,
                            password_decrypted
                        )

                    smtp_conn.sendmail(smtp_settings.from_email, recipient.email, msg.as_string())
                    success = True
                    break
                except smtplib.SMTPRecipientsRefused:
                    error_msg = "Recipient address refused by server."
                    break  # No point in retrying invalid email
                except Exception as e:
                    error_msg = f"Attempt {attempt + 1} failed: {e}"
                    await asyncio.sleep(2)

            if success:
                recipient.status = "sent"
                recipient.error_message = None
                recipient.sent_at = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)
            else:
                recipient.status = "failed"
                recipient.error_message = error_msg
                recipient.retry_count += 1
            
            db.commit()

            # Delay to comply with limits (e.g. 3 seconds)
            await asyncio.sleep(3)

        # 6. Check if all completed
        db.refresh(campaign)
        if campaign.status == "running":
            # Check if any remaining pending or failed
            remaining = db.query(Recipient).filter(
                Recipient.campaign_id == campaign_id,
                Recipient.status.in_(["pending", "failed"])
            ).count()
            if remaining == 0:
                campaign.status = "completed"
            else:
                campaign.status = "paused"
            db.commit()

        # Quit SMTP
        try:
            smtp_conn.quit()
        except Exception:
            pass

    except Exception as e:
        logger.exception(f"Unhandled error in campaign runner {campaign_id}: {e}")
    finally:
        try:
            # Re-fetch campaign to reset processing status
            campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
            if campaign:
                campaign.is_being_processed = False
                db.commit()
        except Exception as ex:
            logger.error(f"Error resetting is_being_processed for campaign {campaign_id}: {ex}")
        db.close()
