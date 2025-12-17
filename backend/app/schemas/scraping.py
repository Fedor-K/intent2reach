from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import datetime
from app.models.scraping import RunStatus


class ScrapingRunCreate(BaseModel):
    """Schema for creating a new scraping run"""
    search_queries: Optional[List[str]] = Field(default=None, description="Search queries for LinkedIn")
    author_urls: Optional[List[str]] = Field(default=None, description="Author profile URLs to scrape")
    authors_companies: Optional[List[str]] = Field(default=None, description="Company names to filter by")
    posted_limit: str = Field(default="24h", description="Time limit for posts (e.g., 24h, 7d, 30d)")
    max_posts: int = Field(default=100, ge=1, le=50000, description="Maximum posts to scrape")
    max_comments: int = Field(default=100, ge=0, le=50000000, description="Maximum comments to scrape")
    max_reactions: int = Field(default=100, ge=0, le=50000000, description="Maximum reactions to scrape")
    scrape_comments: bool = Field(default=True, description="Whether to scrape comments")
    scrape_reactions: bool = Field(default=True, description="Whether to scrape reactions")
    scrape_pages: int = Field(default=1, ge=1, le=100, description="Number of pages to scrape")
    sort_by: str = Field(default="date", description="Sort order: date or relevance")


class ScrapingRunResponse(BaseModel):
    """Schema for scraping run response"""
    id: int
    apify_run_id: Optional[str] = None
    status: RunStatus
    search_queries: Optional[List[str]] = None
    author_urls: Optional[List[str]] = None
    authors_companies: Optional[List[str]] = None
    posted_limit: str
    max_posts: int
    max_comments: int
    max_reactions: int
    scrape_comments: int
    scrape_reactions: int
    scrape_pages: int
    sort_by: str
    created_at: datetime
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    error_message: Optional[str] = None
    results_count: int

    class Config:
        from_attributes = True


class ScrapingRunListResponse(BaseModel):
    """Schema for list of scraping runs"""
    runs: List[ScrapingRunResponse]
    total: int
    page: int
    page_size: int


class ScrapingResultResponse(BaseModel):
    """Schema for individual scraping result"""
    id: int
    run_id: int
    post_url: Optional[str] = None
    post_id: Optional[str] = None
    post_text: Optional[str] = None
    post_date: Optional[datetime] = None
    author_name: Optional[str] = None
    author_url: Optional[str] = None
    author_headline: Optional[str] = None
    author_company: Optional[str] = None
    likes_count: int
    comments_count: int
    shares_count: int
    created_at: datetime

    class Config:
        from_attributes = True


class ScrapingResultListResponse(BaseModel):
    """Schema for list of scraping results"""
    results: List[ScrapingResultResponse]
    total: int
    page: int
    page_size: int
