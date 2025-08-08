"""
Medical compliance and regulatory service
Handles GDPR, HIPAA, and German medical regulations
"""

import logging
import hashlib
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from uuid import UUID

from app.models.report import Report, ReportStatus
from app.models.medical_data import QualityMetric
from app.core.config import get_settings
from app.core.exceptions import ComplianceException

logger = logging.getLogger(__name__)
settings = get_settings()


class MedicalComplianceService:
    """Service for handling medical compliance requirements"""
    
    def __init__(self):
        self.gdpr_enabled = True
        self.hipaa_enabled = True
        self.data_retention_days = settings.DATA_RETENTION_DAYS
        
        # German medical compliance requirements
        self.german_medical_requirements = {
            "physician_signature_required": settings.REQUIRE_PHYSICIAN_SIGNATURE,
            "audit_trail_required": settings.ENABLE_AUDIT_LOGGING,
            "data_retention_years": 7,  # German medical law requirement
            "anonymization_required": True,
            "quality_assurance_required": True
        }
    
    async def validate_report_compliance(
        self,
        report: Report,
        db: AsyncSession
    ) -> Dict[str, Any]:
        """Validate report against medical compliance requirements"""
        
        try:
            compliance_issues = []
            compliance_score = 100
            
            # Check physician signature requirement
            if self.german_medical_requirements["physician_signature_required"]:
                if not report.dictating_physician_name:
                    compliance_issues.append("Missing dictating physician signature")
                    compliance_score -= 20
                
                if report.status == ReportStatus.FINALIZED and not report.reviewing_physician_name:
                    compliance_issues.append("Missing reviewing physician signature for finalized report")
                    compliance_score -= 25
            
            # Check audit trail
            if self.german_medical_requirements["audit_trail_required"]:
                if not report.audit_trail or len(report.audit_trail) == 0:
                    compliance_issues.append("Missing audit trail")
                    compliance_score -= 15
            
            # Check minimum content requirements
            content_issues = await self._validate_content_completeness(report)
            compliance_issues.extend(content_issues)
            compliance_score -= len(content_issues) * 5
            
            # Check quality requirements
            if self.german_medical_requirements["quality_assurance_required"]:
                if not report.quality_score or report.quality_score < 70:
                    compliance_issues.append("Quality score below minimum threshold")
                    compliance_score -= 10
            
            # Check data protection compliance
            privacy_issues = await self._validate_privacy_compliance(report)
            compliance_issues.extend(privacy_issues)
            compliance_score -= len(privacy_issues) * 10
            
            # Ensure score doesn't go below 0
            compliance_score = max(0, compliance_score)
            
            return {
                "is_compliant": len(compliance_issues) == 0,
                "compliance_score": compliance_score,
                "issues": compliance_issues,
                "requirements_checked": [
                    "Physician signatures",
                    "Audit trail",
                    "Content completeness",
                    "Quality assurance",
                    "Data protection"
                ],
                "regulations": ["German Medical Device Law", "GDPR", "German Medical Professional Code"]
            }
            
        except Exception as e:
            logger.error(f"Error validating compliance: {e}")
            raise ComplianceException(f"Compliance validation failed: {str(e)}")
    
    async def anonymize_patient_data(
        self,
        report_id: UUID,
        reason: str,
        user_id: str,
        db: AsyncSession
    ) -> Dict[str, Any]:
        """Anonymize patient data in report for GDPR compliance"""
        
        try:
            # Get report
            query = select(Report).where(Report.id == report_id)
            result = await db.execute(query)
            report = result.scalar_one_or_none()
            
            if not report:
                raise ComplianceException(f"Report {report_id} not found")
            
            # Create anonymized patient ID
            original_patient_id = report.patient_id
            anonymized_id = f"ANON_{hashlib.sha256(original_patient_id.encode()).hexdigest()[:12]}"
            
            # Update report with anonymized data
            report.patient_id = anonymized_id
            
            # Add to audit trail
            if not report.audit_trail:
                report.audit_trail = []
            
            report.audit_trail.append({
                "action": "anonymized",
                "timestamp": datetime.utcnow().isoformat(),
                "user": user_id,
                "reason": reason,
                "original_patient_id_hash": hashlib.sha256(original_patient_id.encode()).hexdigest(),
                "anonymized_id": anonymized_id
            })
            
            await db.commit()
            
            logger.info(f"Patient data anonymized for report {report_id}")
            
            return {
                "report_id": str(report_id),
                "anonymized_patient_id": anonymized_id,
                "anonymization_timestamp": datetime.utcnow().isoformat(),
                "reason": reason,
                "compliance_status": "anonymized"
            }
            
        except Exception as e:
            logger.error(f"Error anonymizing patient data: {e}")
            await db.rollback()
            raise ComplianceException(f"Anonymization failed: {str(e)}")
    
    async def perform_data_retention_cleanup(
        self,
        db: AsyncSession,
        dry_run: bool = True
    ) -> Dict[str, Any]:
        """Perform data retention cleanup according to regulations"""
        
        try:
            retention_date = datetime.utcnow() - timedelta(days=self.data_retention_days)
            
            # Find reports older than retention period
            query = select(Report).where(
                Report.created_at < retention_date,
                Report.status == ReportStatus.ARCHIVED
            )
            result = await db.execute(query)
            old_reports = result.scalars().all()
            
            cleanup_summary = {
                "retention_date": retention_date.isoformat(),
                "reports_found": len(old_reports),
                "reports_to_delete": [],
                "dry_run": dry_run
            }
            
            for report in old_reports:
                report_info = {
                    "report_id": str(report.id),
                    "patient_id": report.patient_id,
                    "created_at": report.created_at.isoformat(),
                    "examination_type": report.examination_type.value,
                    "age_days": (datetime.utcnow() - report.created_at).days
                }
                cleanup_summary["reports_to_delete"].append(report_info)
                
                if not dry_run:
                    # Log deletion in quality metrics before deleting
                    deletion_metric = QualityMetric(
                        metric_name="data_retention_deletion",
                        metric_type="compliance",
                        score=100,
                        report_id=report.id,
                        details={
                            "retention_policy": "7_years",
                            "deletion_reason": "data_retention_policy",
                            "original_creation_date": report.created_at.isoformat()
                        },
                        measured_by="system"
                    )
                    db.add(deletion_metric)
                    
                    # Delete the report (cascade will handle related records)
                    await db.delete(report)
            
            if not dry_run:
                await db.commit()
                logger.info(f"Data retention cleanup completed: {len(old_reports)} reports deleted")
            else:
                logger.info(f"Data retention cleanup dry run: {len(old_reports)} reports would be deleted")
            
            return cleanup_summary
            
        except Exception as e:
            logger.error(f"Error in data retention cleanup: {e}")
            if not dry_run:
                await db.rollback()
            raise ComplianceException(f"Data retention cleanup failed: {str(e)}")
    
    async def generate_compliance_report(
        self,
        start_date: datetime,
        end_date: datetime,
        db: AsyncSession
    ) -> Dict[str, Any]:
        """Generate compliance report for audit purposes"""
        
        try:
            # Query reports in date range
            query = select(Report).where(
                Report.created_at >= start_date,
                Report.created_at <= end_date
            )
            result = await db.execute(query)
            reports = result.scalars().all()
            
            # Analyze compliance metrics
            total_reports = len(reports)
            compliant_reports = 0
            non_compliant_reports = 0
            compliance_issues = {}
            
            for report in reports:
                validation = await self.validate_report_compliance(report, db)
                
                if validation["is_compliant"]:
                    compliant_reports += 1
                else:
                    non_compliant_reports += 1
                    
                    # Count issue types
                    for issue in validation["issues"]:
                        if issue not in compliance_issues:
                            compliance_issues[issue] = 0
                        compliance_issues[issue] += 1
            
            # Calculate compliance rate
            compliance_rate = (compliant_reports / total_reports * 100) if total_reports > 0 else 100
            
            # Generate report
            compliance_report = {
                "report_period": {
                    "start_date": start_date.isoformat(),
                    "end_date": end_date.isoformat()
                },
                "summary": {
                    "total_reports": total_reports,
                    "compliant_reports": compliant_reports,
                    "non_compliant_reports": non_compliant_reports,
                    "compliance_rate_percent": round(compliance_rate, 2)
                },
                "compliance_issues": compliance_issues,
                "regulations_checked": [
                    "German Medical Device Law (MPG)",
                    "German Medical Professional Code (MBO-Ä)",
                    "GDPR (DSGVO)",
                    "German Data Protection Act (BDSG)"
                ],
                "recommendations": self._generate_compliance_recommendations(compliance_issues),
                "generated_at": datetime.utcnow().isoformat(),
                "generated_by": "automated_compliance_system"
            }
            
            return compliance_report
            
        except Exception as e:
            logger.error(f"Error generating compliance report: {e}")
            raise ComplianceException(f"Compliance report generation failed: {str(e)}")
    
    async def validate_physician_signature(
        self,
        physician_id: str,
        physician_name: str,
        signature_data: Optional[str],
        signature_method: str = "electronic"
    ) -> Dict[str, Any]:
        """Validate physician signature according to German medical regulations"""
        
        try:
            validation_result = {
                "is_valid": True,
                "issues": [],
                "signature_method": signature_method,
                "validation_timestamp": datetime.utcnow().isoformat()
            }
            
            # Check physician ID format
            if not physician_id or len(physician_id) < 3:
                validation_result["is_valid"] = False
                validation_result["issues"].append("Invalid physician ID format")
            
            # Check physician name
            if not physician_name or len(physician_name) < 5:
                validation_result["is_valid"] = False
                validation_result["issues"].append("Physician name too short or missing")
            
            # Validate signature based on method
            if signature_method == "electronic":
                if signature_data and len(signature_data) < 10:
                    validation_result["issues"].append("Electronic signature data insufficient")
            elif signature_method == "digital":
                # Would validate digital certificate here
                pass
            
            # Check against physician registry (placeholder)
            # In real implementation, this would check against medical board registry
            if not await self._verify_physician_registry(physician_id, physician_name):
                validation_result["issues"].append("Physician not found in registry")
                validation_result["is_valid"] = False
            
            return validation_result
            
        except Exception as e:
            logger.error(f"Error validating physician signature: {e}")
            return {
                "is_valid": False,
                "issues": [f"Signature validation error: {str(e)}"],
                "signature_method": signature_method,
                "validation_timestamp": datetime.utcnow().isoformat()
            }
    
    async def _validate_content_completeness(self, report: Report) -> List[str]:
        """Validate that report content meets minimum requirements"""
        
        issues = []
        
        # Check required fields
        if not report.findings or len(report.findings.strip()) < 50:
            issues.append("Findings section too brief (minimum 50 characters)")
        
        if not report.assessment or len(report.assessment.strip()) < 30:
            issues.append("Assessment section too brief (minimum 30 characters)")
        
        if not report.clinical_indication:
            issues.append("Missing clinical indication")
        
        # Check for proper medical terminology
        if report.findings:
            # Simple check for German medical terms
            german_medical_indicators = [
                "befund", "pathologie", "anatomie", "regelrecht", 
                "unauffällig", "verdächtig", "kontrastmittel"
            ]
            
            findings_lower = report.findings.lower()
            if not any(term in findings_lower for term in german_medical_indicators):
                issues.append("Findings may lack proper German medical terminology")
        
        return issues
    
    async def _validate_privacy_compliance(self, report: Report) -> List[str]:
        """Validate privacy and data protection compliance"""
        
        issues = []
        
        # Check for potential PII in content that should be anonymized
        sensitive_patterns = [
            "tel:", "telefon", "email", "@", "straße", "str.", 
            "plz", "stadt", "geboren", "geb."
        ]
        
        content_to_check = f"{report.findings} {report.assessment} {report.recommendations or ''}"
        content_lower = content_to_check.lower()
        
        for pattern in sensitive_patterns:
            if pattern in content_lower:
                issues.append(f"Potential PII detected: pattern '{pattern}'")
        
        # Check patient ID format (should be anonymized or coded)
        if report.patient_id and not (
            report.patient_id.startswith("ANON_") or 
            report.patient_id.startswith("PAT_") or
            len(report.patient_id) > 20  # Assume long IDs are hashed/coded
        ):
            issues.append("Patient ID may not be properly anonymized")
        
        return issues
    
    async def _verify_physician_registry(
        self, 
        physician_id: str, 
        physician_name: str
    ) -> bool:
        """Verify physician against medical board registry (placeholder)"""
        
        # In real implementation, this would check against:
        # - Bundesärztekammer registry
        # - State medical board registries
        # - Hospital physician directories
        
        # For now, return True if basic format is correct
        return len(physician_id) >= 3 and len(physician_name) >= 5
    
    def _generate_compliance_recommendations(
        self, 
        compliance_issues: Dict[str, int]
    ) -> List[str]:
        """Generate recommendations based on compliance issues"""
        
        recommendations = []
        
        if "Missing dictating physician signature" in compliance_issues:
            recommendations.append(
                "Implement mandatory physician signature verification before report submission"
            )
        
        if "Missing audit trail" in compliance_issues:
            recommendations.append(
                "Enable comprehensive audit logging for all report modifications"
            )
        
        if "Quality score below minimum threshold" in compliance_issues:
            recommendations.append(
                "Implement quality review process before report finalization"
            )
        
        if "Findings section too brief" in compliance_issues:
            recommendations.append(
                "Provide training on minimum documentation requirements"
            )
        
        if not recommendations:
            recommendations.append("Current compliance levels are satisfactory")
        
        return recommendations


# Global instance
compliance_service = MedicalComplianceService()