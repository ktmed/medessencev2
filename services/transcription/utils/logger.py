"""
Logging configuration and utilities for the transcription service
"""

import logging
import logging.handlers
import sys
from pathlib import Path
from typing import Optional

import structlog
from pythonjsonlogger import jsonlogger


def setup_logger(name: str, level: Optional[str] = None) -> logging.Logger:
    """
    Setup structured logger with JSON formatting
    
    Args:
        name: Logger name
        level: Log level (defaults to INFO)
        
    Returns:
        Configured logger instance
    """
    # Use provided level or default to INFO
    log_level = level or "INFO"
    
    # Create logger
    logger = logging.getLogger(name)
    logger.setLevel(getattr(logging, log_level.upper()))
    
    # Avoid duplicate handlers
    if logger.handlers:
        return logger
    
    # Create formatters
    json_formatter = jsonlogger.JsonFormatter(
        fmt='%(asctime)s %(name)s %(levelname)s %(message)s %(pathname)s %(lineno)d',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    console_formatter = logging.Formatter(
        fmt='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(getattr(logging, log_level.upper()))
    console_handler.setFormatter(console_formatter)
    logger.addHandler(console_handler)
    
    # File handler - disabled in logger to avoid config dependency
    # File logging can be configured externally if needed
    
    return logger


def setup_structlog(debug: bool = False, log_level: str = "INFO"):
    """Setup structured logging with structlog"""
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.StackInfoRenderer(),
            structlog.dev.set_exc_info,
            structlog.processors.TimeStamper(fmt="ISO"),
            structlog.dev.ConsoleRenderer() if debug else structlog.processors.JSONRenderer()
        ],
        wrapper_class=structlog.make_filtering_bound_logger(
            getattr(logging, log_level.upper())
        ),
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )


class TranscriptionLogger:
    """Specialized logger for transcription events"""
    
    def __init__(self, name: str = "transcription"):
        self.logger = setup_logger(name)
        self.struct_logger = structlog.get_logger(name)
    
    def log_transcription_start(self, session_id: str, filename: Optional[str] = None,
                              language: str = "auto", medical_context: bool = True):
        """Log transcription start event"""
        self.struct_logger.info(
            "transcription_started",
            session_id=session_id,
            filename=filename,
            language=language,
            medical_context=medical_context
        )
    
    def log_transcription_complete(self, session_id: str, processing_time: float,
                                 text_length: int, confidence: float,
                                 quality_score: float, medical_terms_count: int):
        """Log transcription completion event"""
        self.struct_logger.info(
            "transcription_completed",
            session_id=session_id,
            processing_time=processing_time,
            text_length=text_length,
            confidence=confidence,
            quality_score=quality_score,
            medical_terms_count=medical_terms_count
        )
    
    def log_transcription_error(self, session_id: str, error: str, error_type: str,
                              filename: Optional[str] = None):
        """Log transcription error event"""
        self.struct_logger.error(
            "transcription_error",
            session_id=session_id,
            error=error,
            error_type=error_type,
            filename=filename
        )
    
    def log_audio_processing(self, session_id: str, original_format: str,
                           duration: float, sample_rate: int, channels: int,
                           quality_metrics: dict):
        """Log audio processing event"""
        self.struct_logger.info(
            "audio_processed",
            session_id=session_id,
            original_format=original_format,
            duration=duration,
            sample_rate=sample_rate,
            channels=channels,
            **quality_metrics
        )
    
    def log_websocket_event(self, session_id: str, event_type: str,
                          client_ip: str, message: Optional[str] = None):
        """Log WebSocket event"""
        self.struct_logger.info(
            "websocket_event",
            session_id=session_id,
            event_type=event_type,
            client_ip=client_ip,
            message=message
        )
    
    def log_model_performance(self, model_type: str, processing_time: float,
                            audio_duration: float, memory_usage: float):
        """Log model performance metrics"""
        self.struct_logger.info(
            "model_performance",
            model_type=model_type,
            processing_time=processing_time,
            audio_duration=audio_duration,
            realtime_factor=processing_time / audio_duration if audio_duration > 0 else 0,
            memory_usage=memory_usage
        )
    
    def log_medical_processing(self, session_id: str, original_text_length: int,
                             enhanced_text_length: int, medical_terms_found: int,
                             corrections_applied: int, language: str):
        """Log medical terminology processing"""
        self.struct_logger.info(
            "medical_processing",
            session_id=session_id,
            original_text_length=original_text_length,
            enhanced_text_length=enhanced_text_length,
            medical_terms_found=medical_terms_found,
            corrections_applied=corrections_applied,
            language=language
        )
    
    def log_cache_operation(self, operation: str, key: str, hit: bool = None,
                          expiry: int = None):
        """Log cache operations"""
        log_data = {
            "cache_operation": operation,
            "key": key
        }
        
        if hit is not None:
            log_data["cache_hit"] = hit
        if expiry is not None:
            log_data["expiry"] = expiry
        
        self.struct_logger.info("cache_operation", **log_data)


# Note: structured logging and transcription logger should be initialized
# in main.py after config is loaded to avoid circular dependencies