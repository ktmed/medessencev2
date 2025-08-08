"""
Custom exceptions for the Medical Report Generation Service
"""


class MedicalReportException(Exception):
    """Base exception for medical report operations"""
    
    def __init__(self, message: str, status_code: int = 500):
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)


class DatabaseException(MedicalReportException):
    """Database operation exceptions"""
    
    def __init__(self, message: str):
        super().__init__(message, 500)


class OpenAIException(MedicalReportException):
    """OpenAI API exceptions"""
    
    def __init__(self, message: str):
        super().__init__(message, 503)


class ValidationException(MedicalReportException):
    """Input validation exceptions"""
    
    def __init__(self, message: str):
        super().__init__(message, 400)


class ReportNotFoundException(MedicalReportException):
    """Report not found exceptions"""
    
    def __init__(self, report_id: str):
        super().__init__(f"Report with ID {report_id} not found", 404)


class TemplateNotFoundException(MedicalReportException):
    """Template not found exceptions"""
    
    def __init__(self, template_id: str):
        super().__init__(f"Template with ID {template_id} not found", 404)


class ReportAlreadyFinalizedException(MedicalReportException):
    """Report already finalized exceptions"""
    
    def __init__(self, report_id: str):
        super().__init__(f"Report {report_id} is already finalized and cannot be modified", 409)


class MedicalTerminologyException(MedicalReportException):
    """Medical terminology validation exceptions"""
    
    def __init__(self, message: str):
        super().__init__(message, 422)


class ICDCodeException(MedicalReportException):
    """ICD code validation exceptions"""
    
    def __init__(self, message: str):
        super().__init__(message, 422)


class PhysicianSignatureException(MedicalReportException):
    """Physician signature exceptions"""
    
    def __init__(self, message: str):
        super().__init__(message, 403)


class ComplianceException(MedicalReportException):
    """Medical compliance exceptions"""
    
    def __init__(self, message: str):
        super().__init__(message, 422)