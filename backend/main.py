import csv
import io
import os
import shutil
import smtplib
import imaplib
import datetime
from typing import List, Optional
from pydantic import BaseModel
from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Form, BackgroundTasks, Response, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from jose import jwt, JWTError
from dotenv import load_dotenv

load_dotenv()

from database import engine, Base, get_db, SessionLocal
from models import User, SMTPSettings, Campaign, Recipient
from auth import get_password_hash, verify_password, create_access_token, create_refresh_token, get_current_user, get_current_admin_user, JWT_SECRET_KEY, ALGORITHM
from security import encrypt_password
from worker import send_campaign_emails, get_smtp_connection, UPLOADS_DIR
from config import PLAN_LIMITS

# Create database tables
Base.metadata.create_all(bind=engine)

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
    except Exception as e:
        print(f"Error seeding admin: {e}")
    finally:
        db.close()

seed_admin()

app = FastAPI(title="Email Outreach Micro SaaS", version="1.0.0")

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Trial check middleware
@app.middleware("http")
async def check_trial_expiry_middleware(request: Request, call_next):
    public_paths = {
        "/api/auth/login",
        "/api/auth/register",
        "/api/auth/refresh",
        "/api/auth/logout",
        "/api/sample-csv",
    }
    path = request.url.path
    if path.startswith("/api/") and path not in public_paths:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            try:
                payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[ALGORITHM])
                plan = payload.get("plan")
                trial_expires_str = payload.get("trial_expires_at")
                role = payload.get("role")
                
                # Fallback if claims are missing from old token
                if plan is None or (plan == "trial" and trial_expires_str is None) or role is None:
                    email = payload.get("sub")
                    if email:
                        db = SessionLocal()
                        try:
                            user = db.query(User).filter(User.email == email).first()
                            if user:
                                plan = user.plan
                                trial_expires_str = user.trial_expires_at.isoformat() if user.trial_expires_at else None
                                role = user.role
                        finally:
                            db.close()

                if role == "admin":
                    return await call_next(request)

                if plan == "trial" and trial_expires_str:
                    trial_expires_at = datetime.datetime.fromisoformat(trial_expires_str)
                    if datetime.datetime.utcnow() > trial_expires_at:
                        return JSONResponse(
                            status_code=402,
                            content={"detail": "trial_expired"}
                        )
            except Exception:
                pass
    return await call_next(request)

# ── Auth Endpoints ────────────────────────────────────────────────────────────

