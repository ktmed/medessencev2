"""Custom exceptions for the summary generation service."""

from fastapi import HTTPException


class SummaryGenerationException(HTTPException):
    """Base exception for summary generation errors."""
    
    def __init__(self, detail: str, status_code: int = 400):
        super().__init__(status_code=status_code, detail=detail)


class OpenAIServiceException(SummaryGenerationException):
    """Exception for OpenAI service errors."""
    
    def __init__(self, detail: str = "OpenAI service error"):
        super().__init__(detail=detail, status_code=503)


class LanguageNotSupportedException(SummaryGenerationException):
    """Exception for unsupported language."""
    
    def __init__(self, language: str):
        super().__init__(
            detail=f"Language '{language}' is not supported",
            status_code=400
        )


class ComplexityLevelNotSupportedException(SummaryGenerationException):
    """Exception for unsupported complexity level."""
    
    def __init__(self, complexity: str):
        super().__init__(
            detail=f"Complexity level '{complexity}' is not supported",
            status_code=400
        )


class MedicalReportNotFoundException(SummaryGenerationException):
    """Exception for missing medical report."""
    
    def __init__(self, report_id: str):
        super().__init__(
            detail=f"Medical report '{report_id}' not found",
            status_code=404
        )


class SummaryNotFoundException(SummaryGenerationException):
    """Exception for missing summary."""
    
    def __init__(self, summary_id: str):
        super().__init__(
            detail=f"Summary '{summary_id}' not found",
            status_code=404
        )


class MedicalTerminologyException(SummaryGenerationException):
    """Exception for medical terminology processing errors."""
    
    def __init__(self, detail: str = "Medical terminology processing error"):
        super().__init__(detail=detail, status_code=422)


class EmergencyDetectionException(SummaryGenerationException):
    """Exception for emergency detection errors."""
    
    def __init__(self, detail: str = "Emergency detection error"):
        super().__init__(detail=detail, status_code=500)


class TemplateRenderingException(SummaryGenerationException):
    """Exception for template rendering errors."""
    
    def __init__(self, detail: str = "Template rendering error"):
        super().__init__(detail=detail, status_code=500)


class RateLimitExceededException(SummaryGenerationException):
    """Exception for rate limit exceeded."""
    
    def __init__(self, detail: str = "Rate limit exceeded"):
        super().__init__(detail=detail, status_code=429)


class ValidationException(SummaryGenerationException):
    """Exception for input validation errors."""
    
    def __init__(self, detail: str):
        super().__init__(detail=detail, status_code=422)