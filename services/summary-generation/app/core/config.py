"""Application configuration settings."""

import os
from functools import lru_cache
from typing import List

from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings."""
    
    # Application
    DEBUG: bool = Field(default=False, description="Debug mode")
    HOST: str = Field(default="0.0.0.0", description="Host to bind to")
    PORT: int = Field(default=8003, description="Port to bind to")
    LOG_LEVEL: str = Field(default="INFO", description="Logging level")
    
    # CORS
    ALLOWED_ORIGINS: List[str] = Field(
        default=["http://localhost:3000", "http://localhost:8000"],
        description="Allowed CORS origins"
    )
    
    # Database
    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://postgres:password@localhost:5432/radiology_ai",
        description="Database URL"
    )
    
    # Redis
    REDIS_URL: str = Field(
        default="redis://localhost:6379",
        description="Redis URL for caching"
    )
    
    # OpenAI
    OPENAI_API_KEY: str = Field(
        default="",
        description="OpenAI API key"
    )
    OPENAI_MODEL: str = Field(
        default="gpt-4-1106-preview",
        description="OpenAI model for text generation"
    )
    OPENAI_MAX_TOKENS: int = Field(
        default=2000,
        description="Maximum tokens for OpenAI completion"
    )
    OPENAI_TEMPERATURE: float = Field(
        default=0.3,
        description="Temperature for OpenAI completion"
    )
    
    # Medical Settings
    SUPPORTED_LANGUAGES: List[str] = Field(
        default=["de", "en", "fr", "es", "it", "tr"],
        description="Supported languages for summaries"
    )
    COMPLEXITY_LEVELS: List[str] = Field(
        default=["basic", "intermediate", "advanced"],
        description="Available complexity levels"
    )
    DEFAULT_LANGUAGE: str = Field(
        default="de",
        description="Default language for summaries"
    )
    DEFAULT_COMPLEXITY: str = Field(
        default="basic",
        description="Default complexity level"
    )
    
    # Security
    SECRET_KEY: str = Field(
        default="your-secret-key-here",
        description="Secret key for JWT tokens"
    )
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(
        default=30,
        description="Access token expiration in minutes"
    )
    
    # Medical Compliance
    INCLUDE_DISCLAIMERS: bool = Field(
        default=True,
        description="Include medical disclaimers in summaries"
    )
    ENABLE_EMERGENCY_DETECTION: bool = Field(
        default=True,
        description="Enable emergency condition detection"
    )
    MAX_SUMMARY_LENGTH: int = Field(
        default=1500,
        description="Maximum summary length in words"
    )
    
    # Rate Limiting
    RATE_LIMIT_PER_MINUTE: int = Field(
        default=60,
        description="Rate limit per minute per user"
    )
    
    # External Services
    REPORT_GENERATION_URL: str = Field(
        default="http://localhost:8002",
        description="Report generation service URL"
    )
    
    class Config:
        """Pydantic config."""
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()