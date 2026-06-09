"""
This router handles admin-level operations, including statistics retrieval,
user listing, updating, deletion, plan settings adjustment, and contact details management.
"""

import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from activity import log_activity
from auth import get_current_admin_user
from database import get_db
from models import Campaign, ContactDetail, PlanQuota, Recipient, User
from schemas import AdminSettingsUpdate, AdminUserUpdate, ContactDetailCreateRequest, ContactDetailUpdate


router = APIRouter()

@router.get("/api/admin/stats")
def get_admin_stats(current_user: User = Depends(get_current_admin_user), db: Session = Depends(get_db)):
    total_users = db.query(User).count()
    pro_users = db.query(User).filter(User.role != "admin", User.plan == "pro").count()
    active_campaigns = db.query(Campaign).filter(Campaign.status == "running").count()

    today_start = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None).replace(hour=0, minute=0, second=0, microsecond=0)
    emails_sent_today = db.query(Recipient).filter(Recipient.status == "sent", Recipient.sent_at >= today_start).count()
    total_emails_sent = db.query(Recipient).filter(Recipient.status == "sent").count()

    quotas = db.query(PlanQuota).all()
    plan_quotas_dict = {}
    plan_limits_dict = {}
    for q in quotas:
        plan_quotas_dict[q.plan] = {
            "add_limit": q.add_limit,
            "edit_limit": q.edit_limit,
            "delete_limit": q.delete_limit,
            "save_limit": q.save_limit
        }
        plan_limits_dict[q.plan] = {
            "max_smtp_accounts": q.max_smtp_accounts,
            "max_campaigns": q.max_campaigns,
            "max_recipients_per_campaign": q.max_recipients_per_campaign
        }

    return {
        "total_users": total_users,
        "pro_users": pro_users,
        "active_campaigns": active_campaigns,
        "emails_sent_today": emails_sent_today,
        "total_emails_sent": total_emails_sent,
        "plan_limits": plan_limits_dict,
        "plan_quotas": plan_quotas_dict
    }