@app.post("/api/auth/register", status_code=status.HTTP_201_CREATED)
def register(email: str = Form(...), password: str = Form(...), db: Session = Depends(get_db)):
    existing_user = db.query(User).filter(User.email == email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_pw = get_password_hash(password)
    new_user = User(
        email=email,
        hashed_password=hashed_pw,
        plan="trial",
        trial_expires_at=datetime.datetime.utcnow() + datetime.timedelta(days=30)
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"message": "User registered successfully", "user_id": new_user.id}


@app.post("/api/auth/login")
def login(response: Response, form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(data={
        "sub": user.email,
        "plan": user.plan,
        "trial_expires_at": user.trial_expires_at.isoformat() if user.trial_expires_at else None,
        "is_active": user.is_active,
        "role": user.role
    })
    refresh_token = create_refresh_token(data={"sub": user.email})
    
    # Set httpOnly cookie
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        max_age=7 * 24 * 60 * 60,
        expires=7 * 24 * 60 * 60,
        samesite="lax",
        secure=False
    )
    return {"access_token": access_token, "token_type": "bearer"}


@app.post("/api/auth/refresh")
def refresh_token(request: Request, response: Response, db: Session = Depends(get_db)):
    refresh_tok = request.cookies.get("refresh_token")
    if not refresh_tok:
        raise HTTPException(status_code=401, detail="Refresh token missing")
    
    try:
        payload = jwt.decode(refresh_tok, JWT_SECRET_KEY, algorithms=[ALGORITHM])
        token_type = payload.get("type")
        if token_type != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        email: str = payload.get("sub")
        if email is None:
            raise HTTPException(status_code=401, detail="Invalid token payload")
    except JWTError:
        raise HTTPException(status_code=401, detail="Could not validate credentials")
        
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
        
    # Rotate tokens
    new_access_token = create_access_token(data={
        "sub": user.email,
        "plan": user.plan,
        "trial_expires_at": user.trial_expires_at.isoformat() if user.trial_expires_at else None,
        "is_active": user.is_active,
        "role": user.role
    })
    new_refresh_token = create_refresh_token(data={"sub": user.email})
    
    response.set_cookie(
        key="refresh_token",
        value=new_refresh_token,
        httponly=True,
        max_age=7 * 24 * 60 * 60,
        expires=7 * 24 * 60 * 60,
        samesite="lax",
        secure=False
    )
    return {"access_token": new_access_token, "token_type": "bearer"}


@app.post("/api/auth/logout")
def logout(response: Response):
    response.delete_cookie(key="refresh_token")
    return {"message": "Logged out successfully"}


@app.get("/api/auth/me")
def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "plan": current_user.plan,
        "role": current_user.role,
        "trial_expires_at": current_user.trial_expires_at.isoformat() if current_user.trial_expires_at else None
    }


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
        # Enforce limits using PLAN_LIMITS configuration
        user_plan = current_user.plan or "trial"
        max_accounts = PLAN_LIMITS.get(user_plan, {}).get("max_smtp_accounts", 1)
        existing_count = db.query(SMTPSettings).filter(SMTPSettings.user_id == current_user.id).count()
        if existing_count >= max_accounts:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"SMTP account limit reached ({max_accounts} account(s) allowed for {user_plan} plan)."
            )
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
        is_placeholder = not password or password == "" or password == "••••••••••••••••"
        if is_placeholder:
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
    except HTTPException as he:
        raise he
    except smtplib.SMTPAuthenticationError:
        raise HTTPException(status_code=400, detail="SMTP Authentication failed. Check username and App Password.")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"SMTP Connection failed: {str(e)}")


def parse_recipients_from_csv_rows(rows: list, campaign_id: int, existing_emails: set = None) -> list[Recipient]:
    if not rows:
        return []
    import json
    normalized_keys = {k.strip().lower(): k for k in rows[0].keys() if k is not None}
    email_key = None
    company_key = None
    first_name_key = None
    last_name_key = None
    role_key = None

    for k in ["email", "email address", "mail"]:
        if k in normalized_keys:
            email_key = normalized_keys[k]
            break

    for k in ["company", "company name", "org", "organization"]:
        if k in normalized_keys:
            company_key = normalized_keys[k]
            break

    for k in ["first_name", "first name", "fname", "first"]:
        if k in normalized_keys:
            first_name_key = normalized_keys[k]
            break

    for k in ["last_name", "last name", "lname", "last"]:
        if k in normalized_keys:
            last_name_key = normalized_keys[k]
            break

    for k in ["role", "job title", "title", "position"]:
        if k in normalized_keys:
            role_key = normalized_keys[k]
            break

    if not email_key:
        raise HTTPException(
            status_code=400,
            detail=f"CSV must contain an 'email' column. Headers found: {list(rows[0].keys())}"
        )

    recipients_list = []
    known_keys = {email_key, company_key, first_name_key, last_name_key, role_key}
    for r in rows:
        email = r.get(email_key, "")
        if not email:
            continue
        email = email.strip()
        if not email or "@" not in email:
            continue
        
        if existing_emails and email.lower() in existing_emails:
            continue
            
        company = r.get(company_key, "").strip() if company_key and r.get(company_key) else ""
        first_name = r.get(first_name_key, "").strip() if first_name_key and r.get(first_name_key) else ""
        last_name = r.get(last_name_key, "").strip() if last_name_key and r.get(last_name_key) else ""
        role = r.get(role_key, "").strip() if role_key and r.get(role_key) else ""
        
        extra_data_dict = {}
        for original_key, val in r.items():
            if original_key not in known_keys and original_key is not None:
                extra_data_dict[original_key.strip()] = val.strip() if val else ""
        extra_data = json.dumps(extra_data_dict) if extra_data_dict else None
        
        recipients_list.append(Recipient(
            campaign_id=campaign_id,
            email=email,
            company=company,
            first_name=first_name,
            last_name=last_name,
            role=role,
            extra_data=extra_data,
            status="pending"
        ))
    return recipients_list


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
            "scheduled_send_at": c.scheduled_send_at.isoformat() if c.scheduled_send_at else None,
            "stats": {"total": total, "sent": sent, "failed": failed}
        })
    return result


