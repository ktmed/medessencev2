# Medical Report Generation Service - API Documentation

## Overview

The Medical Report Generation Service provides a comprehensive REST API for generating, managing, and maintaining German medical reports. This API is designed specifically for radiology departments and complies with German medical regulations.

## Base URL

```
Production: https://api.radiology.example.com/
Development: http://localhost:8002/
```

## Authentication

Currently, the API uses a simple token-based authentication. In production, integrate with your existing authentication system.

```http
Authorization: Bearer your-jwt-token
```

## Content Types

All API endpoints accept and return JSON unless otherwise specified.

```http
Content-Type: application/json
Accept: application/json
```

## Rate Limiting

- API calls: 100 requests per minute per IP
- Health checks: 1000 requests per minute per IP

## Error Handling

All errors follow a consistent format:

```json
{
  "error": "Error description",
  "type": "error_type",
  "timestamp": "2024-01-15T10:30:00Z",
  "details": {
    "additional": "information"
  }
}
```

### HTTP Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `422` - Unprocessable Entity
- `429` - Too Many Requests
- `500` - Internal Server Error
- `503` - Service Unavailable

## API Endpoints

### Reports Management

#### Generate Report

Generate a new medical report from transcribed text.

```http
POST /api/v1/reports/generate
```

**Request Body:**
```json
{
  "transcription": "MRT Kopf nativ. Klinische Fragestellung: V.a. Raumforderung. Technik: Standard T1, T2, FLAIR Sequenzen...",
  "examination_type": "MRI",
  "clinical_indication": "V.a. Raumforderung, neurologische Symptomatik",
  "patient_id": "PAT_12345",
  "examination_date": "2024-01-15T10:30:00Z",
  "dictating_physician_id": "DOC_001",
  "dictating_physician_name": "Dr. med. Müller",
  "template_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response (201):**
```json
{
  "report_id": "123e4567-e89b-12d3-a456-426614174000",
  "status": "draft",
  "confidence_score": 92,
  "quality_score": 87,
  "terminology_validation": {
    "is_valid": true,
    "confidence_score": 0.95,
    "valid_terms": [
      {
        "term": "Raumforderung",
        "category": "pathology",
        "confidence": 0.98
      }
    ],
    "invalid_terms": [],
    "suggestions": [],
    "total_terms_checked": 15
  },
  "suggested_icd_codes": [
    {
      "code": "R93.1",
      "description": "Abnorme Befunde bei bildgebenden Untersuchungen des Herzens und des Koronargefäßsystems",
      "confidence": 0.85,
      "radiology_relevance": 0.9
    }
  ],
  "quality_assessment": {
    "overall_score": 87,
    "aspects": {
      "accuracy": 90,
      "completeness": 85,
      "terminology": 88,
      "structure": 90,
      "compliance": 85
    },
    "recommendations": [
      "Consider adding more specific anatomical details"
    ]
  },
  "compliance_flags": []
}
```

#### Retrieve Report

Get a specific medical report by ID.

```http
GET /api/v1/reports/{report_id}
```

**Query Parameters:**
- `include_html` (boolean, optional): Include HTML-formatted report content

**Response (200):**
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "patient_id": "PAT_12345",
  "examination_date": "2024-01-15T10:30:00Z",
  "examination_type": "MRI",
  "clinical_indication": "V.a. Raumforderung, neurologische Symptomatik",
  "findings": "Das Hirnparenchym zeigt eine regelrechte Signalintensität...",
  "assessment": "Unauffälliger MRT-Befund des Kopfes ohne Hinweis auf...",
  "recommendations": "Bei persistierenden Beschwerden Kontrolle in 6 Monaten",
  "status": "draft",
  "version": 1,
  "confidence_score": 92,
  "quality_score": 87,
  "icd_codes": [
    {
      "code": "Z01.6",
      "description": "Radiologische Untersuchung, anderenorts nicht klassifiziert",
      "confidence": 0.95,
      "radiology_relevance": 1.0
    }
  ],
  "dictating_physician_name": "Dr. med. Müller",
  "reviewing_physician_name": null,
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-15T10:30:00Z",
  "finalized_at": null,
  "compliance_flags": [],
  "audit_trail": [
    {
      "action": "created",
      "timestamp": "2024-01-15T10:30:00Z",
      "user": "DOC_001",
      "details": "Report generated from transcription"
    }
  ],
  "html_content": "<div class=\"report-container\">...</div>"
}
```

#### Update Report

Update an existing report (only allowed for non-finalized reports).

```http
PUT /api/v1/reports/{report_id}
```

