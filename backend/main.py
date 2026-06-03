import csv
import io
import os
import shutil
import smtplib
from pathlib import Path
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Form, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from database import engine, Base, get_db
from models import User, SMTPSettings, Campaign, Recipient
from auth import get_password_hash, verify_password, create_access_token, get_current_user
from security import encrypt_password
from worker import send_campaign_emails, get_smtp_connection, UPLOADS_DIR

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Email Outreach Micro SaaS", version="1.0.0")

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For development. We can narrow down to http://localhost:5173
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Auth Endpoints ────────────────────────────────────────────────────────────

@app.post("/api/auth/register", status_code=status.HTTP_201_CREATED)
def register(email: str = Form(...), password: str = Form(...), db: Session = Depends(get_db)):
    existing_user = db.query(User).filter(User.email == email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_pw = get_password_hash(password)
    new_user = User(email=email, hashed_password=hashed_pw)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"message": "User registered successfully", "user_id": new_user.id}


@app.post("/api/auth/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(data={"sub": user.email})
    return {"access_token": access_token, "token_type": "bearer"}


@app.get("/api/auth/me")
def get_me(current_user: User = Depends(get_current_user)):
    return {"id": current_user.id, "email": current_user.email}


# ── SMTP Settings Endpoints ───────────────────────────────────────────────────

@app.get("/api/settings/smtp")
def get_smtp(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    settings_list = db.query(SMTPSettings).filter(SMTPSettings.user_id == current_user.id).all()
    return [{
        "id": s.id,
        "host": s.host,
        "port": s.port,
        "username": s.username,
        "from_name": s.from_name,
        "from_email": s.from_email,
        "has_password": True
    } for s in settings_list]


@app.post("/api/settings/smtp")
def save_smtp(
    sender_id: Optional[int] = Form(None),
    host: str = Form(...),
    port: int = Form(...),
    username: str = Form(...),
    password: Optional[str] = Form(None),
    from_name: str = Form(...),
    from_email: str = Form(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if sender_id:
        settings = db.query(SMTPSettings).filter(
            SMTPSettings.id == sender_id, 
            SMTPSettings.user_id == current_user.id
        ).first()
        if not settings:
            raise HTTPException(status_code=404, detail="Sender account not found")
        settings.host = host
        settings.port = port
        settings.username = username
        if password and password != "••••••••••••••••":
            settings.encrypted_password = encrypt_password(password)
        settings.from_name = from_name
        settings.from_email = from_email
    else:
        if not password or password == "••••••••••••••••":
            raise HTTPException(status_code=400, detail="Password is required for new SMTP configuration")
        encrypted_pw = encrypt_password(password)
        settings = SMTPSettings(
            user_id=current_user.id,
            host=host,
            port=port,
            username=username,
            encrypted_password=encrypted_pw,
            from_name=from_name,
            from_email=from_email
        )
        db.add(settings)
        
    db.commit()
    return {"message": "SMTP Settings saved successfully"}


@app.delete("/api/settings/smtp/{id}")
def delete_smtp(id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    settings = db.query(SMTPSettings).filter(
        SMTPSettings.id == id, 
        SMTPSettings.user_id == current_user.id
    ).first()
    if not settings:
        raise HTTPException(status_code=404, detail="Sender account not found")
    
    # Check if there are any campaigns using this sender
    campaigns_using = db.query(Campaign).filter(Campaign.sender_id == id).count()
    if campaigns_using > 0:
        raise HTTPException(
            status_code=400, 
            detail="Cannot delete this sender account because it is currently linked to active campaigns"
        )
        
    db.delete(settings)
    db.commit()
    return {"message": "Sender account deleted successfully"}


@app.post("/api/settings/smtp/test")
def test_smtp(
    sender_id: Optional[int] = Form(None),
    host: str = Form(...),
    port: int = Form(...),
    username: str = Form(...),
    password: Optional[str] = Form(None),
    from_name: str = Form(...),
    from_email: str = Form(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        # Resolve password
        if not password or password == "••••••••••••••••":
            if sender_id:
                settings = db.query(SMTPSettings).filter(SMTPSettings.id == sender_id, SMTPSettings.user_id == current_user.id).first()
            else:
                settings = db.query(SMTPSettings).filter(SMTPSettings.username == username, SMTPSettings.user_id == current_user.id).first()
            if not settings:
                raise HTTPException(status_code=400, detail="Password is required to run connection test")
            from security import decrypt_password
            password_plain = decrypt_password(settings.encrypted_password)
        else:
            password_plain = password

        # Establish connection to verify credentials
        server = get_smtp_connection(host, port, username, password_plain)
        
        # Send a quick connection test email to user's registered email
        test_msg = f"Subject: SMTP Test successful\n\nHi!\n\nThis is a test email verifying that your SMTP settings are configured correctly."
        server.sendmail(from_email, current_user.email, test_msg)
        server.quit()
        return {"message": "SMTP Connection verified and test email sent!"}
    except smtplib.SMTPAuthenticationError:
        raise HTTPException(status_code=400, detail="SMTP Authentication failed. Check username and App Password.")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"SMTP Connection failed: {str(e)}")


# ── Campaigns Endpoints ────────────────────────────────────────────────────────

@app.get("/api/campaigns")
def list_campaigns(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    campaigns = db.query(Campaign).filter(Campaign.user_id == current_user.id).order_by(Campaign.created_at.desc()).all()
    result = []
    for c in campaigns:
        total = db.query(Recipient).filter(Recipient.campaign_id == c.id).count()
        sent = db.query(Recipient).filter(Recipient.campaign_id == c.id, Recipient.status == "sent").count()
        failed = db.query(Recipient).filter(Recipient.campaign_id == c.id, Recipient.status == "failed").count()
        result.append({
            "id": c.id,
            "name": c.name,
            "subject_template": c.subject_template,
            "status": c.status,
            "sender_id": c.sender_id,
            "attachment_name": c.attachment_name,
            "attachment_display_name": c.attachment_display_name,
            "created_at": c.created_at,
            "stats": {"total": total, "sent": sent, "failed": failed}
        })
    return result


@app.post("/api/campaigns")
async def create_campaign(
    name: str = Form(...),
    subject_template: str = Form(...),
    body_template: str = Form(...),
    sender_id: int = Form(...),
    contacts_csv: UploadFile = File(...),
    attachment: Optional[UploadFile] = File(None),
    attachment_display_name: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Parse CSV first
    contents = await contacts_csv.read()
    try:
        csv_text = contents.decode("utf-8")
        reader = csv.DictReader(io.StringIO(csv_text))
        rows = list(reader)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read CSV file: {e}")

    if not rows:
        raise HTTPException(status_code=400, detail="CSV file is empty")

    # Normalize keys to locate email and company fields
    normalized_keys = {k.strip().lower(): k for k in rows[0].keys()}
    email_key = None
    company_key = None

    for k in ["email", "email address", "mail"]:
        if k in normalized_keys:
            email_key = normalized_keys[k]
            break
            
    for k in ["company", "company name", "org", "organization"]:
        if k in normalized_keys:
            company_key = normalized_keys[k]
            break

    if not email_key:
        raise HTTPException(
            status_code=400,
            detail=f"CSV must contain an 'email' column. Headers found: {list(rows[0].keys())}"
        )

    # 1. Save Campaign
    new_campaign = Campaign(
        user_id=current_user.id,
        name=name,
        subject_template=subject_template,
        body_template=body_template,
        status="draft",
        sender_id=sender_id,
        attachment_name=attachment.filename if attachment else None,
        attachment_display_name=attachment_display_name if attachment_display_name else None
    )
    db.add(new_campaign)
    db.commit()
    db.refresh(new_campaign)

    # 2. Save Attachment if present
    if attachment:
        attachment_path = UPLOADS_DIR / f"{new_campaign.id}_{attachment.filename}"
        with attachment_path.open("wb") as buffer:
            shutil.copyfileobj(attachment.file, buffer)

    # 3. Add Recipients
    recipients_list = []
    for r in rows:
        email = r.get(email_key, "").strip()
        if not email or "@" not in email:
            continue  # Skip invalid rows
        company = r.get(company_key, "").strip() if company_key else ""
        
        recipients_list.append(Recipient(
            campaign_id=new_campaign.id,
            email=email,
            company=company,
            status="pending"
        ))

    if not recipients_list:
        db.delete(new_campaign)
        db.commit()
        raise HTTPException(status_code=400, detail="No valid email contacts found in CSV")

    db.bulk_save_objects(recipients_list)
    db.commit()

    return {"message": "Campaign created successfully", "campaign_id": new_campaign.id}


@app.get("/api/campaigns/{id}")
def get_campaign(id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    campaign = db.query(Campaign).filter(Campaign.id == id, Campaign.user_id == current_user.id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
        
    total = db.query(Recipient).filter(Recipient.campaign_id == id).count()
    sent = db.query(Recipient).filter(Recipient.campaign_id == id, Recipient.status == "sent").count()
    failed = db.query(Recipient).filter(Recipient.campaign_id == id, Recipient.status == "failed").count()
    sending = db.query(Recipient).filter(Recipient.campaign_id == id, Recipient.status == "sending").count()
    pending = db.query(Recipient).filter(Recipient.campaign_id == id, Recipient.status == "pending").count()
    
    return {
        "id": campaign.id,
        "name": campaign.name,
        "subject_template": campaign.subject_template,
        "body_template": campaign.body_template,
        "status": campaign.status,
        "sender_id": campaign.sender_id,
        "attachment_name": campaign.attachment_name,
        "attachment_display_name": campaign.attachment_display_name,
        "created_at": campaign.created_at,
        "stats": {
            "total": total,
            "sent": sent,
            "failed": failed,
            "sending": sending,
            "pending": pending
        }
    }


@app.get("/api/campaigns/{id}/recipients")
def get_campaign_recipients(
    id: int, 
    current_user: User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    campaign = db.query(Campaign).filter(Campaign.id == id, Campaign.user_id == current_user.id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
        
    recipients = db.query(Recipient).filter(Recipient.campaign_id == id).all()
    return [{
        "id": r.id,
        "email": r.email,
        "company": r.company,
        "status": r.status,
        "error_message": r.error_message,
        "sent_at": r.sent_at
    } for r in recipients]


@app.post("/api/campaigns/{id}/action")
def campaign_action(
    id: int,
    action: str = Form(...),  # start, pause, reset
    background_tasks: BackgroundTasks = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    campaign = db.query(Campaign).filter(Campaign.id == id, Campaign.user_id == current_user.id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    if action == "start":
        # Check if user has SMTP settings configured
        smtp_settings = db.query(SMTPSettings).filter(SMTPSettings.user_id == current_user.id).first()
        if not smtp_settings:
            raise HTTPException(
                status_code=400, 
                detail="Please configure SMTP settings before starting the campaign"
            )
            
        # Reset any stuck "sending" recipients back to "pending"
        db.query(Recipient).filter(
            Recipient.campaign_id == id,
            Recipient.status == "sending"
        ).update({"status": "pending"})
        
        campaign.status = "running"
        db.commit()
        # Enqueue sending task
        background_tasks.add_task(send_campaign_emails, campaign.id)
        return {"message": "Campaign started successfully", "status": "running"}

    elif action == "pause":
        campaign.status = "paused"
        db.commit()
        return {"message": "Campaign paused successfully", "status": "paused"}

    elif action == "reset":
        campaign.status = "draft"
        # Reset recipient statuses
        recipients = db.query(Recipient).filter(Recipient.campaign_id == id).all()
        for r in recipients:
            r.status = "pending"
            r.error_message = None
            r.retry_count = 0
            r.sent_at = None
        db.commit()
        return {"message": "Campaign reset successfully", "status": "draft"}

    else:
        raise HTTPException(status_code=400, detail="Invalid action. Use start, pause, or reset.")


@app.delete("/api/campaigns/{id}")
def delete_campaign(id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    campaign = db.query(Campaign).filter(Campaign.id == id, Campaign.user_id == current_user.id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
        
    # Delete uploaded attachment file if it exists
    if campaign.attachment_name:
        attachment_path = UPLOADS_DIR / f"{campaign.id}_{campaign.attachment_name}"
        if attachment_path.exists():
            try:
                os.remove(attachment_path)
            except Exception:
                pass
                
    db.delete(campaign)
    db.commit()
    return {"message": "Campaign deleted successfully"}
