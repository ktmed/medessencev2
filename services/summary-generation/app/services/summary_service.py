"""Main service for generating patient-friendly medical summaries."""

import logging
import uuid
from datetime import datetime
from typing import Dict, List, Optional, Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.exceptions import (
    SummaryNotFoundException,
    LanguageNotSupportedException,
    ComplexityLevelNotSupportedException,
    ValidationException
)
from app.models.summary import PatientSummary, SummaryTemplate, GenerationMetrics
from app.services.openai_service import OpenAIService
from app.services.medical_terminology_service import MedicalTerminologyService
from app.services.template_service import TemplateService
from app.schemas.summary_schemas import (
    SummaryGenerationRequest,
    SummaryResponse,
    SummaryUpdateRequest,
    EmergencyIndicator,
    GlossaryTerm,
    SummaryContent
)
from app.data.cultural_adaptations import get_cultural_adaptation
from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class SummaryService:
    """Service for managing patient-friendly medical summaries."""
    
    def __init__(self):
        """Initialize the summary service."""
        self.openai_service = OpenAIService()
        self.terminology_service = MedicalTerminologyService()
        self.template_service = TemplateService()
        self.supported_languages = settings.SUPPORTED_LANGUAGES
        self.complexity_levels = settings.COMPLEXITY_LEVELS
    
    async def generate_summary(
        self,
        request: SummaryGenerationRequest,
        db: AsyncSession,
        created_by: Optional[str] = None
    ) -> SummaryResponse:
        """Generate a patient-friendly summary from medical report."""
        try:
            # Validate request
            await self._validate_generation_request(request)
            
            logger.info(f"Starting summary generation for language: {request.language}, complexity: {request.complexity_level}")
            
            # Extract medical terms from the original report
            extracted_terms = self.terminology_service.extract_medical_terms(
                request.report_text,
                source_language="de"  # Assuming German source
            )
            
            # Detect emergency conditions if enabled
            emergency_indicators = []
            if request.emergency_detection:
                emergency_conditions = self.terminology_service.detect_emergency_conditions(
                    request.report_text,
                    language="de"
                )
                emergency_indicators = [
                    EmergencyIndicator(
                        keyword=cond["keyword"],
                        urgency_level=cond["urgency_level"],
                        emergency_type=cond["emergency_type"],
                        patient_warning=cond["patient_warning"],
                        immediate_actions=cond["immediate_actions"],
                        confidence_score=cond["confidence_score"]
                    )
                    for cond in emergency_conditions
                ]
            
            # Generate summary using OpenAI
            ai_summary = await self.openai_service.generate_patient_summary(
                medical_report=request.report_text,
                language=request.language,
                complexity_level=request.complexity_level,
                cultural_context=request.cultural_context,
                region=request.region
            )
            
            # Create medical glossary if requested
            glossary_terms = []
            if request.include_glossary:
                # Extract important terms for glossary
                important_terms = [term["original_term"] for term in extracted_terms[:10]]  # Top 10 terms
                glossary_data = self.terminology_service.create_glossary(
                    important_terms,
                    language=request.language,
                    complexity_level=request.complexity_level
                )
                glossary_terms = [
                    GlossaryTerm(
                        term=term_data["term"],
                        definition=term_data["definition"],
                        category=term_data.get("category")
                    )
                    for term_data in glossary_data
                ]
            
            # Get cultural adaptation for disclaimers
            cultural_adaptation = get_cultural_adaptation(request.language, request.region)
            medical_disclaimer = await self.template_service.get_medical_disclaimer(
                request.language,
                cultural_adaptation
            )
            
            # Determine if urgent based on emergency indicators
            is_urgent = any(ei.urgency_level == "critical" for ei in emergency_indicators)
            
            # Create summary content
            summary_content = SummaryContent(
                title=ai_summary.get("title", ""),
                what_was_examined=ai_summary.get("what_was_examined", ""),
                key_findings=ai_summary.get("key_findings", ""),
                what_this_means=ai_summary.get("what_this_means", ""),
                next_steps=ai_summary.get("next_steps", ""),
                when_to_contact_doctor=ai_summary.get("when_to_contact_doctor", ""),
                medical_disclaimer=medical_disclaimer,
                glossary=glossary_terms
            )
            
            # Create database record
            summary_record = PatientSummary(
                id=uuid.uuid4(),
                report_id=request.report_id,
                patient_id=request.patient_id,
                language=request.language,
                complexity_level=request.complexity_level,
                original_report_text=request.report_text,
                medical_findings={"extracted_terms": [term.__dict__ for term in extracted_terms]},
                title=summary_content.title,
                what_was_examined=summary_content.what_was_examined,
                key_findings=summary_content.key_findings,
                what_this_means=summary_content.what_this_means,
                next_steps=summary_content.next_steps,
                when_to_contact_doctor=summary_content.when_to_contact_doctor,
                glossary=[term.__dict__ for term in glossary_terms],
                is_urgent=is_urgent,
                emergency_indicators=[ei.__dict__ for ei in emergency_indicators],
                generation_model=ai_summary.get("generation_metadata", {}).get("model_used", ""),
                generation_time_seconds=ai_summary.get("generation_metadata", {}).get("generation_time_seconds"),
                confidence_score=ai_summary.get("confidence_score", "medium"),
                cultural_context=request.cultural_context,
                region_specific_info={"region": request.region} if request.region else None,
                medical_disclaimer=medical_disclaimer,
                created_by=created_by,
                status="generated"
            )
            
            db.add(summary_record)
            await db.commit()
            await db.refresh(summary_record)
            
            # Create metrics record
            generation_metadata = ai_summary.get("generation_metadata", {})
            if generation_metadata:
                metrics_record = GenerationMetrics(
                    summary_id=summary_record.id,
                    generation_time_ms=int((generation_metadata.get("generation_time_seconds", 0) * 1000)),
                    token_count_input=generation_metadata.get("tokens_input"),
                    token_count_output=generation_metadata.get("tokens_output"),
                    model_used=generation_metadata.get("model_used", ""),
                    readability_score=ai_summary.get("confidence_score", "medium")
                )
                db.add(metrics_record)
                await db.commit()
            
            # Convert to response format
            response = SummaryResponse(
                id=summary_record.id,
                report_id=summary_record.report_id,
                patient_id=summary_record.patient_id,
                language=summary_record.language,
                complexity_level=summary_record.complexity_level,
                content=summary_content,
                is_urgent=summary_record.is_urgent,
                emergency_indicators=emergency_indicators,
                generation_model=summary_record.generation_model,
                generation_time_seconds=summary_record.generation_time_seconds,
                confidence_score=summary_record.confidence_score,
                created_at=summary_record.created_at,
                updated_at=summary_record.updated_at
            )
            
            logger.info(f"Successfully generated summary with ID: {summary_record.id}")
            return response
            
        except Exception as e:
            logger.error(f"Error generating summary: {e}")
            await db.rollback()
            raise
    
    async def get_summary(self, summary_id: UUID, db: AsyncSession) -> SummaryResponse:
        """Retrieve a summary by ID."""
        try:
            # Query summary from database
            query = select(PatientSummary).where(PatientSummary.id == summary_id)
            result = await db.execute(query)
            summary_record = result.scalar_one_or_none()
            
            if not summary_record:
                raise SummaryNotFoundException(str(summary_id))
            
            # Convert emergency indicators
            emergency_indicators = []
            if summary_record.emergency_indicators:
                emergency_indicators = [
                    EmergencyIndicator(**ei) for ei in summary_record.emergency_indicators
                ]
            
            # Convert glossary
            glossary_terms = []
            if summary_record.glossary:
                glossary_terms = [
                    GlossaryTerm(**term) for term in summary_record.glossary
                ]
            
            # Create summary content
            summary_content = SummaryContent(
                title=summary_record.title,
                what_was_examined=summary_record.what_was_examined,
                key_findings=summary_record.key_findings,
                what_this_means=summary_record.what_this_means,
                next_steps=summary_record.next_steps,
                when_to_contact_doctor=summary_record.when_to_contact_doctor,
                medical_disclaimer=summary_record.medical_disclaimer,
                glossary=glossary_terms
            )
            
            response = SummaryResponse(
                id=summary_record.id,
                report_id=summary_record.report_id,
                patient_id=summary_record.patient_id,
                language=summary_record.language,
                complexity_level=summary_record.complexity_level,
                content=summary_content,
                is_urgent=summary_record.is_urgent,
                emergency_indicators=emergency_indicators,
                generation_model=summary_record.generation_model,
                generation_time_seconds=summary_record.generation_time_seconds,
                confidence_score=summary_record.confidence_score,
                created_at=summary_record.created_at,
                updated_at=summary_record.updated_at
            )
            
            logger.info(f"Retrieved summary: {summary_id}")
            return response
            
        except SummaryNotFoundException:
            raise
        except Exception as e:
            logger.error(f"Error retrieving summary {summary_id}: {e}")
            raise
    
    async def update_summary(
        self,
        summary_id: UUID,
        request: SummaryUpdateRequest,
        db: AsyncSession,
        updated_by: Optional[str] = None
    ) -> SummaryResponse:
        """Update an existing summary."""
        try:
            # Get existing summary
            query = select(PatientSummary).where(PatientSummary.id == summary_id)
            result = await db.execute(query)
            summary_record = result.scalar_one_or_none()
            
            if not summary_record:
                raise SummaryNotFoundException(str(summary_id))
            
            # Validate update request
            if request.language and request.language not in self.supported_languages:
                raise LanguageNotSupportedException(request.language)
            
            if request.complexity_level and request.complexity_level not in self.complexity_levels:
                raise ComplexityLevelNotSupportedException(request.complexity_level)
            
            # Update fields
            update_data = {}
            
            if request.content:
                update_data.update({
                    "title": request.content.title,
                    "what_was_examined": request.content.what_was_examined,
                    "key_findings": request.content.key_findings,
                    "what_this_means": request.content.what_this_means,
                    "next_steps": request.content.next_steps,
                    "when_to_contact_doctor": request.content.when_to_contact_doctor,
                    "medical_disclaimer": request.content.medical_disclaimer,
                    "glossary": [term.__dict__ for term in request.content.glossary]
                })
            
            if request.language:
                update_data["language"] = request.language
            
            if request.complexity_level:
                update_data["complexity_level"] = request.complexity_level
            
            if request.status:
                update_data["status"] = request.status
            
            if request.review_notes:
                update_data["review_notes"] = request.review_notes
            
            if updated_by:
                update_data["updated_by"] = updated_by
            
            update_data["updated_at"] = datetime.utcnow()
            
            # Execute update
            await db.execute(
                update(PatientSummary)
                .where(PatientSummary.id == summary_id)
                .values(**update_data)
            )
            await db.commit()
            
            # Return updated summary
            updated_summary = await self.get_summary(summary_id, db)
            logger.info(f"Updated summary: {summary_id}")
            return updated_summary
            
        except (SummaryNotFoundException, LanguageNotSupportedException, ComplexityLevelNotSupportedException):
            raise
        except Exception as e:
            logger.error(f"Error updating summary {summary_id}: {e}")
            await db.rollback()
            raise
    
    async def list_summaries(
        self,
        db: AsyncSession,
        patient_id: Optional[str] = None,
        language: Optional[str] = None,
        complexity_level: Optional[str] = None,
        status: Optional[str] = None,
        page: int = 1,
        page_size: int = 20
    ) -> Dict[str, Any]:
        """List summaries with filtering and pagination."""
        try:
            # Build query
            query = select(PatientSummary)
            
            # Apply filters
            if patient_id:
                query = query.where(PatientSummary.patient_id == patient_id)
            
            if language:
                query = query.where(PatientSummary.language == language)
            
            if complexity_level:
                query = query.where(PatientSummary.complexity_level == complexity_level)
            
            if status:
                query = query.where(PatientSummary.status == status)
            
            # Count total
            from sqlalchemy import func
            count_query = select(func.count(PatientSummary.id))
            if patient_id:
                count_query = count_query.where(PatientSummary.patient_id == patient_id)
            if language:
                count_query = count_query.where(PatientSummary.language == language)
            if complexity_level:
                count_query = count_query.where(PatientSummary.complexity_level == complexity_level)
            if status:
                count_query = count_query.where(PatientSummary.status == status)
            
            total_result = await db.execute(count_query)
            total = total_result.scalar()
            
            # Apply pagination
            offset = (page - 1) * page_size
            query = query.offset(offset).limit(page_size)
            query = query.order_by(PatientSummary.created_at.desc())
            
            # Execute query
            result = await db.execute(query)
            summary_records = result.scalars().all()
            
            # Convert to response format
            summaries = []
            for record in summary_records:
                emergency_indicators = []
                if record.emergency_indicators:
                    emergency_indicators = [
                        EmergencyIndicator(**ei) for ei in record.emergency_indicators
                    ]
                
                glossary_terms = []
                if record.glossary:
                    glossary_terms = [GlossaryTerm(**term) for term in record.glossary]
                
                summary_content = SummaryContent(
                    title=record.title,
                    what_was_examined=record.what_was_examined,
                    key_findings=record.key_findings,
                    what_this_means=record.what_this_means,
                    next_steps=record.next_steps,
                    when_to_contact_doctor=record.when_to_contact_doctor,
                    medical_disclaimer=record.medical_disclaimer,
                    glossary=glossary_terms
                )
                
                summary_response = SummaryResponse(
                    id=record.id,
                    report_id=record.report_id,
                    patient_id=record.patient_id,
                    language=record.language,
                    complexity_level=record.complexity_level,
                    content=summary_content,
                    is_urgent=record.is_urgent,
                    emergency_indicators=emergency_indicators,
                    generation_model=record.generation_model,
                    generation_time_seconds=record.generation_time_seconds,
                    confidence_score=record.confidence_score,
                    created_at=record.created_at,
                    updated_at=record.updated_at
                )
                
                summaries.append(summary_response)
            
            has_next = (offset + page_size) < total
            
            logger.info(f"Listed {len(summaries)} summaries (page {page}, total: {total})")
            
            return {
                "summaries": summaries,
                "total": total,
                "page": page,
                "page_size": page_size,
                "has_next": has_next
            }
            
        except Exception as e:
            logger.error(f"Error listing summaries: {e}")
            raise
    
    async def delete_summary(self, summary_id: UUID, db: AsyncSession) -> bool:
        """Delete a summary (soft delete by updating status)."""
        try:
            # Update status to archived instead of deleting
            result = await db.execute(
                update(PatientSummary)
                .where(PatientSummary.id == summary_id)
                .values(status="archived", updated_at=datetime.utcnow())
            )
            
            if result.rowcount == 0:
                raise SummaryNotFoundException(str(summary_id))
            
            await db.commit()
            logger.info(f"Archived summary: {summary_id}")
            return True
            
        except SummaryNotFoundException:
            raise
        except Exception as e:
            logger.error(f"Error deleting summary {summary_id}: {e}")
            await db.rollback()
            raise
    
    # Private helper methods
    
    async def _validate_generation_request(self, request: SummaryGenerationRequest) -> None:
        """Validate summary generation request."""
        if request.language not in self.supported_languages:
            raise LanguageNotSupportedException(request.language)
        
        if request.complexity_level not in self.complexity_levels:
            raise ComplexityLevelNotSupportedException(request.complexity_level)
        
        if not request.report_text or len(request.report_text.strip()) == 0:
            raise ValidationException("Report text cannot be empty")
        
        if len(request.report_text) > 50000:  # 50KB limit
            raise ValidationException("Report text too long (max 50,000 characters)")
        
        logger.info("Summary generation request validated successfully")