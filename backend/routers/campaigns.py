"""
This router handles campaigns management, including creation, listing, updating,
deletion, starting/pausing, CSV upload, and manual recipients adjustments.
"""

import csv
from collections import defaultdict
import io
import json
import re
import shutil
import threading
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Response, UploadFile, status

from auth import get_current_user
from database import get_db
from dependencies import check_quota, get_plan_limits, increment_usage
from models import Campaign, PlanQuota, Recipient, SMTPSettings, User
from schemas import BulkDeleteRequest
from worker import UPLOADS_DIR, send_campaign_emails


EMAIL_REGEX = re.compile(r'^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$')
MAX_CSV_BYTES = 6 * 1024 * 1024  # 6 MB

user_locks = defaultdict(threading.Lock)

router = APIRouter()

def parse_recipients_from_csv_rows(rows: list, campaign_id: int, existing_emails: set = None) -> list[Recipient]:
    if not rows:
        return []
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
            detail=f"CSV must contain an 'email' column. Headers found: {list(rows[0].keys())}."
        )

    recipients_list = []
    known_keys = {email_key, company_key, first_name_key, last_name_key, role_key}
    for r in rows:
        email = r.get(email_key, "")
        if not email:
            continue
        email = email.strip()
        if not email or not EMAIL_REGEX.match(email):
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


