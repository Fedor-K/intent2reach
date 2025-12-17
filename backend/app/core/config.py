from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    ENVIRONMENT: str = "development"
    DATABASE_URL: str
    REDIS_URL: str
    SECRET_KEY: str
    ENCRYPTION_KEY: str
    APIFY_API_TOKEN: str
    RESEND_API_KEY: str = ""
    WARMUP_ENABLED: bool = False

    # Apify Actor ID
    APIFY_ACTOR_ID: str = "buIWk2uOUzTmcLsuB"

    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
