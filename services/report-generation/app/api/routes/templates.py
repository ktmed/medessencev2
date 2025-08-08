"""
API routes for report template management
"""

import logging
from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models.template import ReportTemplate, TemplateType, TemplateLanguage
from app.models.report import ExaminationType
from templates.german_report_templates import TEMPLATES

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get(
    "/",
    summary="List available report templates",
    description="Get all available report templates with optional filtering"
)
async def list_templates(
    examination_type: Optional[str] = Query(None, description="Filter by examination type"),
    language: Optional[str] = Query("de", description="Filter by language"),
    template_type: Optional[str] = Query(None, description="Filter by template type"),
    active_only: bool = Query(True, description="Only return active templates"),
    db: AsyncSession = Depends(get_db)
):
    """List available report templates"""
    
    try:
        query = select(ReportTemplate)
        
        if examination_type:
            query = query.where(ReportTemplate.examination_type == ExaminationType(examination_type))
        
        if language:
            query = query.where(ReportTemplate.language == TemplateLanguage(language))
        
        if template_type:
            query = query.where(ReportTemplate.template_type == TemplateType(template_type))
        
        if active_only:
            query = query.where(ReportTemplate.is_active == True)
        
        query = query.order_by(ReportTemplate.examination_type, ReportTemplate.name)
        
        result = await db.execute(query)
        templates = result.scalars().all()
        
        template_list = []
        for template in templates:
            template_list.append({
                "id": str(template.id),
                "name": template.name,
                "description": template.description,
                "examination_type": template.examination_type.value,
                "template_type": template.template_type.value,
                "language": template.language.value,
                "is_default": template.is_default,
                "is_active": template.is_active,
                "version": template.version,
                "created_at": template.created_at.isoformat(),
                "updated_at": template.updated_at.isoformat()
            })
        
        return {
            "templates": template_list,
            "total_count": len(template_list)
        }
        
    except Exception as e:
        logger.error(f"Error listing templates: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get(
    "/{template_id}",
    summary="Get specific report template",
    description="Retrieve detailed information about a specific report template"
)
async def get_template(
    template_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """Get a specific report template"""
    
    try:
        query = select(ReportTemplate).where(ReportTemplate.id == template_id)
        result = await db.execute(query)
        template = result.scalar_one_or_none()
        
        if not template:
            raise HTTPException(status_code=404, detail="Template not found")
        
        return {
            "id": str(template.id),
            "name": template.name,
            "description": template.description,
            "examination_type": template.examination_type.value,
            "template_type": template.template_type.value,
            "language": template.language.value,
            "header_template": template.header_template,
            "clinical_indication_template": template.clinical_indication_template,
            "technical_parameters_template": template.technical_parameters_template,
            "findings_template": template.findings_template,
            "assessment_template": template.assessment_template,
            "recommendations_template": template.recommendations_template,
            "footer_template": template.footer_template,
            "template_config": template.template_config,
            "required_fields": template.required_fields,
            "optional_fields": template.optional_fields,
            "validation_rules": template.validation_rules,
            "ai_prompt_system": template.ai_prompt_system,
            "ai_prompt_user": template.ai_prompt_user,
            "ai_examples": template.ai_examples,
            "css_styles": template.css_styles,
            "layout_config": template.layout_config,
            "compliance_requirements": template.compliance_requirements,
            "required_signatures": template.required_signatures,
            "is_default": template.is_default,
            "is_active": template.is_active,
            "version": template.version,
            "created_at": template.created_at.isoformat(),
            "updated_at": template.updated_at.isoformat(),
            "created_by": template.created_by,
            "updated_by": template.updated_by
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving template {template_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get(
    "/examination-types/{examination_type}/default",
    summary="Get default template for examination type",
    description="Get the default template for a specific examination type"
)
async def get_default_template_for_examination(
    examination_type: str,
    language: str = Query("de", description="Template language"),
    db: AsyncSession = Depends(get_db)
):
    """Get default template for an examination type"""
    
    try:
        query = select(ReportTemplate).where(
            ReportTemplate.examination_type == ExaminationType(examination_type),
            ReportTemplate.language == TemplateLanguage(language),
            ReportTemplate.is_default == True,
            ReportTemplate.is_active == True
        )
        
        result = await db.execute(query)
        template = result.scalar_one_or_none()
        
        if not template:
            # Fall back to built-in templates
            builtin_template = TEMPLATES.get(examination_type, TEMPLATES["Standard"])
            return {
                "id": None,
                "name": f"Standard {examination_type} Template",
                "description": f"Built-in German template for {examination_type} examinations",
                "examination_type": examination_type,
                "template_type": "standard",
                "language": language,
                "is_builtin": True,
                "template_sections": builtin_template
            }
        
        return {
            "id": str(template.id),
            "name": template.name,
            "description": template.description,
            "examination_type": template.examination_type.value,
            "template_type": template.template_type.value,
            "language": template.language.value,
            "is_default": template.is_default,
            "is_builtin": False,
            "version": template.version
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid examination type: {examination_type}")
    except Exception as e:
        logger.error(f"Error getting default template: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get(
    "/builtin",
    summary="Get built-in report templates",
    description="Get information about built-in report templates"
)
async def get_builtin_templates():
    """Get built-in report templates"""
    
    try:
        builtin_templates = []
        
        for exam_type, template_data in TEMPLATES.items():
            builtin_templates.append({
                "examination_type": exam_type,
                "name": f"Standard {exam_type} Template",
                "description": f"Built-in German template for {exam_type} examinations",
                "language": "de",
                "template_type": "standard",
                "sections": list(template_data.keys()),
                "is_builtin": True
            })
        
        return {
            "builtin_templates": builtin_templates,
            "total_count": len(builtin_templates)
        }
        
    except Exception as e:
        logger.error(f"Error getting built-in templates: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get(
    "/preview/{template_id}",
    summary="Preview report template",
    description="Generate a preview of how a template would look with sample data"
)
async def preview_template(
    template_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """Preview a report template with sample data"""
    
    try:
        query = select(ReportTemplate).where(ReportTemplate.id == template_id)
        result = await db.execute(query)
        template = result.scalar_one_or_none()
        
        if not template:
            raise HTTPException(status_code=404, detail="Template not found")
        
        # Sample data for preview
        sample_data = {
            "clinic_name": "Radiologische Allianz",
            "patient_name": "Muster, Max",
            "patient_dob": "01.01.1980",
            "examination_date": "2024-01-15",
            "examination_type": template.examination_type.value,
            "report_id": "RA-2024-001234",
            "clinical_indication": "V.a. Pathologie, Abklärung bei Beschwerden",
            "technical_parameters": {
                "Gerät": "Beispielgerät",
                "Sequenzen": "Standardprotokoll",
                "Kontrastmittel": "Nein"
            },
            "findings": "Beispielbefund: Die Untersuchung zeigt regelrechte anatomische Verhältnisse ohne pathologische Veränderungen.",
            "assessment": "Beispielbeurteilung: Unauffälliger Befund ohne Hinweis auf relevante Pathologie.",
            "recommendations": "Beispielempfehlung: Bei persistierenden Beschwerden ggf. Kontrolle in 6 Monaten.",
            "dictating_physician_name": "Dr. med. Muster",
            "reviewing_physician_name": "Prof. Dr. med. Beispiel",
            "created_at": "2024-01-15",
            "version": "1"
        }
        
        # This would render the template with sample data
        # For now, return the template structure
        return {
            "template_id": str(template.id),
            "template_name": template.name,
            "preview_note": "Template preview with sample data",
            "sample_data": sample_data,
            "template_sections": {
                "header": template.header_template[:200] + "..." if template.header_template else None,
                "findings": template.findings_template[:200] + "..." if template.findings_template else None,
                "assessment": template.assessment_template[:200] + "..." if template.assessment_template else None
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error previewing template {template_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get(
    "/validation-rules",
    summary="Get template validation rules",
    description="Get available validation rules for report templates"
)
async def get_validation_rules():
    """Get available validation rules for templates"""
    
    try:
        validation_rules = {
            "field_rules": {
                "findings": {
                    "min_length": 50,
                    "max_length": 5000,
                    "required": True,
                    "description": "Minimum 50 characters required for findings section"
                },
                "assessment": {
                    "min_length": 30,
                    "max_length": 2000,
                    "required": True,
                    "description": "Minimum 30 characters required for assessment section"
                },
                "clinical_indication": {
                    "min_length": 10,
                    "max_length": 500,
                    "required": False,
                    "description": "Clinical indication should be concise but informative"
                }
            },
            "medical_rules": {
                "terminology_validation": {
                    "enabled": True,
                    "confidence_threshold": 0.7,
                    "description": "Validate medical terminology against medical database"
                },
                "icd_code_validation": {
                    "enabled": True,
                    "require_primary_diagnosis": True,
                    "description": "Validate ICD-10-GM codes and require primary diagnosis"
                }
            },
            "compliance_rules": {
                "physician_signature": {
                    "required": True,
                    "digital_signature_accepted": True,
                    "description": "Physician signature required for finalization"
                },
                "audit_trail": {
                    "enabled": True,
                    "track_all_changes": True,
                    "description": "Complete audit trail of all report changes"
                }
            }
        }
        
        return validation_rules
        
    except Exception as e:
        logger.error(f"Error getting validation rules: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")