@router.get("/api/campaigns")
def list_campaigns(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    campaigns = db.query(Campaign).filter(Campaign.user_id == current_user.id).order_by(Campaign.created_at.desc()).all()

    from sqlalchemy import func, case
    campaign_ids = [c.id for c in campaigns]
    stats_map = {}
    if campaign_ids:
        stats_rows = db.query(
            Recipient.campaign_id,
            func.count(Recipient.id).label("total"),
            func.sum(case((Recipient.status == "sent", 1), else_=0)).label("sent"),
            func.sum(case((Recipient.status == "failed", 1), else_=0)).label("failed"),
        ).filter(
            Recipient.campaign_id.in_(campaign_ids)
        ).group_by(Recipient.campaign_id).all()

        stats_map = {row.campaign_id: row for row in stats_rows}

    result = []
    for c in campaigns:
        stats = stats_map.get(c.id)
        total = stats.total if (stats and stats.total is not None) else 0
        sent = stats.sent if (stats and stats.sent is not None) else 0
        failed = stats.failed if (stats and stats.failed is not None) else 0

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


@router.post("/api/campaigns")
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
    # Enforce size checks on CSV if provided
    csv_rows = []
    if contacts_csv and contacts_csv.filename:
        if contacts_csv.size and contacts_csv.size > MAX_CSV_BYTES:
            raise HTTPException(status_code=400, detail="CSV file too large. Maximum allowed size is 6 MB.")
        contents = await contacts_csv.read()
        if len(contents) > MAX_CSV_BYTES:
            raise HTTPException(status_code=400, detail="CSV file too large. Maximum allowed size is 6 MB.")
        try:
            csv_text = contents.decode("utf-8")
            reader = csv.DictReader(io.StringIO(csv_text))
            csv_rows = list(reader)
        except Exception as error:
            raise HTTPException(status_code=400, detail=f"Failed to read CSV file: {error}.")

    with user_locks[current_user.id]:
        check_quota(current_user, "add", db)

        # Prevent IdOR: Validate SMTP settings ownership
        if sender_id:
            smtp_exists = db.query(SMTPSettings).filter(SMTPSettings.id == sender_id, SMTPSettings.user_id == current_user.id).first()
            if not smtp_exists:
                raise HTTPException(status_code=400, detail="Invalid sender account or access denied.")

        # Enforce campaign creation limit
        user_plan = current_user.plan or "trial"
        limits = get_plan_limits(user_plan, db)
        max_campaigns = limits.get("max_campaigns", 3)
        existing_count = db.query(Campaign).filter(Campaign.user_id == current_user.id).count()
        if existing_count >= max_campaigns:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Campaign creation limit reached ({max_campaigns} on {current_user.plan} plan). Upgrade to Pro for unlimited campaigns."
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
        if csv_rows:
            quota = db.query(PlanQuota).filter(PlanQuota.plan == current_user.plan).first()
            max_r = quota.max_recipients_per_campaign if quota else 500
            if len(csv_rows) > max_r:
                raise HTTPException(
                    status_code=400,
                    detail=f"CSV contains {len(csv_rows)} recipients but your plan allows a maximum of {max_r} per campaign."
                )
            recipients_list = parse_recipients_from_csv_rows(csv_rows, new_campaign.id)
            if recipients_list:
                db.bulk_save_objects(recipients_list)
                db.commit()

        increment_usage(current_user, "add", db)
        from activity import log_activity
        log_activity(
            db,
            current_user.id,
            "campaign",
            f"Campaign created: {name}",
            {"campaign_id": new_campaign.id, "campaign_name": name}
        )

    return {"message": "Campaign created successfully", "campaign_id": new_campaign.id}


@router.get("/api/campaigns/{id}")
def get_campaign(
    id: int,
    poll: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    campaign = db.query(Campaign).filter(Campaign.id == id, Campaign.user_id == current_user.id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found.")

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
        "sender": {
            "id": campaign.sender.id,
            "host": campaign.sender.host,
            "port": campaign.sender.port,
            "username": campaign.sender.username,
            "from_name": campaign.sender.from_name,
            "from_email": campaign.sender.from_email,
            "send_delay_seconds": campaign.sender.send_delay_seconds
        } if campaign.sender else None,
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


@router.get("/api/campaigns/{id}/recipients")
def get_campaign_recipients(
    id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    campaign = db.query(Campaign).filter(Campaign.id == id, Campaign.user_id == current_user.id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found.")

    recipients = db.query(Recipient).filter(Recipient.campaign_id == id).all()
    return [{
        "id": r.id,
        "email": r.email,
        "company": r.company,
        "status": r.status,
        "error_message": r.error_message,
        "sent_at": r.sent_at
    } for r in recipients]


@router.post("/api/campaigns/{id}/action")
def campaign_action(
    id: int,
    action: str = Form(...),  # start, pause, reset
    background_tasks: BackgroundTasks = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    campaign = db.query(Campaign).filter(Campaign.id == id, Campaign.user_id == current_user.id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found.")

    if action == "start":
        # Check if user has SMTP settings configured
        smtp_settings = db.query(SMTPSettings).filter(SMTPSettings.user_id == current_user.id).first()
        if not smtp_settings:
            raise HTTPException(
                status_code=400,
                detail="Please configure SMTP settings before starting the campaign."
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
        from activity import log_activity
        log_activity(
            db,
            current_user.id,
            "campaign",
            f"Campaign started: {campaign.name}",
            {"campaign_id": campaign.id, "campaign_name": campaign.name}
        )
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


@router.delete("/api/campaigns/{id}")
def delete_campaign(id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    check_quota(current_user, "delete", db)
    campaign = db.query(Campaign).filter(Campaign.id == id, Campaign.user_id == current_user.id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found.")

    # Delete uploaded attachment file if it exists
    if campaign.attachment_name:
        attachment_path = UPLOADS_DIR / f"{campaign.id}_{campaign.attachment_name}"
        if attachment_path.exists():
            try:
                os.remove(attachment_path)
            except Exception:
                pass

    campaign_name = campaign.name
    campaign_id = campaign.id
    db.delete(campaign)
    db.commit()
    increment_usage(current_user, "delete", db)
    from activity import log_activity
    log_activity(
        db,
        current_user.id,
        "campaign",
        f"Campaign deleted: {campaign_name}",
        {"campaign_id": campaign_id, "campaign_name": campaign_name}
    )
    return {"message": "Campaign deleted successfully"}


@router.put("/api/campaigns/{id}")
def update_campaign(
    id: int,
    name: str = Form(...),
    subject_template: str = Form(...),
    body_template: str = Form(...),
    sender_id: Optional[int] = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    check_quota(current_user, "save", db)
    campaign = db.query(Campaign).filter(Campaign.id == id, Campaign.user_id == current_user.id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found.")
    if campaign.status not in ("draft", "paused", "completed"):
        raise HTTPException(
            status_code=400,
            detail="Cannot edit a campaign that is active. Please pause it first."
        )

    if sender_id is not None:
        smtp_exists = db.query(SMTPSettings).filter(SMTPSettings.id == sender_id, SMTPSettings.user_id == current_user.id).first()
        if not smtp_exists:
            raise HTTPException(status_code=400, detail="Invalid sender account or access denied.")
        campaign.sender_id = sender_id

    campaign.name = name
    campaign.subject_template = subject_template
    campaign.body_template = body_template
    db.commit()
    db.refresh(campaign)
    increment_usage(current_user, "save", db)
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


@router.post("/api/campaigns/{id}/recipients")
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
        raise HTTPException(status_code=404, detail="Campaign not found.")

    email = email.strip()
    if not email or not EMAIL_REGEX.match(email):
        raise HTTPException(status_code=400, detail="Invalid email address.")

    # Enforce recipients count limit
    quota = db.query(PlanQuota).filter(PlanQuota.plan == current_user.plan).first()
    max_r = quota.max_recipients_per_campaign if quota else 500
    existing_count = db.query(Recipient).filter(Recipient.campaign_id == id).count()
    if existing_count >= max_r:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot add recipient. Campaign has reached the limit of {max_r} recipients for your plan."
        )

    # Check duplicate in this campaign
    existing = db.query(Recipient).filter(
        Recipient.campaign_id == id,
        Recipient.email == email
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Recipient email already exists in this campaign.")

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
    if campaign.status == "completed":
        campaign.status = "paused"
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



@router.post("/api/campaigns/{id}/recipients/csv")
async def upload_recipients_csv(
    id: int,
    contacts_csv: UploadFile = File(...),
    mode: str = Form("append"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    campaign = db.query(Campaign).filter(Campaign.id == id, Campaign.user_id == current_user.id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found.")

    if mode not in ("append", "replace"):
        raise HTTPException(status_code=400, detail="Invalid mode, must be 'append' or 'replace'.")

    if contacts_csv.size and contacts_csv.size > MAX_CSV_BYTES:
        raise HTTPException(status_code=400, detail="CSV file too large. Maximum allowed size is 6 MB.")

    contents = await contacts_csv.read()
    if len(contents) > MAX_CSV_BYTES:
        raise HTTPException(status_code=400, detail="CSV file too large. Maximum allowed size is 6 MB.")
    try:
        csv_text = contents.decode("utf-8")
        reader = csv.DictReader(io.StringIO(csv_text))
        rows = list(reader)
    except Exception as error:
        raise HTTPException(status_code=400, detail=f"Failed to read CSV file: {error}.")

    if not rows:
        raise HTTPException(status_code=400, detail="CSV file is empty.")

    existing_emails = set()
    if mode == "append":
        existing = db.query(Recipient.email).filter(Recipient.campaign_id == id).all()
        existing_emails = {e[0].lower() for e in existing}

    recipients_list = parse_recipients_from_csv_rows(rows, id, existing_emails)

    if not recipients_list and mode == "append":
        return {"message": "No new recipients to add (all were duplicates or invalid)."}

    # Enforce recipients count limit
    quota = db.query(PlanQuota).filter(PlanQuota.plan == current_user.plan).first()
    max_r = quota.max_recipients_per_campaign if quota else 500
    existing_count = db.query(Recipient).filter(Recipient.campaign_id == id).count()
    if mode == "append" and existing_count + len(recipients_list) > max_r:
        raise HTTPException(
            status_code=400,
            detail=f"Adding these recipients would exceed your plan's limit of {max_r} recipients per campaign."
        )
    if mode == "replace" and len(recipients_list) > max_r:
        raise HTTPException(
            status_code=400,
            detail=f"CSV contains {len(recipients_list)} recipients but your plan allows a maximum of {max_r} per campaign."
        )

    if mode == "replace":
        db.query(Recipient).filter(Recipient.campaign_id == id).delete()
        db.commit()

    if recipients_list:
        db.bulk_save_objects(recipients_list)
        if campaign.status == "completed":
            campaign.status = "paused"
        db.commit()

    return {"message": f"Successfully uploaded {len(recipients_list)} recipients in {mode} mode"}


@router.get("/api/campaigns/{id}/recipients/csv")
def download_recipients_csv(
    id: int,
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    campaign = db.query(Campaign).filter(Campaign.id == id, Campaign.user_id == current_user.id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found.")

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


@router.delete("/api/campaigns/{id}/recipients/bulk")
def bulk_delete_recipients(
    id: int,
    body: BulkDeleteRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    campaign = db.query(Campaign).filter(Campaign.id == id, Campaign.user_id == current_user.id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found.")

    deleted_count = db.query(Recipient).filter(
        Recipient.campaign_id == id,
        Recipient.id.in_(body.ids)
    ).delete(synchronize_session=False)

    db.commit()
    return {"deleted": deleted_count}


@router.delete("/api/campaigns/{id}/recipients/{recipient_id}")
def delete_recipient(
    id: int,
    recipient_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    campaign = db.query(Campaign).filter(Campaign.id == id, Campaign.user_id == current_user.id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found.")

    recipient = db.query(Recipient).filter(
        Recipient.id == recipient_id,
        Recipient.campaign_id == id
    ).first()
    if not recipient:
        raise HTTPException(status_code=404, detail="Recipient not found.")

    db.delete(recipient)
    db.commit()
    return {"message": "Recipient deleted successfully"}


@router.post("/api/campaigns/{id}/sync-bounces")
def sync_bounces(
    id: int,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    campaign = db.query(Campaign).filter(Campaign.id == id, Campaign.user_id == current_user.id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found.")

    if campaign.sender_id:
        smtp_settings = db.query(SMTPSettings).filter(SMTPSettings.id == campaign.sender_id).first()
    else:
        smtp_settings = db.query(SMTPSettings).filter(SMTPSettings.user_id == current_user.id).first()

    if not smtp_settings:
        raise HTTPException(status_code=400, detail="SMTP settings not configured for this campaign.")

    sent_count = db.query(Recipient).filter(
        Recipient.campaign_id == id, Recipient.status == "sent"
    ).count()
    if sent_count == 0:
        return {"message": "No sent recipients to scan for bounces."}

    from worker import run_bounce_sync
    background_tasks.add_task(run_bounce_sync, id, smtp_settings.id)
    return {"message": "Bounce sync started in background. Check back in a moment."}
