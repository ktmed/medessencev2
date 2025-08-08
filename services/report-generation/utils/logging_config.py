"""
Logging configuration for the medical report generation service
"""

import logging
import logging.handlers
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, Any
import json

from app.core.config import get_settings

settings = get_settings()


class MedicalReportFormatter(logging.Formatter):
    """Custom formatter for medical report logging with enhanced context"""
    
    def format(self, record):
        # Add timestamp
        record.timestamp = datetime.utcnow().isoformat()
        
        # Add service context
        record.service = "medical-report-generation"
        record.version = settings.VERSION
        
        # Format the base message
        formatted = super().format(record)
        
        # Add medical context if available
        if hasattr(record, 'patient_id'):
            formatted += f" [Patient: {record.patient_id}]"
        
        if hasattr(record, 'report_id'):
            formatted += f" [Report: {record.report_id}]"
        
        if hasattr(record, 'physician_id'):
            formatted += f" [Physician: {record.physician_id}]"
        
        return formatted


class JSONFormatter(logging.Formatter):
    """JSON formatter for structured logging"""
    
    def format(self, record):
        log_entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "service": "medical-report-generation",
            "version": settings.VERSION,
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno
        }
        
        # Add exception info if present
        if record.exc_info:
            log_entry["exception"] = self.formatException(record.exc_info)
        
        # Add medical context
        medical_fields = ['patient_id', 'report_id', 'physician_id', 'examination_type']
        for field in medical_fields:
            if hasattr(record, field):
                log_entry[field] = getattr(record, field)
        
        # Add custom fields
        if hasattr(record, 'extra_fields'):
            log_entry.update(record.extra_fields)
        
        return json.dumps(log_entry, ensure_ascii=False)


class MedicalAuditHandler(logging.Handler):
    """Special handler for medical audit logs"""
    
    def __init__(self, audit_file: str):
        super().__init__()
        self.audit_file = Path(audit_file)
        self.audit_file.parent.mkdir(parents=True, exist_ok=True)
        
        # Use rotating file handler for audit logs
        self.file_handler = logging.handlers.RotatingFileHandler(
            self.audit_file,
            maxBytes=10*1024*1024,  # 10MB
            backupCount=50,  # Keep 50 files (500MB total)
            encoding='utf-8'
        )
        
        # Set JSON formatter for audit logs
        self.file_handler.setFormatter(JSONFormatter())
    
    def emit(self, record):
        # Only log audit-relevant records
        if hasattr(record, 'audit') and record.audit:
            self.file_handler.emit(record)


class SecurityLogFilter(logging.Filter):
    """Filter to identify security-relevant log entries"""
    
    security_keywords = [
        'authentication', 'authorization', 'login', 'logout',
        'access_denied', 'permission', 'signature', 'compliance',
        'gdpr', 'hipaa', 'anonymization', 'audit'
    ]
    
    def filter(self, record):
        message = record.getMessage().lower()
        record.is_security = any(keyword in message for keyword in self.security_keywords)
        return True


