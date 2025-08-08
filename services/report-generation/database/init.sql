-- Medical Report Generation Service Database Initialization
-- PostgreSQL initialization script for radiology reports

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- Create custom types
DO $$
BEGIN
    -- Report status enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_status') THEN
        CREATE TYPE report_status AS ENUM ('draft', 'in_review', 'finalized', 'signed', 'archived');
    END IF;
    
    -- Examination type enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'examination_type') THEN
        CREATE TYPE examination_type AS ENUM ('MRI', 'CT', 'X-Ray', 'Ultrasound', 'Mammography');
    END IF;
    
    -- Template type enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'template_type') THEN
        CREATE TYPE template_type AS ENUM ('standard', 'specialized', 'emergency', 'screening');
    END IF;
    
    -- Template language enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'template_language') THEN
        CREATE TYPE template_language AS ENUM ('de', 'en');
    END IF;
END
$$;

-- Create database user for the application (if not exists)
DO
$do$
BEGIN
   IF NOT EXISTS (
      SELECT FROM pg_catalog.pg_roles
      WHERE rolname = 'report_service') THEN
      
      CREATE ROLE report_service LOGIN PASSWORD 'report_service_password_2024';
   END IF;
END
$do$;

-- Grant necessary permissions
GRANT CONNECT ON DATABASE radiology_reports TO report_service;
GRANT USAGE ON SCHEMA public TO report_service;
GRANT CREATE ON SCHEMA public TO report_service;

-- Create tables if they don't exist

-- Report templates table
CREATE TABLE IF NOT EXISTS report_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    examination_type examination_type NOT NULL,
    template_type template_type DEFAULT 'standard',
    language template_language DEFAULT 'de',
    header_template TEXT NOT NULL,
    clinical_indication_template TEXT,
    technical_parameters_template TEXT,
    findings_template TEXT NOT NULL,
    assessment_template TEXT NOT NULL,
    recommendations_template TEXT,
    footer_template TEXT,
    template_config JSONB,
    required_fields JSONB,
    optional_fields JSONB,
    validation_rules JSONB,
    ai_prompt_system TEXT,
    ai_prompt_user TEXT,
    ai_examples JSONB,
    css_styles TEXT,
    layout_config JSONB,
    compliance_requirements JSONB,
    required_signatures JSONB,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    version VARCHAR(20) DEFAULT '1.0.0',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50),
    updated_by VARCHAR(50),
    
    CONSTRAINT unique_default_per_exam_type UNIQUE (examination_type, language, is_default) 
        DEFERRABLE INITIALLY DEFERRED
);

-- Reports table
CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id VARCHAR(50) NOT NULL,
    examination_date TIMESTAMP NOT NULL,
    examination_type examination_type NOT NULL,
    clinical_indication TEXT,
    technical_parameters JSONB,
    findings TEXT NOT NULL,
    assessment TEXT NOT NULL,
    recommendations TEXT,
    original_transcription TEXT NOT NULL,
    structured_content JSONB,
    confidence_score INTEGER CHECK (confidence_score >= 0 AND confidence_score <= 100),
    icd_codes JSONB,
    procedure_codes JSONB,
    status report_status DEFAULT 'draft' NOT NULL,
    version INTEGER DEFAULT 1 NOT NULL,
    template_id UUID REFERENCES report_templates(id),
    dictating_physician_id VARCHAR(50),
    dictating_physician_name VARCHAR(200),
    reviewing_physician_id VARCHAR(50),
    reviewing_physician_name VARCHAR(200),
    dictation_signature TEXT,
    review_signature TEXT,
    signature_timestamp TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    dictated_at TIMESTAMP,
    reviewed_at TIMESTAMP,
    finalized_at TIMESTAMP,
    quality_score INTEGER CHECK (quality_score >= 0 AND quality_score <= 100),
    compliance_flags JSONB,
    audit_trail JSONB,
    metadata JSONB,
    tags JSONB
);