@router.get("/api/admin/users")
def get_admin_users(
    page: int = 1,
    limit: int = 10,
    search: Optional[str] = None,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    query = db.query(User)
    if search:
        query = query.filter(User.email.like(f"%{search}%"))

    total = query.count()
    users = query.offset((page - 1) * limit).limit(limit).all()

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

    import math
    return {
        "users": results,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": math.ceil(total / limit) if limit > 0 else 1
    }


@router.patch("/api/admin/users/{user_id}")
def update_admin_user(
    user_id: int,
    update_data: AdminUserUpdate,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot update your own admin role, plan, or active status.")

    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found.")

    plan_changed = False
    old_plan = None
    new_plan = None
    if update_data.plan is not None:
        if update_data.plan not in ["trial", "pro"]:
            raise HTTPException(status_code=400, detail="Invalid plan name. Must be 'trial' or 'pro'.")
        if target_user.plan != update_data.plan:
            plan_changed = True
            old_plan = target_user.plan
            new_plan = update_data.plan
            target_user.campaign_add_count = 0
            target_user.campaign_edit_count = 0
            target_user.campaign_delete_count = 0
            target_user.campaign_save_count = 0
            target_user.plan = update_data.plan

    if update_data.role is not None:
        if update_data.role not in ["user", "admin"]:
            raise HTTPException(status_code=400, detail="Invalid role name. Must be 'user' or 'admin'.")
        target_user.role = update_data.role

    if update_data.is_active is not None:
        target_user.is_active = update_data.is_active

    db.commit()
    db.refresh(target_user)

    if plan_changed:
        action_str = "Plan upgraded to Pro" if new_plan == "pro" else "Plan downgraded to Trial"
        log_activity(db, target_user.id, "profile", action_str, {"old_plan": old_plan, "new_plan": new_plan})

    return {
        "id": target_user.id,
        "email": target_user.email,
        "plan": target_user.plan,
        "role": target_user.role,
        "is_active": target_user.is_active
    }


@router.delete("/api/admin/users/{user_id}")
def delete_admin_user(user_id: int, current_user: User = Depends(get_current_admin_user), db: Session = Depends(get_db)):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account.")

    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found.")

    db.delete(target_user)
    db.commit()
    return {"message": "User deleted successfully"}


@router.get("/api/admin/campaigns")
def get_admin_campaigns(
    page: int = 1,
    limit: int = 10,
    search: Optional[str] = None,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    query = db.query(Campaign)
    if search:
        query = query.join(User, Campaign.user_id == User.id).filter(
            (Campaign.name.like(f"%{search}%")) | (User.email.like(f"%{search}%"))
        )

    total = query.count()
    campaigns = query.offset((page - 1) * limit).limit(limit).all()

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

    import math
    return {
        "campaigns": results,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": math.ceil(total / limit) if limit > 0 else 1
    }


@router.patch("/api/admin/settings")
def update_admin_settings(
    update_data: AdminSettingsUpdate,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    if update_data.trial:
        trial_quota = db.query(PlanQuota).filter(PlanQuota.plan == "trial").first()
        if not trial_quota:
            trial_quota = PlanQuota(plan="trial")
            db.add(trial_quota)
        for k, v in update_data.trial.items():
            if hasattr(trial_quota, k) and isinstance(v, int):
                setattr(trial_quota, k, v)
        db.commit()

    if update_data.pro:
        pro_quota = db.query(PlanQuota).filter(PlanQuota.plan == "pro").first()
        if not pro_quota:
            pro_quota = PlanQuota(plan="pro")
            db.add(pro_quota)
        for k, v in update_data.pro.items():
            if hasattr(pro_quota, k) and isinstance(v, int):
                setattr(pro_quota, k, v)
        db.commit()

    if update_data.trial_quotas:
        trial_quota = db.query(PlanQuota).filter(PlanQuota.plan == "trial").first()
        if not trial_quota:
            trial_quota = PlanQuota(plan="trial")
            db.add(trial_quota)
        if "add" in update_data.trial_quotas:
            trial_quota.add_limit = int(update_data.trial_quotas["add"])
        if "edit" in update_data.trial_quotas:
            trial_quota.edit_limit = int(update_data.trial_quotas["edit"])
        if "delete" in update_data.trial_quotas:
            trial_quota.delete_limit = int(update_data.trial_quotas["delete"])
        if "save" in update_data.trial_quotas:
            trial_quota.save_limit = int(update_data.trial_quotas["save"])
        db.commit()

    if update_data.pro_quotas:
        pro_quota = db.query(PlanQuota).filter(PlanQuota.plan == "pro").first()
        if not pro_quota:
            pro_quota = PlanQuota(plan="pro")
            db.add(pro_quota)
        if "add" in update_data.pro_quotas:
            pro_quota.add_limit = int(update_data.pro_quotas["add"])
        if "edit" in update_data.pro_quotas:
            pro_quota.edit_limit = int(update_data.pro_quotas["edit"])
        if "delete" in update_data.pro_quotas:
            pro_quota.delete_limit = int(update_data.pro_quotas["delete"])
        if "save" in update_data.pro_quotas:
            pro_quota.save_limit = int(update_data.pro_quotas["save"])
        db.commit()

    quotas = db.query(PlanQuota).all()
    plan_quotas_dict = {}
    plan_limits_dict = {}
    for q in quotas:
        plan_quotas_dict[q.plan] = {
            "add_limit": q.add_limit,
            "edit_limit": q.edit_limit,
            "delete_limit": q.delete_limit,
            "save_limit": q.save_limit
        }
        plan_limits_dict[q.plan] = {
            "max_smtp_accounts": q.max_smtp_accounts,
            "max_campaigns": q.max_campaigns,
            "max_recipients_per_campaign": q.max_recipients_per_campaign
        }

    return {
        "plan_limits": plan_limits_dict,
        "plan_quotas": plan_quotas_dict
    }


@router.post("/api/admin/contact-details")
def create_contact_detail(
    data: ContactDetailCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    if data.type not in ["email", "whatsapp"]:
        raise HTTPException(status_code=400, detail="Invalid contact type. Must be 'email' or 'whatsapp'.")

    val = data.value.strip()
    if not val:
        raise HTTPException(status_code=400, detail="Value cannot be empty.")

    if data.type == "email":
        if "@" not in val:
            raise HTTPException(status_code=400, detail="Invalid email address format.")
    else:
        digits_only = "".join([c for c in val if c.isdigit()])
        if len(digits_only) < 7:
            raise HTTPException(status_code=400, detail="Invalid WhatsApp number format.")

    new_detail = ContactDetail(
        type=data.type,
        value=val,
        label=data.label.strip() if data.label else None
    )
    db.add(new_detail)
    db.commit()
    db.refresh(new_detail)
    return {
        "id": new_detail.id,
        "type": new_detail.type,
        "value": new_detail.value,
        "label": new_detail.label
    }


@router.put("/api/admin/contact-details/{id}")
def update_contact_detail(
    id: int,
    data: ContactDetailUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    detail = db.query(ContactDetail).filter(ContactDetail.id == id).first()
    if not detail:
        raise HTTPException(status_code=404, detail="Contact detail not found.")

    if data.type is not None:
        if data.type not in ["email", "whatsapp"]:
            raise HTTPException(status_code=400, detail="Invalid contact type. Must be 'email' or 'whatsapp'.")
        detail.type = data.type

    if data.value is not None:
        val = data.value.strip()
        if not val:
            raise HTTPException(status_code=400, detail="Value cannot be empty.")
        if detail.type == "email" and "@" not in val:
            raise HTTPException(status_code=400, detail="Invalid email address format.")
        elif detail.type == "whatsapp":
            digits_only = "".join([c for c in val if c.isdigit()])
            if len(digits_only) < 7:
                raise HTTPException(status_code=400, detail="Invalid WhatsApp number format.")
        detail.value = val

    if data.label is not None:
        detail.label = data.label.strip() if data.label else None

    db.commit()
    db.refresh(detail)
    return {
        "id": detail.id,
        "type": detail.type,
        "value": detail.value,
        "label": detail.label
    }


@router.delete("/api/admin/contact-details/{id}")
def delete_contact_detail(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    detail = db.query(ContactDetail).filter(ContactDetail.id == id).first()
    if not detail:
        raise HTTPException(status_code=404, detail="Contact detail not found.")

    db.delete(detail)
    db.commit()
    return {"message": "Contact detail deleted successfully"}