**Query Parameters:**
- `user_id` (string, required): ID of user making the update
- `user_name` (string, required): Name of user making the update

**Request Body:**
```json
{
  "findings": "Updated findings section with additional details...",
  "assessment": "Updated assessment based on review...",
  "recommendations": "Updated recommendations...",
  "clinical_indication": "Updated clinical indication",
  "technical_parameters": {
    "contrast_agent": "Gadolinium",
    "dose": "0.1 mmol/kg"
  },
  "change_reason": "Review by senior radiologist"
}
```

**Response (200):**
```json
{
  "report_id": "123e4567-e89b-12d3-a456-426614174000",
  "version": 2,
  "updated_fields": ["findings", "assessment", "recommendations"],
  "confidence_score": 94,
  "quality_score": 89
}
```

#### Finalize Report

Finalize and digitally sign a medical report.

```http
POST /api/v1/reports/{report_id}/finalize
```

**Request Body:**
```json
{
  "reviewing_physician_id": "DOC_002",
  "reviewing_physician_name": "Prof. Dr. med. Schmidt",
  "digital_signature": "base64-encoded-signature-data",
  "signature_method": "electronic"
}
```

**Response (200):**
```json
{
  "report_id": "123e4567-e89b-12d3-a456-426614174000",
  "status": "finalized",
  "finalized_at": "2024-01-15T14:30:00Z",
  "reviewing_physician": "Prof. Dr. med. Schmidt",
  "validation_results": {
    "is_valid": true,
    "issues": [],
    "terminology_validation": {
      "is_valid": true,
      "confidence_score": 0.95
    },
    "quality_score": 89
  }
}
```

#### List Reports

List medical reports with filtering and pagination.

```http
GET /api/v1/reports
```

**Query Parameters:**
- `patient_id` (string, optional): Filter by patient ID
- `examination_type` (string, optional): Filter by examination type
- `status` (string, optional): Filter by report status
- `physician_id` (string, optional): Filter by physician ID
- `date_from` (string, optional): Filter by date range (ISO format)
- `date_to` (string, optional): Filter by date range (ISO format)
- `page` (integer, default: 1): Page number
- `page_size` (integer, default: 20, max: 100): Page size

**Response (200):**
```json
{
  "reports": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "patient_id": "PAT_12345",
      "examination_type": "MRI",
      "status": "finalized",
      "created_at": "2024-01-15T10:30:00Z",
      "dictating_physician_name": "Dr. med. Müller"
    }
  ],
  "total_count": 1,
  "page": 1,
  "page_size": 20,
  "has_next": false
}
```

#### Get Report Versions

Retrieve version history for a report.

```http
GET /api/v1/reports/{report_id}/versions
```

**Response (200):**
```json
{
  "report_id": "123e4567-e89b-12d3-a456-426614174000",
  "versions": [
    {
      "version_number": 1,
      "created_at": "2024-01-15T10:30:00Z",
      "created_by": "DOC_001",
      "changes_summary": "Initial generation",
      "content_snapshot": {
        "findings": "Original findings...",
        "assessment": "Original assessment..."
      }
    },
    {
      "version_number": 2,
      "created_at": "2024-01-15T11:30:00Z",
      "created_by": "DOC_002",
      "changes_summary": "Updated findings and assessment",
      "change_reason": "Senior radiologist review"
    }
  ]
}
```

#### Get Audit Trail

Retrieve audit trail for a report.

```http
GET /api/v1/reports/{report_id}/audit
```

**Response (200):**
```json
{
  "report_id": "123e4567-e89b-12d3-a456-426614174000",
  "audit_trail": [
    {
      "action": "created",
      "timestamp": "2024-01-15T10:30:00Z",
      "user": "DOC_001",
      "user_name": "Dr. med. Müller",
      "details": "Report generated from transcription"
    },
    {
      "action": "updated",
      "timestamp": "2024-01-15T11:30:00Z",
      "user": "DOC_002",
      "user_name": "Prof. Dr. med. Schmidt",
      "fields_updated": ["findings", "assessment"],
      "details": "Senior radiologist review"
    },
    {
      "action": "finalized",
      "timestamp": "2024-01-15T14:30:00Z",
      "user": "DOC_002",
      "user_name": "Prof. Dr. med. Schmidt",
      "details": "Report finalized and signed"
    }
  ]
}
```

### Template Management

#### List Templates

Get all available report templates.

```http
GET /api/v1/templates
```

**Query Parameters:**
- `examination_type` (string, optional): Filter by examination type
- `language` (string, default: "de"): Filter by language
- `template_type` (string, optional): Filter by template type
- `active_only` (boolean, default: true): Only return active templates

