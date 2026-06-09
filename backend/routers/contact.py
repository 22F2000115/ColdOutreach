"""
This router handles public contact details retrieval and provides
sample CSV files for campaigns importing.
"""

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import ContactDetail, User

router = APIRouter()

@router.get("/api/contact-details")
def get_contact_details(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    details = db.query(ContactDetail).all()
    return [{
        "id": d.id,
        "type": d.type,
        "value": d.value,
        "label": d.label
    } for d in details]


@router.get("/api/sample-csv")
def get_sample_csv():
    csv_content = "company,email\nGoogle,leads@google.com\nApple,jobs@apple.com\n"
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=sample_contacts.csv"}
    )
