"""
This router handles activity logging and analytics for campaigns, including fetching
historical logs and compiling detailed stats of email delivery rates per campaign.
"""

import datetime
import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import ActivityLog, Campaign, Recipient, User

router = APIRouter()


@router.get("/api/user/activity-log")
def get_activity_log(
    event_type: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    limit = min(max(limit, 1), 200)

    # ── Build summary (unfiltered by event_type / date so stats are always totals) ──
    user_campaigns = db.query(Campaign).filter(Campaign.user_id == current_user.id).all()
    campaign_ids = [c.id for c in user_campaigns]

    total_emails_sent = 0
    delivered_count = 0
    failed_count = 0
    total_campaigns_run = 0

    if campaign_ids:
        stats_rows = db.query(
            func.count(Recipient.id).label("total"),
            func.sum(case((Recipient.status == "sent", 1), else_=0)).label("sent"),
            func.sum(case((Recipient.status.in_(["failed", "bounced"]), 1), else_=0)).label("failed"),
        ).filter(Recipient.campaign_id.in_(campaign_ids)).one()

        total_emails_sent = stats_rows.total or 0
        delivered_count = stats_rows.sent or 0
        failed_count = stats_rows.failed or 0

        total_campaigns_run = db.query(Campaign).filter(
            Campaign.user_id == current_user.id,
            Campaign.status.in_(["running", "completed", "paused"])
        ).count()

    summary = {
        "total_emails_sent": total_emails_sent,
        "total_campaigns_run": total_campaigns_run,
        "delivered_count": delivered_count,
        "failed_count": failed_count,
    }

    # ── Build filtered activity logs ──
    query = db.query(ActivityLog).filter(ActivityLog.user_id == current_user.id)

    if event_type:
        query = query.filter(ActivityLog.event_type == event_type)

    if from_date:
        try:
            from_dt = datetime.datetime.strptime(from_date, "%Y-%m-%d")
            query = query.filter(ActivityLog.created_at >= from_dt)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid from_date format. Must be YYYY-MM-DD.")

    if to_date:
        try:
            to_dt = datetime.datetime.strptime(to_date, "%Y-%m-%d") + datetime.timedelta(days=1) - datetime.timedelta(seconds=1)
            query = query.filter(ActivityLog.created_at <= to_dt)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid to_date format. Must be YYYY-MM-DD.")

    logs = query.order_by(ActivityLog.created_at.desc()).offset(offset).limit(limit).all()

    results = []
    for log in logs:
        meta = None
        if log.metadata_json:
            try:
                meta = json.loads(log.metadata_json)
            except Exception:
                pass
        results.append({
            "id": log.id,
            "event_type": log.event_type,
            "action": log.action,
            "metadata": meta,
            "created_at": log.created_at.isoformat() if log.created_at else None
        })

    return {"summary": summary, "logs": results}


@router.get("/api/user/campaign-activity/{campaign_id}")
def get_campaign_activity(
    campaign_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    campaign = db.query(Campaign).filter(
        Campaign.id == campaign_id,
        Campaign.user_id == current_user.id
    ).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found.")

    recipients = db.query(Recipient).filter(
        Recipient.campaign_id == campaign_id
    ).order_by(Recipient.sent_at.asc()).all()

    total_leads = len(recipients)
    agg_delivered = sum(1 for r in recipients if r.status == "sent")
    agg_failed = sum(1 for r in recipients if r.status in ("failed", "bounced"))
    agg_pending = sum(1 for r in recipients if r.status == "pending")

    send_events = []
    for r in recipients:
        if r.status in ("sent", "failed", "bounced"):
            send_events.append({
                "email": r.email,
                "company": r.company or "",
                "status": "delivered" if r.status == "sent" else r.status,
                "sent_at": r.sent_at.isoformat() if r.sent_at else None,
                "error_message": r.error_message or None,
            })

    return {
        "id": campaign.id,
        "name": campaign.name,
        "status": campaign.status,
        "created_at": campaign.created_at.isoformat() if campaign.created_at else None,
        "total_leads": total_leads,
        "stats": {
            "delivered": agg_delivered,
            "failed": agg_failed,
            "pending": agg_pending,
        },
        "send_events": send_events,
    }
