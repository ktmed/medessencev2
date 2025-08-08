-- Patient-Friendly Summary Generation Service Database Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom enum types
CREATE TYPE complexity_levels AS ENUM ('basic', 'intermediate', 'advanced');
CREATE TYPE summary_status AS ENUM ('draft', 'generated', 'reviewed', 'approved', 'archived');
CREATE TYPE template_complexity AS ENUM ('basic', 'intermediate', 'advanced');

-- Patient Summaries Table
CREATE TABLE IF NOT EXISTS patient_summaries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id VARCHAR(255),
    patient_id VARCHAR(255),
    
    -- Language and complexity
    language VARCHAR(10) NOT NULL DEFAULT 'de',
    complexity_level complexity_levels NOT NULL DEFAULT 'basic',
    
    -- Original medical content
    original_report_text TEXT NOT NULL,
    medical_findings JSONB,
    
    -- Generated summary content
    title VARCHAR(500) NOT NULL,
    what_was_examined TEXT NOT NULL,
    key_findings TEXT NOT NULL,
    what_this_means TEXT NOT NULL,
    next_steps TEXT NOT NULL,
    when_to_contact_doctor TEXT NOT NULL,
    glossary JSONB,
    
    -- Emergency and safety
    is_urgent BOOLEAN DEFAULT FALSE,
    emergency_indicators JSONB,
    safety_warnings TEXT,
    
    -- Metadata
    generation_model VARCHAR(100) NOT NULL,
    generation_time_seconds INTEGER,
    confidence_score VARCHAR(20),
    
    -- Cultural adaptation
    cultural_context VARCHAR(50),
    region_specific_info JSONB,
    
    -- Disclaimers and compliance
    medical_disclaimer TEXT NOT NULL,
    compliance_notes JSONB,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE,
    created_by VARCHAR(255),
    updated_by VARCHAR(255),
    
    -- Status tracking
    status summary_status NOT NULL DEFAULT 'generated',
    review_notes TEXT
);

-- Summary Templates Table
CREATE TABLE IF NOT EXISTS summary_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    language VARCHAR(10) NOT NULL,
    complexity_level template_complexity NOT NULL,
    
    -- Template sections
    title_template TEXT NOT NULL,
    examination_template TEXT NOT NULL,
    findings_template TEXT NOT NULL,
    meaning_template TEXT NOT NULL,
    next_steps_template TEXT NOT NULL,
    contact_doctor_template TEXT NOT NULL,
    disclaimer_template TEXT NOT NULL,
    
    -- Cultural context
    cultural_adaptations JSONB,
    region_specific_templates JSONB,
    
    -- Metadata
    is_active BOOLEAN DEFAULT TRUE,
    version VARCHAR(20) NOT NULL DEFAULT '1.0',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Medical Terms Table
CREATE TABLE IF NOT EXISTS medical_terms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Original medical term
    original_term VARCHAR(500) NOT NULL,
    language VARCHAR(10) NOT NULL DEFAULT 'de',
    
    -- Simplified translations
    simple_translation TEXT NOT NULL,
    basic_explanation TEXT,
    intermediate_explanation TEXT,
    advanced_explanation TEXT,
    
    -- Medical category
    category VARCHAR(100),
    specialty VARCHAR(100),
    body_system VARCHAR(100),
    
    -- Multilingual translations
    translations JSONB,
    
    -- Metadata
    frequency_score REAL DEFAULT 0.0,
    complexity_score REAL DEFAULT 0.0,
    patient_friendly_score REAL DEFAULT 0.0,
    
    -- Validation
    is_validated BOOLEAN DEFAULT FALSE,
    validated_by VARCHAR(255),
    validation_date TIMESTAMP WITH TIME ZONE,
    
    -- Usage tracking
    usage_count INTEGER DEFAULT 0,
    last_used TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Medical Abbreviations Table
CREATE TABLE IF NOT EXISTS medical_abbreviations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    abbreviation VARCHAR(50) NOT NULL,
    full_form VARCHAR(500) NOT NULL,
    language VARCHAR(10) NOT NULL DEFAULT 'de',
    
    -- Patient-friendly explanations
    simple_explanation TEXT NOT NULL,
    context_examples JSONB,
    
    -- Medical context
    specialty VARCHAR(100),
    usage_context VARCHAR(200),
    
    -- Multilingual support
    translations JSONB,
    
    -- Metadata
    is_common BOOLEAN DEFAULT FALSE,
    usage_frequency INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Emergency Keywords Table
