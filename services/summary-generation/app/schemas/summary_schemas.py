"""Pydantic schemas for summary-related API operations."""

from datetime import datetime
from typing import Dict, List, Optional, Any
from uuid import UUID

from pydantic import BaseModel, Field, validator


class SummaryGenerationRequest(BaseModel):
    """Request schema for generating a patient-friendly summary."""
    
    report_text: str = Field(..., description="Original medical report text")
    report_id: Optional[str] = Field(None, description="ID of the original report")
    patient_id: Optional[str] = Field(None, description="Patient identifier")
    language: str = Field(default="de", description="Target language for summary")
    complexity_level: str = Field(default="basic", description="Complexity level (basic, intermediate, advanced)")
    cultural_context: Optional[str] = Field(None, description="Cultural context for adaptation")
    region: Optional[str] = Field(None, description="Region for localization")
    include_glossary: bool = Field(default=True, description="Include medical terms glossary")
    emergency_detection: bool = Field(default=True, description="Enable emergency condition detection")
    
    @validator('language')
    def validate_language(cls, v):
        supported_languages = ['de', 'en', 'fr', 'es', 'it', 'tr']
        if v not in supported_languages:
            raise ValueError(f'Language must be one of: {supported_languages}')
        return v
    
    @validator('complexity_level')
    def validate_complexity(cls, v):
        supported_levels = ['basic', 'intermediate', 'advanced']
        if v not in supported_levels:
            raise ValueError(f'Complexity level must be one of: {supported_levels}')
        return v


class EmergencyIndicator(BaseModel):
    """Emergency indicator information."""
    
    keyword: str = Field(..., description="Emergency keyword found")
    urgency_level: str = Field(..., description="Urgency level (critical, high, medium, low)")
    emergency_type: str = Field(..., description="Type of emergency condition")
    patient_warning: str = Field(..., description="Warning message for patient")
    immediate_actions: List[str] = Field(default_factory=list, description="Immediate actions to take")
    confidence_score: float = Field(..., description="Confidence in emergency detection")


class GlossaryTerm(BaseModel):
    """Glossary term definition."""
    
    term: str = Field(..., description="Medical term")
    definition: str = Field(..., description="Patient-friendly definition")
    category: Optional[str] = Field(None, description="Medical category")


class SummaryContent(BaseModel):
    """Generated summary content."""
    
    title: str = Field(..., description="Patient-friendly title")
    what_was_examined: str = Field(..., description="What was examined (simple explanation)")
    key_findings: str = Field(..., description="Key findings in plain language")
    what_this_means: str = Field(..., description="What this means for the patient")
    next_steps: str = Field(..., description="Next steps and recommendations")
    when_to_contact_doctor: str = Field(..., description="When to contact healthcare provider")
    medical_disclaimer: str = Field(..., description="Medical disclaimer")
    glossary: List[GlossaryTerm] = Field(default_factory=list, description="Medical terms glossary")


class SummaryResponse(BaseModel):
    """Response schema for generated summary."""
    
    id: UUID = Field(..., description="Summary ID")
    report_id: Optional[str] = Field(None, description="Original report ID")
    patient_id: Optional[str] = Field(None, description="Patient ID")
    language: str = Field(..., description="Summary language")
    complexity_level: str = Field(..., description="Complexity level")
    
    # Summary content
    content: SummaryContent = Field(..., description="Generated summary content")
    
    # Emergency and safety
    is_urgent: bool = Field(default=False, description="Urgent condition detected")
    emergency_indicators: List[EmergencyIndicator] = Field(default_factory=list, description="Emergency indicators")
    safety_warnings: Optional[str] = Field(None, description="Safety warnings")
    
    # Generation metadata
    generation_model: str = Field(..., description="AI model used for generation")
    generation_time_seconds: Optional[int] = Field(None, description="Generation time in seconds")
    confidence_score: Optional[str] = Field(None, description="Overall confidence score")
    
    # Timestamps
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: Optional[datetime] = Field(None, description="Last update timestamp")
    
    class Config:
        from_attributes = True


