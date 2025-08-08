export type Language = 'de' | 'en' | 'fr' | 'es' | 'it' | 'tr';

export interface LanguageOption {
  code: Language;
  name: string;
  flag: string;
}

export interface AudioRecordingState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  audioLevel: number;
}

export interface TranscriptionData {
  id: string;
  text: string;
  confidence: number;
  timestamp: number;
  language: Language;
  isFinal: boolean;
}

export interface ReportSection {
  title: string;
  content: string;
  order: number;
}

export interface StructuredFinding {
  text: string;
  significance: 'general' | 'significant' | 'critical';
  sourceSpan: { start: number; end: number };
  category: string;
}

export interface EnhancedFindingsData {
  content: string;
  structuredFindings: StructuredFinding[];
  originalText: string;
}

export interface ICDCode {
  code: string;
  description: string;
  confidence: number;
  radiologyRelevance: number;
  priority: 'primary' | 'secondary' | 'differential';
  category: string;
  reasoning: string;
}

export interface ICDPredictions {
  codes: ICDCode[];
  summary: {
    totalCodes: number;
    primaryDiagnoses: number;
    secondaryDiagnoses: number;
    averageConfidence: number;
  };
  agentType?: string;
  language?: string;
  provider?: string;
  timestamp?: string;
  cached?: boolean;
  fallback?: boolean;
}

export interface MedicalReport {
  id: string;
  patientId?: string;
  transcriptionId: string;
  sections?: ReportSection[];
  findings: string;
  impression: string;
  recommendations: string;
  technicalDetails: string;
  generatedAt: number;
  language: Language;
  type?: string;
  classification?: {
    type: string;
    confidence: number;
    scores?: Array<{ type: string; score: number }>;
  };
  // NEW: Enhanced findings with significance highlighting and grounding
  enhancedFindings?: EnhancedFindingsData;
  // NEW: ICD-10-GM code predictions
  icdPredictions?: ICDPredictions;
  metadata?: {
    agent?: string;
    aiGenerated?: boolean;
    aiProvider?: string;
    language?: Language;
    hasEnhancedFindings?: boolean;
    [key: string]: any;
  };
}

export interface PatientSummary {
  id: string;
  reportId: string;
  summary: string;
  keyFindings: string[];
  recommendations: string[];
  language: Language;
  generatedAt: number;
}

export interface WebSocketMessage {
  type: 'transcription' | 'report' | 'summary' | 'error';
  data: any;
  timestamp: number;
}

export interface AudioConstraints {
  sampleRate: number;
  channelCount: number;
  echoCancellation: boolean;
  noiseSuppression: boolean;
}

export interface RecordingError {
  code: string;
  message: string;
  details?: any;
}

export interface UIState {
  loading: boolean;
  error: string | null;
  success: string | null;
}