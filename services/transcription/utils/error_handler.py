"""
Error handling utilities for the transcription service
"""

import traceback
from typing import Dict, Optional, Type

from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse

from utils.logger import setup_logger

logger = setup_logger(__name__)


class TranscriptionError(Exception):
    """Base exception for transcription-related errors"""
    
    def __init__(self, message: str, error_code: str = "TRANSCRIPTION_ERROR",
                 details: Optional[Dict] = None):
        self.message = message
        self.error_code = error_code
        self.details = details or {}
        super().__init__(message)


class AudioProcessingError(TranscriptionError):
    """Error in audio processing"""
    
    def __init__(self, message: str, details: Optional[Dict] = None):
        super().__init__(message, "AUDIO_PROCESSING_ERROR", details)


class ModelLoadError(TranscriptionError):
    """Error loading transcription models"""
    
    def __init__(self, message: str, model_type: str, details: Optional[Dict] = None):
        details = details or {}
        details["model_type"] = model_type
        super().__init__(message, "MODEL_LOAD_ERROR", details)


class TranscriptionTimeoutError(TranscriptionError):
    """Transcription process timeout"""
    
    def __init__(self, message: str, timeout_duration: float, details: Optional[Dict] = None):
        details = details or {}
        details["timeout_duration"] = timeout_duration
        super().__init__(message, "TRANSCRIPTION_TIMEOUT", details)


class InvalidAudioFormatError(TranscriptionError):
    """Invalid audio format error"""
    
    def __init__(self, message: str, format_attempted: str, supported_formats: list,
                 details: Optional[Dict] = None):
        details = details or {}
        details.update({
            "format_attempted": format_attempted,
            "supported_formats": supported_formats
        })
        super().__init__(message, "INVALID_AUDIO_FORMAT", details)


class WebSocketError(TranscriptionError):
    """WebSocket-related error"""
    
    def __init__(self, message: str, session_id: str, details: Optional[Dict] = None):
        details = details or {}
        details["session_id"] = session_id
        super().__init__(message, "WEBSOCKET_ERROR", details)


class RateLimitError(TranscriptionError):
    """Rate limiting error"""
    
    def __init__(self, message: str, client_ip: str, limit: int, window: int,
                 details: Optional[Dict] = None):
        details = details or {}
        details.update({
            "client_ip": client_ip,
            "rate_limit": limit,
            "time_window": window
        })
        super().__init__(message, "RATE_LIMIT_EXCEEDED", details)


class ServiceUnavailableError(TranscriptionError):
    """Service unavailable error"""
    
    def __init__(self, message: str, service_name: str, details: Optional[Dict] = None):
        details = details or {}
        details["service_name"] = service_name
        super().__init__(message, "SERVICE_UNAVAILABLE", details)