@app.post("/api/campaigns")
async def create_campaign(
    name: str = Form(...),
    subject_template: str = Form(...),
    body_template: str = Form(...),
    sender_id: int = Form(...),
    contacts_csv: Optional[UploadFile] = File(None),
    attachment: Optional[UploadFile] = File(None),
    attachment_display_name: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Enforce campaign creation limit
    user_plan = current_user.plan or "trial"
    max_campaigns = PLAN_LIMITS.get(user_plan, {}).get("max_campaigns", 3)
    existing_count = db.query(Campaign).filter(Campaign.user_id == current_user.id).count()
    if existing_count >= max_campaigns:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Campaign limit reached ({max_campaigns} campaign(s) allowed for {user_plan} plan). Please upgrade to add more."
        )

    # 1. Save Campaign first
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
    if attachment and attachment.filename:
        attachment_path = UPLOADS_DIR / f"{new_campaign.id}_{attachment.filename}"
        with attachment_path.open("wb") as buffer:
            shutil.copyfileobj(attachment.file, buffer)

    # 3. Parse and add recipients if CSV was provided
    if contacts_csv and contacts_csv.filename:
        contents = await contacts_csv.read()
        try:
            csv_text = contents.decode("utf-8")
            reader = csv.DictReader(io.StringIO(csv_text))
            rows = list(reader)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to read CSV file: {e}")

        if rows:
            recipients_list = parse_recipients_from_csv_rows(rows, new_campaign.id)
            if recipients_list:
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
        "scheduled_send_at": campaign.scheduled_send_at.isoformat() if campaign.scheduled_send_at else None,
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
        campaign.scheduled_send_at = None
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
        campaign.scheduled_send_at = None
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
        raise HTTPException(status_code=400, detail="Invalid action. Use start, cancel, pause, or reset.")


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


# ── Enhanced Campaign Management Endpoints ─────────────────────────────────────