CREATE TABLE IF NOT EXISTS emergency_keywords (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    keyword VARCHAR(500) NOT NULL,
    language VARCHAR(10) NOT NULL DEFAULT 'de',
    
    -- Emergency classification
    urgency_level VARCHAR(20) NOT NULL,
    emergency_type VARCHAR(100) NOT NULL,
    
    -- Patient communication
    patient_warning TEXT NOT NULL,
    immediate_actions JSONB,
    when_to_seek_help TEXT NOT NULL,
    
    -- Multilingual support
    translations JSONB,
    
    -- Context patterns
    context_patterns JSONB,
    exclusion_patterns JSONB,
    
    -- Metadata
    is_active BOOLEAN DEFAULT TRUE,
    confidence_threshold REAL DEFAULT 0.8,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Cultural Adaptations Table
CREATE TABLE IF NOT EXISTS cultural_adaptations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    language VARCHAR(10) NOT NULL,
    region VARCHAR(50),
    cultural_context VARCHAR(100) NOT NULL,
    
    -- Adaptation rules
    communication_style JSONB NOT NULL,
    medical_terminology_preferences JSONB,
    family_involvement_level VARCHAR(20),
    
    -- Template adjustments
    greeting_style TEXT,
    explanation_style TEXT,
    recommendation_style TEXT,
    disclaimer_style TEXT,
    
    -- Cultural sensitivities
    sensitive_topics JSONB,
    preferred_metaphors JSONB,
    taboo_expressions JSONB,
    
    -- Healthcare system context
    healthcare_system_info JSONB,
    typical_next_steps JSONB,
    contact_information_format TEXT,
    
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Summary Feedback Table
CREATE TABLE IF NOT EXISTS summary_feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    summary_id UUID NOT NULL REFERENCES patient_summaries(id),
    
    -- Feedback ratings (1-5 scale)
    clarity_rating INTEGER CHECK (clarity_rating >= 1 AND clarity_rating <= 5),
    usefulness_rating INTEGER CHECK (usefulness_rating >= 1 AND usefulness_rating <= 5),
    accuracy_rating INTEGER CHECK (accuracy_rating >= 1 AND accuracy_rating <= 5),
    overall_rating INTEGER CHECK (overall_rating >= 1 AND overall_rating <= 5),
    
    -- Feedback text
    comments TEXT,
    suggestions TEXT,
    
    -- Metadata
    patient_id VARCHAR(255),
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Generation Metrics Table
CREATE TABLE IF NOT EXISTS generation_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    summary_id UUID NOT NULL REFERENCES patient_summaries(id),
    
    -- Performance metrics
    generation_time_ms INTEGER NOT NULL,
    token_count_input INTEGER,
    token_count_output INTEGER,
    api_calls_made INTEGER DEFAULT 1,
    
    -- Quality metrics
    readability_score VARCHAR(20),
    medical_accuracy_score VARCHAR(20),
    translation_quality_score VARCHAR(20),
    
    -- Error tracking
    errors_encountered JSONB,
    warnings_generated JSONB,
    
    -- Model information
    model_used VARCHAR(100) NOT NULL,
    model_version VARCHAR(50),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Terminology Usage Log Table
CREATE TABLE IF NOT EXISTS terminology_usage_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    summary_id UUID NOT NULL REFERENCES patient_summaries(id),
    term_id UUID REFERENCES medical_terms(id),
    
    -- Usage details
    original_term VARCHAR(500) NOT NULL,
    simplified_term TEXT NOT NULL,
    context TEXT,
    
    -- Performance metrics
    confidence_score REAL,
    processing_time_ms INTEGER,
    
    -- Feedback
    was_helpful BOOLEAN,
    user_feedback TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_patient_summaries_patient_id ON patient_summaries(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_summaries_report_id ON patient_summaries(report_id);
CREATE INDEX IF NOT EXISTS idx_patient_summaries_language ON patient_summaries(language);
CREATE INDEX IF NOT EXISTS idx_patient_summaries_complexity ON patient_summaries(complexity_level);
CREATE INDEX IF NOT EXISTS idx_patient_summaries_status ON patient_summaries(status);
CREATE INDEX IF NOT EXISTS idx_patient_summaries_created_at ON patient_summaries(created_at);
CREATE INDEX IF NOT EXISTS idx_patient_summaries_is_urgent ON patient_summaries(is_urgent);

CREATE INDEX IF NOT EXISTS idx_medical_terms_original_term ON medical_terms(original_term);
CREATE INDEX IF NOT EXISTS idx_medical_terms_language ON medical_terms(language);
CREATE INDEX IF NOT EXISTS idx_medical_terms_category ON medical_terms(category);

CREATE INDEX IF NOT EXISTS idx_medical_abbreviations_abbreviation ON medical_abbreviations(abbreviation);
CREATE INDEX IF NOT EXISTS idx_medical_abbreviations_language ON medical_abbreviations(language);

CREATE INDEX IF NOT EXISTS idx_emergency_keywords_keyword ON emergency_keywords(keyword);
CREATE INDEX IF NOT EXISTS idx_emergency_keywords_language ON emergency_keywords(language);
CREATE INDEX IF NOT EXISTS idx_emergency_keywords_urgency ON emergency_keywords(urgency_level);

CREATE INDEX IF NOT EXISTS idx_cultural_adaptations_language ON cultural_adaptations(language);
CREATE INDEX IF NOT EXISTS idx_cultural_adaptations_region ON cultural_adaptations(region);

CREATE INDEX IF NOT EXISTS idx_summary_feedback_summary_id ON summary_feedback(summary_id);
CREATE INDEX IF NOT EXISTS idx_generation_metrics_summary_id ON generation_metrics(summary_id);
CREATE INDEX IF NOT EXISTS idx_terminology_usage_summary_id ON terminology_usage_logs(summary_id);

-- Insert some default templates
INSERT INTO summary_templates (name, language, complexity_level, title_template, examination_template, findings_template, meaning_template, next_steps_template, contact_doctor_template, disclaimer_template) VALUES 
('Basic German Template', 'de', 'basic', 
 'Ihr Untersuchungsergebnis: {title}',
 'Bei Ihrer Untersuchung wurde {examination} durchgeführt.',
 'Die wichtigsten Befunde sind: {findings}',
 'Das bedeutet für Sie: {meaning}',
 'Nächste Schritte: {next_steps}',
 'Kontaktieren Sie Ihren Arzt wenn: {contact_conditions}',
 'Diese Zusammenfassung dient nur zur Information und ersetzt nicht das Gespräch mit Ihrem Arzt.');

-- Insert some common medical terms
INSERT INTO medical_terms (original_term, language, simple_translation, basic_explanation, category) VALUES
('Röntgenaufnahme', 'de', 'Röntgenbild', 'Ein Bild von Ihrem Körperinneren mit Röntgenstrahlen', 'imaging'),
('CT', 'de', 'Computertomographie', 'Ein spezielles Röntgenverfahren für Schnittbilder', 'imaging'),
('MRT', 'de', 'Magnetresonanztomographie', 'Bildgebung mit Magnetfeldern', 'imaging');

-- Insert common abbreviations
INSERT INTO medical_abbreviations (abbreviation, full_form, language, simple_explanation, specialty) VALUES
('CT', 'Computertomographie', 'de', 'Spezielle Röntgenuntersuchung', 'radiology'),
('MRT', 'Magnetresonanztomographie', 'de', 'Untersuchung mit Magnetfeldern', 'radiology'),
('EKG', 'Elektrokardiogramm', 'de', 'Untersuchung der Herzströme', 'cardiology');

-- Insert emergency keywords
INSERT INTO emergency_keywords (keyword, language, urgency_level, emergency_type, patient_warning, when_to_seek_help) VALUES
('Notfall', 'de', 'critical', 'general', 'Dies erfordert sofortige medizinische Aufmerksamkeit', 'Sofort'),
('akut', 'de', 'high', 'acute_condition', 'Dies erfordert zeitnahe ärztliche Behandlung', 'Innerhalb weniger Stunden'),
('Herzinfarkt', 'de', 'critical', 'cardiac', 'Verdacht auf Herzinfarkt - lebensbedrohlich', 'Sofort');

-- Success message
SELECT 'Database schema initialized successfully' as message;