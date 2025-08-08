"""
Pydantic schemas for report-related API endpoints
"""

from datetime import datetime
from typing import Optional, List, Dict, Any
from uuid import UUID
from pydantic import BaseModel, Field, validator
from enum import Enum


class ExaminationTypeEnum(str, Enum):
    """Examination type enumeration"""
    MRI = "MRI"
    CT = "CT"
    X_RAY = "X-Ray"
    ULTRASOUND = "Ultrasound"
    MAMMOGRAPHY = "Mammography"


class ReportStatusEnum(str, Enum):
    """Report status enumeration"""
    DRAFT = "draft"
    IN_REVIEW = "in_review"
    FINALIZED = "finalized"
    SIGNED = "signed"
    ARCHIVED = "archived"


class ReportGenerationRequest(BaseModel):
    """Request schema for report generation"""
    
    transcription: str = Field(..., min_length=10, description="Transcribed medical dictation")
    examination_type: ExaminationTypeEnum = Field(..., description="Type of medical examination")
    clinical_indication: Optional[str] = Field(None, description="Clinical indication for examination")
    patient_id: str = Field(..., min_length=1, description="Patient identifier")
    examination_date: datetime = Field(..., description="Date of examination")
    dictating_physician_id: str = Field(..., min_length=1, description="ID of dictating physician")
    dictating_physician_name: str = Field(..., min_length=1, description="Name of dictating physician")
    template_id: Optional[UUID] = Field(None, description="Template ID to use for report")
    
    @validator('examination_date')
    def validate_examination_date(cls, v):
        if v > datetime.now():
            raise ValueError('Examination date cannot be in the future')
        return v


class ReportUpdateRequest(BaseModel):
    """Request schema for report updates"""
    
    findings: Optional[str] = Field(None, description="Updated findings section")
    assessment: Optional[str] = Field(None, description="Updated assessment section")
    recommendations: Optional[str] = Field(None, description="Updated recommendations")
    clinical_indication: Optional[str] = Field(None, description="Updated clinical indication")
    technical_parameters: Optional[Dict[str, Any]] = Field(None, description="Updated technical parameters")
    change_reason: Optional[str] = Field(None, description="Reason for the change")


class ReportFinalizationRequest(BaseModel):
    """Request schema for report finalization"""
    
    reviewing_physician_id: str = Field(..., min_length=1, description="ID of reviewing physician")
    reviewing_physician_name: str = Field(..., min_length=1, description="Name of reviewing physician")
    digital_signature: Optional[str] = Field(None, description="Digital signature data")
    signature_method: Optional[str] = Field("electronic", description="Signature method used")


class ICDCodeInfo(BaseModel):
    """ICD code information"""
    
    code: str = Field(..., description="ICD-10-GM code")
    description: str = Field(..., description="German description of the code")
    confidence: Optional[float] = Field(None, ge=0.0, le=1.0, description="AI confidence score")
    radiology_relevance: Optional[float] = Field(None, ge=0.0, le=1.0, description="Relevance to radiology")


class TerminologyValidation(BaseModel):
    """Medical terminology validation result"""
    
    is_valid: bool = Field(..., description="Whether terminology is valid")
    confidence_score: float = Field(..., ge=0.0, le=1.0, description="Overall confidence score")
    valid_terms: List[Dict[str, Any]] = Field(default_factory=list, description="Valid medical terms found")
    invalid_terms: List[str] = Field(default_factory=list, description="Invalid terms found")
    suggestions: List[Dict[str, Any]] = Field(default_factory=list, description="Term suggestions")
    total_terms_checked: int = Field(..., ge=0, description="Total number of terms checked")


class QualityAssessment(BaseModel):
    """Report quality assessment"""
    
    overall_score: int = Field(..., ge=0, le=100, description="Overall quality score")
    aspects: Dict[str, int] = Field(..., description="Individual quality aspects")
    recommendations: List[str] = Field(default_factory=list, description="Quality improvement recommendations")


