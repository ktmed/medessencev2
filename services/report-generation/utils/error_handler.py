"""
Comprehensive error handling utilities for the medical report generation service
"""

import logging
import traceback
from datetime import datetime
from typing import Dict, Any, Optional
from fastapi import Request, HTTPException
from sqlalchemy.exc import SQLAlchemyError
import openai

from app.core.exceptions import (
    MedicalReportException,
    DatabaseException, 
    OpenAIException,
    ValidationException,
    ComplianceException
)

logger = logging.getLogger(__name__)


class ErrorHandler:
    """Centralized error handling for the medical report service"""
    
    @staticmethod
    def log_error(
        error: Exception,
        context: Optional[Dict[str, Any]] = None,
        request: Optional[Request] = None
    ) -> str:
        """Log error with context information"""
        
        error_id = f"ERR_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{hash(str(error)) % 10000:04d}"
        
        error_details = {
            "error_id": error_id,
            "error_type": type(error).__name__,
            "error_message": str(error),
            "timestamp": datetime.utcnow().isoformat(),
            "context": context or {},
            "traceback": traceback.format_exc()
        }
        
        if request:
            error_details["request_info"] = {
                "method": request.method,
                "url": str(request.url),
                "headers": dict(request.headers),
                "client_host": request.client.host if request.client else None
            }
        
        logger.error(f"Error {error_id}: {error_details}")
        
        return error_id
    
    @staticmethod
    def handle_database_error(error: SQLAlchemyError, context: Optional[Dict[str, Any]] = None) -> DatabaseException:
        """Handle database-related errors"""
        
        error_id = ErrorHandler.log_error(error, context)
        
        # Map specific database errors to user-friendly messages
        error_message = "Database operation failed"
        
        if "connection" in str(error).lower():
            error_message = "Database connection error"
        elif "timeout" in str(error).lower():
            error_message = "Database operation timed out"
        elif "constraint" in str(error).lower():
            error_message = "Data constraint violation"
        elif "integrity" in str(error).lower():
            error_message = "Data integrity error"
        
        return DatabaseException(f"{error_message} (Error ID: {error_id})")
    
    @staticmethod
    def handle_openai_error(error: Exception, context: Optional[Dict[str, Any]] = None) -> OpenAIException:
        """Handle OpenAI API-related errors"""
        
        error_id = ErrorHandler.log_error(error, context)
        
        # Map OpenAI errors to user-friendly messages
        if isinstance(error, openai.RateLimitError):
            error_message = "AI service rate limit exceeded. Please try again later."
        elif isinstance(error, openai.APITimeoutError):
            error_message = "AI service request timed out. Please try again."
        elif isinstance(error, openai.AuthenticationError):
            error_message = "AI service authentication failed."
        elif isinstance(error, openai.APIError):
            error_message = f"AI service error: {str(error)}"
        else:
            error_message = "AI service temporarily unavailable"
        
        return OpenAIException(f"{error_message} (Error ID: {error_id})")
    
    @staticmethod
    def handle_validation_error(error: Exception, context: Optional[Dict[str, Any]] = None) -> ValidationException:
        """Handle validation-related errors"""
        
        error_id = ErrorHandler.log_error(error, context)
        
        # Extract meaningful validation messages
        if hasattr(error, 'errors') and callable(getattr(error, 'errors')):
            # Pydantic validation error
            validation_errors = error.errors()
            error_messages = []
            
            for validation_error in validation_errors:
                field = " -> ".join(str(loc) for loc in validation_error['loc'])
                message = validation_error['msg']
                error_messages.append(f"{field}: {message}")
            
            error_message = "; ".join(error_messages)
        else:
            error_message = str(error)
        
        return ValidationException(f"Validation failed: {error_message} (Error ID: {error_id})")
    
    @staticmethod
    def handle_compliance_error(error: Exception, context: Optional[Dict[str, Any]] = None) -> ComplianceException:
        """Handle medical compliance-related errors"""
        
        error_id = ErrorHandler.log_error(error, context)
        
        error_message = f"Medical compliance violation: {str(error)} (Error ID: {error_id})"
        
        return ComplianceException(error_message)
    
    @staticmethod
    def handle_generic_error(error: Exception, context: Optional[Dict[str, Any]] = None) -> MedicalReportException:
        """Handle generic errors"""
        
        error_id = ErrorHandler.log_error(error, context)
        
        # Don't expose internal error details to users
        if isinstance(error, MedicalReportException):
            return error
        
        return MedicalReportException(
            f"An unexpected error occurred. Please contact support with Error ID: {error_id}",
            500
        )
    
    @staticmethod
    def create_error_response(
        error: Exception,
        include_details: bool = False
    ) -> Dict[str, Any]:
        """Create standardized error response"""
        
        if isinstance(error, MedicalReportException):
            response = {
                "error": error.message,
                "type": "medical_report_error",
                "status_code": error.status_code,
                "timestamp": datetime.utcnow().isoformat()
            }
        else:
            response = {
                "error": "Internal server error",
                "type": "internal_error",
                "status_code": 500,
                "timestamp": datetime.utcnow().isoformat()
            }
        
        if include_details and hasattr(error, '__dict__'):
            response["details"] = error.__dict__
        
        return response


class MedicalErrorContext:
    """Context manager for medical error handling"""
    
    def __init__(self, operation: str, context: Optional[Dict[str, Any]] = None):
        self.operation = operation
        self.context = context or {}
        self.start_time = None
    
    def __enter__(self):
        self.start_time = datetime.utcnow()
        logger.info(f"Starting operation: {self.operation}")
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        duration = (datetime.utcnow() - self.start_time).total_seconds()
        
        if exc_type is None:
            logger.info(f"Operation completed successfully: {self.operation} (duration: {duration:.2f}s)")
        else:
            self.context.update({
                "operation": self.operation,
                "duration_seconds": duration
            })
            
            # Handle specific error types
            if issubclass(exc_type, SQLAlchemyError):
                handled_error = ErrorHandler.handle_database_error(exc_val, self.context)
                raise handled_error from exc_val
            elif issubclass(exc_type, openai.APIError):
                handled_error = ErrorHandler.handle_openai_error(exc_val, self.context)
                raise handled_error from exc_val
            elif issubclass(exc_type, (ValueError, TypeError)):
                handled_error = ErrorHandler.handle_validation_error(exc_val, self.context)
                raise handled_error from exc_val
            elif issubclass(exc_type, MedicalReportException):
                # Already a handled error, just re-raise
                raise exc_val
            else:
                handled_error = ErrorHandler.handle_generic_error(exc_val, self.context)
                raise handled_error from exc_val
        
        return False  # Don't suppress exceptions


def medical_error_handler(operation: str):
    """Decorator for medical error handling"""
    
    def decorator(func):
        async def async_wrapper(*args, **kwargs):
            context = {
                "function": func.__name__,
                "operation": operation,
                "args": str(args)[:200],  # Limit to avoid huge logs
                "kwargs": str(kwargs)[:200]
            }
            
            with MedicalErrorContext(operation, context):
                return await func(*args, **kwargs)
        
        def sync_wrapper(*args, **kwargs):
            context = {
                "function": func.__name__,
                "operation": operation,
                "args": str(args)[:200],
                "kwargs": str(kwargs)[:200]
            }
            
            with MedicalErrorContext(operation, context):
                return func(*args, **kwargs)
        
        # Return appropriate wrapper based on function type
        if hasattr(func, '__code__') and 'async' in str(func.__code__.co_flags):
            return async_wrapper
        else:
            return sync_wrapper
    
    return decorator


# Global error handler instance
error_handler = ErrorHandler()