/**
 * Comprehensive Validation Schemas for MedEssenceAI
 * Using Zod for runtime type safety and input validation
 */

import { z } from 'zod';

// ==================== CORE TYPES ====================

export const LanguageSchema = z.enum([
  'de', 'en', 'ar', 'uk', 'fr', 'es', 'it', 'tr'
]);

export const ProcessingModeSchema = z.enum(['cloud', 'local']);

export const ComplexitySchema = z.enum(['simple', 'detailed', 'technical']);

// ==================== API REQUEST SCHEMAS ====================

export const GenerateReportRequestSchema = z.object({
  transcriptionId: z.string().min(1, 'Transcription ID is required'),
  language: LanguageSchema,
  transcriptionText: z.string().min(10, 'Transcription text must be at least 10 characters'),
  processingMode: ProcessingModeSchema.optional().default('cloud')
});

export const GenerateSummaryRequestSchema = z.object({
  reportId: z.string().min(1, 'Report ID is required'),
  reportContent: z.string().min(50, 'Report content must be at least 50 characters'),
  language: LanguageSchema,
  complexity: ComplexitySchema.optional().default('detailed'),
  processingMode: ProcessingModeSchema.optional().default('cloud')
});

export const GenerateICDRequestSchema = z.object({
  reportId: z.string().min(1, 'Report ID is required'),
  reportContent: z.string().min(20, 'Report content must be at least 20 characters'),
  language: LanguageSchema,
  codeSystem: z.enum(['ICD-10-GM', 'ICD-10', 'ICD-11']).default('ICD-10-GM'),
  processingMode: ProcessingModeSchema.optional().default('cloud')
});

export const GenerateEnhancedFindingsRequestSchema = z.object({
  reportId: z.string().min(1, 'Report ID is required'),
  reportContent: z.string().min(20, 'Report content must be at least 20 characters'),
  language: LanguageSchema
});

// ==================== VALIDATION FUNCTIONS ====================

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
  sanitizedText?: string;
  detectedTerms?: string[];
  modalityMatch?: boolean;
  defaultLanguage?: string;
  validationRules?: any;
  sanitizedData?: any;
}

// German medical terms dictionary
const GERMAN_MEDICAL_TERMS = [
  'mammographie', 'sonographie', 'computertomographie', 'magnetresonanztomographie',
  'röntgen', 'befund', 'beurteilung', 'empfehlung', 'unauffällig', 'pathologisch',
  'kontrastmittel', 'beidseits', 'rechts', 'links', 'ventral', 'dorsal',
  'kranial', 'kaudal', 'leber', 'lunge', 'herz', 'niere', 'milz', 'pankreas',
  'gallenblase', 'magen', 'darm', 'wirbelsäule'
];

