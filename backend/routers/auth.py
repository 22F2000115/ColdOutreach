"""
This router handles authentication operations, including user registration,
login (token generation), token rotation (refresh), and password updates.
"""

import datetime
import os
import re

from fastapi import APIRouter, Depends, Form, HTTPException, Request, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from activity import log_activity
from auth import (
    ALGORITHM,
    JWT_SECRET_KEY,
    create_access_token,
    create_refresh_token,
    get_current_user,
    get_password_hash,
    verify_password,
)
from database import get_db
from dependencies import limiter
from models import PlanQuota, User
from schemas import PasswordChangeRequest


EMAIL_REGEX = re.compile(r'^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$')

router = APIRouter()

@router.post("/api/auth/register", status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
def register(request: Request, email: str = Form(...), password: str = Form(...), db: Session = Depends(get_db)):
    email = email.strip().lower()
    if not EMAIL_REGEX.match(email):
        raise HTTPException(status_code=400, detail="Invalid email address format.")

    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters long.")

    existing_user = db.query(User).filter(User.email == email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered.")

    hashed_pw = get_password_hash(password)
    new_user = User(
        email=email,
        hashed_password=hashed_pw,
        plan="trial",
        trial_expires_at=datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None) + datetime.timedelta(days=30)
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"message": "User registered successfully", "user_id": new_user.id}


@router.post("/api/auth/login")
@limiter.limit("10/minute")
def login(request: Request, response: Response, form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
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
    is_prod = os.getenv("ENV", "development") == "production"
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        max_age=7 * 24 * 60 * 60,
        expires=7 * 24 * 60 * 60,
        samesite="lax",
        secure=is_prod
    )
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/api/auth/refresh")
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

    is_prod = os.getenv("ENV", "development") == "production"
    response.set_cookie(
        key="refresh_token",
        value=new_refresh_token,
        httponly=True,
        max_age=7 * 24 * 60 * 60,
        expires=7 * 24 * 60 * 60,
        samesite="lax",
        secure=is_prod
    )
    return {"access_token": new_access_token, "token_type": "bearer"}


@router.post("/api/auth/logout")
def logout(response: Response):
    response.delete_cookie(key="refresh_token")
    return {"message": "Logged out successfully"}


@router.get("/api/auth/me")
def get_me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    quota = db.query(PlanQuota).filter(PlanQuota.plan == current_user.plan).first()
    if quota:
        quotas_dict = {
            "add": quota.add_limit,
            "edit": quota.edit_limit,
            "delete": quota.delete_limit,
            "save": quota.save_limit,
            "max_recipients_per_campaign": quota.max_recipients_per_campaign
        }
        limits_dict = {
            "max_smtp_accounts": quota.max_smtp_accounts,
            "max_campaigns": quota.max_campaigns
        }
    else:
        quotas_dict = {
            "add": 999999,
            "edit": 999999,
            "delete": 999999,
            "save": 999999,
            "max_recipients_per_campaign": 50000 if current_user.plan == "pro" else 500
        }
        limits_dict = {
            "max_smtp_accounts": 3 if current_user.plan == "pro" else 1,
            "max_campaigns": 999999 if current_user.plan == "pro" else 3
        }
    return {
        "id": current_user.id,
        "email": current_user.email,
        "plan": current_user.plan,
        "role": current_user.role,
        "trial_expires_at": current_user.trial_expires_at.isoformat() if current_user.trial_expires_at else None,
        "usage": {
            "add": current_user.campaign_add_count,
            "edit": current_user.campaign_edit_count,
            "delete": current_user.campaign_delete_count,
            "save": current_user.campaign_save_count
        },
        "quotas": quotas_dict,
        "limits": limits_dict
    }


@router.post("/api/user/change-password")
def change_password(
    body: PasswordChangeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not verify_password(body.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")
    if len(body.new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters long.")
    if body.current_password == body.new_password:
        raise HTTPException(status_code=400, detail="New password must be different from current password.")
    current_user.hashed_password = get_password_hash(body.new_password)
    db.commit()
    log_activity(db, current_user.id, "profile", "Password changed", {})
    return {"message": "Password changed successfully."}