class ErrorHandler:
    """Centralized error handling for the transcription service"""
    
    def __init__(self):
        self.error_counts: Dict[str, int] = {}
    
    async def handle_exception(self, request: Request, exc: Exception) -> JSONResponse:
        """
        Handle exceptions and return appropriate JSON responses
        
        Args:
            request: FastAPI request object
            exc: Exception that occurred
            
        Returns:
            JSONResponse with error details
        """
        # Increment error counter
        error_type = type(exc).__name__
        self.error_counts[error_type] = self.error_counts.get(error_type, 0) + 1
        
        # Log the error
        logger.error(
            f"Exception occurred: {error_type}",
            exc_info=True,
            extra={
                "request_path": str(request.url.path),
                "request_method": request.method,
                "client_ip": self._get_client_ip(request),
                "error_type": error_type,
                "error_message": str(exc)
            }
        )
        
        # Handle specific error types
        if isinstance(exc, TranscriptionError):
            return await self._handle_transcription_error(exc)
        elif isinstance(exc, HTTPException):
            return await self._handle_http_exception(exc)
        elif isinstance(exc, ValueError):
            return await self._handle_value_error(exc)
        elif isinstance(exc, FileNotFoundError):
            return await self._handle_file_not_found_error(exc)
        elif isinstance(exc, PermissionError):
            return await self._handle_permission_error(exc)
        elif isinstance(exc, TimeoutError):
            return await self._handle_timeout_error(exc)
        else:
            return await self._handle_generic_error(exc)
    
    async def _handle_transcription_error(self, exc: TranscriptionError) -> JSONResponse:
        """Handle TranscriptionError and its subclasses"""
        status_code = self._get_status_code_for_error(exc)
        
        return JSONResponse(
            status_code=status_code,
            content={
                "error": True,
                "error_code": exc.error_code,
                "message": exc.message,
                "details": exc.details,
                "type": "transcription_error"
            }
        )
    
    async def _handle_http_exception(self, exc: HTTPException) -> JSONResponse:
        """Handle HTTPException"""
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": True,
                "error_code": "HTTP_ERROR",
                "message": exc.detail,
                "type": "http_error"
            }
        )
    
    async def _handle_value_error(self, exc: ValueError) -> JSONResponse:
        """Handle ValueError"""
        return JSONResponse(
            status_code=400,
            content={
                "error": True,
                "error_code": "INVALID_INPUT",
                "message": f"Invalid input: {str(exc)}",
                "type": "validation_error"
            }
        )
    
    async def _handle_file_not_found_error(self, exc: FileNotFoundError) -> JSONResponse:
        """Handle FileNotFoundError"""
        return JSONResponse(
            status_code=404,
            content={
                "error": True,
                "error_code": "FILE_NOT_FOUND",
                "message": "Required file or resource not found",
                "type": "file_error"
            }
        )
    
    async def _handle_permission_error(self, exc: PermissionError) -> JSONResponse:
        """Handle PermissionError"""
        return JSONResponse(
            status_code=403,
            content={
                "error": True,
                "error_code": "PERMISSION_DENIED",
                "message": "Permission denied accessing resource",
                "type": "permission_error"
            }
        )
    
    async def _handle_timeout_error(self, exc: TimeoutError) -> JSONResponse:
        """Handle TimeoutError"""
        return JSONResponse(
            status_code=408,
            content={
                "error": True,
                "error_code": "TIMEOUT",
                "message": "Operation timed out",
                "type": "timeout_error"
            }
        )
    
    async def _handle_generic_error(self, exc: Exception) -> JSONResponse:
        """Handle generic exceptions"""
        return JSONResponse(
            status_code=500,
            content={
                "error": True,
                "error_code": "INTERNAL_ERROR",
                "message": "An internal error occurred",
                "type": "internal_error"
            }
        )
    
    def _get_status_code_for_error(self, exc: TranscriptionError) -> int:
        """Get appropriate HTTP status code for TranscriptionError"""
        error_code_mapping = {
            "AUDIO_PROCESSING_ERROR": 400,
            "MODEL_LOAD_ERROR": 503,
            "TRANSCRIPTION_TIMEOUT": 408,
            "INVALID_AUDIO_FORMAT": 400,
            "WEBSOCKET_ERROR": 400,
            "RATE_LIMIT_EXCEEDED": 429,
            "SERVICE_UNAVAILABLE": 503
        }
        
        return error_code_mapping.get(exc.error_code, 500)
    
    def _get_client_ip(self, request: Request) -> str:
        """Get client IP address from request"""
        # Try to get real IP from headers
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()
        
        real_ip = request.headers.get("x-real-ip")
        if real_ip:
            return real_ip
        
        # Fallback to client address
        if hasattr(request, "client") and request.client:
            return request.client.host
        
        return "unknown"
    
    def get_error_stats(self) -> Dict:
        """Get error statistics"""
        total_errors = sum(self.error_counts.values())
        
        return {
            "total_errors": total_errors,
            "error_counts": dict(self.error_counts),
            "error_types": list(self.error_counts.keys())
        }
    
    def reset_error_stats(self):
        """Reset error statistics"""
        self.error_counts.clear()


# Context managers for error handling
class HandleTranscriptionErrors:
    """Context manager for handling transcription-specific errors"""
    
    def __init__(self, session_id: str, operation: str):
        self.session_id = session_id
        self.operation = operation
    
    def __enter__(self):
        return self
    
    def __exit__(self, exc_type: Optional[Type[Exception]], 
                 exc_val: Optional[Exception], 
                 exc_tb: Optional[traceback]):
        if exc_type is None:
            return False
        
        # Log the error with context
        logger.error(
            f"Error in {self.operation}",
            exc_info=True,
            extra={
                "session_id": self.session_id,
                "operation": self.operation,
                "error_type": exc_type.__name__,
                "error_message": str(exc_val)
            }
        )
        
        # Re-raise as TranscriptionError if not already
        if not isinstance(exc_val, TranscriptionError):
            raise TranscriptionError(
                f"Error in {self.operation}: {str(exc_val)}",
                details={
                    "session_id": self.session_id,
                    "operation": self.operation,
                    "original_error": exc_type.__name__
                }
            )
        
        return False  # Don't suppress the exception


class HandleAudioProcessingErrors:
    """Context manager for handling audio processing errors"""
    
    def __init__(self, filename: str, format_type: str):
        self.filename = filename
        self.format_type = format_type
    
    def __enter__(self):
        return self
    
    def __exit__(self, exc_type: Optional[Type[Exception]], 
                 exc_val: Optional[Exception], 
                 exc_tb: Optional[traceback]):
        if exc_type is None:
            return False
        
        # Log the error with context
        logger.error(
            f"Audio processing error for {self.filename}",
            exc_info=True,
            extra={
                "filename": self.filename,
                "format_type": self.format_type,
                "error_type": exc_type.__name__,
                "error_message": str(exc_val)
            }
        )
        
        # Convert to AudioProcessingError
        if not isinstance(exc_val, AudioProcessingError):
            raise AudioProcessingError(
                f"Failed to process audio file {self.filename}: {str(exc_val)}",
                details={
                    "filename": self.filename,
                    "format_type": self.format_type,
                    "original_error": exc_type.__name__
                }
            )
        
        return False  # Don't suppress the exception