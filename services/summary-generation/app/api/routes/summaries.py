"""Summary generation and management endpoints."""

import logging
from typing import Optional, List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.exceptions import (
    SummaryNotFoundException,
    LanguageNotSupportedException,
    ComplexityLevelNotSupportedException,
    ValidationException,
    OpenAIServiceException
)
from app.services.summary_service import SummaryService
from app.schemas.summary_schemas import (
    SummaryGenerationRequest,
    SummaryResponse,
    SummaryUpdateRequest,
    SummaryListResponse,
    SummaryFeedbackRequest,
    ErrorResponse
)

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/generate-summary", response_model=SummaryResponse)
async def generate_summary(
    request: SummaryGenerationRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    summary_service: SummaryService = Depends(lambda: SummaryService())
) -> SummaryResponse:
    """
    Generate a patient-friendly summary from a medical report.
    
    This endpoint converts complex German medical reports into clear, 
    understandable summaries in the requested language and complexity level.
    
    - **report_text**: The original German medical report text
    - **language**: Target language (de, en, fr, es, it, tr)
    - **complexity_level**: Target complexity (basic, intermediate, advanced)
    - **cultural_context**: Cultural adaptation context (optional)
    - **region**: Regional adaptation (optional)
    - **include_glossary**: Include medical terms glossary
    - **emergency_detection**: Enable emergency condition detection
    """
    try:
        logger.info(f"Generating summary for language: {request.language}, complexity: {request.complexity_level}")
        
        summary = await summary_service.generate_summary(
            request=request,
            db=db,
            created_by="api_user"  # In production, get from auth
        )
        
        # Add background task for analytics/metrics
        # background_tasks.add_task(log_summary_generation, summary.id)
        
        return summary
        
    except (LanguageNotSupportedException, ComplexityLevelNotSupportedException, ValidationException) as e:
        logger.warning(f"Validation error in summary generation: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except OpenAIServiceException as e:
        logger.error(f"OpenAI service error: {e}")
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error in summary generation: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/summaries/{summary_id}", response_model=SummaryResponse)
async def get_summary(
    summary_id: UUID,
    db: AsyncSession = Depends(get_db),
    summary_service: SummaryService = Depends(lambda: SummaryService())
) -> SummaryResponse:
    """
    Retrieve a specific summary by ID.
    
    Returns the complete summary including content, metadata, and any emergency indicators.
    """
    try:
        summary = await summary_service.get_summary(summary_id, db)
        return summary
        
    except SummaryNotFoundException as e:
        logger.warning(f"Summary not found: {summary_id}")
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error retrieving summary {summary_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.put("/summaries/{summary_id}", response_model=SummaryResponse)
async def update_summary(
    summary_id: UUID,
    request: SummaryUpdateRequest,
    db: AsyncSession = Depends(get_db),
    summary_service: SummaryService = Depends(lambda: SummaryService())
) -> SummaryResponse:
    """
    Update an existing summary.
    
    Allows updating summary content, language, complexity level, status, and review notes.
    """
    try:
        updated_summary = await summary_service.update_summary(
            summary_id=summary_id,
            request=request,
            db=db,
            updated_by="api_user"  # In production, get from auth
        )
        
        return updated_summary
        
    except SummaryNotFoundException as e:
        logger.warning(f"Summary not found for update: {summary_id}")
        raise HTTPException(status_code=404, detail=str(e))
    except (LanguageNotSupportedException, ComplexityLevelNotSupportedException) as e:
        logger.warning(f"Validation error in summary update: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating summary {summary_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/summaries", response_model=SummaryListResponse)
async def list_summaries(
    patient_id: Optional[str] = Query(None, description="Filter by patient ID"),
    language: Optional[str] = Query(None, description="Filter by language"),
    complexity_level: Optional[str] = Query(None, description="Filter by complexity level"),
    status: Optional[str] = Query(None, description="Filter by status"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    db: AsyncSession = Depends(get_db),
    summary_service: SummaryService = Depends(lambda: SummaryService())
) -> SummaryListResponse:
    """
    List summaries with filtering and pagination.
    
    Supports filtering by patient ID, language, complexity level, and status.
    Results are paginated with configurable page size.
    """
    try:
        result = await summary_service.list_summaries(
            db=db,
            patient_id=patient_id,
            language=language,
            complexity_level=complexity_level,
            status=status,
            page=page,
            page_size=page_size
        )
        
        return SummaryListResponse(**result)
        
    except Exception as e:
        logger.error(f"Error listing summaries: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.delete("/summaries/{summary_id}")
async def delete_summary(
    summary_id: UUID,
    db: AsyncSession = Depends(get_db),
    summary_service: SummaryService = Depends(lambda: SummaryService())
) -> dict:
    """
    Delete (archive) a summary.
    
    Performs a soft delete by updating the summary status to 'archived'.
    """
    try:
        success = await summary_service.delete_summary(summary_id, db)
        
        if success:
            return {"message": "Summary archived successfully"}
        else:
            raise HTTPException(status_code=500, detail="Failed to archive summary")
            
    except SummaryNotFoundException as e:
        logger.warning(f"Summary not found for deletion: {summary_id}")
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error deleting summary {summary_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/summaries/{summary_id}/feedback")
async def submit_feedback(
    summary_id: UUID,
    feedback: SummaryFeedbackRequest,
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Submit feedback for a summary.
    
    Allows patients to provide ratings and comments about summary quality.
    """
    try:
        # Verify summary exists
        summary_service = SummaryService()
        await summary_service.get_summary(summary_id, db)
        
        # In a full implementation, this would save feedback to database
        # For now, just log it
        logger.info(f"Received feedback for summary {summary_id}: {feedback.dict()}")
        
        return {"message": "Feedback submitted successfully"}
        
    except SummaryNotFoundException as e:
        logger.warning(f"Summary not found for feedback: {summary_id}")
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error submitting feedback for summary {summary_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/summaries/{summary_id}/export")
async def export_summary(
    summary_id: UUID,
    format: str = Query("pdf", description="Export format: pdf, docx, html"),
    db: AsyncSession = Depends(get_db),
    summary_service: SummaryService = Depends(lambda: SummaryService())
):
    """
    Export summary in various formats.
    
    Supports PDF, DOCX, and HTML export formats.
    """
    try:
        summary = await summary_service.get_summary(summary_id, db)
        
        # In a full implementation, this would generate the requested format
        # For now, return JSON with a message
        return {
            "message": f"Export functionality for {format} format will be implemented",
            "summary_id": str(summary_id),
            "available_formats": ["pdf", "docx", "html"]
        }
        
    except SummaryNotFoundException as e:
        logger.warning(f"Summary not found for export: {summary_id}")
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error exporting summary {summary_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# Utility endpoints for development/debugging

@router.get("/summaries/{summary_id}/raw")
async def get_raw_summary(
    summary_id: UUID,
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    Get raw summary data for debugging purposes.
    
    Returns the complete database record including all metadata.
    Only available in debug mode.
    """
    try:
        from app.core.config import get_settings
        settings = get_settings()
        
        if not settings.DEBUG:
            raise HTTPException(status_code=404, detail="Endpoint not available")
        
        from sqlalchemy import select
        from app.models.summary import PatientSummary
        
        query = select(PatientSummary).where(PatientSummary.id == summary_id)
        result = await db.execute(query)
        summary_record = result.scalar_one_or_none()
        
        if not summary_record:
            raise HTTPException(status_code=404, detail="Summary not found")
        
        # Convert to dict for JSON serialization
        return {
            "id": str(summary_record.id),
            "report_id": summary_record.report_id,
            "patient_id": summary_record.patient_id,
            "language": summary_record.language,
            "complexity_level": summary_record.complexity_level,
            "original_report_text": summary_record.original_report_text,
            "medical_findings": summary_record.medical_findings,
            "is_urgent": summary_record.is_urgent,
            "emergency_indicators": summary_record.emergency_indicators,
            "generation_model": summary_record.generation_model,
            "generation_time_seconds": summary_record.generation_time_seconds,
            "confidence_score": summary_record.confidence_score,
            "cultural_context": summary_record.cultural_context,
            "region_specific_info": summary_record.region_specific_info,
            "status": summary_record.status,
            "created_at": summary_record.created_at.isoformat() if summary_record.created_at else None,
            "updated_at": summary_record.updated_at.isoformat() if summary_record.updated_at else None,
            "created_by": summary_record.created_by,
            "updated_by": summary_record.updated_by
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting raw summary {summary_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")