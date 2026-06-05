import sys
import os
import datetime
import json
from fastapi.testclient import TestClient

# Add current path to sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal
from models import User, Campaign, Recipient, PlanQuota
from main import app
import worker

class DummySMTP:
    def noop(self): pass
    def sendmail(self, *args, **kwargs): pass
    def quit(self): pass

worker.get_smtp_connection = lambda *args, **kwargs: DummySMTP()

client = TestClient(app)

def run_tests():
    print("Starting programatic API tests...")
    
    # 1. Clean up any previous test user and reset global plan limits
    db = SessionLocal()
    trial_quota = db.query(PlanQuota).filter(PlanQuota.plan == "trial").first()
    if trial_quota:
        trial_quota.max_smtp_accounts = 1
        trial_quota.max_campaigns = 3
        trial_quota.add_limit = 3
        trial_quota.edit_limit = 5
        trial_quota.delete_limit = 3
        trial_quota.save_limit = 5
    pro_quota = db.query(PlanQuota).filter(PlanQuota.plan == "pro").first()
    if pro_quota:
        pro_quota.max_smtp_accounts = 3
        pro_quota.max_campaigns = 999999
        pro_quota.add_limit = 999999
        pro_quota.edit_limit = 999999
        pro_quota.delete_limit = 999999
        pro_quota.save_limit = 999999
    db.commit()

    # Sync global limits in-memory in main app
    from main import PLAN_LIMITS
    PLAN_LIMITS["trial"]["max_smtp_accounts"] = 1
    PLAN_LIMITS["trial"]["max_campaigns"] = 3
    PLAN_LIMITS["pro"]["max_smtp_accounts"] = 3
    PLAN_LIMITS["pro"]["max_campaigns"] = 999999

    test_email = "test_api_user@example.com"
    existing = db.query(User).filter(User.email == test_email).first()
    if existing:
        db.delete(existing)
        db.commit()
    db.close()
    
    # 2. Test Registration
    print("Testing Registration...")
    reg_response = client.post(
        "/api/auth/register",
        data={"email": test_email, "password": "password123"}
    )
    assert reg_response.status_code == 201
    reg_json = reg_response.json()
    assert "user_id" in reg_json
    
    # Check User defaults in DB
    db = SessionLocal()
    user = db.query(User).filter(User.email == test_email).first()
    assert user is not None
    assert user.plan == "trial"
    assert user.trial_expires_at is not None
    # Expiry should be around 30 days from now
    diff = user.trial_expires_at - datetime.datetime.utcnow()
    assert diff.days >= 29 and diff.days <= 30
    db.close()
    print("Registration OK.")
    
    # 3. Test Login and Token Generation
    print("Testing Login...")
    login_response = client.post(
        "/api/auth/login",
        data={"username": test_email, "password": "password123"}
    )
    assert login_response.status_code == 200
    login_json = login_response.json()
    assert "access_token" in login_json
    assert login_json["token_type"] == "bearer"
    # Check refresh_token cookie
    assert "refresh_token" in login_response.cookies
    
    access_token = login_json["access_token"]
    headers = {"Authorization": f"Bearer {access_token}"}
    print("Login OK.")
    
    # 4. Test SMTP Account Limits (Trial = 1)
    print("Testing SMTP Limits (Trial plan)...")
    # Add first SMTP settings
    smtp1_response = client.post(
        "/api/settings/smtp",
        headers=headers,
        data={
            "host": "smtp.example.com",
            "port": 465,
            "username": "sender1@example.com",
            "password": "apppassword123",
            "from_name": "Sender One",
            "from_email": "sender1@example.com"
        }
    )
    assert smtp1_response.status_code == 200
    
    # Try adding second SMTP settings (should fail)
    smtp2_response = client.post(
        "/api/settings/smtp",
        headers=headers,
        data={
            "host": "smtp.example.com",
            "port": 465,
            "username": "sender2@example.com",
            "password": "apppassword123",
            "from_name": "Sender Two",
            "from_email": "sender2@example.com"
        }
    )
    assert smtp2_response.status_code == 403
    assert "limit reached" in smtp2_response.json()["detail"]
    print("SMTP Limit (Trial) OK.")
    
    # 5. Test SMTP Account Limits upgrade (Pro = 3)
    print("Testing SMTP Limits (Pro plan)...")
    # Manually upgrade user in DB to pro
    db = SessionLocal()
    user = db.query(User).filter(User.email == test_email).first()
    user.plan = "pro"
    db.commit()
    db.close()
    
    # Try adding second SMTP settings again (should succeed)
    smtp2_response = client.post(
        "/api/settings/smtp",
        headers=headers,
        data={
            "host": "smtp.example.com",
            "port": 465,
            "username": "sender2@example.com",
            "password": "apppassword123",
            "from_name": "Sender Two",
            "from_email": "sender2@example.com"
        }
    )
    assert smtp2_response.status_code == 200
    
    # Add third SMTP settings (should succeed)
    smtp3_response = client.post(
        "/api/settings/smtp",
        headers=headers,
        data={
            "host": "smtp.example.com",
            "port": 465,
            "username": "sender3@example.com",
            "password": "apppassword123",
            "from_name": "Sender Three",
            "from_email": "sender3@example.com"
        }
    )
    assert smtp3_response.status_code == 200
    
    # Add fourth SMTP settings (should fail)
    smtp4_response = client.post(
        "/api/settings/smtp",
        headers=headers,
        data={
            "host": "smtp.example.com",
            "port": 465,
            "username": "sender4@example.com",
            "password": "apppassword123",
            "from_name": "Sender Four",
            "from_email": "sender4@example.com"
        }
    )
    assert smtp4_response.status_code == 403
    assert "limit reached" in smtp4_response.json()["detail"]
    print("SMTP Limit (Pro) OK.")
    
    # 6. Test Campaigns and Custom Header Recipient Ingestion
    print("Testing Recipient Personalization and Campaign Scheduling...")
    # Fetch Senders list to get a valid sender_id
    senders_res = client.get("/api/settings/smtp", headers=headers)
    sender_id = senders_res.json()[0]["id"]
    
    # Create campaign with a CSV containing custom headers
    csv_content = (
        "email,company,first_name,last_name,role,custom_field_one\n"
        "lead1@example.com,Google,Sundar,Pichai,CEO,ValueOne\n"
        "lead2@example.com,Apple,Tim,Cook,CEO,ValueTwo\n"
    )
    
    csv_file = ("contacts.csv", csv_content, "text/csv")
    
    camp_res = client.post(
        "/api/campaigns",
        headers=headers,
        data={
            "name": "Personalized Test Campaign",
            "subject_template": "Hi {{first_name}} - {{custom_field_one}}",
            "body_template": "<p>Hello {{first_name}} {{last_name}} of {{company}}</p>",
            "sender_id": sender_id
        },
        files={"contacts_csv": csv_file}
    )
    assert camp_res.status_code == 200
    camp_id = camp_res.json()["campaign_id"]
    
    # Query database and verify custom fields
    db = SessionLocal()
    recipients = db.query(Recipient).filter(Recipient.campaign_id == camp_id).all()
    assert len(recipients) == 2
    assert recipients[0].first_name == "Sundar"
    assert recipients[0].last_name == "Pichai"
    assert recipients[0].role == "CEO"
    # Verify extra_data JSON contains custom_field_one
    extra1 = json.loads(recipients[0].extra_data)
    assert extra1.get("custom_field_one") == "ValueOne"
    
    assert recipients[1].first_name == "Tim"
    assert recipients[1].last_name == "Cook"
    assert recipients[1].role == "CEO"
    extra2 = json.loads(recipients[1].extra_data)
    assert extra2.get("custom_field_one") == "ValueTwo"
    db.close()
    print("Recipient Personalization OK.")
    
    # 7. Test Immediate Start Action
    print("Testing Immediate Start Action...")
    # Start campaign
    start_res = client.post(
        f"/api/campaigns/{camp_id}/action",
        headers=headers,
        data={"action": "start"}
    )
    assert start_res.status_code == 200
    assert start_res.json()["status"] == "running"
    
    # Verify DB status is running
    db = SessionLocal()
    camp = db.query(Campaign).filter(Campaign.id == camp_id).first()
    assert camp.status in ("running", "completed")
    db.close()
    
    # Cancel action should not be supported / raise error
    cancel_res = client.post(
        f"/api/campaigns/{camp_id}/action",
        headers=headers,
        data={"action": "cancel"}
    )
    assert cancel_res.status_code == 400
    print("Immediate Start Action OK.")
    
    # 8. Test Trial Expiration check (402)
    print("Testing Trial Expiry (402)...")
    # Set User back to trial and set trial_expires_at to 1 hour ago
    db = SessionLocal()
    user = db.query(User).filter(User.email == test_email).first()
    user.plan = "trial"
    user.trial_expires_at = datetime.datetime.utcnow() - datetime.timedelta(hours=1)
    db.commit()
    db.close()
    
    # Refresh token to obtain a token reflecting the expired database state
    login_response_exp = client.post(
        "/api/auth/login",
        data={"username": test_email, "password": "password123"}
    )
    headers_exp = {"Authorization": f"Bearer {login_response_exp.json()['access_token']}"}

    # Call protected endpoint - should fail with 402
    exp_res = client.get("/api/campaigns", headers=headers_exp)
    assert exp_res.status_code == 402
    assert exp_res.json()["detail"] == "trial_expired"
    print("Trial Expiry (402) OK.")
    
    # 9. Test Token Refresh
    print("Testing Token Refresh...")
    # Get refresh token cookie from login_response
    cookies = login_response.cookies
    # Remove trial expiry to let refresh request verify user
    db = SessionLocal()
    user = db.query(User).filter(User.email == test_email).first()
    user_id = user.id
    user.trial_expires_at = datetime.datetime.utcnow() + datetime.timedelta(days=30)
    db.commit()
    db.close()
    
    refresh_res = client.post("/api/auth/refresh", cookies=cookies)
    assert refresh_res.status_code == 200
    refresh_json = refresh_res.json()
    assert "access_token" in refresh_json
    assert "refresh_token" in refresh_res.cookies
    print("Token Refresh OK.")

    # 10. Test Campaign Limits (Trial = 3 campaigns)
    print("Testing Campaign Limits (Trial plan)...")
    headers_active = {"Authorization": f"Bearer {refresh_json['access_token']}"}
    
    # Clean up existing campaigns first
    db = SessionLocal()
    db.query(Campaign).filter(Campaign.user_id == user_id).delete()
    user = db.query(User).filter(User.id == user_id).first()
    if user:
        user.campaign_add_count = 0
        user.campaign_edit_count = 0
        user.campaign_delete_count = 0
        user.campaign_save_count = 0
    db.commit()
    db.close()
    
    # Create 3 campaigns
    for idx in range(3):
        create_res = client.post(
            "/api/campaigns",
            headers=headers_active,
            data={
                "name": f"Trial Campaign {idx}",
                "subject_template": "Subject",
                "body_template": "Body",
                "sender_id": sender_id
            }
        )
        assert create_res.status_code == 200

    # Try creating 4th campaign (should fail with 403)
    create4_res = client.post(
        "/api/campaigns",
        headers=headers_active,
        data={
            "name": "Trial Campaign 4",
            "subject_template": "Subject",
            "body_template": "Body",
            "sender_id": sender_id
        }
    )
    assert create4_res.status_code == 403
    assert "limit" in create4_res.json()["detail"].lower()
    print("Campaign limits (Trial) OK.")

    # 11. Test Account Suspension (is_active = False)
    print("Testing Account Suspension (is_active = False)...")
    db = SessionLocal()
    user = db.query(User).filter(User.email == test_email).first()
    user.is_active = False
    db.commit()
    db.close()
    
    # Try calling api - should fail with 403
    susp_res = client.get("/api/campaigns", headers=headers_active)
    assert susp_res.status_code == 403
    assert "suspended" in susp_res.json()["detail"]
    print("Account Suspension OK.")
    
    # 12. Test Admin Panel Endpoints
    print("Testing Admin Panel Endpoints...")
    
    # Create an admin user directly in DB
    db = SessionLocal()
    admin_email = "admin_test@example.com"
    existing_admin = db.query(User).filter(User.email == admin_email).first()
    if existing_admin:
        db.delete(existing_admin)
        db.commit()
        
    from auth import get_password_hash
    new_admin = User(
        email=admin_email,
        hashed_password=get_password_hash("adminpassword123"),
        plan="pro",
        role="admin",
        is_active=True,
        trial_expires_at=None
    )
    db.add(new_admin)
    db.commit()
    db.close()
    
    # Login as admin
    admin_login_res = client.post(
        "/api/auth/login",
        data={"username": admin_email, "password": "adminpassword123"}
    )
    assert admin_login_res.status_code == 200
    admin_access_token = admin_login_res.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_access_token}"}
    
    # Regular user tries to access admin stats (should get 403)
    user_stats_res = client.get("/api/admin/stats", headers=headers_active)
    assert user_stats_res.status_code == 403
    
    # Admin accesses stats (should get 200)
    admin_stats_res = client.get("/api/admin/stats", headers=admin_headers)
    assert admin_stats_res.status_code == 200
    stats_json = admin_stats_res.json()
    assert "total_users" in stats_json
    assert "pro_users" in stats_json
    assert "active_campaigns" in stats_json
    assert "emails_sent_today" in stats_json
    assert "plan_limits" in stats_json
    
    # Admin lists users
    users_res = client.get("/api/admin/users", headers=admin_headers)
    assert users_res.status_code == 200
    users_json = users_res.json()
    assert len(users_json) >= 2 # at least admin and regular test user
    
    # Find our test user's ID
    regular_user_id = None
    for u in users_json:
        if u["email"] == test_email:
            regular_user_id = u["id"]
            break
    assert regular_user_id is not None
    
    # Admin updates regular user's plan to pro and is_active to True
    update_res = client.patch(
        f"/api/admin/users/{regular_user_id}",
        headers=admin_headers,
        json={"plan": "pro", "is_active": True}
      )
    assert update_res.status_code == 200
    assert update_res.json()["plan"] == "pro"
    assert update_res.json()["is_active"] is True
    
    # Verify regular user plan changed to pro in DB
    db = SessionLocal()
    reg_user_db = db.query(User).filter(User.id == regular_user_id).first()
    assert reg_user_db.plan == "pro"
    db.close()
    
    # Admin updates global plan settings
    settings_patch_res = client.patch(
        "/api/admin/settings",
        headers=admin_headers,
        json={
            "trial": {"max_campaigns": 5, "max_smtp_accounts": 2},
            "pro": {"max_campaigns": 50, "max_smtp_accounts": 10}
        }
    )
    assert settings_patch_res.status_code == 200
    from config import PLAN_LIMITS as plan_limits_obj
    assert plan_limits_obj["trial"]["max_campaigns"] == 5
    assert plan_limits_obj["trial"]["max_smtp_accounts"] == 2
    
    # Admin gets campaigns list
    campaigns_res = client.get("/api/admin/campaigns", headers=admin_headers)
    assert campaigns_res.status_code == 200
    
    # Admin tries to update own role/active status (should fail with 400)
    db = SessionLocal()
    my_id = db.query(User).filter(User.email == admin_email).first().id
    db.close()
    self_update_res = client.patch(
        f"/api/admin/users/{my_id}",
        headers=admin_headers,
        json={"role": "user"}
    )
    assert self_update_res.status_code == 400
    
    # Clean up admin user
    db = SessionLocal()
    admin_user = db.query(User).filter(User.email == admin_email).first()
    if admin_user:
        db.delete(admin_user)
        db.commit()
    db.close()
    
    print("Admin Panel Endpoints OK.")
    
    # Clean up test user
    db = SessionLocal()
    user = db.query(User).filter(User.email == test_email).first()
    if user:
        db.delete(user)
        db.commit()
    db.close()
    
    print("\nALL PROGRAMMATIC API TESTS COMPLETED SUCCESSFULLY!")

if __name__ == '__main__':
    run_tests()