**Response (200):**
```json
{
  "templates": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Standard MRI Template",
      "description": "Default German template for MRI examinations",
      "examination_type": "MRI",
      "template_type": "standard",
      "language": "de",
      "is_default": true,
      "is_active": true,
      "version": "1.0.0",
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    }
  ],
  "total_count": 1
}
```

#### Get Template

Get a specific template by ID.

```http
GET /api/v1/templates/{template_id}
```

**Response (200):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Standard MRI Template",
  "description": "Default German template for MRI examinations",
  "examination_type": "MRI",
  "template_type": "standard",
  "language": "de",
  "header_template": "<div class=\"header\">...</div>",
  "clinical_indication_template": "<div class=\"section\">...</div>",
  "technical_parameters_template": "<div class=\"section\">...</div>",
  "findings_template": "<div class=\"section\">...</div>",
  "assessment_template": "<div class=\"section\">...</div>",
  "recommendations_template": "<div class=\"section\">...</div>",
  "footer_template": "<div class=\"footer\">...</div>",
  "template_config": {
    "required_sections": ["findings", "assessment"],
    "optional_sections": ["recommendations"]
  },
  "required_fields": ["findings", "assessment"],
  "optional_fields": ["recommendations", "technical_parameters"],
  "validation_rules": {
    "min_findings_length": 50,
    "min_assessment_length": 30
  },
  "ai_prompt_system": "Sie sind ein erfahrener Radiologe...",
  "ai_prompt_user": "Erstellen Sie einen strukturierten deutschen radiologischen Befundbericht...",
  "ai_examples": [
    {
      "input": "Sample transcription...",
      "output": "Sample structured report..."
    }
  ],
  "css_styles": ".report-container { font-family: Arial... }",
  "layout_config": {
    "page_size": "A4",
    "margins": "2cm"
  },
  "compliance_requirements": {
    "physician_signature_required": true,
    "audit_trail_required": true
  },
  "required_signatures": ["dictating_physician", "reviewing_physician"],
  "is_default": true,
  "is_active": true,
  "version": "1.0.0",
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z",
  "created_by": "system",
  "updated_by": "system"
}
```

#### Get Default Template

Get the default template for an examination type.

```http
GET /api/v1/templates/examination-types/{examination_type}/default
```

**Query Parameters:**
- `language` (string, default: "de"): Template language

**Response (200):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Standard MRI Template",
  "description": "Default German template for MRI examinations",
  "examination_type": "MRI",
  "template_type": "standard",
  "language": "de",
  "is_default": true,
  "is_builtin": false,
  "version": "1.0.0"
}
```

#### Get Built-in Templates

Get information about built-in report templates.

```http
GET /api/v1/templates/builtin
```

**Response (200):**
```json
{
  "builtin_templates": [
    {
      "examination_type": "MRI",
      "name": "Standard MRI Template",
      "description": "Built-in German template for MRI examinations",
      "language": "de",
      "template_type": "standard",
      "sections": ["header", "clinical_indication", "technical_parameters", "findings", "assessment", "signatures", "footer"],
      "is_builtin": true
    },
    {
      "examination_type": "CT",
      "name": "Standard CT Template",
      "description": "Built-in German template for CT examinations",
      "language": "de",
      "template_type": "standard",
      "sections": ["header", "clinical_indication", "technical_parameters", "findings", "assessment", "signatures", "footer"],
      "is_builtin": true
    }
  ],
  "total_count": 2
}
```

#### Preview Template

Generate a preview of a template with sample data.

```http
GET /api/v1/templates/preview/{template_id}
```

**Response (200):**
```json
{
  "template_id": "550e8400-e29b-41d4-a716-446655440000",
  "template_name": "Standard MRI Template",
  "preview_note": "Template preview with sample data",
  "sample_data": {
    "clinic_name": "Radiologische Allianz",
    "patient_name": "Muster, Max",
    "patient_dob": "01.01.1980",
    "examination_date": "2024-01-15",
    "examination_type": "MRI",
    "report_id": "RA-2024-001234",
    "clinical_indication": "V.a. Pathologie, Abklärung bei Beschwerden",
    "findings": "Beispielbefund: Die Untersuchung zeigt regelrechte anatomische Verhältnisse ohne pathologische Veränderungen.",
    "assessment": "Beispielbeurteilung: Unauffälliger Befund ohne Hinweis auf relevante Pathologie."
  },
  "template_sections": {
    "header": "<!DOCTYPE html><html>...",
    "findings": "<div class=\"section findings\">...",
    "assessment": "<div class=\"section assessment\">..."
  }
}
```

