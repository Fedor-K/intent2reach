from fastapi import APIRouter
from app.api.routes import scraping

api_router = APIRouter()
api_router.include_router(scraping.router, prefix="/scraping", tags=["scraping"])
