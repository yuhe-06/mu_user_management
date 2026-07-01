from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth import authenticate_admin, create_access_token, get_current_admin
from app.db import get_db
from app.models import User
from app.schemas import LoginRequest, TokenResponse, UserRead


router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = authenticate_admin(db, payload.username, payload.password)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="用户名或密码错误")
    token = create_access_token(user.username)
    return TokenResponse(access_token=token, username=user.username, permissions=user.permissions)


@router.get("/me", response_model=UserRead)
def me(current_user: User = Depends(get_current_admin)):
    return current_user