class ReportGenerationResponse(BaseModel):
    """Response schema for report generation"""
    
    report_id: str = Field(..., description="Generated report ID")
    status: ReportStatusEnum = Field(..., description="Report status")
    confidence_score: int = Field(..., ge=0, le=100, description="AI confidence score")
    quality_score: int = Field(..., ge=0, le=100, description="Quality assessment score")
    terminology_validation: TerminologyValidation = Field(..., description="Terminology validation results")
    suggested_icd_codes: List[ICDCodeInfo] = Field(default_factory=list, description="Suggested ICD codes")
    quality_assessment: QualityAssessment = Field(..., description="Quality assessment details")
    compliance_flags: List[str] = Field(default_factory=list, description="Compliance issues found")


class ReportResponse(BaseModel):
    """Response schema for report retrieval"""
    
    id: str = Field(..., description="Report ID")
    patient_id: str = Field(..., description="Patient ID")
    examination_date: str = Field(..., description="Examination date (ISO format)")
    examination_type: ExaminationTypeEnum = Field(..., description="Examination type")
    clinical_indication: Optional[str] = Field(None, description="Clinical indication")
    findings: str = Field(..., description="Report findings")
    assessment: str = Field(..., description="Report assessment")
    recommendations: Optional[str] = Field(None, description="Recommendations")
    status: ReportStatusEnum = Field(..., description="Report status")
    version: int = Field(..., description="Report version number")
    confidence_score: int = Field(..., description="AI confidence score")
    quality_score: int = Field(..., description="Quality score")
    icd_codes: List[ICDCodeInfo] = Field(default_factory=list, description="Associated ICD codes")
    dictating_physician_name: str = Field(..., description="Dictating physician name")
    reviewing_physician_name: Optional[str] = Field(None, description="Reviewing physician name")
    created_at: str = Field(..., description="Creation timestamp (ISO format)")
    updated_at: str = Field(..., description="Last update timestamp (ISO format)")
    finalized_at: Optional[str] = Field(None, description="Finalization timestamp (ISO format)")
    compliance_flags: List[str] = Field(default_factory=list, description="Compliance flags")
    audit_trail: List[Dict[str, Any]] = Field(default_factory=list, description="Audit trail")
    html_content: Optional[str] = Field(None, description="HTML formatted report")


class ReportUpdateResponse(BaseModel):
    """Response schema for report updates"""
    
    report_id: str = Field(..., description="Report ID")
    version: int = Field(..., description="New version number")
    updated_fields: List[str] = Field(..., description="Fields that were updated")
    confidence_score: int = Field(..., description="Updated confidence score")
    quality_score: int = Field(..., description="Updated quality score")


class ReportFinalizationResponse(BaseModel):
    """Response schema for report finalization"""
    
    report_id: str = Field(..., description="Report ID")
    status: ReportStatusEnum = Field(..., description="New report status")
    finalized_at: str = Field(..., description="Finalization timestamp (ISO format)")
    reviewing_physician: str = Field(..., description="Reviewing physician name")
    validation_results: Dict[str, Any] = Field(..., description="Final validation results")


class ReportListResponse(BaseModel):
    """Response schema for report listing"""
    
    reports: List[ReportResponse] = Field(..., description="List of reports")
    total_count: int = Field(..., description="Total number of reports")
    page: int = Field(..., description="Current page number")
    page_size: int = Field(..., description="Page size")
    has_next: bool = Field(..., description="Whether there are more pages")


class ErrorResponse(BaseModel):
    """Error response schema"""
    
    error: str = Field(..., description="Error message")
    type: str = Field(..., description="Error type")
    details: Optional[Dict[str, Any]] = Field(None, description="Additional error details")


class HealthResponse(BaseModel):
    """Health check response schema"""
    
    status: str = Field(..., description="Service status")
    timestamp: str = Field(..., description="Health check timestamp")
    version: str = Field(..., description="Service version")
    database_status: str = Field(..., description="Database connection status")
    openai_status: str = Field(..., description="OpenAI API status")
    dependencies: Dict[str, str] = Field(..., description="Status of service dependencies")