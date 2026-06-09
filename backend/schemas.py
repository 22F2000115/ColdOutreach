from typing import List, Optional

from pydantic import BaseModel


class AIEmailRequest(BaseModel):
    context_type: Optional[str] = None
    context_data: Optional[dict] = None
    sender_name: Optional[str] = None

    role: Optional[str] = None
    objective: Optional[str] = None
    target_audience: Optional[str] = None
    skills_or_offer: Optional[str] = None
    additional_context: Optional[str] = None
    tone: Optional[str] = None
    length: Optional[str] = None
    formality: Optional[str] = None
    cta_strength: Optional[str] = None
    writing_style: Optional[str] = None


class AIGenerateSubjectsRequest(BaseModel):
    role: str
    objective: str
    target_audience: str
    skills_or_offer: Optional[str] = None
    existing_subjects: Optional[List[str]] = None
    tone: Optional[str] = "professional"
    count: Optional[int] = 3


class TemplateCreateRequest(BaseModel):
    name: str
    subject: str
    body: str
    variables: Optional[List[str]] = None


class BulkDeleteRequest(BaseModel):
    ids: List[int]


class AdminUserUpdate(BaseModel):
    plan: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None


class AdminSettingsUpdate(BaseModel):
    trial: Optional[dict] = None
    pro: Optional[dict] = None
    trial_quotas: Optional[dict] = None
    pro_quotas: Optional[dict] = None


class ContactDetailCreateRequest(BaseModel):
    type: str  # "email" or "whatsapp"
    value: str
    label: Optional[str] = None


class ContactDetailUpdate(BaseModel):
    type: Optional[str] = None
    value: Optional[str] = None
    label: Optional[str] = None


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str
