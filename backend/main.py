import datetime
import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
load_dotenv(override=True)

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from jose import jwt
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from auth import ALGORITHM, JWT_SECRET_KEY
from database import Base, SessionLocal, engine
from dependencies import limiter
from models import User
from routers.activity import router as activity_router
from routers.admin import router as admin_router
from routers.ai import router as ai_router
from routers.auth import router as auth_router
from routers.campaigns import router as campaigns_router
from routers.contact import router as contact_router
from routers.smtp import router as smtp_router
from routers.templates import router as templates_router
from seed import reset_stuck_campaigns, seed_admin, seed_contact_details, seed_plan_quotas

# Create database tables
Base.metadata.create_all(bind=engine)

@asynccontextmanager
async def lifespan(app: FastAPI):
    import asyncio
    # Startup actions
    seed_admin()
    seed_contact_details()
    seed_plan_quotas()
    reset_stuck_campaigns()

    from worker import auto_bounce_sync_loop
    sync_task = asyncio.create_task(auto_bounce_sync_loop())

    yield
    # Shutdown actions
    sync_task.cancel()
    try:
        await sync_task
    except asyncio.CancelledError:
        pass

app = FastAPI(title="Email Outreach Micro SaaS", version="1.0.0", lifespan=lifespan)

# SlowAPI Limiter setup

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# CORS configuration
allowed_origins_str = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173")
allowed_origins = [orig.strip() for orig in allowed_origins_str.split(",") if orig.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Trial check middleware
@app.middleware("http")
async def check_trial_expiry_middleware(request: Request, call_next):
    public_paths = {
        "/api/auth/login",
        "/api/auth/register",
        "/api/auth/refresh",
        "/api/auth/logout",
        "/api/sample-csv",
    }
    path = request.url.path
    if path.startswith("/api/") and path not in public_paths:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            try:
                payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[ALGORITHM])
                plan = payload.get("plan")
                trial_expires_str = payload.get("trial_expires_at")
                role = payload.get("role")

                if plan is None or (plan == "trial" and trial_expires_str is None) or role is None:
                    email = payload.get("sub")
                    if email:
                        db = SessionLocal()
                        try:
                            user = db.query(User).filter(User.email == email).first()
                            if user:
                                plan = user.plan
                                trial_expires_str = user.trial_expires_at.isoformat() if user.trial_expires_at else None
                                role = user.role
                        finally:
                            db.close()

                if role == "admin":
                    return await call_next(request)

                if plan == "trial" and trial_expires_str:
                    trial_expires_at = datetime.datetime.fromisoformat(trial_expires_str)
                    if datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None) > trial_expires_at:
                        email = payload.get("sub")
                        if email:
                            db_verify = SessionLocal()
                            try:
                                db_user = db_verify.query(User).filter(User.email == email).first()
                                if db_user:
                                    if db_user.plan != "trial" or (db_user.trial_expires_at and datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None) <= db_user.trial_expires_at):
                                        return await call_next(request)
                            finally:
                                db_verify.close()
                        return JSONResponse(
                            status_code=402,
                            content={"detail": "trial_expired"}
                        )
            except Exception:
                pass
    return await call_next(request)

# Include routers

app.include_router(auth_router)
app.include_router(smtp_router)
app.include_router(campaigns_router)
app.include_router(ai_router)
app.include_router(templates_router)
app.include_router(activity_router)
app.include_router(admin_router)
app.include_router(contact_router)
