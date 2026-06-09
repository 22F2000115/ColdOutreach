"""
This router handles template management, allowing users to create, update,
delete, and retrieve personalized message templates with dynamic variables.
"""

import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import Template, User
from schemas import TemplateCreateRequest

router = APIRouter()


@router.get("/api/templates")
def get_templates(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    templates = db.query(Template).filter(Template.user_id == current_user.id).order_by(Template.created_at.desc()).all()
    results = []
    for template_obj in templates:
        vars_list = []
        if template_obj.variables:
            try:
                vars_list = json.loads(template_obj.variables)
            except Exception:
                pass
        results.append({
            "id": template_obj.id,
            "name": template_obj.name,
            "subject": template_obj.subject,
            "body": template_obj.body,
            "variables": vars_list,
            "created_at": template_obj.created_at.isoformat() if template_obj.created_at else None
        })
    return results


@router.post("/api/templates")
def create_template(
    body: TemplateCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    vars_str = json.dumps(body.variables) if body.variables else None
    new_template = Template(
        user_id=current_user.id,
        name=body.name.strip(),
        subject=body.subject.strip(),
        body=body.body,
        variables=vars_str
    )
    db.add(new_template)
    db.commit()
    db.refresh(new_template)
    return {"message": "Template saved successfully", "template_id": new_template.id}


@router.put("/api/templates/{id}")
def update_template(
    id: int,
    body: TemplateCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    template = db.query(Template).filter(Template.id == id, Template.user_id == current_user.id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found.")
    template.name = body.name.strip()
    template.subject = body.subject.strip()
    template.body = body.body
    template.variables = json.dumps(body.variables) if body.variables else None
    db.commit()
    return {"message": "Template updated successfully"}


@router.delete("/api/templates/{id}")
def delete_template(
    id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    template = db.query(Template).filter(Template.id == id, Template.user_id == current_user.id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found.")
    db.delete(template)
    db.commit()
    return {"message": "Template deleted successfully"}
