import sys
import os
import datetime

# Add current path to sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal
from models import User, SMTPSettings, Campaign, Recipient
from auth import get_password_hash
from security import encrypt_password

def seed():
    print("Seeding database with sample bounced leads...")
    db = SessionLocal()
    
    # Clean up existing demo user
    demo_email = "demo@example.com"
    existing_user = db.query(User).filter(User.email == demo_email).first()
    if existing_user:
        db.delete(existing_user)
        db.commit()
        print("Cleared previous demo user.")

    # Create new demo user
    hashed_pw = get_password_hash("password123")
    user = User(
        email=demo_email,
        hashed_password=hashed_pw,
        plan="pro",
        trial_expires_at=None # No trial expiration for demo
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    print(f"Created demo user: {demo_email}")

    # Add SMTP settings
    smtp = SMTPSettings(
        user_id=user.id,
        host="smtp.ethereal.email",
        port=587,
        username="demo_sender@ethereal.email",
        encrypted_password=encrypt_password("demo123"),
        from_name="Demo Outreach",
        from_email="demo_sender@ethereal.email"
    )
    db.add(smtp)
    db.commit()
    db.refresh(smtp)
    print("Created demo SMTP settings.")

    # Create Campaign
    campaign = Campaign(
        user_id=user.id,
        name="Outreach Campaign 2026",
        subject_template="Hi {{first_name}} - Quick question",
        body_template="<p>Hi {{first_name}} {{last_name}},</p><p>We noticed {{company}} is growing and wanted to reach out.</p>",
        status="paused",
        sender_id=smtp.id
    )
    db.add(campaign)
    db.commit()
    db.refresh(campaign)
    print("Created outreach campaign.")

    # Add recipients
    now = datetime.datetime.utcnow()
    recipients = [
        # Sent
        Recipient(campaign_id=campaign.id, email="alex@google.com", company="Google", first_name="Alex", last_name="Page", role="Director", status="sent", sent_at=now),
        Recipient(campaign_id=campaign.id, email="sara@apple.com", company="Apple", first_name="Sara", last_name="Cook", role="Manager", status="sent", sent_at=now),
        
        # Bounced - 550 No such user
        Recipient(campaign_id=campaign.id, email="invalid1@bounce.com", company="SpamCorp", first_name="John", last_name="Doe", role="Lead", status="failed", error_message="550 No such user here", sent_at=now),
        Recipient(campaign_id=campaign.id, email="invalid2@bounce.com", company="SpamCorp", first_name="Jane", last_name="Smith", role="Lead", status="failed", error_message="550 No such user here", sent_at=now),
        Recipient(campaign_id=campaign.id, email="invalid3@bounce.com", company="SpamCorp", first_name="Bob", last_name="Johnson", role="Lead", status="failed", error_message="550 No such user here", sent_at=now),
        
        # Bounced - 421 Too many connections
        Recipient(campaign_id=campaign.id, email="rate_limit1@domain.com", company="SlowCorp", first_name="Michael", last_name="Brown", role="Developer", status="failed", error_message="421 Too many connections", sent_at=now),
        Recipient(campaign_id=campaign.id, email="rate_limit2@domain.com", company="SlowCorp", first_name="Emily", last_name="Davis", role="Developer", status="failed", error_message="421 Too many connections", sent_at=now),
        
        # Bounced - Timeout
        Recipient(campaign_id=campaign.id, email="timeout_user@slowmail.com", company="SlowMail", first_name="David", last_name="Miller", role="VP", status="failed", error_message="SMTP connection timed out after 30 seconds", sent_at=now),
        
        # Pending
        Recipient(campaign_id=campaign.id, email="pending1@outlook.com", company="OutLooker", first_name="Chris", last_name="Wilson", role="Director", status="pending"),
        Recipient(campaign_id=campaign.id, email="pending2@outlook.com", company="OutLooker", first_name="Jessica", last_name="Taylor", role="VP", status="pending"),
    ]
    
    db.bulk_save_objects(recipients)
    db.commit()
    print(f"Successfully seeded {len(recipients)} recipients.")
    db.close()

if __name__ == '__main__':
    seed()
