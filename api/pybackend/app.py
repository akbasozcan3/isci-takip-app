from datetime import datetime, timedelta
from typing import Optional
import os

from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel
from sqlalchemy import Column, Integer, String, DateTime, create_engine, and_, text
from sqlalchemy.orm import declarative_base, sessionmaker, Session

# === Config ===
SECRET_KEY = os.getenv("SECRET_KEY", "change_this_secret")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "10080"))  # 7 days

DB_PATH = os.getenv("DATABASE_URL", "sqlite:///./app.db")
engine = create_engine(DB_PATH, connect_args={"check_same_thread": False} if DB_PATH.startswith("sqlite") else {})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

# === Models ===
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=True)
    hashed_password = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    # New fields (may be added via ALTER TABLE on existing SQLite DB)
    # phone, email_verified, phone_verified
    phone = Column(String, unique=True, index=True, nullable=True)
    email_verified = Column(String, nullable=True, default='0')
    phone_verified = Column(String, nullable=True, default='0')

class PasswordReset(Base):
    __tablename__ = "password_resets"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, index=True, nullable=False)
    code = Column(String, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    used_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class EmailVerification(Base):
    __tablename__ = "email_verifications"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, index=True, nullable=False)
    code = Column(String, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    used_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class PhoneVerification(Base):
    __tablename__ = "phone_verifications"
    id = Column(Integer, primary_key=True, index=True)
    phone = Column(String, index=True, nullable=False)
    code = Column(String, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    used_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

# === Schemas ===
class UserCreate(BaseModel):
    email: str
    password: str
    name: Optional[str] = None
    phone: str

class UserOut(BaseModel):
    id: int
    email: str
    name: Optional[str] = None
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class ForgotPasswordIn(BaseModel):
    email: str

class ResetPasswordIn(BaseModel):
    email: str
    code: str
    new_password: str

class VerifyEmailIn(BaseModel):
    email: str
    code: str

class VerifyPhoneIn(BaseModel):
    phone: str
    code: str

# === App ===
app = FastAPI(title="Isci Takip Python Backend")

# CORS: allow origins via env (comma-separated). Fallback to '*'
allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "*")
origins = [o.strip() for o in allowed_origins_env.split(",") if o.strip()] or ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Basic security headers middleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault("Permissions-Policy", "geolocation=(), microphone=(), camera=()")
        return response

app.add_middleware(SecurityHeadersMiddleware)

# Simple request logging middleware
import time as _time
class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        _start = _time.time()
        response: Response = await call_next(request)
        _dur = int((_time.time() - _start) * 1000)
        try:
            print(f"[req] {request.method} {request.url.path} -> {response.status_code} {_dur}ms")
        except Exception:
            pass
        return response

app.add_middleware(RequestLoggingMiddleware)

Base.metadata.create_all(bind=engine)

# Attempt lightweight SQLite migrations for added columns (if using SQLite)
def ensure_sqlite_columns():
    if not DB_PATH.startswith("sqlite"):
        return
    with engine.connect() as conn:
        # users: phone TEXT, email_verified TEXT, phone_verified TEXT
        existing_cols = set()
        try:
            res = conn.execute(text("PRAGMA table_info(users)")).fetchall()
            for row in res:
                existing_cols.add(row[1])  # name
        except Exception:
            existing_cols = set()
        alter_statements = []
        if "phone" not in existing_cols:
            alter_statements.append("ALTER TABLE users ADD COLUMN phone VARCHAR")
        if "email_verified" not in existing_cols:
            alter_statements.append("ALTER TABLE users ADD COLUMN email_verified VARCHAR DEFAULT '0'")
        if "phone_verified" not in existing_cols:
            alter_statements.append("ALTER TABLE users ADD COLUMN phone_verified VARCHAR DEFAULT '0'")
        for stmt in alter_statements:
            try:
                conn.execute(text(stmt))
            except Exception:
                pass

ensure_sqlite_columns()

# === Dependencies ===

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# === Helpers ===
import re
import time

# Very simple in-memory rate limiter (per key)
_RATE_STORE = {}
def rate_limit(key: str, max_calls: int = 5, window_sec: int = 60):
    now = time.time()
    bucket = _RATE_STORE.get(key, [])
    bucket = [t for t in bucket if now - t < window_sec]
    if len(bucket) >= max_calls:
        raise HTTPException(status_code=429, detail="Too many requests. Please try again later.")
    bucket.append(now)
    _RATE_STORE[key] = bucket

def normalize_phone(phone: str, default_country_code: str = "+90") -> Optional[str]:
    if not phone:
        return None
    digits = re.sub(r"\D", "", phone)
    if digits.startswith("00"):
        digits = digits[2:]
    # If starts with country code 90 or others with leading +
    if digits.startswith("90") and len(digits) >= 12:
        return "+" + digits
    # Turkey typical: 10 or 11 digits starting with 0
    if len(digits) == 10:
        return default_country_code + digits
    if len(digits) == 11 and digits.startswith("0"):
        return default_country_code + digits[1:]
    # If already has + and sufficient length
    if phone.startswith("+") and len(digits) >= 10:
        return "+" + digits
    # Fallback: if 12+ digits, prefix with +
    if len(digits) >= 10:
        return "+" + digits
    return None

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_user_by_email(db: Session, email: str) -> Optional[User]:
    return db.query(User).filter(User.email == email).first()

def get_user_by_phone(db: Session, phone: str) -> Optional[User]:
    return db.query(User).filter(User.phone == phone).first()

def create_reset_code(db: Session, email: str) -> str:
    from random import randint
    # 6-digit numeric code
    code = f"{randint(100000, 999999)}"
    expires_at = datetime.utcnow() + timedelta(minutes=int(os.getenv("RESET_CODE_EXPIRE_MIN", "15")))
    # Invalidate previous unused codes for email
    db.query(PasswordReset).filter(
        and_(PasswordReset.email == email, PasswordReset.used_at.is_(None))
    ).update({PasswordReset.used_at: datetime.utcnow()})
    pr = PasswordReset(email=email, code=code, expires_at=expires_at)
    db.add(pr)
    db.commit()
    return code

def verify_reset_code(db: Session, email: str, code: str) -> bool:
    pr: Optional[PasswordReset] = (
        db.query(PasswordReset)
        .filter(
            PasswordReset.email == email,
            PasswordReset.code == code,
            PasswordReset.used_at.is_(None),
        )
        .order_by(PasswordReset.created_at.desc())
        .first()
    )
    if not pr:
        return False
    if pr.expires_at < datetime.utcnow():
        return False
    # mark as used
    pr.used_at = datetime.utcnow()
    db.add(pr)
    db.commit()
    return True

def create_email_verification(db: Session, email: str) -> str:
    from random import randint
    code = f"{randint(100000, 999999)}"
    expires_at = datetime.utcnow() + timedelta(minutes=int(os.getenv("VERIFY_CODE_EXPIRE_MIN", "30")))
    # invalidate previous unused
    db.query(EmailVerification).filter(
        and_(EmailVerification.email == email, EmailVerification.used_at.is_(None))
    ).update({EmailVerification.used_at: datetime.utcnow()})
    ev = EmailVerification(email=email, code=code, expires_at=expires_at)
    db.add(ev)
    db.commit()
    return code

def create_phone_verification(db: Session, phone: str) -> str:
    from random import randint
    code = f"{randint(100000, 999999)}"
    expires_at = datetime.utcnow() + timedelta(minutes=int(os.getenv("VERIFY_CODE_EXPIRE_MIN", "30")))
    db.query(PhoneVerification).filter(
        and_(PhoneVerification.phone == phone, PhoneVerification.used_at.is_(None))
    ).update({PhoneVerification.used_at: datetime.utcnow()})
    pv = PhoneVerification(phone=phone, code=code, expires_at=expires_at)
    db.add(pv)
    db.commit()
    return code

def consume_email_code(db: Session, email: str, code: str) -> bool:
    ev: Optional[EmailVerification] = (
        db.query(EmailVerification)
        .filter(
            EmailVerification.email == email,
            EmailVerification.code == code,
            EmailVerification.used_at.is_(None),
        )
        .order_by(EmailVerification.created_at.desc())
        .first()
    )
    if not ev or ev.expires_at < datetime.utcnow():
        return False
    ev.used_at = datetime.utcnow()
    db.add(ev)
    db.commit()
    return True

def consume_phone_code(db: Session, phone: str, code: str) -> bool:
    pv: Optional[PhoneVerification] = (
        db.query(PhoneVerification)
        .filter(
            PhoneVerification.phone == phone,
            PhoneVerification.code == code,
            PhoneVerification.used_at.is_(None),
        )
        .order_by(PhoneVerification.created_at.desc())
        .first()
    )
    if not pv or pv.expires_at < datetime.utcnow():
        return False
    pv.used_at = datetime.utcnow()
    db.add(pv)
    db.commit()
    return True

# Email/SMS sending helpers
def send_email_code(email: str, code: Optional[str] = None, message_type: str = "verify"):
    import smtplib
    from email.mime.text import MIMEText
    # Subject
    subject = (
        os.getenv("EMAIL_SUBJECT_RESET", "Şifre Sıfırlama Kodu")
        if message_type == "reset"
        else os.getenv("EMAIL_SUBJECT_VERIFY", "Hesabınızı Doğrulayın")
    )
    # Try template file, fallback to inline minimal HTML
    body_html = None
    try:
        templates_dir = os.path.join(os.path.dirname(__file__), "templates")
        tpl = "email_reset.html" if message_type == "reset" else "email_verify.html"
        tpl_path = os.path.join(templates_dir, tpl)
        if os.path.exists(tpl_path):
            with open(tpl_path, "r", encoding="utf-8") as f:
                body_html = f.read()
            expire = os.getenv('RESET_CODE_EXPIRE_MIN' if message_type == 'reset' else 'VERIFY_CODE_EXPIRE_MIN', '15' if message_type == 'reset' else '30')
            body_html = body_html.replace("{{CODE}}", str(code or "")).replace("{{EXPIRE_MIN}}", str(expire))
    except Exception:
        body_html = None
    if not body_html:
        if message_type == "reset":
            body_html = f"""
            <div style='font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif'>
              <h2>Şifre Sıfırlama</h2>
              <p>Şifre sıfırlama kodunuz: <strong style='font-size:20px'>{code}</strong></p>
              <p>Bu kod {os.getenv('RESET_CODE_EXPIRE_MIN', '15')} dakika boyunca geçerlidir.</p>
            </div>
            """
        else:
            body_html = f"""
            <div style='font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif'>
              <h2>Hesap Doğrulama</h2>
              <p>Doğrulama kodunuz: <strong style='font-size:20px'>{code}</strong></p>
              <p>Bu kod {os.getenv('VERIFY_CODE_EXPIRE_MIN', '30')} dakika boyunca geçerlidir.</p>
            </div>
            """
    msg = MIMEText(body_html, "html", "utf-8")
    msg["Subject"] = subject
    msg["From"] = os.getenv("SMTP_FROM", os.getenv("SMTP_USER", "noreply@example.com"))
    msg["To"] = email
    host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    port = int(os.getenv("SMTP_PORT", "587"))
    user = os.getenv("SMTP_USER")
    password = os.getenv("SMTP_PASS")
    if not user or not password:
        # dev mode: no send
        return False
    with smtplib.SMTP(host, port) as server:
        server.starttls()
        server.login(user, password)
        server.send_message(msg)
    return True

def send_sms_code(phone: str, code: str) -> bool:
    # Twilio integration via env vars
    account_sid = os.getenv("TWILIO_ACCOUNT_SID")
    auth_token = os.getenv("TWILIO_AUTH_TOKEN")
    from_number = os.getenv("TWILIO_FROM")
    if not (account_sid and auth_token and from_number):
        return False
    try:
        from twilio.rest import Client  # type: ignore
        client = Client(account_sid, auth_token)
        client.messages.create(
            body=f"Doğrulama kodunuz: {code}",
            from_=from_number,
            to=phone,
        )
        return True
    except Exception:
        return False

def authenticate_user(db: Session, email: str, password: str) -> Optional[User]:
    user = get_user_by_email(db, email)
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: Optional[str] = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = get_user_by_email(db, email=email)
    if user is None:
        raise credentials_exception
    return user

@app.get("/", tags=["health"])
def health():
    return {"status": "ok", "time": datetime.utcnow().isoformat()}

@app.get("/health", tags=["health"])  # compatibility with existing clients
def health_alt():
    return {"ok": True, "timestamp": int(datetime.utcnow().timestamp() * 1000)}

@app.post("/auth/register", response_model=UserOut, tags=["auth"])
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    # Rate limit by email and phone
    rate_limit(f"register:{user_in.email}")
    rate_limit(f"register:{user_in.phone}")
    if get_user_by_email(db, user_in.email):
        raise HTTPException(status_code=400, detail="Email already registered")
    norm_phone = normalize_phone(user_in.phone)
    if not norm_phone:
        raise HTTPException(status_code=400, detail="Invalid phone number")
    if get_user_by_phone(db, norm_phone):
        raise HTTPException(status_code=400, detail="Phone already registered")
    user = User(
        email=user_in.email,
        name=user_in.name,
        hashed_password=get_password_hash(user_in.password),
        phone=norm_phone,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    # Send verification codes
    email_code = create_email_verification(db, user.email)
    phone_code = create_phone_verification(db, user.phone)
    try:
        send_email_code(user.email, email_code, message_type="verify")
    except Exception:
        pass
    try:
        send_sms_code(user.phone, phone_code)
    except Exception:
        pass
    return user

@app.post("/auth/login", response_model=Token, tags=["auth"])
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    # Block login until verified
    # SQLite stores booleans as '0'/'1' strings via our lightweight migration defaults
    # Treat non-'1' as False
    email_verified = False
    phone_verified = False
    try:
        email_verified = str(getattr(user, 'email_verified', '0')) == '1'
        phone_verified = str(getattr(user, 'phone_verified', '0')) == '1'
    except Exception:
        pass
    if not email_verified or not phone_verified:
        raise HTTPException(status_code=403, detail="Account not verified. Please verify email and phone.")
    access_token = create_access_token(data={"sub": user.email})
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/auth/send-email-code", tags=["auth"])
def resend_email_code(payload: ForgotPasswordIn, db: Session = Depends(get_db)):
    rate_limit(f"send_email:{payload.email}")
    user = get_user_by_email(db, payload.email)
    if not user:
        return {"ok": True}
    code = create_email_verification(db, payload.email)
    try:
        sent = send_email_code(payload.email, code)
    except Exception:
        sent = False
    res = {"ok": True}
    if os.getenv("RESET_DEV_RETURN_CODE", "1") == "1" and not sent:
        res.update({"dev_code": code})
    return res

@app.post("/auth/send-phone-code", tags=["auth"])
def resend_phone_code(payload: VerifyPhoneIn, db: Session = Depends(get_db)):
    rate_limit(f"send_phone:{payload.phone}")
    norm_phone = normalize_phone(payload.phone)
    if not norm_phone:
        return {"ok": True}
    user = get_user_by_phone(db, norm_phone)
    if not user:
        return {"ok": True}
    code = create_phone_verification(db, norm_phone)
    sent = send_sms_code(norm_phone, code)
    res = {"ok": True}
    if os.getenv("RESET_DEV_RETURN_CODE", "1") == "1" and not sent:
        res.update({"dev_code": code})
    return res

@app.post("/auth/verify-email", tags=["auth"])
def verify_email(payload: VerifyEmailIn, db: Session = Depends(get_db)):
    rate_limit(f"verify_email:{payload.email}")
    user = get_user_by_email(db, payload.email)
    if not user:
        raise HTTPException(status_code=400, detail="Invalid email or code")
    if not consume_email_code(db, payload.email, payload.code):
        raise HTTPException(status_code=400, detail="Invalid or expired code")
    # mark verified
    try:
        setattr(user, 'email_verified', '1')
        db.add(user)
        db.commit()
    except Exception:
        pass
    return {"ok": True}

@app.post("/auth/verify-phone", tags=["auth"])
def verify_phone(payload: VerifyPhoneIn, db: Session = Depends(get_db)):
    rate_limit(f"verify_phone:{payload.phone}")
    norm_phone = normalize_phone(payload.phone)
    if not norm_phone:
        raise HTTPException(status_code=400, detail="Invalid phone or code")
    user = get_user_by_phone(db, norm_phone)
    if not user:
        raise HTTPException(status_code=400, detail="Invalid phone or code")
    if not consume_phone_code(db, norm_phone, payload.code):
        raise HTTPException(status_code=400, detail="Invalid or expired code")
    try:
        setattr(user, 'phone_verified', '1')
        db.add(user)
        db.commit()
    except Exception:
        pass
    return {"ok": True}

@app.post("/auth/forgot", tags=["auth"])
def forgot_password(payload: ForgotPasswordIn, db: Session = Depends(get_db)):
    rate_limit(f"forgot:{payload.email}")
    user = get_user_by_email(db, payload.email)
    if not user:
        # To avoid user enumeration, return 200 even if user doesn't exist
        return {"ok": True}
    code = create_reset_code(db, payload.email)
    # Send reset code via email
    try:
        send_email_code(payload.email, code, message_type="reset")
    except Exception:
        pass
    # For development optionally return code.
    dev_return_code = os.getenv("RESET_DEV_RETURN_CODE", "1") == "1"
    res = {"ok": True}
    if dev_return_code:
        res.update({"dev_code": code})
    return res

@app.post("/auth/reset", tags=["auth"])
def reset_password(payload: ResetPasswordIn, db: Session = Depends(get_db)):
    rate_limit(f"reset:{payload.email}")
    user = get_user_by_email(db, payload.email)
    if not user:
        raise HTTPException(status_code=400, detail="Invalid email or code")
    if not verify_reset_code(db, payload.email, payload.code):
        raise HTTPException(status_code=400, detail="Invalid or expired code")
    user.hashed_password = get_password_hash(payload.new_password)
    db.add(user)
    db.commit()
    return {"ok": True}

@app.get("/users/me", response_model=UserOut, tags=["users"])
def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user

@app.get("/auth/me", tags=["auth"])  # compatibility with existing clients
def auth_me(current_user: User = Depends(get_current_user)):
    return {"user": current_user}