#### Get Validation Rules

Get available validation rules for templates.

```http
GET /api/v1/templates/validation-rules
```

**Response (200):**
```json
{
  "field_rules": {
    "findings": {
      "min_length": 50,
      "max_length": 5000,
      "required": true,
      "description": "Minimum 50 characters required for findings section"
    },
    "assessment": {
      "min_length": 30,
      "max_length": 2000,
      "required": true,
      "description": "Minimum 30 characters required for assessment section"
    },
    "clinical_indication": {
      "min_length": 10,
      "max_length": 500,
      "required": false,
      "description": "Clinical indication should be concise but informative"
    }
  },
  "medical_rules": {
    "terminology_validation": {
      "enabled": true,
      "confidence_threshold": 0.7,
      "description": "Validate medical terminology against medical database"
    },
    "icd_code_validation": {
      "enabled": true,
      "require_primary_diagnosis": true,
      "description": "Validate ICD-10-GM codes and require primary diagnosis"
    }
  },
  "compliance_rules": {
    "physician_signature": {
      "required": true,
      "digital_signature_accepted": true,
      "description": "Physician signature required for finalization"
    },
    "audit_trail": {
      "enabled": true,
      "track_all_changes": true,
      "description": "Complete audit trail of all report changes"
    }
  }
}
```

### Health Monitoring

#### Health Check

Basic health check for the service.

```http
GET /health
```

**Response (200):**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "version": "1.0.0",
  "database_status": "healthy",
  "openai_status": "healthy",
  "dependencies": {
    "database": "healthy",
    "openai_api": "healthy",
    "redis": "not_implemented",
    "file_storage": "not_implemented"
  }
}
```

#### Readiness Check

Check if the service is ready to accept requests.

```http
GET /health/ready
```

**Response (200):**
```json
{
  "status": "ready",
  "timestamp": "2024-01-15T10:30:00Z",
  "message": "Service is ready to accept requests"
}
```

#### Liveness Check

Simple liveness check.

```http
GET /health/live
```

**Response (200):**
```json
{
  "status": "alive",
  "timestamp": "2024-01-15T10:30:00Z",
  "message": "Service is alive"
}
```

#### Service Metrics

Get basic service metrics and statistics.

```http
GET /health/metrics
```

**Response (200):**
```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "metrics": {
    "reports_generated_total": 1542,
    "reports_generated_today": 23,
    "average_processing_time_seconds": 2.3,
    "error_rate_percent": 0.1,
    "active_database_connections": 5,
    "memory_usage_mb": 256,
    "cpu_usage_percent": 15.2,
    "uptime_seconds": 86400
  }
}
```

## Medical Data Models

### Examination Types

Supported examination types:
- `MRI` - Magnetic Resonance Imaging
- `CT` - Computed Tomography
- `X-Ray` - X-Ray examination
- `Ultrasound` - Ultrasound examination
- `Mammography` - Mammography examination

### Report Status

Report status values:
- `draft` - Initial draft state
- `in_review` - Under review by physician
- `finalized` - Finalized and signed
- `signed` - Digitally signed
- `archived` - Archived report

### ICD-10-GM Codes

The service uses German ICD-10-GM codes with radiology relevance scoring:

```json
{
  "code": "R93.1",
  "description": "Abnorme Befunde bei bildgebenden Untersuchungen des Herzens und des Koronargefäßsystems",
  "confidence": 0.85,
  "radiology_relevance": 0.9
}
```

## German Medical Terminology

The service includes a comprehensive German medical terminology database covering:

- **Anatomical terms**: Organ systems, body regions, anatomical structures
- **Pathological terms**: Disease processes, abnormalities, findings
- **Procedural terms**: Examination techniques, contrast agents, protocols
- **Assessment terms**: Normal/abnormal findings, diagnostic conclusions

## Compliance Features

### GDPR Compliance

- **Data anonymization**: Automatic patient data anonymization
- **Right to be forgotten**: Complete data deletion capabilities
- **Data portability**: Export patient data in structured format
- **Consent management**: Track and manage patient consent

### Medical Compliance

- **Audit trails**: Complete tracking of all report modifications
- **Digital signatures**: Support for physician electronic signatures
- **Quality assurance**: Automated quality checks before finalization
- **Retention policy**: Automatic cleanup after 7-year retention period

### Security Features

- **Rate limiting**: Protection against API abuse
- **Input validation**: Comprehensive input sanitization
- **Error handling**: Secure error messages
- **Audit logging**: Comprehensive security and audit logging

## Error Codes

### Medical-Specific Errors

- `MEDICAL_001`: Invalid medical terminology
- `MEDICAL_002`: Missing required physician signature
- `MEDICAL_003`: Report already finalized
- `MEDICAL_004`: Insufficient report quality
- `MEDICAL_005`: Compliance validation failed
- `MEDICAL_006`: ICD code validation failed
- `MEDICAL_007`: Template not found
- `MEDICAL_008`: Patient data anonymization required

### API-Specific Errors

- `API_001`: Invalid request format
- `API_002`: Missing required parameters
- `API_003`: Resource not found
- `API_004`: Authentication failed
- `API_005`: Rate limit exceeded
- `API_006`: Service unavailable

## SDK Examples

### Python SDK

```python
import requests
from datetime import datetime