-- Report versions table
CREATE TABLE IF NOT EXISTS report_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    content_snapshot JSONB NOT NULL,
    changes_summary TEXT,
    change_reason VARCHAR(500),
    created_by VARCHAR(50) NOT NULL,
    created_by_name VARCHAR(200),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    
    CONSTRAINT unique_report_version UNIQUE (report_id, version_number)
);

-- Report attachments table
CREATE TABLE IF NOT EXISTS report_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INTEGER,
    file_type VARCHAR(50),
    mime_type VARCHAR(100),
    description TEXT,
    attachment_type VARCHAR(50),
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    uploaded_by VARCHAR(50)
);

-- Medical terms table
CREATE TABLE IF NOT EXISTS medical_terms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    term_de VARCHAR(500) NOT NULL,
    term_en VARCHAR(500),
    term_latin VARCHAR(500),
    category VARCHAR(100) NOT NULL,
    subcategory VARCHAR(100),
    specialty VARCHAR(100),
    definition_de TEXT,
    definition_en TEXT,
    synonyms_de JSONB,
    synonyms_en JSONB,
    abbreviations JSONB,
    icd_10_codes JSONB,
    snomed_codes JSONB,
    usage_count INTEGER DEFAULT 0,
    confidence_score REAL DEFAULT 1.0 CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_validated BOOLEAN DEFAULT FALSE,
    validated_by VARCHAR(50)
);

-- ICD codes table
CREATE TABLE IF NOT EXISTS icd_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(20) NOT NULL UNIQUE,
    description_de TEXT NOT NULL,
    description_en TEXT,
    chapter VARCHAR(10),
    block VARCHAR(20),
    category VARCHAR(10),
    is_billable BOOLEAN DEFAULT TRUE,
    is_header BOOLEAN DEFAULT FALSE,
    gender_specific VARCHAR(10),
    age_restrictions JSONB,
    includes JSONB,
    excludes JSONB,
    parent_code VARCHAR(20),
    child_codes JSONB,
    radiology_relevance REAL DEFAULT 0.0 CHECK (radiology_relevance >= 0.0 AND radiology_relevance <= 1.0),
    common_findings JSONB,
    typical_examinations JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    icd_version VARCHAR(10) DEFAULT 'ICD-10-GM'
);

-- Radiology findings table
CREATE TABLE IF NOT EXISTS radiology_findings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    finding_name_de VARCHAR(300) NOT NULL,
    finding_name_en VARCHAR(300),
    examination_type VARCHAR(50) NOT NULL,
    body_region VARCHAR(100) NOT NULL,
    organ_system VARCHAR(100),
    normal_description_de TEXT,
    abnormal_description_de TEXT,
    measurement_template TEXT,
    severity_levels JSONB,
    urgency_level INTEGER DEFAULT 1 CHECK (urgency_level >= 1 AND urgency_level <= 5),
    requires_followup BOOLEAN DEFAULT FALSE,
    related_icd_codes JSONB,
    related_terms JSONB,
    differential_diagnoses JSONB,
    example_descriptions JSONB,
    keywords JSONB,
    frequency_score REAL DEFAULT 0.0 CHECK (frequency_score >= 0.0 AND frequency_score <= 1.0),
    accuracy_score REAL DEFAULT 1.0 CHECK (accuracy_score >= 0.0 AND accuracy_score <= 1.0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50)
);

-- Quality metrics table
CREATE TABLE IF NOT EXISTS quality_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_name VARCHAR(100) NOT NULL,
    metric_type VARCHAR(50) NOT NULL,
    score REAL NOT NULL,
    threshold_warning REAL,
    threshold_error REAL,
    report_id UUID,
    template_id UUID,
    examination_type VARCHAR(50),
    details JSONB,
    recommendations JSONB,
    measured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    measured_by VARCHAR(50)
);

-- Template sections table
CREATE TABLE IF NOT EXISTS template_sections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    section_type VARCHAR(50) NOT NULL,
    content_template TEXT NOT NULL,
    ai_prompt TEXT,
    is_required BOOLEAN DEFAULT TRUE,
    display_order INTEGER DEFAULT 0,
    formatting_rules JSONB,
    medical_terms JSONB,
    icd_mappings JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Template variables table
