-- Radiology AI System Database Schema
-- GDPR-compliant medical data structure

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users table (medical professionals)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'radiologist',
    license_number VARCHAR(100),
    department VARCHAR(100),
    hospital_id UUID,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Hospitals/Institutions table
CREATE TABLE hospitals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    address TEXT,
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    country VARCHAR(2) DEFAULT 'DE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Patients table (anonymized/pseudonymized)
CREATE TABLE patients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_identifier VARCHAR(255) UNIQUE NOT NULL, -- Pseudonymized ID
    date_of_birth_encrypted BYTEA, -- Encrypted DOB
    sex INTEGER, -- 0=Unknown, 1=Male, 2=Female
    age_class INTEGER, -- Age group classification
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Medical examinations
CREATE TABLE examinations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id),
    user_id UUID NOT NULL REFERENCES users(id),
    exam_service_id INTEGER,
    exam_type VARCHAR(100) NOT NULL, -- MRI, CT, X-Ray, etc.
    exam_description TEXT,
    clinical_indication TEXT,
    icd_code VARCHAR(20),
    exam_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) DEFAULT 'pending', -- pending, in_progress, completed, reviewed
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Audio transcription sessions
CREATE TABLE transcription_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    examination_id UUID NOT NULL REFERENCES examinations(id),
    user_id UUID NOT NULL REFERENCES users(id),
    audio_language VARCHAR(10) DEFAULT 'de', -- ISO language codes
    transcription_text TEXT,
    confidence_score DECIMAL(3,2),
    duration_seconds INTEGER,
    status VARCHAR(50) DEFAULT 'processing', -- processing, completed, failed
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Generated medical reports
CREATE TABLE medical_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    examination_id UUID NOT NULL REFERENCES examinations(id),
    transcription_session_id UUID REFERENCES transcription_sessions(id),
    user_id UUID NOT NULL REFERENCES users(id),
    report_text TEXT NOT NULL,
    report_language VARCHAR(10) DEFAULT 'de',
    technical_parameters JSONB, -- Equipment specs, settings
    findings TEXT,
    assessment TEXT,
    recommendations TEXT,
    is_final BOOLEAN DEFAULT false,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    finalized_at TIMESTAMP WITH TIME ZONE,
    signed_by UUID REFERENCES users(id)
);

-- Patient-friendly summaries
CREATE TABLE patient_summaries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    medical_report_id UUID NOT NULL REFERENCES medical_reports(id),
    summary_text TEXT NOT NULL,
    target_language VARCHAR(10) NOT NULL, -- Language for patient summary
    reading_level VARCHAR(20) DEFAULT 'intermediate', -- basic, intermediate, advanced
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Audit trail for GDPR compliance
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name VARCHAR(100) NOT NULL,
    record_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL, -- INSERT, UPDATE, DELETE, SELECT
    user_id UUID REFERENCES users(id),
    ip_address INET,
    user_agent TEXT,
    changes JSONB, -- Before/after values for updates
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- System configurations
CREATE TABLE system_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    config_key VARCHAR(100) UNIQUE NOT NULL,
    config_value JSONB NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_patients_identifier ON patients(patient_identifier);
CREATE INDEX idx_examinations_patient_id ON examinations(patient_id);
CREATE INDEX idx_examinations_user_id ON examinations(user_id);
CREATE INDEX idx_examinations_date ON examinations(exam_date);
CREATE INDEX idx_examinations_status ON examinations(status);
CREATE INDEX idx_transcription_sessions_exam_id ON transcription_sessions(examination_id);
CREATE INDEX idx_medical_reports_exam_id ON medical_reports(examination_id);
CREATE INDEX idx_medical_reports_user_id ON medical_reports(user_id);
CREATE INDEX idx_patient_summaries_report_id ON patient_summaries(medical_report_id);
CREATE INDEX idx_audit_logs_table_record ON audit_logs(table_name, record_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_patients_updated_at BEFORE UPDATE ON patients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_examinations_updated_at BEFORE UPDATE ON examinations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_system_configs_updated_at BEFORE UPDATE ON system_configs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default system configurations
INSERT INTO system_configs (config_key, config_value, description) VALUES
('supported_languages', '["de", "en", "fr", "es", "it", "tr"]', 'Supported languages for transcription and summaries'),
('max_audio_duration', '600', 'Maximum audio duration in seconds'),
('supported_audio_formats', '["wav", "mp3", "m4a", "webm", "ogg"]', 'Supported audio file formats'),
('default_report_language', '"de"', 'Default language for medical reports'),
('gdpr_retention_days', '2555', 'GDPR data retention period (7 years)'),
('audit_log_retention_days', '2555', 'Audit log retention period');

-- Create default admin user (password: admin123 - change in production!)
INSERT INTO users (email, password_hash, first_name, last_name, role) VALUES
('admin@med-essence.de', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewKyNiCeLjaK1TzW', 'System', 'Administrator', 'admin');

-- Create sample hospital
INSERT INTO hospitals (name, address, contact_email) VALUES
('Radiologische Allianz Hamburg', 'Hamburg, Germany', 'info@radiologische-allianz.de');

COMMIT;