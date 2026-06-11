from typing import List, Optional

from pydantic import BaseModel


class AITemplatePromptRequest(BaseModel):
    prompt: str


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