CREATE TABLE IF NOT EXISTS template_variables (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    variable_type VARCHAR(50) NOT NULL,
    default_value TEXT,
    possible_values JSONB,
    validation_pattern VARCHAR(200),
    display_name_de VARCHAR(200),
    display_name_en VARCHAR(200),
    help_text_de TEXT,
    help_text_en TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_reports_patient_id ON reports(patient_id);
CREATE INDEX IF NOT EXISTS idx_reports_examination_date ON reports(examination_date);
CREATE INDEX IF NOT EXISTS idx_reports_examination_type ON reports(examination_type);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at);
CREATE INDEX IF NOT EXISTS idx_reports_dictating_physician ON reports(dictating_physician_id);

CREATE INDEX IF NOT EXISTS idx_medical_terms_de ON medical_terms(term_de);
CREATE INDEX IF NOT EXISTS idx_medical_terms_category ON medical_terms(category);
CREATE INDEX IF NOT EXISTS idx_medical_terms_specialty ON medical_terms(specialty);
CREATE INDEX IF NOT EXISTS idx_medical_terms_text_search ON medical_terms USING gin(to_tsvector('german', term_de));

CREATE INDEX IF NOT EXISTS idx_icd_codes_code ON icd_codes(code);
CREATE INDEX IF NOT EXISTS idx_icd_codes_radiology_relevance ON icd_codes(radiology_relevance);
CREATE INDEX IF NOT EXISTS idx_icd_codes_text_search ON icd_codes USING gin(to_tsvector('german', description_de));

CREATE INDEX IF NOT EXISTS idx_radiology_findings_examination_type ON radiology_findings(examination_type);
CREATE INDEX IF NOT EXISTS idx_radiology_findings_body_region ON radiology_findings(body_region);
CREATE INDEX IF NOT EXISTS idx_radiology_findings_text_search ON radiology_findings USING gin(to_tsvector('german', finding_name_de));

CREATE INDEX IF NOT EXISTS idx_report_versions_report_id ON report_versions(report_id);
CREATE INDEX IF NOT EXISTS idx_report_attachments_report_id ON report_attachments(report_id);

CREATE INDEX IF NOT EXISTS idx_quality_metrics_report_id ON quality_metrics(report_id);
CREATE INDEX IF NOT EXISTS idx_quality_metrics_measured_at ON quality_metrics(measured_at);

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_reports_updated_at BEFORE UPDATE ON reports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON report_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_medical_terms_updated_at BEFORE UPDATE ON medical_terms
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_icd_codes_updated_at BEFORE UPDATE ON icd_codes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_radiology_findings_updated_at BEFORE UPDATE ON radiology_findings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions to application user
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO report_service;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO report_service;

-- Insert default report templates
INSERT INTO report_templates (
    name, description, examination_type, template_type, language,
    header_template, findings_template, assessment_template,
    is_default, is_active
) VALUES 
(
    'Standard MRI Template',
    'Default German template for MRI examinations',
    'MRI',
    'standard',
    'de',
    '<div class="header">MRI Befund</div>',
    '<div class="findings">{{ findings }}</div>',
    '<div class="assessment">{{ assessment }}</div>',
    TRUE,
    TRUE
),
(
    'Standard CT Template',
    'Default German template for CT examinations',
    'CT',
    'standard',
    'de',
    '<div class="header">CT Befund</div>',
    '<div class="findings">{{ findings }}</div>',
    '<div class="assessment">{{ assessment }}</div>',
    TRUE,
    TRUE
),
(
    'Standard X-Ray Template',
    'Default German template for X-Ray examinations',
    'X-Ray',
    'standard',
    'de',
    '<div class="header">Röntgen Befund</div>',
    '<div class="findings">{{ findings }}</div>',
    '<div class="assessment">{{ assessment }}</div>',
    TRUE,
    TRUE
);

