"""
API routes for report management
"""

import logging
from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.services.report_service import report_service
from app.schemas.report_schemas import (
    ReportGenerationRequest,
    ReportGenerationResponse,
    ReportResponse,
    ReportUpdateRequest,
    ReportUpdateResponse,
    ReportFinalizationRequest,
    ReportFinalizationResponse,
    ReportListResponse,
    ErrorResponse
)
from app.core.exceptions import (
    ReportNotFoundException,
    ReportAlreadyFinalizedException,
    ValidationException,
    MedicalReportException
)

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post(
    "/generate",
    response_model=ReportGenerationResponse,
    status_code=201,
    summary="Generate medical report from transcription",
    description="Generate a structured German medical report from transcribed dictation text"
)
async def generate_report(
    request: ReportGenerationRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """Generate a new medical report from transcription"""
    
    try:
        logger.info(f"Generating report for patient {request.patient_id}")
        
        result = await report_service.generate_report(
            transcription=request.transcription,
            examination_type=request.examination_type.value,
            clinical_indication=request.clinical_indication,
            patient_id=request.patient_id,
            examination_date=request.examination_date,
            dictating_physician_id=request.dictating_physician_id,
            dictating_physician_name=request.dictating_physician_name,
            template_id=request.template_id,
            db=db
        )
        
        # Add background task for post-processing (e.g., notifications, analytics)
        background_tasks.add_task(
            _log_report_generation,
            result["report_id"],
            request.patient_id,
            request.examination_type.value
        )
        
        return ReportGenerationResponse(**result)
        
    except ValidationException as e:
        logger.warning(f"Validation error in report generation: {e.message}")
        raise HTTPException(status_code=400, detail=e.message)
    except MedicalReportException as e:
        logger.error(f"Medical report error: {e.message}")
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        logger.error(f"Unexpected error generating report: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get(
    "/{report_id}",
    response_model=ReportResponse,
    summary="Retrieve medical report",
    description="Retrieve a medical report by ID with optional HTML formatting"
)
async def get_report(
    report_id: UUID,
    include_html: bool = Query(False, description="Include HTML formatted content"),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve a specific medical report"""
    
    try:
        result = await report_service.get_report(
            report_id=report_id,
            db=db,
            include_html=include_html
        )
        
        return ReportResponse(**result)
        
    except ReportNotFoundException as e:
        logger.warning(f"Report not found: {report_id}")
        raise HTTPException(status_code=404, detail=e.message)
    except Exception as e:
        logger.error(f"Error retrieving report {report_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.put(
    "/{report_id}",
    response_model=ReportUpdateResponse,
    summary="Update medical report",
    description="Update content of a medical report (only allowed for non-finalized reports)"
)
async def update_report(
    report_id: UUID,
    request: ReportUpdateRequest,
    user_id: str = Query(..., description="ID of user making the update"),
    user_name: str = Query(..., description="Name of user making the update"),
    db: AsyncSession = Depends(get_db)
):
    """Update a medical report"""
    
    try:
        # Convert request to dict, excluding None values
        updates = request.dict(exclude_none=True)
        
        if not updates:
            raise HTTPException(status_code=400, detail="No valid updates provided")
        
        result = await report_service.update_report(
            report_id=report_id,
            updates=updates,
            user_id=user_id,
            user_name=user_name,
            db=db
        )
        
        return ReportUpdateResponse(**result)
        
    except ReportNotFoundException as e:
        logger.warning(f"Report not found for update: {report_id}")
        raise HTTPException(status_code=404, detail=e.message)
    except ReportAlreadyFinalizedException as e:
        logger.warning(f"Attempt to update finalized report: {report_id}")
        raise HTTPException(status_code=409, detail=e.message)
    except ValidationException as e:
        logger.warning(f"Validation error in report update: {e.message}")
        raise HTTPException(status_code=400, detail=e.message)
    except Exception as e:
        logger.error(f"Error updating report {report_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post(
    "/{report_id}/finalize",
    response_model=ReportFinalizationResponse,
    summary="Finalize medical report",
    description="Finalize and digitally sign a medical report"
)
async def finalize_report(
    report_id: UUID,
    request: ReportFinalizationRequest,
    db: AsyncSession = Depends(get_db)
):
    """Finalize and sign a medical report"""
    
    try:
        result = await report_service.finalize_report(
            report_id=report_id,
            reviewing_physician_id=request.reviewing_physician_id,
            reviewing_physician_name=request.reviewing_physician_name,
            digital_signature=request.digital_signature,
            db=db
        )
        
        return ReportFinalizationResponse(**result)
        
    except ReportNotFoundException as e:
        logger.warning(f"Report not found for finalization: {report_id}")
        raise HTTPException(status_code=404, detail=e.message)
    except ReportAlreadyFinalizedException as e:
        logger.warning(f"Report already finalized: {report_id}")
        raise HTTPException(status_code=409, detail=e.message)
    except ValidationException as e:
        logger.warning(f"Validation failed for report finalization: {e.message}")
        raise HTTPException(status_code=422, detail=e.message)
    except Exception as e:
        logger.error(f"Error finalizing report {report_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get(
    "/",
    response_model=ReportListResponse,
    summary="List medical reports",
    description="List medical reports with optional filtering"
)
async def list_reports(
    patient_id: Optional[str] = Query(None, description="Filter by patient ID"),
    examination_type: Optional[str] = Query(None, description="Filter by examination type"),
    status: Optional[str] = Query(None, description="Filter by report status"),
    physician_id: Optional[str] = Query(None, description="Filter by physician ID"),
    date_from: Optional[str] = Query(None, description="Filter by date range (ISO format)"),
    date_to: Optional[str] = Query(None, description="Filter by date range (ISO format)"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Page size"),
    db: AsyncSession = Depends(get_db)
):
    """List medical reports with filtering and pagination"""
    
    try:
        # This would be implemented with proper filtering logic
        # For now, return a placeholder response
        return ReportListResponse(
            reports=[],
            total_count=0,
            page=page,
            page_size=page_size,
            has_next=False
        )
        
    except Exception as e:
        logger.error(f"Error listing reports: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get(
    "/{report_id}/versions",
    summary="Get report version history",
    description="Retrieve version history for a medical report"
)
async def get_report_versions(
    report_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """Get version history for a report"""
    
    try:
        # This would be implemented with proper version retrieval logic
        return {"message": "Version history retrieval not yet implemented"}
        
    except Exception as e:
        logger.error(f"Error retrieving report versions: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get(
    "/{report_id}/audit",
    summary="Get report audit trail",
    description="Retrieve audit trail for a medical report"
)
async def get_report_audit_trail(
    report_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """Get audit trail for a report"""
    
    try:
        report_data = await report_service.get_report(
            report_id=report_id,
            db=db,
            include_html=False
        )
        
        return {
            "report_id": str(report_id),
            "audit_trail": report_data.get("audit_trail", [])
        }
        
    except ReportNotFoundException as e:
        raise HTTPException(status_code=404, detail=e.message)
    except Exception as e:
        logger.error(f"Error retrieving audit trail: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post(
    "/{report_id}/validate",
    summary="Validate report content",
    description="Validate medical terminology and content quality"
)
async def validate_report_content(
    report_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """Validate report content for medical accuracy and quality"""
    
    try:
        # This would implement comprehensive content validation
        return {"message": "Content validation not yet implemented"}
        
    except Exception as e:
        logger.error(f"Error validating report content: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


async def _log_report_generation(report_id: str, patient_id: str, examination_type: str):
    """Background task to log report generation for analytics"""
    
    try:
        logger.info(f"Report generated: ID={report_id}, Patient={patient_id}, Type={examination_type}")
        # Here you could add analytics tracking, notifications, etc.
        
    except Exception as e:
        logger.error(f"Error in background task: {e}")