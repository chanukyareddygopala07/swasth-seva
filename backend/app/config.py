from functools import lru_cache
from typing import List

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    APP_NAME: str = "Swasth Seva"
    API_V1_PREFIX: str = "/api/v1"
    DEBUG: bool = False

    DATABASE_URL: str = "postgresql+asyncpg://swasth:swasth_secret@localhost:5432/swasthseva"
    REDIS_URL: str = "redis://localhost:6379/0"

    SECRET_KEY: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    BACKEND_CORS_ORIGINS: List[str] = ["http://localhost:3000"]

    SEED_DEMO_DATA: bool = True
    AI_MODEL_DIR: str = "ai_models"

    SMTP_HOST: str | None = None
    SMTP_PORT: int = 587
    SMTP_USER: str | None = None
    SMTP_PASSWORD: str | None = None
    SMTP_FROM: str = "Swasth Seva <no-reply@swasthseva.app>"

    SMS_PROVIDER: str = "abstraction"
    SMS_API_KEY: str | None = None
    SMS_SENDER_ID: str | None = None

    WHATSAPP_API_KEY: str | None = None
    WHATSAPP_PHONE_ID: str | None = None

    FCM_SERVER_KEY: str | None = None

    CLOUDINARY_CLOUD_NAME: str | None = None
    CLOUDINARY_API_KEY: str | None = None
    CLOUDINARY_API_SECRET: str | None = None

    OSRM_API_URL: str = "https://router.project-osrm.org/route/v1/driving"
    NOMINATIM_API_URL: str = "https://nominatim.openstreetmap.org/search"

    SUPER_ADMIN_EMAIL: str = "superadmin@swasthseva.app"
    SUPER_ADMIN_PASSWORD: str = "SuperAdmin@123"

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def split_origins(cls, v):
        if isinstance(v, str):
            return [o.strip() for o in v.split(",") if o.strip()]
        return v


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
