"""
Configuration settings for the Medical Report Generation Service
"""

import os
from functools import lru_cache
from typing import List, Optional
from pydantic import validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings"""
    
    # App settings
    APP_NAME: str = "Medical Report Generation Service"
    DEBUG: bool = False
    VERSION: str = "1.0.0"
    
    # Database settings
    DATABASE_URL: str = "postgresql://postgres:password@localhost:5432/radiology_reports"
    DATABASE_POOL_SIZE: int = 10
    DATABASE_MAX_OVERFLOW: int = 20
    
    # OpenAI settings
    OPENAI_API_KEY: str
    OPENAI_MODEL: str = "gpt-4-1106-preview"
    OPENAI_MAX_TOKENS: int = 4000
    OPENAI_TEMPERATURE: float = 0.3
    
    # Redis settings (for caching)
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_CACHE_TTL: int = 3600  # 1 hour
    
    # Security settings
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # CORS settings
    ALLOWED_HOSTS: List[str] = ["*"]
    
    # Medical settings
    DEFAULT_LANGUAGE: str = "de"  # German
    SUPPORTED_EXAM_TYPES: List[str] = ["MRI", "CT", "X-Ray", "Ultrasound", "Mammography"]
    
    # File settings
    MAX_UPLOAD_SIZE: int = 10 * 1024 * 1024  # 10MB
    ALLOWED_FILE_TYPES: List[str] = [".txt", ".json", ".wav", ".mp3"]
    
    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    
    # Medical compliance
    REQUIRE_PHYSICIAN_SIGNATURE: bool = True
    ENABLE_AUDIT_LOGGING: bool = True
    DATA_RETENTION_DAYS: int = 2555  # 7 years (medical requirement)
    
    @validator("OPENAI_API_KEY")
    def validate_openai_key(cls, v):
        if not v:
            raise ValueError("OPENAI_API_KEY is required")
        return v
    
    @validator("SECRET_KEY")
    def validate_secret_key(cls, v):
        if not v:
            raise ValueError("SECRET_KEY is required")
        return v
    
    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    """Get cached application settings"""
    return Settings()