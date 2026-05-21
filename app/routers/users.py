from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import String, cast, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth import get_current_admin, get_password_hash
from app.db import get_db
from app.models import User
from app.schemas import UserCreate, UserListItem, UserListResponse, UserRead, UserUpdate


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
    q: Optional[str] = None,
    username: Optional[str] = None,
    email: Optional[str] = None,
    edu_email: Optional[str] = None,
    organization_name: Optional[str] = None,
    permissions: Optional[str] = None,
    permissions_new: Optional[str] = None,
    teams_email_reg: Optional[str] = None,
    sort_by: str = "updated_at",
    sort_order: str = "desc",
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    query = _not_deleted(db.query(User))
    searchable_columns = (
        User.id,
        User.username,
        User.email,
        User.edu_email,
        User.organization_name,
        User.permissions,
        User.permissions_new,
        User.teams_email_reg,
        User.created_at,
        User.updated_at,
        User.subscribe_start_at,
        User.subscribe_end_at,
    )
    if q:
        keyword = f"%{q}%"
        query = query.filter(or_(*(cast(column, String).ilike(keyword) for column in searchable_columns)))
    if username:
        query = query.filter(User.username.ilike(f"%{username}%"))
    if email:
        query = query.filter(User.email.ilike(f"%{email}%"))
    if edu_email:
        query = query.filter(User.edu_email.ilike(f"%{edu_email}%"))
    if organization_name:
        query = query.filter(User.organization_name.ilike(f"%{organization_name}%"))
    if permissions:
        query = query.filter(User.permissions.ilike(f"%{permissions}%"))
    if permissions_new:
        query = query.filter(User.permissions_new.ilike(f"%{permissions_new}%"))
    if teams_email_reg:
        query = query.filter(User.teams_email_reg.ilike(f"%{teams_email_reg}%"))

    sort_columns = {
        "id": User.id,
        "username": User.username,
        "email": User.email,
        "edu_email": User.edu_email,
        "organization_name": User.organization_name,
        "permissions": User.permissions,
        "permissions_new": User.permissions_new,
        "teams_email_reg": User.teams_email_reg,
        "subscribe_start_at": User.subscribe_start_at,
        "subscribe_end_at": User.subscribe_end_at,
        "created_at": User.created_at,
        "updated_at": User.updated_at,
        "deleted": User.deleted,
    }
    sort_column = sort_columns.get(sort_by, User.updated_at)
    order_expression = sort_column.asc() if sort_order == "asc" else sort_column.desc()

    total = query.count()
    users = (
        query.order_by(order_expression.nullslast(), User.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return UserListResponse(
        total=total,
        page=page,
        page_size=page_size,
        data=[UserListItem.model_validate(user) for user in users],
    )


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
    if "updated_at" not in data:
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
