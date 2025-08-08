"""
Configuration management for the transcription service
"""

import os
from pathlib import Path
from typing import List, Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Config(BaseSettings):
    """Configuration settings for the transcription service"""
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )
    
    # Server settings
    HOST: str = Field(default="0.0.0.0", description="Server host")
    PORT: int = Field(default=8001, description="Server port")
    DEBUG: bool = Field(default=False, description="Debug mode")
    WORKERS: int = Field(default=4, description="Number of worker processes")
    
    # CORS settings
    ALLOWED_ORIGINS: List[str] = Field(
        default=["http://localhost:3000", "http://localhost:8000"],
        description="Allowed CORS origins"
    )
    
    # OpenAI settings
    OPENAI_API_KEY: Optional[str] = Field(default=None, description="OpenAI API key")
    OPENAI_MODEL: str = Field(default="whisper-1", description="OpenAI Whisper model")
    OPENAI_TIMEOUT: int = Field(default=60, description="OpenAI API timeout in seconds")
    
    # Local Whisper settings
    WHISPER_MODEL: str = Field(default="base", description="Local Whisper model size")
    WHISPER_DEVICE: str = Field(default="cpu", description="Device for Whisper model (cpu/cuda)")
    WHISPER_COMPUTE_TYPE: str = Field(default="int8", description="Compute type for Whisper")
    USE_LOCAL_WHISPER: bool = Field(default=True, description="Use local Whisper model")
    
    # German Medical Whisper settings
    USE_GERMAN_MEDICAL_MODEL: bool = Field(default=True, description="Use German medical Whisper model")
    GERMAN_MEDICAL_MODEL: str = Field(default="distil-large-v3", description="German medical model size")
    
    # Redis settings
    REDIS_HOST: str = Field(default="localhost", description="Redis host")
    REDIS_PORT: int = Field(default=6379, description="Redis port")
    REDIS_PASSWORD: Optional[str] = Field(default=None, description="Redis password")
    REDIS_DB: int = Field(default=0, description="Redis database number")
    REDIS_URL: Optional[str] = Field(default=None, description="Redis connection URL")
    
    # Audio processing settings
    AUDIO_SAMPLE_RATE: int = Field(default=16000, description="Audio sample rate")
    AUDIO_CHANNELS: int = Field(default=1, description="Audio channels (mono)")
    MAX_AUDIO_SIZE: int = Field(default=25 * 1024 * 1024, description="Max audio file size (25MB)")
    AUDIO_CHUNK_DURATION: float = Field(default=30.0, description="Audio chunk duration in seconds")
    
    # Transcription settings
    DEFAULT_LANGUAGE: str = Field(default="auto", description="Default language code")
    SUPPORTED_LANGUAGES: List[str] = Field(
        default=["auto", "en", "de", "fr", "es", "it", "tr"],
        description="Supported language codes"
    )
    MIN_CONFIDENCE_THRESHOLD: float = Field(default=0.6, description="Minimum confidence threshold")
    
    # Medical terminology settings
    ENABLE_MEDICAL_PROCESSING: bool = Field(default=True, description="Enable medical terminology processing")
    MEDICAL_DICT_PATH: str = Field(default="data/medical_dictionaries", description="Medical dictionaries path")
    
    # WebSocket settings
    WS_MAX_CONNECTIONS: int = Field(default=100, description="Maximum WebSocket connections")
    WS_HEARTBEAT_INTERVAL: int = Field(default=30, description="WebSocket heartbeat interval")
    WS_MAX_MESSAGE_SIZE: int = Field(default=1024 * 1024, description="Max WebSocket message size")
    
    # Session management
    SESSION_TIMEOUT: int = Field(default=3600, description="Session timeout in seconds")
    MAX_SESSIONS_PER_IP: int = Field(default=5, description="Maximum sessions per IP")
    
    # File storage
    TEMP_DIR: str = Field(default="/tmp/transcription", description="Temporary file directory")
    UPLOAD_DIR: str = Field(default="uploads", description="Upload directory")
    
    # Logging settings
    LOG_LEVEL: str = Field(default="INFO", description="Logging level")
    LOG_FORMAT: str = Field(
        default="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        description="Log format"
    )
    LOG_FILE: Optional[str] = Field(default=None, description="Log file path")
    
    # Performance settings
    MAX_CONCURRENT_TRANSCRIPTIONS: int = Field(default=10, description="Max concurrent transcriptions")
    TRANSCRIPTION_TIMEOUT: int = Field(default=300, description="Transcription timeout in seconds")
    
    # Security settings
    SECRET_KEY: str = Field(default="change-me-in-production", description="Secret key for sessions")
    RATE_LIMIT_PER_MINUTE: int = Field(default=60, description="Rate limit per minute per IP")
    
    # Health check settings
    HEALTH_CHECK_INTERVAL: int = Field(default=30, description="Health check interval in seconds")
    
    # Model paths
    MODEL_CACHE_DIR: str = Field(default="models", description="Model cache directory")
    
    @property
    def redis_url_computed(self) -> str:
        """Compute Redis URL from individual settings if REDIS_URL not provided"""
        if self.REDIS_URL:
            return self.REDIS_URL
        
        auth = f":{self.REDIS_PASSWORD}@" if self.REDIS_PASSWORD else ""
        return f"redis://{auth}{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"
    
    @property
    def temp_dir_path(self) -> Path:
        """Get temp directory as Path object"""
        return Path(self.TEMP_DIR)
    
    @property
    def upload_dir_path(self) -> Path:
        """Get upload directory as Path object"""
        return Path(self.UPLOAD_DIR)
    
    @property
    def medical_dict_path_obj(self) -> Path:
        """Get medical dictionary path as Path object"""
        return Path(self.MEDICAL_DICT_PATH)
    
    @property
    def model_cache_dir_path(self) -> Path:
        """Get model cache directory as Path object"""
        return Path(self.MODEL_CACHE_DIR)
    
    def create_directories(self) -> None:
        """Create necessary directories"""
        directories = [
            self.temp_dir_path,
            self.upload_dir_path,
            self.medical_dict_path_obj,
            self.model_cache_dir_path
        ]
        
        for directory in directories:
            directory.mkdir(parents=True, exist_ok=True)
    
    def validate_config(self) -> None:
        """Validate configuration settings"""
        # Check audio settings
        if self.AUDIO_SAMPLE_RATE not in [8000, 16000, 22050, 44100, 48000]:
            raise ValueError(f"Invalid sample rate: {self.AUDIO_SAMPLE_RATE}")
        
        if self.AUDIO_CHANNELS not in [1, 2]:
            raise ValueError(f"Invalid channel count: {self.AUDIO_CHANNELS}")
        
        # Check language settings
        if self.DEFAULT_LANGUAGE not in self.SUPPORTED_LANGUAGES:
            raise ValueError(f"Default language {self.DEFAULT_LANGUAGE} not in supported languages")
        
        # Check thresholds
        if not 0.0 <= self.MIN_CONFIDENCE_THRESHOLD <= 1.0:
            raise ValueError(f"Invalid confidence threshold: {self.MIN_CONFIDENCE_THRESHOLD}")
        
        # Check Whisper model
        valid_models = ["tiny", "base", "small", "medium", "large", "large-v2", "large-v3"]
        if self.USE_LOCAL_WHISPER and self.WHISPER_MODEL not in valid_models:
            raise ValueError(f"Invalid Whisper model: {self.WHISPER_MODEL}")
        
        # Check device
        if self.WHISPER_DEVICE not in ["cpu", "cuda", "auto"]:
            raise ValueError(f"Invalid device: {self.WHISPER_DEVICE}")


# Global config instance
config = Config()

# Validate and create directories on import
config.validate_config()
config.create_directories()