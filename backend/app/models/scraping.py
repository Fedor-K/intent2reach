from sqlalchemy import Column, Integer, String, DateTime, Text, JSON, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
import enum


class RunStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    ABORTED = "aborted"


class ScrapingRun(Base):
    """Represents a single Apify actor run"""
    __tablename__ = "scraping_runs"

    id = Column(Integer, primary_key=True, index=True)
    apify_run_id = Column(String(255), unique=True, index=True, nullable=True)
    status = Column(SQLEnum(RunStatus), default=RunStatus.PENDING, index=True)

    # Input parameters
    search_queries = Column(JSON, nullable=True)
    author_urls = Column(JSON, nullable=True)
    authors_companies = Column(JSON, nullable=True)
    posted_limit = Column(String(50), default="24h")
    max_posts = Column(Integer, default=50000)
    max_comments = Column(Integer, default=50000000)
    max_reactions = Column(Integer, default=50000000)
    scrape_comments = Column(Integer, default=1)
    scrape_reactions = Column(Integer, default=1)
    scrape_pages = Column(Integer, default=1)
    sort_by = Column(String(50), default="date")

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    started_at = Column(DateTime(timezone=True), nullable=True)
    finished_at = Column(DateTime(timezone=True), nullable=True)

    # Error info
    error_message = Column(Text, nullable=True)

    # Stats
    results_count = Column(Integer, default=0)

    # Relationships
    results = relationship("ScrapingResult", back_populates="run", cascade="all, delete-orphan")


class ScrapingResult(Base):
    """Individual scraped LinkedIn post/comment"""
    __tablename__ = "scraping_results"

    id = Column(Integer, primary_key=True, index=True)
    run_id = Column(Integer, ForeignKey("scraping_runs.id", ondelete="CASCADE"), index=True)

    # Post data
    post_url = Column(String(1024), nullable=True, index=True)
    post_id = Column(String(255), nullable=True, index=True)
    post_text = Column(Text, nullable=True)
    post_date = Column(DateTime(timezone=True), nullable=True)

    # Author data
    author_name = Column(String(512), nullable=True)
    author_url = Column(String(1024), nullable=True)
    author_headline = Column(String(1024), nullable=True)
    author_company = Column(String(512), nullable=True)

    # Engagement
    likes_count = Column(Integer, default=0)
    comments_count = Column(Integer, default=0)
    shares_count = Column(Integer, default=0)

    # Raw data
    raw_data = Column(JSON, nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    run = relationship("ScrapingRun", back_populates="results")