class MedicalReportClient:
    def __init__(self, base_url, api_key):
        self.base_url = base_url
        self.headers = {
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        }
    
    def generate_report(self, transcription, examination_type, **kwargs):
        data = {
            'transcription': transcription,
            'examination_type': examination_type,
            'examination_date': datetime.utcnow().isoformat(),
            **kwargs
        }
        
        response = requests.post(
            f'{self.base_url}/api/v1/reports/generate',
            json=data,
            headers=self.headers
        )
        
        response.raise_for_status()
        return response.json()
    
    def get_report(self, report_id, include_html=False):
        params = {'include_html': include_html} if include_html else {}
        
        response = requests.get(
            f'{self.base_url}/api/v1/reports/{report_id}',
            params=params,
            headers=self.headers
        )
        
        response.raise_for_status()
        return response.json()

# Usage
client = MedicalReportClient('http://localhost:8002', 'your-token')

report = client.generate_report(
    transcription="MRT Kopf nativ. Befund: unauffällig...",
    examination_type="MRI",
    patient_id="PAT_001",
    dictating_physician_id="DOC_001",
    dictating_physician_name="Dr. med. Müller"
)

print(f"Generated report: {report['report_id']}")
```

### JavaScript SDK

```javascript
class MedicalReportClient {
    constructor(baseUrl, apiKey) {
        this.baseUrl = baseUrl;
        this.headers = {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        };
    }
    
    async generateReport(transcription, examinationType, options = {}) {
        const data = {
            transcription,
            examination_type: examinationType,
            examination_date: new Date().toISOString(),
            ...options
        };
        
        const response = await fetch(`${this.baseUrl}/api/v1/reports/generate`, {
            method: 'POST',
            headers: this.headers,
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    }
    
    async getReport(reportId, includeHtml = false) {
        const params = includeHtml ? '?include_html=true' : '';
        
        const response = await fetch(`${this.baseUrl}/api/v1/reports/${reportId}${params}`, {
            headers: this.headers
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    }
}

// Usage
const client = new MedicalReportClient('http://localhost:8002', 'your-token');

try {
    const report = await client.generateReport(
        "MRT Kopf nativ. Befund: unauffällig...",
        "MRI",
        {
            patient_id: "PAT_001",
            dictating_physician_id: "DOC_001",
            dictating_physician_name: "Dr. med. Müller"
        }
    );
    
    console.log(`Generated report: ${report.report_id}`);
} catch (error) {
    console.error('Error generating report:', error);
}
```

## Postman Collection

Import the following collection into Postman for easy API testing:

```json
{
  "info": {
    "name": "Medical Report Generation API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "variable": [
    {
      "key": "baseUrl",
      "value": "http://localhost:8002"
    },
    {
      "key": "apiToken",
      "value": "your-token-here"
    }
  ],
  "auth": {
    "type": "bearer",
    "bearer": [
      {
        "key": "token",
        "value": "{{apiToken}}"
      }
    ]
  },
  "item": [
    {
      "name": "Generate Report",
      "request": {
        "method": "POST",
        "header": [],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"transcription\": \"MRT Kopf nativ. Klinische Fragestellung: V.a. Raumforderung.\",\n  \"examination_type\": \"MRI\",\n  \"patient_id\": \"PAT_001\",\n  \"examination_date\": \"2024-01-15T10:30:00Z\",\n  \"dictating_physician_id\": \"DOC_001\",\n  \"dictating_physician_name\": \"Dr. med. Müller\"\n}",
          "options": {
            "raw": {
              "language": "json"
            }
          }
        },
        "url": {
          "raw": "{{baseUrl}}/api/v1/reports/generate",
          "host": ["{{baseUrl}}"],
          "path": ["api", "v1", "reports", "generate"]
        }
      }
    }
  ]
}
```

---

**Medical Report Generation Service API v1.0.0**  
*Professional medical API - Handle with care* 🏥