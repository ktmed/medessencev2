"""
Main report generation service that orchestrates all components
"""

import json
import logging
from datetime import datetime
from typing import Dict, Any, List, Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from jinja2 import Environment, BaseLoader

from app.models.report import Report, ReportStatus, ExaminationType, ReportVersion
from app.models.template import ReportTemplate
from app.services.openai_service import openai_service
from app.services.ai_providers import ai_provider_factory
from app.services.medical_terminology_service import medical_terminology_service
from app.core.exceptions import (
    ReportNotFoundException, 
    TemplateNotFoundException,
    ReportAlreadyFinalizedException,
    ValidationException
)
from templates.german_report_templates import TEMPLATES, REPORT_CSS

logger = logging.getLogger(__name__)


class ReportGenerationService:
    """Main service for medical report generation"""
    
    def __init__(self):
        self.jinja_env = Environment(loader=BaseLoader())
        
    async def generate_report(
        self,
        transcription: str,
        examination_type: str,
        clinical_indication: Optional[str],
        patient_id: str,
        examination_date: datetime,
        dictating_physician_id: str,
        dictating_physician_name: str,
        template_id: Optional[UUID],
        db: AsyncSession
    ) -> Dict[str, Any]:
        """Generate a new medical report from transcription"""
        
        try:
            logger.info(f"Starting report generation for patient {patient_id}")
            
            # Get template
            template = await self._get_template(template_id, examination_type, db)
            
            # Generate structured content using AI with fallback support
            try:
                ai_content = await ai_provider_factory.generate_report_with_fallback(
                    transcription=transcription,
                    examination_type=examination_type,
                    clinical_indication=clinical_indication,
                    template=template.template_config if template else None
                )
            except Exception as e:
                logger.error(f"All AI providers failed: {e}")
                # Fallback to original OpenAI service if available
                if openai_service:
                    ai_content = await openai_service.generate_medical_report(
                        transcription=transcription,
                        examination_type=examination_type,
                        clinical_indication=clinical_indication,
                        template_config=template.template_config if template else None
                    )
                else:
                    raise
            
            # Validate medical terminology
            terminology_validation = await medical_terminology_service.validate_medical_terms(
                text=f"{ai_content.get('BEFUND', '')} {ai_content.get('BEURTEILUNG', '')}",
                db=db,
                examination_type=examination_type
            )
            
            # Suggest ICD codes
            icd_codes = await medical_terminology_service.suggest_icd_codes_for_findings(
                findings=ai_content.get('BEFUND', ''),
                examination_type=examination_type,
                db=db
            )
            
            # Check quality
            quality_check = await openai_service.check_report_quality(
                report_content=json.dumps(ai_content, ensure_ascii=False)
            )
            
            # Create report record
            report = Report(
                patient_id=patient_id,
                examination_date=examination_date,
                examination_type=ExaminationType(examination_type),
                clinical_indication=clinical_indication,
                findings=ai_content.get('BEFUND', ''),
                assessment=ai_content.get('BEURTEILUNG', ''),
                recommendations=ai_content.get('EMPFEHLUNGEN', ''),
                original_transcription=transcription,
                structured_content=ai_content,
                confidence_score=int(terminology_validation['confidence_score'] * 100),
                icd_codes=icd_codes,
                template_id=template.id if template else None,
                dictating_physician_id=dictating_physician_id,
                dictating_physician_name=dictating_physician_name,
                quality_score=quality_check.get('overall_score', 0),
                compliance_flags=self._check_compliance(ai_content),
                technical_parameters=ai_content.get('TECHNISCHE_PARAMETER', {}),
                audit_trail=[{
                    "action": "created",
                    "timestamp": datetime.utcnow().isoformat(),
                    "user": dictating_physician_id,
                    "details": "Report generated from transcription"
                }]
            )
            
            db.add(report)
            await db.commit()
            await db.refresh(report)
            
            # Create initial version
            await self._create_report_version(report, "Initial generation", dictating_physician_id, db)
            
            logger.info(f"Report generated successfully with ID: {report.id}")
            
            return {
                "report_id": str(report.id),
                "status": report.status.value,
                "confidence_score": report.confidence_score,
                "quality_score": report.quality_score,
                "terminology_validation": terminology_validation,
                "suggested_icd_codes": icd_codes,
                "quality_assessment": quality_check,
                "compliance_flags": report.compliance_flags
            }
            
        except Exception as e:
            logger.error(f"Error generating report: {e}")
            await db.rollback()
            raise
    
    async def get_report(
        self,
        report_id: UUID,
        db: AsyncSession,
        include_html: bool = False
    ) -> Dict[str, Any]:
        """Retrieve a report by ID"""
        
        try:
            query = select(Report).where(Report.id == report_id)
            result = await db.execute(query)
            report = result.scalar_one_or_none()
            
            if not report:
                raise ReportNotFoundException(str(report_id))
            
            report_data = {
                "id": str(report.id),
                "patient_id": report.patient_id,
                "examination_date": report.examination_date.isoformat(),
                "examination_type": report.examination_type.value,
                "clinical_indication": report.clinical_indication,
                "findings": report.findings,
                "assessment": report.assessment,
                "recommendations": report.recommendations,
                "status": report.status.value,
                "version": report.version,
                "confidence_score": report.confidence_score,
                "quality_score": report.quality_score,
                "icd_codes": report.icd_codes,
                "dictating_physician_name": report.dictating_physician_name,
                "reviewing_physician_name": report.reviewing_physician_name,
                "created_at": report.created_at.isoformat(),
                "updated_at": report.updated_at.isoformat(),
                "finalized_at": report.finalized_at.isoformat() if report.finalized_at else None,
                "compliance_flags": report.compliance_flags,
                "audit_trail": report.audit_trail
            }
            
            if include_html:
                html_content = await self._generate_html_report(report, db)
                report_data["html_content"] = html_content
            
            return report_data
            
        except ReportNotFoundException:
            raise
        except Exception as e:
            logger.error(f"Error retrieving report {report_id}: {e}")
            raise
    
    async def update_report(
        self,
        report_id: UUID,
        updates: Dict[str, Any],
        user_id: str,
        user_name: str,
        db: AsyncSession
    ) -> Dict[str, Any]:
        """Update a report"""
        
        try:
            # Get existing report
            query = select(Report).where(Report.id == report_id)
            result = await db.execute(query)
            report = result.scalar_one_or_none()
            
            if not report:
                raise ReportNotFoundException(str(report_id))
            
            if report.status == ReportStatus.FINALIZED:
                raise ReportAlreadyFinalizedException(str(report_id))
            
            # Store original content for version history
            original_content = {
                "findings": report.findings,
                "assessment": report.assessment,
                "recommendations": report.recommendations,
                "clinical_indication": report.clinical_indication
            }
            
            # Apply updates
            updated_fields = []
            if "findings" in updates:
                report.findings = updates["findings"]
                updated_fields.append("findings")
            
            if "assessment" in updates:
                report.assessment = updates["assessment"]
                updated_fields.append("assessment")
            
            if "recommendations" in updates:
                report.recommendations = updates["recommendations"]
                updated_fields.append("recommendations")
            
            if "clinical_indication" in updates:
                report.clinical_indication = updates["clinical_indication"]
                updated_fields.append("clinical_indication")
            
            # Update technical parameters if provided
            if "technical_parameters" in updates:
                report.technical_parameters = updates["technical_parameters"]
                updated_fields.append("technical_parameters")
            
            # Re-validate terminology if content changed
            if any(field in updated_fields for field in ["findings", "assessment"]):
                combined_text = f"{report.findings} {report.assessment}"
                terminology_validation = await medical_terminology_service.validate_medical_terms(
                    text=combined_text,
                    db=db,
                    examination_type=report.examination_type.value
                )
                report.confidence_score = int(terminology_validation['confidence_score'] * 100)
                
                # Re-check quality
                quality_check = await openai_service.check_report_quality(combined_text)
                report.quality_score = quality_check.get('overall_score', 0)
            
            # Update version and timestamps
            report.version += 1
            report.updated_at = datetime.utcnow()
            
            # Add to audit trail
            if not report.audit_trail:
                report.audit_trail = []
            
            report.audit_trail.append({
                "action": "updated",
                "timestamp": datetime.utcnow().isoformat(),
                "user": user_id,
                "user_name": user_name,
                "fields_updated": updated_fields,
                "details": updates.get("change_reason", "Manual update")
            })
            
            await db.commit()
            await db.refresh(report)
            
            # Create version history entry
            change_summary = f"Updated fields: {', '.join(updated_fields)}"
            await self._create_report_version(
                report, change_summary, user_id, db, original_content
            )
            
            logger.info(f"Report {report_id} updated successfully")
            
            return {
                "report_id": str(report.id),
                "version": report.version,
                "updated_fields": updated_fields,
                "confidence_score": report.confidence_score,
                "quality_score": report.quality_score
            }
            
        except (ReportNotFoundException, ReportAlreadyFinalizedException):
            raise
        except Exception as e:
            logger.error(f"Error updating report {report_id}: {e}")
            await db.rollback()
            raise
    
    async def finalize_report(
        self,
        report_id: UUID,
        reviewing_physician_id: str,
        reviewing_physician_name: str,
        digital_signature: Optional[str],
        db: AsyncSession
    ) -> Dict[str, Any]:
        """Finalize and sign a report"""
        
        try:
            # Get report
            query = select(Report).where(Report.id == report_id)
            result = await db.execute(query)
            report = result.scalar_one_or_none()
            
            if not report:
                raise ReportNotFoundException(str(report_id))
            
            if report.status == ReportStatus.FINALIZED:
                raise ReportAlreadyFinalizedException(str(report_id))
            
            # Perform final quality and compliance checks
            final_validation = await self._perform_final_validation(report, db)
            
            if not final_validation["is_valid"]:
                raise ValidationException(f"Report validation failed: {final_validation['issues']}")
            
            # Update report status
            report.status = ReportStatus.FINALIZED
            report.reviewing_physician_id = reviewing_physician_id
            report.reviewing_physician_name = reviewing_physician_name
            report.review_signature = digital_signature
            report.finalized_at = datetime.utcnow()
            report.reviewed_at = datetime.utcnow()
            
            # Add to audit trail
            if not report.audit_trail:
                report.audit_trail = []
            
            report.audit_trail.append({
                "action": "finalized",
                "timestamp": datetime.utcnow().isoformat(),
                "user": reviewing_physician_id,
                "user_name": reviewing_physician_name,
                "details": "Report finalized and signed"
            })
            
            await db.commit()
            await db.refresh(report)
            
            logger.info(f"Report {report_id} finalized successfully")
            
            return {
                "report_id": str(report.id),
                "status": report.status.value,
                "finalized_at": report.finalized_at.isoformat(),
                "reviewing_physician": reviewing_physician_name,
                "validation_results": final_validation
            }
            
        except (ReportNotFoundException, ReportAlreadyFinalizedException, ValidationException):
            raise
        except Exception as e:
            logger.error(f"Error finalizing report {report_id}: {e}")
            await db.rollback()
            raise
    
    async def _get_template(
        self,
        template_id: Optional[UUID],
        examination_type: str,
        db: AsyncSession
    ) -> Optional[ReportTemplate]:
        """Get report template"""
        
        if template_id:
            query = select(ReportTemplate).where(ReportTemplate.id == template_id)
            result = await db.execute(query)
            template = result.scalar_one_or_none()
            
            if not template:
                raise TemplateNotFoundException(str(template_id))
            
            return template
        else:
            # Get default template for examination type
            query = select(ReportTemplate).where(
                ReportTemplate.examination_type == ExaminationType(examination_type),
                ReportTemplate.is_default == True,
                ReportTemplate.is_active == True
            )
            result = await db.execute(query)
            return result.scalar_one_or_none()
    
    async def _generate_html_report(
        self,
        report: Report,
        db: AsyncSession
    ) -> str:
        """Generate HTML version of the report"""
        
        try:
            # Get template
            template_data = TEMPLATES.get(report.examination_type.value, TEMPLATES["Standard"])
            
            # Prepare context
            context = {
                "clinic_name": "Radiologische Allianz",
                "patient_name": "Anonymisiert",
                "patient_dob": "xx.xx.xxxx",
                "examination_date": report.examination_date,
                "examination_type": report.examination_type.value,
                "report_id": str(report.id),
                "clinical_indication": report.clinical_indication,
                "technical_parameters": report.technical_parameters or {},
                "findings": report.findings,
                "assessment": report.assessment,
                "recommendations": report.recommendations,
                "icd_codes": report.icd_codes or [],
                "dictating_physician_name": report.dictating_physician_name,
                "reviewing_physician_name": report.reviewing_physician_name,
                "dictated_at": report.created_at,
                "reviewed_at": report.reviewed_at,
                "created_at": report.created_at,
                "version": report.version,
                "dictation_signature": report.dictation_signature,
                "review_signature": report.review_signature
            }
            
            # Render sections
            html_sections = []
            
            # Add CSS
            html_sections.append(REPORT_CSS)
            html_sections.append('<div class="report-container">')
            
            # Render each section
            for section_name, section_template in template_data.items():
                template = self.jinja_env.from_string(section_template)
                rendered_section = template.render(**context)
                html_sections.append(rendered_section)
            
            html_sections.append('</div>')
            
            return '\n'.join(html_sections)
            
        except Exception as e:
            logger.error(f"Error generating HTML report: {e}")
            return f"<p>Error generating report: {str(e)}</p>"
    
    async def _create_report_version(
        self,
        report: Report,
        change_summary: str,
        user_id: str,
        db: AsyncSession,
        content_snapshot: Optional[Dict[str, Any]] = None
    ):
        """Create a version history entry"""
        
        try:
            if content_snapshot is None:
                content_snapshot = {
                    "findings": report.findings,
                    "assessment": report.assessment,
                    "recommendations": report.recommendations,
                    "clinical_indication": report.clinical_indication,
                    "technical_parameters": report.technical_parameters,
                    "structured_content": report.structured_content
                }
            
            version = ReportVersion(
                report_id=report.id,
                version_number=report.version,
                content_snapshot=content_snapshot,
                changes_summary=change_summary,
                created_by=user_id
            )
            
            db.add(version)
            await db.commit()
            
        except Exception as e:
            logger.error(f"Error creating report version: {e}")
    
    def _check_compliance(self, content: Dict[str, Any]) -> List[str]:
        """Check medical compliance requirements"""
        
        flags = []
        
        # Check for required sections
        required_sections = ["BEFUND", "BEURTEILUNG"]
        for section in required_sections:
            if not content.get(section):
                flags.append(f"Missing required section: {section}")
        
        # Check for minimum content length
        findings = content.get("BEFUND", "")
        if len(findings) < 50:
            flags.append("Findings section too brief")
        
        assessment = content.get("BEURTEILUNG", "")
        if len(assessment) < 30:
            flags.append("Assessment section too brief")
        
        return flags
    
    async def _perform_final_validation(
        self,
        report: Report,
        db: AsyncSession
    ) -> Dict[str, Any]:
        """Perform final validation before finalization"""
        
        try:
            issues = []
            
            # Check required fields
            if not report.findings:
                issues.append("Missing findings")
            
            if not report.assessment:
                issues.append("Missing assessment")
            
            if not report.dictating_physician_name:
                issues.append("Missing dictating physician")
            
            # Validate medical terminology
            combined_text = f"{report.findings} {report.assessment}"
            terminology_validation = await medical_terminology_service.validate_medical_terms(
                text=combined_text,
                db=db,
                examination_type=report.examination_type.value
            )
            
            if not terminology_validation["is_valid"]:
                issues.extend([f"Terminology issue: {term}" for term in terminology_validation["invalid_terms"]])
            
            # Check compliance flags
            if report.compliance_flags:
                issues.extend(report.compliance_flags)
            
            # Check quality score
            if report.quality_score < 70:
                issues.append(f"Quality score too low: {report.quality_score}")
            
            return {
                "is_valid": len(issues) == 0,
                "issues": issues,
                "terminology_validation": terminology_validation,
                "quality_score": report.quality_score
            }
            
        except Exception as e:
            logger.error(f"Error in final validation: {e}")
            return {
                "is_valid": False,
                "issues": [f"Validation error: {str(e)}"],
                "terminology_validation": {},
                "quality_score": 0
            }


# Global instance
report_service = ReportGenerationService()