@app.put("/api/campaigns/{id}")
def update_campaign(
    id: int,
    name: str = Form(...),
    subject_template: str = Form(...),
    body_template: str = Form(...),
    sender_id: Optional[int] = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    campaign = db.query(Campaign).filter(Campaign.id == id, Campaign.user_id == current_user.id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if campaign.status not in ("draft", "paused"):
        raise HTTPException(
            status_code=400, 
            detail="Cannot edit a campaign that is active or completed. Please pause it first."
        )
    
    campaign.name = name
    campaign.subject_template = subject_template
    campaign.body_template = body_template
    if sender_id is not None:
        campaign.sender_id = sender_id
    db.commit()
    db.refresh(campaign)
    return {
        "message": "Campaign updated successfully", 
        "campaign": {
            "id": campaign.id,
            "name": campaign.name,
            "subject_template": campaign.subject_template,
            "body_template": campaign.body_template,
            "status": campaign.status,
            "sender_id": campaign.sender_id
        }
    }


@app.post("/api/campaigns/{id}/recipients")
def add_recipient(
    id: int,
    email: str = Form(...),
    company: Optional[str] = Form(None),
    first_name: Optional[str] = Form(None),
    last_name: Optional[str] = Form(None),
    role: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    campaign = db.query(Campaign).filter(Campaign.id == id, Campaign.user_id == current_user.id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    email = email.strip()
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Invalid email address")
    
    # Check duplicate in this campaign
    existing = db.query(Recipient).filter(
        Recipient.campaign_id == id, 
        Recipient.email == email
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Recipient email already exists in this campaign")
    
    new_rec = Recipient(
        campaign_id=id,
        email=email,
        company=company.strip() if company else "",
        first_name=first_name.strip() if first_name else "",
        last_name=last_name.strip() if last_name else "",
        role=role.strip() if role else "",
        status="pending"
    )
    db.add(new_rec)
    db.commit()
    db.refresh(new_rec)
    return {
        "message": "Recipient added successfully", 
        "recipient": {
            "id": new_rec.id,
            "email": new_rec.email,
            "company": new_rec.company,
            "first_name": new_rec.first_name,
            "last_name": new_rec.last_name,
            "role": new_rec.role,
            "status": new_rec.status
        }
    }


@app.post("/api/campaigns/{id}/recipients/csv")
async def upload_recipients_csv(
    id: int,
    contacts_csv: UploadFile = File(...),
    mode: str = Form("append"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    campaign = db.query(Campaign).filter(Campaign.id == id, Campaign.user_id == current_user.id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    if mode not in ("append", "replace"):
        raise HTTPException(status_code=400, detail="Invalid mode, must be 'append' or 'replace'")

    contents = await contacts_csv.read()
    try:
        csv_text = contents.decode("utf-8")
        reader = csv.DictReader(io.StringIO(csv_text))
        rows = list(reader)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read CSV file: {e}")

    if not rows:
        raise HTTPException(status_code=400, detail="CSV file is empty")

    existing_emails = set()
    if mode == "append":
        existing = db.query(Recipient.email).filter(Recipient.campaign_id == id).all()
        existing_emails = {e[0].lower() for e in existing}

    recipients_list = parse_recipients_from_csv_rows(rows, id, existing_emails)

    if not recipients_list and mode == "append":
        return {"message": "No new recipients to add (all were duplicates or invalid)."}

    if mode == "replace":
        db.query(Recipient).filter(Recipient.campaign_id == id).delete()
        db.commit()

    if recipients_list:
        db.bulk_save_objects(recipients_list)
        db.commit()

    return {"message": f"Successfully uploaded {len(recipients_list)} recipients in {mode} mode"}


@app.get("/api/campaigns/{id}/recipients/csv")
def download_recipients_csv(
    id: int,
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    campaign = db.query(Campaign).filter(Campaign.id == id, Campaign.user_id == current_user.id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    query = db.query(Recipient).filter(Recipient.campaign_id == id)
    if status:
        query = query.filter(Recipient.status == status)
    recipients = query.all()
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["company", "email", "first_name", "last_name", "role", "status", "error_message"])
    for r in recipients:
        writer.writerow([
            r.company or "",
            r.email,
            r.first_name or "",
            r.last_name or "",
            r.role or "",
            r.status,
            r.error_message or ""
        ])
        
    csv_content = output.getvalue()
    output.close()
    
    if status == "failed":
        filename = f"campaign_{id}_failed_contacts.csv"
    else:
        filename = f"campaign_{id}_recipients.csv"
        
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


class BulkDeleteRequest(BaseModel):
    ids: List[int]


@app.delete("/api/campaigns/{id}/recipients/bulk")
def bulk_delete_recipients(
    id: int,
    body: BulkDeleteRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    campaign = db.query(Campaign).filter(Campaign.id == id, Campaign.user_id == current_user.id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    deleted_count = db.query(Recipient).filter(
        Recipient.campaign_id == id,
        Recipient.id.in_(body.ids)
    ).delete(synchronize_session=False)
    
    db.commit()
    return {"deleted": deleted_count}


@app.delete("/api/campaigns/{id}/recipients/{recipient_id}")
def delete_recipient(
    id: int,
    recipient_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    campaign = db.query(Campaign).filter(Campaign.id == id, Campaign.user_id == current_user.id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    recipient = db.query(Recipient).filter(
        Recipient.id == recipient_id, 
        Recipient.campaign_id == id
    ).first()
    if not recipient:
        raise HTTPException(status_code=404, detail="Recipient not found")
        
    db.delete(recipient)
    db.commit()
    return {"message": "Recipient deleted successfully"}


def get_imap_host(smtp_host: str) -> str:
    h = smtp_host.lower().strip()
    if "gmail" in h:
        return "imap.gmail.com"
    if "outlook" in h or "office365" in h or "hotmail" in h:
        return "outlook.office365.com"
    if "ethereal" in h:
        return "imap.ethereal.email"
    if h.startswith("smtp."):
        return h.replace("smtp.", "imap.", 1)
    return f"imap.{h}"


def parse_header_str(header_value):
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


@app.post("/api/campaigns/{id}/sync-bounces")
def sync_bounces(
    id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    import email
    import re
    
    campaign = db.query(Campaign).filter(Campaign.id == id, Campaign.user_id == current_user.id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
        
    if campaign.sender_id:
        smtp_settings = db.query(SMTPSettings).filter(SMTPSettings.id == campaign.sender_id).first()
    else:
        smtp_settings = db.query(SMTPSettings).filter(SMTPSettings.user_id == campaign.user_id).first()
        
    if not smtp_settings:
        raise HTTPException(status_code=400, detail="SMTP settings not configured for this campaign")
        
    sent_recipients = db.query(Recipient).filter(
        Recipient.campaign_id == id,
        Recipient.status == "sent"
    ).all()
    
    if not sent_recipients:
        return {"synced_bounces": 0, "message": "No sent recipients to scan for bounces"}
        
    recipient_map = {r.email.lower().strip(): r for r in sent_recipients}
    
    from security import decrypt_password
    try:
        password_decrypted = decrypt_password(smtp_settings.encrypted_password)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to decrypt mailbox password: {e}")
        
    imap_host = get_imap_host(smtp_settings.host)
    imap_port = 993
    
    new_bounces_count = 0
    
    try:
        mail = imaplib.IMAP4_SSL(imap_host, imap_port, timeout=15)
        mail.login(smtp_settings.username, password_decrypted)
        mail.select("INBOX")
        
        status, messages = mail.search(None, "ALL")
        if status != "OK" or not messages[0]:
            mail.logout()
            return {"synced_bounces": 0, "message": "No emails found in inbox"}
            
        mail_ids = messages[0].split()
        last_n_ids = mail_ids[-100:]
        
        for mail_id in reversed(last_n_ids):
            status, data = mail.fetch(mail_id, "(RFC822)")
            if status != "OK" or not data or not data[0]:
                continue
                
            raw_email = data[0][1]
            if isinstance(raw_email, str):
                msg = email.message_from_string(raw_email)
            else:
                msg = email.message_from_bytes(raw_email)
                
            subject = parse_header_str(msg.get("Subject", "")).lower()
            sender = parse_header_str(msg.get("From", "")).lower()
            
            is_bounce = False
            if any(keyword in sender for keyword in ["mailer-daemon", "postmaster", "bounce", "delivery"]):
                is_bounce = True
            elif any(keyword in subject for keyword in ["undeliverable", "delivery status", "failed", "returned", "failure", "bounce"]):
                is_bounce = True
                
            if not is_bounce:
                continue
                
            # Get body text decoded properly (quoted-printable, base64, etc.)
            body_text = ""
            if msg.is_multipart():
                for part in msg.walk():
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
                payload = msg.get_payload(decode=True)
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
                    db.commit()
                    
                    recipient_map.pop(email_addr)
                    new_bounces_count += 1
                    
        mail.logout()
        
    except imaplib.IMAP4.error as imap_err:
        raise HTTPException(
            status_code=400, 
            detail=f"IMAP Mailbox connection failed: {imap_err}. Verify your account allows IMAP access."
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to synchronize bounces: {str(e)}")
        
    return {
        "synced_bounces": new_bounces_count,
        "message": f"Successfully synchronized {new_bounces_count} bounced email(s)."
    }


@app.get("/api/sample-csv")
def get_sample_csv():
    csv_content = "company,email\nGoogle,leads@google.com\nApple,jobs@apple.com\n"
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=sample_contacts.csv"}
    )


# ── Admin Panel Endpoints ──────────────────────────────────────────────────────

class AdminUserUpdate(BaseModel):
    plan: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None

class AdminSettingsUpdate(BaseModel):
    trial: Optional[dict] = None
    pro: Optional[dict] = None

@app.get("/api/admin/stats")
def get_admin_stats(current_user: User = Depends(get_current_admin_user), db: Session = Depends(get_db)):
    total_users = db.query(User).count()
    pro_users = db.query(User).filter(User.role != "admin", User.plan == "pro").count()
    active_campaigns = db.query(Campaign).filter(Campaign.status == "running").count()
    
    today_start = datetime.datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    emails_sent_today = db.query(Recipient).filter(Recipient.status == "sent", Recipient.sent_at >= today_start).count()
    total_emails_sent = db.query(Recipient).filter(Recipient.status == "sent").count()
    
    return {
        "total_users": total_users,
        "pro_users": pro_users,
        "active_campaigns": active_campaigns,
        "emails_sent_today": emails_sent_today,
        "total_emails_sent": total_emails_sent,
        "plan_limits": PLAN_LIMITS
    }

@app.get("/api/admin/users")
def get_admin_users(current_user: User = Depends(get_current_admin_user), db: Session = Depends(get_db)):
    users = db.query(User).all()
    results = []
    for u in users:
        campaign_count = db.query(Campaign).filter(Campaign.user_id == u.id).count()
        results.append({
            "id": u.id,
            "email": u.email,
            "plan": u.plan,
            "role": u.role,
            "is_active": u.is_active,
            "created_at": u.created_at.isoformat() if u.created_at else None,
            "campaign_count": campaign_count
        })
    return results

@app.patch("/api/admin/users/{user_id}")
def update_admin_user(user_id: int, update_data: AdminUserUpdate, current_user: User = Depends(get_current_admin_user), db: Session = Depends(get_db)):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot update your own admin role, plan, or active status.")
        
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if update_data.plan is not None:
        if update_data.plan not in ["trial", "pro"]:
            raise HTTPException(status_code=400, detail="Invalid plan name. Must be 'trial' or 'pro'.")
        target_user.plan = update_data.plan
        
    if update_data.role is not None:
        if update_data.role not in ["user", "admin"]:
            raise HTTPException(status_code=400, detail="Invalid role name. Must be 'user' or 'admin'.")
        target_user.role = update_data.role
        
    if update_data.is_active is not None:
        target_user.is_active = update_data.is_active
        
    db.commit()
    db.refresh(target_user)
    return {
        "id": target_user.id,
        "email": target_user.email,
        "plan": target_user.plan,
        "role": target_user.role,
        "is_active": target_user.is_active
    }

@app.delete("/api/admin/users/{user_id}")
def delete_admin_user(user_id: int, current_user: User = Depends(get_current_admin_user), db: Session = Depends(get_db)):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account.")
        
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    db.delete(target_user)
    db.commit()
    return {"message": "User deleted successfully"}

@app.get("/api/admin/campaigns")
def get_admin_campaigns(current_user: User = Depends(get_current_admin_user), db: Session = Depends(get_db)):
    campaigns = db.query(Campaign).all()
    results = []
    for c in campaigns:
        owner = db.query(User).filter(User.id == c.user_id).first()
        recipient_count = db.query(Recipient).filter(Recipient.campaign_id == c.id).count()
        results.append({
            "id": c.id,
            "name": c.name,
            "owner_email": owner.email if owner else "Unknown",
            "status": c.status,
            "recipient_count": recipient_count,
            "created_at": c.created_at.isoformat() if c.created_at else None
        })
    return results

@app.patch("/api/admin/settings")
def update_admin_settings(update_data: AdminSettingsUpdate, current_user: User = Depends(get_current_admin_user)):
    global PLAN_LIMITS
    if update_data.trial:
        for k, v in update_data.trial.items():
            if k in PLAN_LIMITS["trial"] and isinstance(v, int):
                PLAN_LIMITS["trial"][k] = v
    if update_data.pro:
        for k, v in update_data.pro.items():
            if k in PLAN_LIMITS["pro"] and isinstance(v, int):
                PLAN_LIMITS["pro"][k] = v
    return PLAN_LIMITS
