import logging
import os

from auth import get_password_hash
from database import SessionLocal
from models import Campaign, ContactDetail, PlanQuota, User

logger = logging.getLogger(__name__)


def seed_admin():
    raw = os.getenv("ADMIN_ACCOUNTS", "")
    if not raw.strip():
        return
    db = SessionLocal()
    try:
        for entry in raw.split(","):
            entry = entry.strip()
            if ":" not in entry:
                continue
            email, password = entry.split(":", 1)
            email, password = email.strip(), password.strip()
            user = db.query(User).filter(User.email == email).first()
            if user:
                updated = False
                if user.role != "admin" or user.plan != "pro" or not user.is_active:
                    user.role = "admin"
                    user.plan = "pro"
                    user.is_active = True
                    updated = True
                # Always sync the password from .env on startup
                user.hashed_password = get_password_hash(password)
                updated = True
                if updated:
                    db.commit()
            else:
                new_admin = User(
                    email=email,
                    hashed_password=get_password_hash(password),
                    plan="pro",
                    role="admin",
                    is_active=True,
                    trial_expires_at=None,
                )
                db.add(new_admin)
                db.commit()
    except Exception as error:
        logger.exception(f"Error seeding admin: {error}")
    finally:
        db.close()


def seed_contact_details():
    db = SessionLocal()
    try:
        count = db.query(ContactDetail).count()
        if count == 0:
            default_contacts = [
                ContactDetail(type="email", value="support@coldoutreach.com", label="Customer Support"),
                ContactDetail(type="email", value="sales@coldoutreach.com", label="Enterprise Sales"),
                ContactDetail(type="whatsapp", value="+15550199", label="WhatsApp Support (US)"),
            ]
            db.bulk_save_objects(default_contacts)
            db.commit()
    except Exception as error:
        logger.exception(f"Error seeding contact details: {error}")
    finally:
        db.close()


def seed_plan_quotas():
    db = SessionLocal()
    try:
        count = db.query(PlanQuota).count()
        if count == 0:
            default_quotas = [
                PlanQuota(
                    plan="trial",
                    add_limit=3,
                    edit_limit=5,
                    delete_limit=3,
                    save_limit=5,
                    max_smtp_accounts=1,
                    max_campaigns=3,
                    max_recipients_per_campaign=500
                ),
                PlanQuota(
                    plan="pro",
                    add_limit=999999,
                    edit_limit=999999,
                    delete_limit=999999,
                    save_limit=999999,
                    max_smtp_accounts=3,
                    max_campaigns=999999,
                    max_recipients_per_campaign=50000
                )
            ]
            db.bulk_save_objects(default_quotas)
            db.commit()
        else:
            trial_q = db.query(PlanQuota).filter(PlanQuota.plan == "trial").first()
            if trial_q:
                if trial_q.max_smtp_accounts is None:
                    trial_q.max_smtp_accounts = 1
                if trial_q.max_campaigns is None:
                    trial_q.max_campaigns = 3
                if trial_q.max_recipients_per_campaign is None:
                    trial_q.max_recipients_per_campaign = 500
            pro_q = db.query(PlanQuota).filter(PlanQuota.plan == "pro").first()
            if pro_q:
                if pro_q.max_smtp_accounts is None or pro_q.max_smtp_accounts == 1:
                    pro_q.max_smtp_accounts = 3
                if pro_q.max_campaigns is None or pro_q.max_campaigns == 3:
                    pro_q.max_campaigns = 999999
                if pro_q.max_recipients_per_campaign is None:
                    pro_q.max_recipients_per_campaign = 50000
            db.commit()
    except Exception as error:
        logger.exception(f"Error seeding plan quotas: {error}")
    finally:
        db.close()


def reset_stuck_campaigns():
    """On startup, reset any campaigns stuck in is_being_processed=True state."""
    db = SessionLocal()
    try:
        stuck = db.query(Campaign).filter(Campaign.is_being_processed == True).all()
        for c in stuck:
            c.is_being_processed = False
            if c.status == "running":
                c.status = "paused"
        if stuck:
            db.commit()
            logger.info(f"[startup] Reset {len(stuck)} stuck campaign(s) to paused.")
    except Exception as error:
        logger.exception(f"[startup] Error resetting stuck campaigns: {error}")
    finally:
        db.close()