-- Insert sample medical terms
INSERT INTO medical_terms (term_de, term_en, category, definition_de, confidence_score) VALUES
('Kontrastmittel', 'Contrast agent', 'procedure', 'Substanz zur Verbesserung der Bildgebung', 1.0),
('Raumforderung', 'Space-occupying lesion', 'pathology', 'Pathologische Struktur, die Raum einnimmt', 1.0),
('unauffällig', 'unremarkable', 'assessment', 'Ohne pathologische Veränderungen', 1.0),
('Verkalkung', 'Calcification', 'pathology', 'Einlagerung von Kalksalzen im Gewebe', 1.0);

-- Insert sample ICD codes relevant to radiology
INSERT INTO icd_codes (code, description_de, description_en, radiology_relevance, is_billable) VALUES
('Z01.6', 'Radiologische Untersuchung, anderenorts nicht klassifiziert', 'Radiological examination, not elsewhere classified', 1.0, TRUE),
('R93.1', 'Abnorme Befunde bei bildgebenden Untersuchungen des Herzens und des Koronargefäßsystems', 'Abnormal findings on diagnostic imaging of heart and coronary circulation', 0.9, TRUE),
('M79.3', 'Panniculitis, nicht näher bezeichnet', 'Panniculitis, unspecified', 0.7, TRUE);

-- Insert sample radiology findings
INSERT INTO radiology_findings (
    finding_name_de, finding_name_en, examination_type, body_region,
    normal_description_de, abnormal_description_de, frequency_score
) VALUES
(
    'Hirnparenchym',
    'Brain parenchyma',
    'MRI',
    'Kopf',
    'Das Hirnparenchym zeigt eine regelrechte Signalintensität ohne fokale Läsionen.',
    'Im Hirnparenchym zeigen sich hyperintense Läsionen in der T2-Wichtung.',
    0.8
),
(
    'Lungenparenchym',
    'Lung parenchyma',
    'CT',
    'Thorax',
    'Das Lungenparenchym zeigt keine infiltrativen Veränderungen.',
    'Im Lungenparenchym zeigen sich fleckförmige Verschattungen.',
    0.9
);

-- Create a function to anonymize patient data (GDPR compliance)
CREATE OR REPLACE FUNCTION anonymize_patient_data(patient_id_param VARCHAR(50))
RETURNS VOID AS $$
BEGIN
    UPDATE reports 
    SET 
        patient_id = 'ANONYMIZED_' || substring(md5(patient_id), 1, 8),
        audit_trail = COALESCE(audit_trail, '[]'::jsonb) || 
                     jsonb_build_object(
                         'action', 'anonymized',
                         'timestamp', CURRENT_TIMESTAMP,
                         'reason', 'Data protection compliance'
                     )
    WHERE patient_id = patient_id_param;
END;
$$ LANGUAGE plpgsql;

-- Create a function to clean up old data based on retention policy
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER := 0;
    retention_date TIMESTAMP;
BEGIN
    -- Calculate retention date (default 7 years)
    retention_date := CURRENT_TIMESTAMP - INTERVAL '2555 days';
    
    -- Delete old reports
    WITH deleted AS (
        DELETE FROM reports 
        WHERE created_at < retention_date 
        AND status = 'archived'
        RETURNING id
    )
    SELECT COUNT(*) INTO deleted_count FROM deleted;
    
    -- Clean up orphaned versions and attachments
    DELETE FROM report_versions 
    WHERE report_id NOT IN (SELECT id FROM reports);
    
    DELETE FROM report_attachments 
    WHERE report_id NOT IN (SELECT id FROM reports);
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Log successful initialization
INSERT INTO quality_metrics (
    metric_name, metric_type, score, details, measured_by
) VALUES (
    'database_initialization',
    'system',
    100,
    '{"status": "completed", "timestamp": "' || CURRENT_TIMESTAMP || '", "tables_created": "all"}',
    'system'
);

-- Final permissions and setup
GRANT EXECUTE ON FUNCTION anonymize_patient_data(VARCHAR) TO report_service;
GRANT EXECUTE ON FUNCTION cleanup_old_data() TO report_service;

COMMIT;