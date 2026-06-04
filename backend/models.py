import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    plan = Column(String, default="trial", nullable=False)
    trial_expires_at = Column(DateTime, default=lambda: datetime.datetime.utcnow() + datetime.timedelta(days=30), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    role = Column(String, default="user", nullable=False)

    # Relationships
    smtp_accounts = relationship("SMTPSettings", back_populates="user", cascade="all, delete-orphan")
    campaigns = relationship("Campaign", back_populates="user", cascade="all, delete-orphan")


class SMTPSettings(Base):
    __tablename__ = "smtp_settings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    host = Column(String, nullable=False)
    port = Column(Integer, nullable=False)
    username = Column(String, nullable=False)
    encrypted_password = Column(String, nullable=False)
    from_name = Column(String, nullable=False)
    from_email = Column(String, nullable=False)

    # Relationships
    user = relationship("User", back_populates="smtp_accounts")


class Campaign(Base):
    __tablename__ = "campaigns"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    subject_template = Column(String, nullable=False)
    body_template = Column(Text, nullable=False)
    status = Column(String, default="draft")  # draft, running, paused, completed
    sender_id = Column(Integer, ForeignKey("smtp_settings.id"), nullable=True)
    attachment_name = Column(String, nullable=True)  # filename of attachment
    attachment_display_name = Column(String, nullable=True)  # custom filename shown to recipient
    scheduled_send_at = Column(DateTime, nullable=True)  # 10-minute delay send time
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="campaigns")
    sender = relationship("SMTPSettings")
    recipients = relationship("Recipient", back_populates="campaign", cascade="all, delete-orphan")


class Recipient(Base):
    __tablename__ = "recipients"

    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"), nullable=False)
    email = Column(String, index=True, nullable=False)
    company = Column(String, nullable=True)
    first_name = Column(String, nullable=True)
    last_name = Column(String, nullable=True)
    role = Column(String, nullable=True)
    extra_data = Column(Text, nullable=True)  # JSON-encoded extra fields
    status = Column(String, default="pending")  # pending, sending, sent, failed, skipped
    retry_count = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)
    sent_at = Column(DateTime, nullable=True)

    # Relationships
    campaign = relationship("Campaign", back_populates="recipients")
