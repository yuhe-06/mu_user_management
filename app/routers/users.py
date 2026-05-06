from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth import get_current_admin, get_password_hash
from app.db import get_db
from app.models import User
from app.schemas import UserCreate, UserListResponse, UserRead, UserUpdate


router = APIRouter(prefix="/api/users", tags=["users"], dependencies=[Depends(get_current_admin)])


def _not_deleted(query):
    return query.filter(or_(User.deleted.is_(False), User.deleted.is_(None)))


def _get_user_or_404(db: Session, user_id: int) -> User:
    user = _not_deleted(db.query(User)).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


def _ensure_unique(db: Session, username: Optional[str], email: Optional[str], current_id: Optional[int] = None) -> None:
    clauses = []
    if username:
        clauses.append(User.username == username)
    if email:
        clauses.append(User.email == email)
    if not clauses:
        return
    query = db.query(User).filter(or_(*clauses))
    if current_id:
        query = query.filter(User.id != current_id)
    if query.first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username or email already exists")


@router.get("", response_model=UserListResponse)
def list_users(
    username: Optional[str] = None,
    email: Optional[str] = None,
    organization_name: Optional[str] = None,
    permissions: Optional[str] = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    query = _not_deleted(db.query(User))
    if username:
        query = query.filter(User.username.ilike(f"%{username}%"))
    if email:
        query = query.filter(User.email.ilike(f"%{email}%"))
    if organization_name:
        query = query.filter(User.organization_name.ilike(f"%{organization_name}%"))
    if permissions:
        query = query.filter(User.permissions == permissions)

    total = query.count()
    users = (
        query.order_by(User.updated_at.desc().nullslast(), User.created_at.desc().nullslast(), User.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return UserListResponse(total=total, page=page, page_size=page_size, data=users)


@router.post("", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def create_user(payload: UserCreate, db: Session = Depends(get_db)):
    _ensure_unique(db, payload.username, payload.email)
    data = payload.model_dump(exclude={"password"})
    now = datetime.utcnow()
    user = User(**data, hashed_password=get_password_hash(payload.password), deleted=False, created_at=now, updated_at=now)
    db.add(user)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username or email already exists") from exc
    db.refresh(user)
    return user


@router.get("/{user_id}", response_model=UserRead)
def get_user(user_id: int, db: Session = Depends(get_db)):
    return _get_user_or_404(db, user_id)


@router.put("/{user_id}", response_model=UserRead)
def update_user(user_id: int, payload: UserUpdate, db: Session = Depends(get_db)):
    user = _get_user_or_404(db, user_id)
    data = payload.model_dump(exclude_unset=True)
    _ensure_unique(db, data.get("username"), data.get("email"), current_id=user_id)

    password = data.pop("password", None)
    for key, value in data.items():
        setattr(user, key, value)
    if password:
        user.hashed_password = get_password_hash(password)
    user.updated_at = datetime.utcnow()

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username or email already exists") from exc
    db.refresh(user)
    return user


@router.delete("/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db)):
    user = _get_user_or_404(db, user_id)
    user.deleted = True
    user.updated_at = datetime.utcnow()
    db.commit()
    return {"ok": True}
