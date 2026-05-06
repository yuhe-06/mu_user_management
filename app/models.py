import datetime

from sqlalchemy import Boolean, CheckConstraint, Column, DateTime, Integer, String

from app.db import Base


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("query_limit >= 0 AND query_limit <= 150", name="users_query_limit_check"),
        {"schema": "public"},
    )

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    edu_email = Column(String, nullable=True)
    first_name = Column(String, nullable=True)
    last_name = Column(String, nullable=True)
    organization_name = Column(String, nullable=True)
    hashed_password = Column(String, nullable=True)
    permissions = Column(String, nullable=True)
    query_limit = Column(Integer, nullable=True)
    teams_email_reg = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    deleted = Column(Boolean, default=False)
    subscribe_start_at = Column(DateTime, nullable=True)
    subscribe_end_at = Column(DateTime, nullable=True)
    permissions_new = Column(String, nullable=True)
