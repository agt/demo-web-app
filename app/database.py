import os
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

# DATABASE_URL accepts any SQLAlchemy URL.
# SQLITE_DB_PATH is a convenience shorthand for a local file path; it is
# ignored when DATABASE_URL is set.
# Default: lab_equipment.db in the current working directory.
def _database_url() -> str:
    if url := os.environ.get("DATABASE_URL"):
        return url
    if path := os.environ.get("SQLITE_DB_PATH"):
        return f"sqlite:///{Path(path).resolve()}"
    return "sqlite:///./lab_equipment.db"

SQLALCHEMY_DATABASE_URL = _database_url()

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
