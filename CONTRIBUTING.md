# Contributing to MedEssenceAI

Welcome to MedEssenceAI! We appreciate your interest in contributing to our healthcare AI platform. This document provides guidelines for contributing code, reporting issues, and participating in the development process.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Security Guidelines](#security-guidelines)
- [Testing Requirements](#testing-requirements)
- [Documentation Standards](#documentation-standards)
- [Review Process](#review-process)
- [HIPAA Compliance](#hipaa-compliance)

## Code of Conduct

### Our Commitment

As contributors and maintainers of MedEssenceAI, we pledge to foster an open, welcoming, and harassment-free environment for everyone, regardless of:

- Age, body size, disability, ethnicity, gender identity and expression
- Level of experience, education, socio-economic status
- Nationality, personal appearance, race, religion
- Sexual identity and orientation

### Standards of Behavior

**Positive behaviors include:**
- Using welcoming and inclusive language
- Being respectful of differing viewpoints and experiences
- Gracefully accepting constructive criticism
- Focusing on what is best for the community and patients
- Showing empathy towards other community members

**Unacceptable behaviors include:**
- Trolling, insulting/derogatory comments, and personal attacks
- Public or private harassment
- Publishing others' private information without explicit permission
- Discussing patient data or PHI in public forums
- Other conduct which could reasonably be considered inappropriate

### Medical Ethics Considerations

Given our healthcare focus, we also expect:

- **Patient Privacy First**: Never discuss real patient data
- **Safety-Critical Mindset**: Consider patient safety in all decisions
- **Evidence-Based Contributions**: Support features with medical literature when applicable
- **Accessibility**: Consider users with disabilities and diverse needs

### Enforcement

Project maintainers will remove, edit, or reject comments, commits, code, issues, and other contributions that are not aligned with this Code of Conduct. For violations, contact: conduct@medessence-ai.com

## Getting Started

### Prerequisites

Before contributing, ensure you have:

1. **Development Environment**
   - Node.js 18+ and npm 8+
   - Python 3.11+ and pip
   - Docker and Docker Compose
   - Git with proper configuration

2. **Access Requirements**
   - GitHub account with 2FA enabled
   - Signed Contributor License Agreement (CLA)
   - HIPAA training completion (for PHI-related work)

3. **Security Clearance**
   - Background check (for production access)
   - Security awareness training
   - NDA signed for sensitive medical AI work

### Setting Up Development Environment

1. **Clone and Setup**
   ```bash
   git clone https://github.com/medessence-ai/medessence-production.git
   cd medessence-production
   
   # Install dependencies
   npm install
   cd frontend && npm install
   cd ../backend && npm install
   
   # Setup Python virtual environment
   cd ../services/transcription
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

2. **Environment Configuration**
   ```bash
   # Copy environment templates
   cp config/environments/development.env.example .env.development
   
   # Configure development database
   docker-compose -f docker-compose.dev.yml up -d postgres redis
   
   # Run database migrations
   cd backend && npx prisma migrate dev
   ```

3. **Pre-commit Hooks**
   ```bash
   # Install pre-commit hooks for code quality
   npm install -g @commitlint/cli @commitlint/config-conventional
   pip install pre-commit
   pre-commit install
   ```

### Understanding the Architecture

```
MedEssenceAI/
├── frontend/                 # Next.js React application
├── backend/                  # Node.js API Gateway
├── services/
│   ├── transcription/        # Python FastAPI service
│   ├── report-generation/    # Python FastAPI service
│   └── summary-generation/   # Python FastAPI service
├── k8s/                      # Kubernetes manifests
├── docker/                   # Docker configurations
├── tests/                    # Integration tests
└── docs/                     # Documentation
```

## Development Workflow

### Branching Strategy

We use GitHub Flow with medical-specific conventions:

```
main (production)
├── develop (integration)
├── feature/MED-123-patient-dashboard
├── feature/MED-124-transcription-accuracy
├── bugfix/MED-125-auth-vulnerability
├── hotfix/MED-126-critical-security-patch
└── compliance/MED-127-hipaa-audit-logs
```

**Branch Naming Conventions:**
- `feature/MED-{ticket}-{brief-description}`
- `bugfix/MED-{ticket}-{brief-description}`
- `hotfix/MED-{ticket}-{brief-description}`
- `compliance/MED-{ticket}-{brief-description}`
- `security/MED-{ticket}-{brief-description}`

### Issue Types and Labels

We use specific labels for healthcare context:

#### Priority Labels
- `priority/critical` - Security vulnerabilities, PHI exposure
- `priority/high` - Patient safety, system downtime
- `priority/medium` - Feature enhancements, performance
- `priority/low` - Documentation, minor improvements

#### Type Labels
- `type/feature` - New functionality
- `type/bug` - Software defects
- `type/security` - Security-related issues
- `type/compliance` - HIPAA, GDPR, regulatory requirements
- `type/performance` - Performance improvements
- `type/documentation` - Documentation updates

#### Component Labels
- `component/frontend` - React/Next.js frontend
- `component/backend` - Node.js API Gateway  
- `component/ai-services` - Python ML services
- `component/infrastructure` - K8s, Docker, CI/CD
- `component/database` - PostgreSQL, Redis

#### Medical Context Labels
- `medical/transcription` - Speech-to-text functionality
- `medical/reporting` - Medical report generation
- `medical/terminology` - Medical vocabulary/terminology
- `medical/compliance` - Medical compliance requirements

### Commit Message Standards

We follow Conventional Commits with medical-specific types:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

**Types:**
- `feat`: New feature for users
- `fix`: Bug fix for users
- `security`: Security vulnerability fix
- `compliance`: HIPAA/regulatory compliance
- `perf`: Performance improvement
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `docs`: Documentation updates
- `ci`: CI/CD pipeline changes

**Examples:**
```
feat(transcription): add German medical terminology support

- Implemented German medical dictionary integration
- Added real-time terminology validation
- Improved accuracy for cardiac procedures by 15%

Closes MED-123

security(auth): fix JWT token validation vulnerability

- Properly validate JWT signature and expiration
- Add rate limiting for authentication endpoints
- Update security headers for HIPAA compliance

BREAKING CHANGE: Invalid tokens now return 401 instead of 403
```

### Pull Request Process

#### 1. Pre-submission Checklist

Before opening a PR, ensure:

- [ ] Code follows coding standards (ESLint, Prettier, Black)
- [ ] All tests pass locally
- [ ] Security scan passes (no critical/high vulnerabilities)
- [ ] Documentation updated (if applicable)
- [ ] HIPAA compliance verified (for PHI-related changes)
- [ ] Breaking changes documented
- [ ] Performance impact assessed

#### 2. Pull Request Template

```markdown
## Description
Brief description of changes and motivation.

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)  
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Security fix (addresses security vulnerability)
- [ ] Compliance update (HIPAA, GDPR, regulatory)
- [ ] Documentation update

## Medical/Clinical Impact
- [ ] No clinical impact
- [ ] Affects transcription accuracy
- [ ] Changes medical terminology handling
- [ ] Impacts patient data processing
- [ ] Modifies audit logging

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Security tests added/updated
- [ ] Manual testing completed
- [ ] Accessibility testing completed

## HIPAA/Compliance Checklist
- [ ] No PHI in logs or error messages
- [ ] Audit logging implemented for PHI access
- [ ] Data encryption verified
- [ ] Access controls properly implemented
- [ ] Compliance documentation updated

## Security Checklist
- [ ] Input validation implemented
- [ ] Output encoding implemented
- [ ] Authentication/authorization verified
- [ ] SQL injection prevention verified
- [ ] XSS prevention verified
- [ ] Dependencies updated and secure

## Screenshots (if applicable)
Include screenshots for UI changes.

## Breaking Changes
List any breaking changes and migration steps.

## Additional Notes
Any additional information for reviewers.
```

#### 3. Review Requirements

All PRs require:

- **Code Review**: At least 2 reviewers (1 senior developer)
- **Security Review**: For security-sensitive changes
- **Medical Review**: For clinical workflow changes
- **Compliance Review**: For PHI-related changes
- **Automated Checks**: All CI/CD checks must pass

#### 4. Review Criteria

Reviewers should verify:

**Code Quality:**
- Code is readable and maintainable
- Follows established patterns and architecture
- Has appropriate test coverage
- Performance considerations addressed

**Security:**
- Input validation and sanitization
- Authentication and authorization
- No sensitive data in logs
- Secure coding practices followed

**Medical Compliance:**
- HIPAA requirements met
- PHI properly handled and encrypted
- Audit logging implemented
- Clinical accuracy maintained

## Coding Standards

### JavaScript/TypeScript Standards

#### Code Style
```javascript
// ✅ GOOD: Use const/let, avoid var
const patientData = await getPatientData(patientId);
let processedData = [];

// ✅ GOOD: Use descriptive variable names
const medicalRecordNumber = generateMRN();
const transcriptionAccuracy = calculateAccuracy(original, transcribed);

// ❌ BAD: Unclear variable names
const mrn = genMRN();
const acc = calcAcc(o, t);

// ✅ GOOD: Use async/await instead of callbacks
async function processTranscription(audioFile) {
    try {
        const transcript = await transcribeAudio(audioFile);
        const enhanced = await enhanceWithAI(transcript);
        return enhanced;
    } catch (error) {
        logger.error('Transcription failed', { error, audioFile: audioFile.id });
        throw new TranscriptionError('Processing failed');
    }
}

// ❌ BAD: Callback hell
function processTranscription(audioFile, callback) {
    transcribeAudio(audioFile, (err, transcript) => {
        if (err) return callback(err);
        enhanceWithAI(transcript, (err, enhanced) => {
            if (err) return callback(err);
            callback(null, enhanced);
        });
    });
}
```

#### Error Handling
```javascript
// ✅ GOOD: Comprehensive error handling
class MedicalDataError extends Error {
    constructor(message, code, patientId) {
        super(message);
        this.name = 'MedicalDataError';
        this.code = code;
        this.patientId = patientId;
        this.timestamp = new Date().toISOString();
    }
}

async function getPatientRecord(patientId, userId) {
    try {
        // Validate inputs
        if (!patientId || !userId) {
            throw new MedicalDataError('Invalid parameters', 'INVALID_PARAMS');
        }
        
        // Check authorization
        const hasAccess = await checkPatientAccess(userId, patientId);
        if (!hasAccess) {
            await auditLog.logUnauthorizedAccess(userId, patientId);
            throw new MedicalDataError('Access denied', 'UNAUTHORIZED', patientId);
        }
        
        const record = await db.getPatientRecord(patientId);
        await auditLog.logPatientAccess(userId, patientId, 'READ');
        
        return record;
    } catch (error) {
        logger.error('Failed to get patient record', {
            error: error.message,
            patientId: patientId, // OK to log patient ID for internal debugging
            userId,
            stack: error.stack
        });
        
        // Don't expose internal details
        if (error instanceof MedicalDataError) {
            throw error;
        }
        
        throw new MedicalDataError('Database error occurred', 'DB_ERROR');
    }
}
```

#### PHI Handling
```javascript
// ✅ GOOD: PHI encryption and audit logging
const encryptPHI = (data) => {
    const cipher = crypto.createCipher('aes-256-gcm', process.env.PHI_ENCRYPTION_KEY);
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return {
        data: encrypted,
        iv: cipher.iv.toString('hex'),
        authTag: cipher.getAuthTag().toString('hex')
    };
};

const createPatientRecord = async (patientData, createdBy) => {
    // Validate required fields
    const requiredFields = ['firstName', 'lastName', 'birthDate'];
    const missing = requiredFields.filter(field => !patientData[field]);
    if (missing.length > 0) {
        throw new ValidationError(`Missing required fields: ${missing.join(', ')}`);
    }
    
    // Encrypt PHI
    const phi = {
        firstName: patientData.firstName,
        lastName: patientData.lastName,
        birthDate: patientData.birthDate,
        ssn: patientData.ssn,
        medicalHistory: patientData.medicalHistory
    };
    
    const encryptedPHI = encryptPHI(phi);
    
    // Store with audit trail
    const patient = await db.transaction(async (tx) => {
        const newPatient = await tx.patients.create({
            data: {
                id: generatePatientId(),
                encrypted_phi: encryptedPHI.data,
                encryption_iv: encryptedPHI.iv,
                auth_tag: encryptedPHI.authTag,
                created_by: createdBy,
                created_at: new Date()
            }
        });
        
        // Audit log
        await tx.audit_logs.create({
            data: {
                action: 'CREATE_PATIENT',
                user_id: createdBy,
                patient_id: newPatient.id,
                ip_address: req.ip,
                user_agent: req.get('User-Agent'),
                timestamp: new Date()
            }
        });
        
        return newPatient;
    });
    
    logger.info('Patient record created', {
        patientId: patient.id,
        createdBy,
        // Never log PHI data
    });
    
    return patient;
};
```

### Python Standards

#### Code Style (PEP 8 + Medical Extensions)
```python
# ✅ GOOD: Type hints and clear naming
from typing import Dict, List, Optional
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

class MedicalTranscription:
    """Medical transcription processing with PHI protection."""
    
    def __init__(self, encryption_key: str, audit_logger: AuditLogger):
        self.encryption_key = encryption_key
        self.audit_logger = audit_logger
    
    async def process_audio(
        self, 
        audio_file: AudioFile, 
        patient_id: str,
        user_id: str
    ) -> TranscriptionResult:
        """Process medical audio with HIPAA compliance.
        
        Args:
            audio_file: The audio file to transcribe
            patient_id: Patient identifier for audit logging
            user_id: User performing the transcription
            
        Returns:
            TranscriptionResult with encrypted content
            
        Raises:
            TranscriptionError: If processing fails
            ValidationError: If inputs are invalid
        """
        try:
            # Validate inputs
            if not audio_file or not patient_id or not user_id:
                raise ValidationError("Missing required parameters")
            
            # Check file size and format
            if audio_file.size > MAX_AUDIO_SIZE:
                raise ValidationError("Audio file too large")
            
            if audio_file.format not in ALLOWED_FORMATS:
                raise ValidationError("Unsupported audio format")
            
            # Log access attempt
            await self.audit_logger.log_phi_access(
                user_id=user_id,
                patient_id=patient_id,
                action="AUDIO_TRANSCRIPTION_START",
                ip_address=request.remote_addr
            )
            
            # Process transcription
            transcript = await self._transcribe_audio(audio_file)
            
            # Enhance with medical terminology
            enhanced_transcript = await self._enhance_medical_terminology(transcript)
            
            # Encrypt result
            encrypted_result = self._encrypt_transcription(enhanced_transcript)
            
            # Store in database
            result = await self._store_transcription(
                encrypted_result,
                patient_id,
                user_id
            )
            
            # Log successful completion
            await self.audit_logger.log_phi_access(
                user_id=user_id,
                patient_id=patient_id,
                action="AUDIO_TRANSCRIPTION_COMPLETE",
                result_id=result.id
            )
            
            logger.info(
                "Transcription completed successfully",
                extra={
                    "patient_id": patient_id,
                    "user_id": user_id,
                    "result_id": result.id,
                    "audio_duration": audio_file.duration,
                    "transcript_length": len(enhanced_transcript)
                }
            )
            
            return result
            
        except Exception as e:
            # Log error with context (no PHI in logs)
            logger.error(
                "Transcription failed",
                extra={
                    "error": str(e),
                    "patient_id": patient_id,  # ID is OK for debugging
                    "user_id": user_id,
                    "audio_file_id": audio_file.id
                },
                exc_info=True
            )
            
            # Log failed attempt
            await self.audit_logger.log_phi_access(
                user_id=user_id,
                patient_id=patient_id,
                action="AUDIO_TRANSCRIPTION_FAILED",
                error=str(e)
            )
            
            raise TranscriptionError(f"Transcription processing failed: {str(e)}")

# ❌ BAD: No type hints, unclear names, no error handling
def process(audio, pid, uid):
    result = transcribe(audio)
    return result
```

#### Medical Data Validation
```python
from pydantic import BaseModel, Field, validator
from typing import Optional
import re

class PatientData(BaseModel):
    """Patient data model with validation."""
    
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100) 
    birth_date: datetime = Field(...)
    medical_record_number: Optional[str] = Field(None, regex=r'^MRN-\d{8}$')
    ssn: Optional[str] = Field(None, regex=r'^\d{3}-\d{2}-\d{4}$')
    
    @validator('birth_date')
    def validate_birth_date(cls, v):
        if v > datetime.now():
            raise ValueError('Birth date cannot be in the future')
        if v < datetime(1900, 1, 1):
            raise ValueError('Birth date too old')
        return v
    
    @validator('first_name', 'last_name')
    def validate_names(cls, v):
        if not re.match(r'^[a-zA-Z\s\-\']+$', v):
            raise ValueError('Names can only contain letters, spaces, hyphens, and apostrophes')
        return v.strip()
    
    class Config:
        # Don't allow extra fields
        extra = "forbid"
        # Use enum values
        use_enum_values = True
        # Validate assignment
        validate_assignment = True
```

### SQL Standards

```sql
-- ✅ GOOD: Use proper indexing and constraints
CREATE TABLE patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    medical_record_number VARCHAR(20) UNIQUE NOT NULL,
    encrypted_phi TEXT NOT NULL,
    encryption_iv VARCHAR(32) NOT NULL,
    auth_tag VARCHAR(32) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    
    -- Audit fields
    version INTEGER DEFAULT 1,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID REFERENCES users(id)
);

-- Create indexes for performance
CREATE INDEX idx_patients_mrn ON patients(medical_record_number) WHERE NOT is_deleted;
CREATE INDEX idx_patients_created_at ON patients(created_at) WHERE NOT is_deleted;
CREATE INDEX idx_patients_created_by ON patients(created_by) WHERE NOT is_deleted;

-- ✅ GOOD: Parameterized queries
-- In application code:
SELECT p.id, p.encrypted_phi, p.encryption_iv, p.auth_tag 
FROM patients p 
WHERE p.id = $1 
  AND p.is_deleted = FALSE
  AND EXISTS (
    SELECT 1 FROM patient_access pa 
    WHERE pa.patient_id = p.id 
      AND pa.user_id = $2 
      AND pa.access_type IN ('READ', 'WRITE')
  );

-- ❌ BAD: String concatenation (SQL injection risk)
SELECT * FROM patients WHERE id = '" + patientId + "'
```

## Security Guidelines

### Input Validation

```javascript
// ✅ GOOD: Comprehensive input validation
const Joi = require('joi');

const patientSchema = Joi.object({
    firstName: Joi.string().alphanum().min(1).max(100).required(),
    lastName: Joi.string().alphanum().min(1).max(100).required(),
    email: Joi.string().email().required(),
    birthDate: Joi.date().max('now').required(),
    medicalRecordNumber: Joi.string().pattern(/^MRN-\d{8}$/)
});

const validatePatientInput = (req, res, next) => {
    const { error } = patientSchema.validate(req.body);
    if (error) {
        logger.warn('Invalid patient input', { 
            error: error.details[0].message,
            userId: req.user?.id 
        });
        return res.status(400).json({ 
            error: 'Invalid input data',
            details: error.details[0].message 
        });
    }
    next();
};
```

### Output Encoding

```javascript
// ✅ GOOD: Proper output encoding
const DOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');

const sanitizeHtml = (dirty) => {
    const window = new JSDOM('').window;
    const purify = DOMPurify(window);
    
    return purify.sanitize(dirty, {
        ALLOWED_TAGS: ['p', 'br', 'strong', 'em'],
        ALLOWED_ATTR: []
    });
};

// Usage in API response
app.get('/api/reports/:id', async (req, res) => {
    const report = await getReportById(req.params.id);
    
    // Sanitize before sending to client
    const sanitizedReport = {
        ...report,
        content: sanitizeHtml(report.content),
        summary: sanitizeHtml(report.summary)
    };
    
    res.json(sanitizedReport);
});
```

## Testing Requirements

### Test Categories

1. **Unit Tests**: Individual functions and components
2. **Integration Tests**: API endpoints and service interactions
3. **Security Tests**: Authentication, authorization, input validation
4. **Medical Accuracy Tests**: Clinical terminology and workflow validation
5. **Performance Tests**: Load testing and response time validation
6. **Compliance Tests**: HIPAA audit logging and PHI protection

### Test Structure

```javascript
// ✅ GOOD: Comprehensive test structure
describe('Patient Data Processing', () => {
    describe('createPatient', () => {
        beforeEach(async () => {
            await setupTestDatabase();
            await seedTestUsers();
        });
        
        afterEach(async () => {
            await cleanupTestDatabase();
        });
        
        it('should create patient with encrypted PHI', async () => {
            const patientData = {
                firstName: 'John',
                lastName: 'Doe',
                birthDate: '1980-01-01',
                ssn: '123-45-6789'
            };
            
            const result = await createPatient(patientData, TEST_USER_ID);
            
            expect(result.id).toBeDefined();
            expect(result.encrypted_phi).toBeDefined();
            expect(result.firstName).toBeUndefined(); // PHI should be encrypted
            
            // Verify audit log created
            const auditLogs = await getAuditLogs(result.id);
            expect(auditLogs).toHaveLength(1);
            expect(auditLogs[0].action).toBe('CREATE_PATIENT');
        });
        
        it('should reject invalid SSN format', async () => {
            const patientData = {
                firstName: 'John',
                lastName: 'Doe', 
                birthDate: '1980-01-01',
                ssn: 'invalid-ssn'
            };
            
            await expect(createPatient(patientData, TEST_USER_ID))
                .rejects.toThrow('Invalid SSN format');
        });
        
        it('should prevent SQL injection in patient creation', async () => {
            const maliciousData = {
                firstName: "'; DROP TABLE patients; --",
                lastName: 'Test',
                birthDate: '1980-01-01'
            };
            
            // Should not throw database error, should validate and reject
            await expect(createPatient(maliciousData, TEST_USER_ID))
                .rejects.toThrow('Invalid input data');
                
            // Verify table still exists
            const tableExists = await checkTableExists('patients');
            expect(tableExists).toBe(true);
        });
    });
});
```

### Medical Accuracy Testing

```python
# Medical terminology and clinical workflow tests
import pytest
from medical_ai.transcription import MedicalTranscriber
from medical_ai.terminology import MedicalTerminologyValidator

class TestMedicalAccuracy:
    
    @pytest.fixture
    def transcriber(self):
        return MedicalTranscriber()
    
    @pytest.fixture 
    def terminology_validator(self):
        return MedicalTerminologyValidator()
    
    def test_cardiac_terminology_recognition(self, transcriber):
        """Test recognition of cardiac medical terms."""
        audio_content = load_test_audio('cardiac_exam.wav')
        
        result = transcriber.transcribe(audio_content)
        
        # Verify cardiac terms are correctly identified
        expected_terms = [
            'myocardial infarction',
            'electrocardiogram',
            'bradycardia',
            'systolic murmur'
        ]
        
        for term in expected_terms:
            assert term.lower() in result.transcript.lower()
    
    def test_medication_dosage_accuracy(self, transcriber):
        """Test accurate transcription of medication dosages."""
        audio_content = load_test_audio('medication_orders.wav')
        
        result = transcriber.transcribe(audio_content)
        
        # Verify dosages are transcribed correctly
        assert 'metformin 500 mg' in result.transcript.lower()
        assert 'twice daily' in result.transcript.lower()
        assert 'with meals' in result.transcript.lower()
    
    def test_german_medical_terminology(self, transcriber):
        """Test German medical terminology recognition."""
        audio_content = load_test_audio('german_diagnosis.wav')
        
        result = transcriber.transcribe(audio_content, language='de-DE')
        
        # Verify German medical terms
        expected_german_terms = [
            'Herzinfarkt',
            'Bluthochdruck', 
            'Elektrokardiogramm'
        ]
        
        for term in expected_german_terms:
            assert term in result.transcript
    
    def test_medical_abbreviation_expansion(self, terminology_validator):
        """Test expansion of medical abbreviations."""
        abbreviations = {
            'MI': 'myocardial infarction',
            'HTN': 'hypertension',
            'DM': 'diabetes mellitus'
        }
        
        for abbrev, full_form in abbreviations.items():
            expanded = terminology_validator.expand_abbreviation(abbrev)
            assert expanded == full_form
```

## Documentation Standards

### Code Documentation

```javascript
/**
 * Processes medical transcription with PHI protection and audit logging.
 * 
 * @param {Object} audioFile - The audio file to transcribe
 * @param {string} audioFile.id - Unique identifier for the audio file
 * @param {Buffer} audioFile.content - Audio file binary content
 * @param {string} audioFile.mimeType - MIME type of the audio file
 * @param {string} patientId - Patient identifier for HIPAA audit logging
 * @param {string} userId - User performing the transcription
 * @param {Object} options - Optional configuration
 * @param {string} [options.language='en-US'] - Language code for transcription
 * @param {boolean} [options.enhanceTerminology=true] - Apply medical terminology enhancement
 * 
 * @returns {Promise<TranscriptionResult>} Promise resolving to transcription result
 * @returns {string} returns.id - Unique identifier for the transcription
 * @returns {string} returns.encryptedContent - Encrypted transcription content
 * @returns {number} returns.confidenceScore - Transcription confidence (0-1)
 * @returns {MedicalTerm[]} returns.medicalTerms - Identified medical terminology
 * 
 * @throws {ValidationError} When input parameters are invalid
 * @throws {AuthorizationError} When user lacks patient access permissions
 * @throws {TranscriptionError} When transcription processing fails
 * @throws {EncryptionError} When PHI encryption fails
 * 
 * @example
 * const audioFile = {
 *   id: 'audio-123',
 *   content: audioBuffer,
 *   mimeType: 'audio/wav'
 * };
 * 
 * try {
 *   const result = await processTranscription(
 *     audioFile,
 *     'patient-456', 
 *     'user-789',
 *     { language: 'de-DE', enhanceTerminology: true }
 *   );
 *   console.log('Transcription completed:', result.id);
 * } catch (error) {
 *   if (error instanceof ValidationError) {
 *     console.error('Invalid input:', error.message);
 *   } else if (error instanceof AuthorizationError) {
 *     console.error('Access denied:', error.message);
 *   }
 * }
 * 
 * @since 2.1.0
 * @memberof MedicalTranscription
 * @requires HIPAA_AUDIT_ENABLED=true
 * @requires PHI_ENCRYPTION_KEY environment variable
 */
async function processTranscription(audioFile, patientId, userId, options = {}) {
    // Implementation here
}
```

### API Documentation

```yaml
# OpenAPI/Swagger documentation
paths:
  /api/patients/{patientId}/transcriptions:
    post:
      summary: Create new medical transcription
      description: |
        Processes audio file to create medical transcription with HIPAA compliance.
        
        **Security Requirements:**
        - Valid JWT token required
        - User must have READ access to the specified patient
        - All PHI is encrypted at rest
        - Audit logging is automatically performed
        
        **Medical Context:**
        - Supports medical terminology enhancement
        - Handles multiple languages including German medical terms
        - Provides confidence scoring for clinical accuracy
        
      tags: [Medical Transcription]
      security:
        - JWTAuth: []
      parameters:
        - name: patientId
          in: path
          required: true
          schema:
            type: string
            format: uuid
          description: Patient UUID for HIPAA audit logging
      requestBody:
        required: true
        content:
          multipart/form-data:
            schema:
              type: object
              properties:
                audioFile:
                  type: string
                  format: binary
                  description: Audio file (WAV, MP3, M4A supported)
                language:
                  type: string
                  enum: [en-US, de-DE, es-ES]
                  default: en-US
                  description: Transcription language
                enhanceTerminology:
                  type: boolean
                  default: true
                  description: Apply medical terminology enhancement
      responses:
        201:
          description: Transcription created successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/TranscriptionResult'
        400:
          description: Invalid input parameters
        401:
          description: Authentication required
        403:
          description: Insufficient permissions for patient access
        413:
          description: Audio file too large
        422:
          description: Unsupported audio format
        500:
          description: Internal transcription error
```

## Review Process

### Code Review Guidelines

#### For Reviewers

**Security Review:**
- [ ] Input validation implemented and comprehensive
- [ ] Authentication and authorization properly checked
- [ ] No sensitive data in logs or error messages
- [ ] SQL injection prevention verified
- [ ] XSS prevention measures in place
- [ ] Secrets not hardcoded in code

**Medical Compliance Review:**
- [ ] PHI encryption implemented for sensitive data
- [ ] Audit logging present for all PHI access
- [ ] Data retention policies followed
- [ ] Access controls properly implemented
- [ ] Medical terminology accuracy verified

**Code Quality Review:**
- [ ] Code follows established patterns and style
- [ ] Functions are well-documented with JSDoc/docstrings
- [ ] Error handling is comprehensive
- [ ] Tests provide adequate coverage
- [ ] Performance implications considered

**Architecture Review:**
- [ ] Changes align with overall system architecture
- [ ] Database schema changes are backward compatible
- [ ] API changes are versioned appropriately
- [ ] Dependencies are necessary and up-to-date

#### Review Timeline

- **Standard PRs**: 2-3 business days
- **Security PRs**: 1 business day (expedited)
- **Hotfixes**: 4-8 hours
- **Compliance PRs**: 3-5 business days (additional compliance review)

### Definition of Done

Before a PR can be merged:

**Technical Requirements:**
- [ ] All automated tests pass
- [ ] Code coverage meets minimum threshold (80%)
- [ ] Security scans pass (no critical/high vulnerabilities)
- [ ] Performance tests pass (if applicable)
- [ ] Documentation updated

**Review Requirements:**
- [ ] Code reviewed by 2+ developers
- [ ] Security review completed (if security-sensitive)
- [ ] Medical review completed (if clinically relevant)
- [ ] All review comments addressed

**Compliance Requirements:**
- [ ] HIPAA compliance verified
- [ ] Audit logging implemented
- [ ] PHI protection measures validated
- [ ] Access controls tested

**Quality Requirements:**
- [ ] No linting errors
- [ ] Code formatted according to standards
- [ ] Commit messages follow conventions
- [ ] Breaking changes documented

## HIPAA Compliance

### PHI Handling Requirements

All contributors working with PHI must follow these requirements:

#### Data Classification

**PHI (Protected Health Information):**
- Patient names, addresses, phone numbers
- Medical record numbers, SSNs
- Medical history, diagnoses, treatments
- Audio recordings of patient interactions

**Non-PHI:**
- Aggregated statistics (no individual identification)
- System logs without patient data
- Configuration settings
- Code and documentation

#### PHI Processing Rules

1. **Encryption**: All PHI must be encrypted at rest and in transit
2. **Access Logging**: All PHI access must be audit logged
3. **Minimum Necessary**: Only access PHI required for your work
4. **Secure Communication**: Use encrypted channels for PHI discussion
5. **Data Retention**: Follow established retention policies

### Development with Test Data

#### Test Data Requirements

```javascript
// ✅ GOOD: Synthetic test data
const TEST_PATIENTS = [
    {
        id: 'test-patient-001',
        firstName: 'John',  // Common, non-identifying name
        lastName: 'Doe',    // Common, non-identifying name
        birthDate: '1980-01-01',
        medicalRecordNumber: 'MRN-TEST001',
        notes: 'Test patient for development'
    }
];

// ❌ BAD: Real-looking PHI (even if fake)
const TEST_PATIENTS = [
    {
        id: 'patient-real-001',
        firstName: 'Jennifer',
        lastName: 'Martinez',
        birthDate: '1985-03-15',
        ssn: '555-12-3456',  // Looks like real SSN
        address: '123 Main St, Boston, MA'
    }
];
```

#### Data Generation

Use libraries like Faker.js with medical-specific generators:

```javascript
const faker = require('faker');

const generateTestPatient = () => ({
    id: `test-${faker.datatype.uuid()}`,
    firstName: faker.name.firstName(),
    lastName: faker.name.lastName(), 
    birthDate: faker.date.between('1920-01-01', '2010-01-01'),
    medicalRecordNumber: `MRN-TEST${faker.datatype.number({ min: 100000, max: 999999 })}`,
    // Never generate SSN or real addresses for test data
});
```

### Audit Logging Requirements

All PHI access must be logged with:

```javascript
const auditPHIAccess = async (action, context) => {
    await AuditLog.create({
        timestamp: new Date(),
        event_type: 'PHI_ACCESS',
        action: action, // CREATE, READ, UPDATE, DELETE, EXPORT
        user_id: context.userId,
        patient_id: context.patientId,
        resource_type: context.resourceType, // patient, transcription, report
        resource_id: context.resourceId,
        ip_address: context.ipAddress,
        user_agent: context.userAgent,
        session_id: context.sessionId,
        outcome: context.outcome, // SUCCESS, FAILED, DENIED
        failure_reason: context.failureReason, // if outcome is not SUCCESS
        
        // Security context
        authentication_method: context.authMethod,
        authorization_method: context.authzMethod,
        
        // Request context
        request_id: context.requestId,
        correlation_id: context.correlationId
    });
};
```

## Getting Help

### Community Resources

- **Documentation**: https://docs.medessence-ai.com
- **Developer Forum**: https://community.medessence-ai.com  
- **Stack Overflow**: Tag questions with `medessence-ai`
- **Discord**: https://discord.gg/medessence-ai (for real-time chat)

### Team Contacts

- **General Questions**: dev-team@medessence-ai.com
- **Security Issues**: security@medessence-ai.com
- **HIPAA Compliance**: compliance@medessence-ai.com
- **Medical/Clinical Questions**: clinical-team@medessence-ai.com

### Office Hours

The core team holds weekly office hours for contributors:

- **When**: Fridays 2-4 PM EST
- **Where**: https://meet.medessence-ai.com/office-hours
- **Topics**: Architecture discussions, contribution planning, Q&A

---

**Thank you for contributing to MedEssenceAI!** 

Your contributions help improve healthcare technology and ultimately benefit patients worldwide. We appreciate your commitment to quality, security, and compliance in medical AI development.

---

**Document Version**: 1.2  
**Last Updated**: 2024-12-20  
**Next Review**: 2025-03-20  
**Maintained By**: Developer Relations Team