from datetime import datetime, timedelta
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.models import User


settings = get_settings()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def verify_password(plain_password: str, hashed_password: Optional[str]) -> bool:
    if not hashed_password:
        return False
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(subject: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes)
    payload = {"sub": subject, "exp": expire}
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def authenticate_admin(db: Session, username: str, password: str) -> Optional[User]:
    user = (
        db.query(User)
        .filter(or_(User.username == username, User.email == username))
        .filter(or_(User.deleted.is_(False), User.deleted.is_(None)))
        .first()
    )
    if not user or not verify_password(password, user.hashed_password):
        return None
    if user.permissions != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admin users can sign in")
    return user


def get_current_admin(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        username = payload.get("sub")
        if not username:
            raise credentials_exception
    except JWTError as exc:
        raise credentials_exception from exc

    user = (
        db.query(User)
        .filter(or_(User.username == username, User.email == username))
        .filter(or_(User.deleted.is_(False), User.deleted.is_(None)))
        .first()
    )
    if not user:
        raise credentials_exception
    if user.permissions != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admin users can manage users")
    return user
