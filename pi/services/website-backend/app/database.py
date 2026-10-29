"""
Database configuration and session management.

Provides SQLAlchemy engine, session factory, and base model class.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from app.config import settings


# keep this many sqlite connections open between requests; a burst opens more as needed
POOL_SIZE = 5
# no cap on the extras. sqlite connections are just open file handles, and a request that
# has to wait for one deadlocks the server: the wait blocks whoever would hand one back
# (the event loop for async routes, the threadpool for sync ones). the display kiosk's
# two screens refreshing every gallery at once (~46 requests) was enough to freeze it
UNLIMITED_OVERFLOW = -1

engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False},  # Required for SQLite
    pool_size=POOL_SIZE,
    max_overflow=UNLIMITED_OVERFLOW,
)

# Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for models
Base = declarative_base()


def get_db():
    """
    Dependency function that provides database session to FastAPI routes.
    
    Yields:
        Session: SQLAlchemy database session
        
    Usage:
        @app.get("/items")
        def get_items(db: Session = Depends(get_db)):
            return db.query(Item).all()
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """
    Initialize database by creating all tables.
    
    Should be called once on application startup.
    """
    Base.metadata.create_all(bind=engine)