def setup_logging():
    """Setup comprehensive logging configuration"""
    
    # Create logs directory
    log_dir = Path("logs")
    log_dir.mkdir(exist_ok=True)
    
    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, settings.LOG_LEVEL))
    
    # Clear existing handlers
    root_logger.handlers.clear()
    
    # Console handler with colored output
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.INFO)
    console_formatter = MedicalReportFormatter(
        fmt='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    console_handler.setFormatter(console_formatter)
    root_logger.addHandler(console_handler)
    
    # Main application log file
    app_handler = logging.handlers.RotatingFileHandler(
        log_dir / "medical_report_service.log",
        maxBytes=10*1024*1024,  # 10MB
        backupCount=10,
        encoding='utf-8'
    )
    app_handler.setLevel(logging.DEBUG if settings.DEBUG else logging.INFO)
    app_handler.setFormatter(JSONFormatter())
    root_logger.addHandler(app_handler)
    
    # Error log file (only errors and above)
    error_handler = logging.handlers.RotatingFileHandler(
        log_dir / "errors.log",
        maxBytes=5*1024*1024,  # 5MB
        backupCount=20,
        encoding='utf-8'
    )
    error_handler.setLevel(logging.ERROR)
    error_handler.setFormatter(JSONFormatter())
    root_logger.addHandler(error_handler)
    
    # Security log file
    security_handler = logging.handlers.RotatingFileHandler(
        log_dir / "security.log",
        maxBytes=5*1024*1024,  # 5MB
        backupCount=50,  # Keep longer for security compliance
        encoding='utf-8'
    )
    security_handler.setLevel(logging.INFO)
    security_handler.setFormatter(JSONFormatter())
    security_handler.addFilter(SecurityLogFilter())
    
    # Only add security logs with security context
    class SecurityOnlyFilter(logging.Filter):
        def filter(self, record):
            return hasattr(record, 'is_security') and record.is_security
    
    security_handler.addFilter(SecurityOnlyFilter())
    root_logger.addHandler(security_handler)
    
    # Medical audit log (if enabled)
    if settings.ENABLE_AUDIT_LOGGING:
        audit_handler = MedicalAuditHandler(log_dir / "medical_audit.log")
        audit_handler.setLevel(logging.INFO)
        root_logger.addHandler(audit_handler)
    
    # Performance log file
    perf_handler = logging.handlers.RotatingFileHandler(
        log_dir / "performance.log",
        maxBytes=5*1024*1024,  # 5MB
        backupCount=5,
        encoding='utf-8'
    )
    perf_handler.setLevel(logging.INFO)
    perf_handler.setFormatter(JSONFormatter())
    
    # Only log performance-related entries
    class PerformanceFilter(logging.Filter):
        def filter(self, record):
            return hasattr(record, 'performance') and record.performance
    
    perf_handler.addFilter(PerformanceFilter())
    root_logger.addHandler(perf_handler)
    
    # Configure specific loggers
    
    # Uvicorn (reduce noise)
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.error").setLevel(logging.INFO)
    
    # SQLAlchemy (reduce noise in production)
    if not settings.DEBUG:
        logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
        logging.getLogger("sqlalchemy.pool").setLevel(logging.WARNING)
    
    # OpenAI API (reduce noise)
    logging.getLogger("openai").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    
    # FastAPI
    logging.getLogger("fastapi").setLevel(logging.INFO)
    
    # Medical report service logger
    medical_logger = logging.getLogger("medical_report_service")
    medical_logger.setLevel(logging.DEBUG if settings.DEBUG else logging.INFO)
    
    logging.info("Logging configuration completed")


def get_medical_logger(name: str) -> logging.Logger:
    """Get a logger configured for medical operations"""
    
    logger = logging.getLogger(f"medical_report_service.{name}")
    return logger


def log_medical_event(
    logger: logging.Logger,
    level: int,
    message: str,
    patient_id: str = None,
    report_id: str = None,
    physician_id: str = None,
    examination_type: str = None,
    audit: bool = False,
    security: bool = False,
    performance: bool = False,
    extra_fields: Dict[str, Any] = None
):
    """Log a medical event with enhanced context"""
    
    extra = {}
    
    if patient_id:
        extra['patient_id'] = patient_id
    if report_id:
        extra['report_id'] = report_id
    if physician_id:
        extra['physician_id'] = physician_id
    if examination_type:
        extra['examination_type'] = examination_type
    if audit:
        extra['audit'] = True
    if security:
        extra['security'] = True
    if performance:
        extra['performance'] = True
    if extra_fields:
        extra['extra_fields'] = extra_fields
    
    logger.log(level, message, extra=extra)


def log_audit_event(
    event_type: str,
    description: str,
    user_id: str = None,
    patient_id: str = None,
    report_id: str = None,
    details: Dict[str, Any] = None
):
    """Log an audit event for compliance tracking"""
    
    audit_logger = logging.getLogger("medical_audit")
    
    extra = {
        'audit': True,
        'event_type': event_type,
        'user_id': user_id,
        'extra_fields': {
            'audit_event': {
                'type': event_type,
                'description': description,
                'details': details or {},
                'compliance_relevant': True
            }
        }
    }
    
    if patient_id:
        extra['patient_id'] = patient_id
    if report_id:
        extra['report_id'] = report_id
    
    audit_logger.info(f"AUDIT: {event_type} - {description}", extra=extra)


def log_performance_metric(
    operation: str,
    duration_ms: float,
    success: bool = True,
    details: Dict[str, Any] = None
):
    """Log performance metrics"""
    
    perf_logger = logging.getLogger("performance")
    
    extra = {
        'performance': True,
        'extra_fields': {
            'performance_metric': {
                'operation': operation,
                'duration_ms': duration_ms,
                'success': success,
                'details': details or {}
            }
        }
    }
    
    perf_logger.info(f"PERF: {operation} completed in {duration_ms:.2f}ms", extra=extra)


# Initialize logging on module import
if not logging.getLogger().handlers:
    setup_logging()