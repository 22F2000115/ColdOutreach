import json
import logging
from sqlalchemy.orm import Session
from models import ActivityLog

logger = logging.getLogger(__name__)

def log_activity(db: Session, user_id: int, event_type: str, action: str, metadata: dict = None):
    """
    Log an activity to the activity_logs table.
    Fails silently to avoid disrupting core business flows.
    """
    try:
        entry = ActivityLog(
            user_id=user_id,
            event_type=event_type,
            action=action,
            metadata_json=json.dumps(metadata) if metadata else None
        )
        db.add(entry)
        db.commit()
    except Exception as error:
        logger.exception(f"Error logging activity: {error}")
        try:
            db.rollback()
        except Exception:
            pass