class SummaryUpdateRequest(BaseModel):
    """Request schema for updating a summary."""
    
    content: Optional[SummaryContent] = Field(None, description="Updated content")
    language: Optional[str] = Field(None, description="Updated language")
    complexity_level: Optional[str] = Field(None, description="Updated complexity level")
    status: Optional[str] = Field(None, description="Updated status")
    review_notes: Optional[str] = Field(None, description="Review notes")
    
    @validator('language')
    def validate_language(cls, v):
        if v is not None:
            supported_languages = ['de', 'en', 'fr', 'es', 'it', 'tr']
            if v not in supported_languages:
                raise ValueError(f'Language must be one of: {supported_languages}')
        return v
    
    @validator('complexity_level')
    def validate_complexity(cls, v):
        if v is not None:
            supported_levels = ['basic', 'intermediate', 'advanced']
            if v not in supported_levels:
                raise ValueError(f'Complexity level must be one of: {supported_levels}')
        return v


class SummaryListResponse(BaseModel):
    """Response schema for listing summaries."""
    
    summaries: List[SummaryResponse] = Field(..., description="List of summaries")
    total: int = Field(..., description="Total number of summaries")
    page: int = Field(..., description="Current page")
    page_size: int = Field(..., description="Page size")
    has_next: bool = Field(..., description="Has next page")


class SummaryFeedbackRequest(BaseModel):
    """Request schema for summary feedback."""
    
    summary_id: UUID = Field(..., description="Summary ID")
    clarity_rating: Optional[int] = Field(None, ge=1, le=5, description="Clarity rating (1-5)")
    usefulness_rating: Optional[int] = Field(None, ge=1, le=5, description="Usefulness rating (1-5)")
    accuracy_rating: Optional[int] = Field(None, ge=1, le=5, description="Accuracy rating (1-5)")
    overall_rating: Optional[int] = Field(None, ge=1, le=5, description="Overall rating (1-5)")
    comments: Optional[str] = Field(None, description="Additional comments")
    suggestions: Optional[str] = Field(None, description="Suggestions for improvement")


class LanguageInfo(BaseModel):
    """Language information."""
    
    code: str = Field(..., description="Language code")
    name: str = Field(..., description="Language name")
    native_name: str = Field(..., description="Native language name")
    supported_complexities: List[str] = Field(..., description="Supported complexity levels")
    cultural_contexts: List[str] = Field(default_factory=list, description="Available cultural contexts")


class ComplexityLevelInfo(BaseModel):
    """Complexity level information."""
    
    level: str = Field(..., description="Complexity level")
    name: str = Field(..., description="Display name")
    description: str = Field(..., description="Level description")
    target_audience: str = Field(..., description="Target audience")
    reading_level: str = Field(..., description="Reading level")


class HealthCheckResponse(BaseModel):
    """Health check response."""
    
    status: str = Field(..., description="Service status")
    timestamp: datetime = Field(..., description="Check timestamp")
    version: str = Field(..., description="Service version")
    dependencies: Dict[str, str] = Field(..., description="Dependency status")


class GenerationMetrics(BaseModel):
    """Generation performance metrics."""
    
    generation_time_ms: int = Field(..., description="Generation time in milliseconds")
    token_count_input: Optional[int] = Field(None, description="Input token count")
    token_count_output: Optional[int] = Field(None, description="Output token count")
    api_calls_made: int = Field(default=1, description="Number of API calls made")
    readability_score: Optional[str] = Field(None, description="Readability score")
    medical_accuracy_score: Optional[str] = Field(None, description="Medical accuracy score")
    errors_encountered: List[str] = Field(default_factory=list, description="Errors during generation")
    warnings_generated: List[str] = Field(default_factory=list, description="Warnings during generation")


class MedicalTermTranslation(BaseModel):
    """Medical term translation."""
    
    original_term: str = Field(..., description="Original medical term")
    simplified_term: str = Field(..., description="Simplified translation")
    explanation: str = Field(..., description="Patient-friendly explanation")
    category: Optional[str] = Field(None, description="Medical category")
    confidence_score: float = Field(..., description="Translation confidence")


class ErrorResponse(BaseModel):
    """Error response schema."""
    
    error: str = Field(..., description="Error message")
    type: str = Field(..., description="Error type")
    details: Optional[Dict[str, Any]] = Field(None, description="Additional error details")
    timestamp: datetime = Field(..., description="Error timestamp")