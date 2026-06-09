from fastapi import HTTPException
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

from models import PlanQuota, User

limiter = Limiter(key_func=get_remote_address)


def check_quota(user: User, action: str, db: Session):
    """
    Check if a user has exceeded their plan quota limit for a specific action.

    Args:
        user (User): The user object to check limits for.
        action (str): The type of action ('add', 'edit', 'delete', or 'save').
        db (Session): Database session to query plan quotas.

    Raises:
        HTTPException: If the user's campaign action count exceeds the allowed limit.
    """
    if user.role == "admin":
        return

    quota = db.query(PlanQuota).filter(PlanQuota.plan == user.plan).first()
    if not quota:
        return

    if action == "add":
        if user.campaign_add_count >= quota.add_limit:
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to perform this action."
            )
    elif action == "edit":
        if user.campaign_edit_count >= quota.edit_limit:
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to perform this action."
            )
    elif action == "delete":
        if user.campaign_delete_count >= quota.delete_limit:
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to perform this action."
            )
    elif action == "save":
        if user.campaign_save_count >= quota.save_limit:
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to perform this action."
            )


def increment_usage(user: User, action: str, db: Session):
    """
    Increment a user's action count in the database once the action has been performed.

    Args:
        user (User): The user executing the action.
        action (str): The type of action performed ('add', 'edit', 'delete', or 'save').
        db (Session): Database session to commit the usage increase.
    """
    if user.role == "admin":
        return
    if action == "add":
        user.campaign_add_count += 1
    elif action == "edit":
        user.campaign_edit_count += 1
    elif action == "delete":
        user.campaign_delete_count += 1
    elif action == "save":
        user.campaign_save_count += 1
    db.commit()


def get_plan_limits(plan: str, db: Session) -> dict:
    """
    Retrieve configured limits for a given plan.

    Args:
        plan (str): The user plan string ('trial' or 'pro').
        db (Session): Database session to query configured plan quotas.

    Returns:
        dict: A dictionary containing max_smtp_accounts, max_campaigns,
              and max_recipients_per_campaign.
    """
    quota = db.query(PlanQuota).filter(PlanQuota.plan == plan).first()
    if quota:
        return {
            "max_smtp_accounts": quota.max_smtp_accounts,
            "max_campaigns": quota.max_campaigns,
            "max_recipients_per_campaign": quota.max_recipients_per_campaign
        }
    if plan == "pro":
        return {
            "max_smtp_accounts": 3,
            "max_campaigns": 999999,
            "max_recipients_per_campaign": 50000
        }
    return {
        "max_smtp_accounts": 1,
        "max_campaigns": 3,
        "max_recipients_per_campaign": 500
    }
