from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, declarative_base, sessionmaker

from app.config import get_settings


settings = get_settings()

engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    pool_recycle=1800,
)
platform_engine = create_engine(
    settings.platform_database_url,
    pool_pre_ping=True,
    pool_recycle=1800,
)
platform_read_engine = create_engine(
    settings.platform_read_database_url,
    pool_pre_ping=True,
    pool_recycle=1800,
)
deerflow_engine = create_engine(
    settings.deerflow_database_url,
    pool_pre_ping=True,
    pool_recycle=1800,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
