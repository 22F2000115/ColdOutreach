"""
This router handles SMTP configurations for users, including creating, updating,
deleting, retrieving, and testing SMTP connection details.
"""

import smtplib
from typing import Optional

from fastapi import APIRouter, Depends, Form, HTTPException, status
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from dependencies import get_plan_limits
from models import Campaign, SMTPSettings, User
from routers.campaigns import user_locks
from security import decrypt_password, encrypt_password
from worker import get_smtp_connection


router = APIRouter()

@router.get("/api/settings/smtp")
def get_smtp(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    settings_list = db.query(SMTPSettings).filter(SMTPSettings.user_id == current_user.id).all()
    return [{
        "id": s.id,
        "host": s.host,
        "port": s.port,
        "username": s.username,
        "from_name": s.from_name,
        "from_email": s.from_email,
        "send_delay_seconds": s.send_delay_seconds,
        "has_password": True
    } for s in settings_list]


@router.post("/api/settings/smtp")
def save_smtp(
    sender_id: Optional[int] = Form(None),
    host: Optional[str] = Form(None),
    port: Optional[int] = Form(None),
    username: Optional[str] = Form(None),
    password: Optional[str] = Form(None),
    from_name: str = Form(...),
    from_email: Optional[str] = Form(None),
    send_delay_seconds: Optional[int] = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if sender_id:
        settings = db.query(SMTPSettings).filter(
            SMTPSettings.id == sender_id,
            SMTPSettings.user_id == current_user.id
        ).first()
        if not settings:
            raise HTTPException(status_code=404, detail="Sender account not found.")
        if host is not None:
            settings.host = host
        if port is not None:
            settings.port = port
        if username is not None:
            settings.username = username
        if password and password != "••••••••••••••••":
            settings.encrypted_password = encrypt_password(password)
        settings.from_name = from_name
        if from_email is not None:
            settings.from_email = from_email
        elif username is not None:
            settings.from_email = username

        if send_delay_seconds is not None:
            settings.send_delay_seconds = max(1, min(send_delay_seconds, 60))
        db.commit()
    else:
        with user_locks[current_user.id]:
            # Enforce limits using PlanQuota from database
            user_plan = current_user.plan or "trial"
            limits = get_plan_limits(user_plan, db)
            max_accounts = limits.get("max_smtp_accounts", 1)
            existing_count = db.query(SMTPSettings).filter(SMTPSettings.user_id == current_user.id).count()
            if existing_count >= max_accounts:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Sender account limit reached ({max_accounts} on {current_user.plan} plan). Upgrade to Pro for more sender accounts."
                )
            if not host or not port or not username:
                raise HTTPException(status_code=400, detail="Host, port, and username are required for new SMTP configuration.")
            if not password or password == "••••••••••••••••":
                raise HTTPException(status_code=400, detail="Password is required for new SMTP configuration.")
            encrypted_pw = encrypt_password(password)

            # clamp delay
            clamped_delay = max(1, min(send_delay_seconds or 3, 60))

            settings = SMTPSettings(
                user_id=current_user.id,
                host=host,
                port=port,
                username=username,
                encrypted_password=encrypted_pw,
                from_name=from_name,
                from_email=from_email or username,
                send_delay_seconds=clamped_delay
            )
            db.add(settings)
            db.commit()
            db.refresh(settings)
            from activity import log_activity
            log_activity(
                db,
                current_user.id,
                "smtp",
                f"SMTP account added ({from_email or username})",
                {"smtp_id": settings.id, "from_email": from_email or username}
            )

    return {"message": "SMTP Settings saved successfully"}


@router.delete("/api/settings/smtp/{id}")
def delete_smtp(id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    settings = db.query(SMTPSettings).filter(
        SMTPSettings.id == id,
        SMTPSettings.user_id == current_user.id
    ).first()
    if not settings:
        raise HTTPException(status_code=404, detail="Sender account not found.")

    # Check if there are any campaigns using this sender
    campaigns_using = db.query(Campaign).filter(Campaign.sender_id == id).count()
    if campaigns_using > 0:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete this sender account because it is currently linked to active campaigns."
        )

    smtp_email = settings.from_email
    db.delete(settings)
    db.commit()
    from activity import log_activity
    log_activity(
        db,
        current_user.id,
        "smtp",
        f"SMTP account deleted ({smtp_email})",
        {"from_email": smtp_email}
    )
    return {"message": "Sender account deleted successfully"}


@router.post("/api/settings/smtp/test")
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
                raise HTTPException(status_code=400, detail="Password is required to run connection test.")
            password_plain = decrypt_password(settings.encrypted_password)
        else:
            password_plain = password

        # Establish connection to verify credentials
        server = get_smtp_connection(host, port, username, password_plain)

        test_msg = (
            f"From: {from_name} <{from_email}>\n"
            f"To: {current_user.email}\n"
            f"Subject: SMTP Test successful\n\n"
            f"Hi!\n\nThis is a test email verifying that your SMTP settings are configured correctly."
        )
        server.sendmail(from_email, current_user.email, test_msg)
        server.quit()
        return {"message": "SMTP Connection verified and test email sent!"}
    except HTTPException as he:
        raise he
    except smtplib.SMTPAuthenticationError:
        raise HTTPException(status_code=400, detail="SMTP Authentication failed. Check username and App Password.")
    except Exception as error:
        raise HTTPException(status_code=400, detail=f"SMTP Connection failed: {str(error)}.")