export function validateTranscription(text: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const detectedTerms: string[] = [];
  
  if (!text || text.trim().length === 0) {
    errors.push('Transcription text is required');
    return { isValid: false, errors };
  }
  
  if (text.length < 10) {
    errors.push('Transcription must be at least 10 characters');
  }
  
  if (text.length > 10000) {
    errors.push('Transcription must not exceed 10000 characters');
  }
  
  // Sanitize and check for XSS
  const sanitized = sanitizeInput(text);
  if (sanitized !== text) {
    warnings.push('Input was sanitized for security');
  }
  
  // Detect German medical terms
  const lowerText = text.toLowerCase();
  GERMAN_MEDICAL_TERMS.forEach(term => {
    if (lowerText.includes(term)) {
      detectedTerms.push(term);
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    sanitizedText: sanitized,
    detectedTerms
  };
}

export function validateICDCode(code: string, modality?: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // ICD-10 format: Letter + 2-3 digits + optional dot + 1-2 digits
  const icdPattern = /^[A-Z]\d{2,3}(\.\d{1,2})?$/;
  
  if (!icdPattern.test(code)) {
    errors.push('Invalid ICD-10 code format');
    return { isValid: false, errors };
  }
  
  let modalityMatch = true;
  if (modality === 'mammography') {
    const mammographyCodes = ['Z12.31', 'C50', 'N63'];
    modalityMatch = mammographyCodes.some(prefix => code.startsWith(prefix));
    
    if (!modalityMatch) {
      warnings.push('ICD code may not match the specified modality');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    modalityMatch
  };
}

export function validateModality(modality: string): ValidationResult {
  const validModalities = ['mammography', 'ultrasound', 'ct_scan', 'mri', 'xray', 'pet_scan'];
  const errors: string[] = [];
  
  if (!validModalities.includes(modality)) {
    errors.push('Invalid modality type');
    return { isValid: false, errors };
  }
  
  const validationRules: any = {};
  if (modality === 'mammography') {
    validationRules.requiresPatientGender = true;
    validationRules.minimumAge = 35;
    validationRules.typicalDuration = '15-30 minutes';
  }
  
  return {
    isValid: true,
    errors: [],
    validationRules
  };
}

export function validateLanguage(lang: string): ValidationResult {
  const supportedLanguages = ['de', 'en', 'fr', 'tr'];
  const warnings: string[] = [];
  
  if (!supportedLanguages.includes(lang)) {
    warnings.push('Unsupported language, defaulting to German');
    return {
      isValid: false,
      errors: [],
      warnings,
      defaultLanguage: 'de'
    };
  }
  
  return {
    isValid: true,
    errors: []
  };
}

export function sanitizeInput(input: string): string {
  // Remove HTML tags
  let sanitized = input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  sanitized = sanitized.replace(/<[^>]+>/g, '');
  
  // Normalize whitespace
  sanitized = sanitized.replace(/\s+/g, ' ').trim();
  
  return sanitized;
}

export function validateReportData(report: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!report.transcription) {
    errors.push('Transcription is required');
  }
  
  if (!report.modality) {
    errors.push('Modality is required');
  }
  
  // Validate patient info for mammography
  if (report.modality === 'mammography' && report.patientInfo) {
    if (report.patientInfo.age < 35) {
      warnings.push(`Patient age (${report.patientInfo.age}) is below typical mammography screening age (35+)`);
    }
    
    if (report.patientInfo.gender === 'male') {
      warnings.push('Mammography for male patients is uncommon');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

export function validatePatientData(patient: any): ValidationResult {
  const errors: string[] = [];
  const sanitizedData: any = {};
  
  if (patient.age !== undefined) {
    if (patient.age < 0 || patient.age > 120) {
      errors.push('Invalid age');
    }
  }
  
  if (patient.gender !== undefined) {
    const validGenders = ['male', 'female', 'other', 'unknown'];
    if (!validGenders.includes(patient.gender)) {
      errors.push('Invalid gender');
    }
  }
  
  if (patient.name) {
    sanitizedData.name = sanitizeInput(patient.name);
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    sanitizedData
  };
}

// ==================== RESPONSE SCHEMAS ====================

export const MetadataSchema = z.object({
  aiProvider: z.string().optional(),
  aiGenerated: z.boolean().default(false),
  confidence: z.number().min(0).max(1).optional(),
  processingAgent: z.string().optional(),
  agent: z.string().optional()
});

export const EnhancedFindingsSchema = z.object({
  normalFindings: z.array(z.string()),
  pathologicalFindings: z.array(z.string()),
  specialObservations: z.array(z.string()),
  measurements: z.array(z.string()),
  localizations: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  processingAgent: z.string(),
  provider: z.string().optional(),
  timestamp: z.number(), // STANDARDIZED: Always use numbers for timestamps
  generatedAt: z.number().optional() // Legacy compatibility
}).refine(
  (data) => {
    // At least one finding category must have content
    return data.normalFindings.length > 0 ||
           data.pathologicalFindings.length > 0 ||
           data.specialObservations.length > 0 ||
           data.measurements.length > 0 ||
           data.localizations.length > 0;
  },
  {
    message: "Enhanced findings must contain at least one finding in any category",
  }
);

export const ICDCodeSchema = z.object({
  code: z.string().min(1, 'ICD code is required'),
  description: z.string().min(1, 'ICD description is required'),
  confidence: z.number().min(0).max(1),
  radiologyRelevance: z.number().min(0).max(1),
  priority: z.enum(['primary', 'secondary', 'differential']),
  category: z.string(),
  reasoning: z.string()
});

export const ICDPredictionsSchema = z.object({
  codes: z.array(ICDCodeSchema),
  summary: z.object({
    primaryDiagnoses: z.number().min(0),
    secondaryConditions: z.number().min(0),
    totalCodes: z.number().min(0)
  }),
  confidence: z.number().min(0).max(1),
  provider: z.string(),
  generatedAt: z.number(),
  language: LanguageSchema
});

export const MedicalReportSchema = z.object({
  id: z.string().min(1, 'Report ID is required'),
  transcriptionId: z.string().min(1, 'Transcription ID is required'),
  findings: z.string().min(1, 'Findings are required'),
  impression: z.string().min(1, 'Impression is required'),
  recommendations: z.string().min(1, 'Recommendations are required'),
  technicalDetails: z.string().optional(),
  enhancedFindings: EnhancedFindingsSchema.optional(),
  icdPredictions: ICDPredictionsSchema.optional(),
  generatedAt: z.number(), // STANDARDIZED: Always use numbers
  language: LanguageSchema,
  type: z.enum(['transcription', 'manual', 'imported']).default('transcription'),
  metadata: MetadataSchema.optional()
});

export const PatientSummarySchema = z.object({
  id: z.string().min(1, 'Summary ID is required'),
  reportId: z.string().min(1, 'Report ID is required'),
  summary: z.string().min(50, 'Summary must be at least 50 characters'),
  keyFindings: z.array(z.string()).min(1, 'At least one key finding is required'),
  recommendations: z.array(z.string()).min(1, 'At least one recommendation is required'),
  language: LanguageSchema,
  generatedAt: z.number(), // STANDARDIZED: Always use numbers
  complexity: ComplexitySchema,
  metadata: MetadataSchema.optional()
});

export const TranscriptionDataSchema = z.object({
  id: z.string().min(1, 'Transcription ID is required'),
  text: z.string().min(1, 'Transcription text is required'),
  isFinal: z.boolean(),
  confidence: z.number().min(0).max(1),
  language: LanguageSchema,
  timestamp: z.number() // STANDARDIZED: Always use numbers
});

// ==================== VALIDATION FUNCTIONS ====================

/**
 * Validates and sanitizes API request data
 */
export function validateApiRequest<T>(
  schema: z.ZodSchema<T>, 
  data: unknown
): { success: true; data: T } | { success: false; error: string } {
  try {
    const validated = schema.parse(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.issues
        .map((err: any) => `${err.path.join('.')}: ${err.message}`)
        .join('; ');
      return { success: false, error: errorMessage };
    }
    return { success: false, error: 'Unknown validation error' };
  }
}

/**
 * Validates API response data with proper error handling
 */
export function validateApiResponse<T>(
  schema: z.ZodSchema<T>, 
  data: unknown,
  context: string = 'API response'
): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.issues
        .map((err: any) => `${err.path.join('.')}: ${err.message}`)
        .join('; ');
      
      console.error(`🚨 ${context} validation failed:`, {
        errors: error.issues,
        data,
        timestamp: new Date().toISOString()
      });
      
      throw new Error(`Invalid ${context}: ${errorMessage}`);
    }
    throw error;
  }
}

/**
 * Safely parses and validates data with fallback
 */
export function safeValidate<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  fallback: T
): T {
  const result = validateApiRequest(schema, data);
  if (result.success) {
    return result.data;
  }
  
  console.warn('🔄 Using fallback data due to validation error:', result.error);
  return fallback;
}

/**
 * Standardizes timestamp handling - converts any timestamp format to number
 */
export function normalizeTimestamp(timestamp: unknown): number {
  if (typeof timestamp === 'number') {
    return timestamp;
  }
  if (typeof timestamp === 'string') {
    const parsed = new Date(timestamp).getTime();
    if (!isNaN(parsed)) {
      return parsed;
    }
  }
  return Date.now();
}

// ==================== TYPE EXPORTS ====================

export type Language = z.infer<typeof LanguageSchema>;
export type ProcessingMode = z.infer<typeof ProcessingModeSchema>;
export type Complexity = z.infer<typeof ComplexitySchema>;
export type GenerateReportRequest = z.infer<typeof GenerateReportRequestSchema>;
export type GenerateSummaryRequest = z.infer<typeof GenerateSummaryRequestSchema>;
export type GenerateICDRequest = z.infer<typeof GenerateICDRequestSchema>;
export type GenerateEnhancedFindingsRequest = z.infer<typeof GenerateEnhancedFindingsRequestSchema>;
export type MedicalReport = z.infer<typeof MedicalReportSchema>;
export type PatientSummary = z.infer<typeof PatientSummarySchema>;
export type TranscriptionData = z.infer<typeof TranscriptionDataSchema>;
export type EnhancedFindings = z.infer<typeof EnhancedFindingsSchema>;
export type ICDPredictions = z.infer<typeof ICDPredictionsSchema>;
export type Metadata = z.infer<typeof MetadataSchema>;