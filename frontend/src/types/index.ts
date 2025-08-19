export type Language = 'de' | 'en' | 'fr' | 'es' | 'it' | 'tr' | 'ar' | 'uk';

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

export interface EnhancedFindings {
  normalFindings: string[];
  pathologicalFindings: string[];
  specialObservations: string[];
  measurements: string[];
  localizations: string[];
  confidence: number;
  processingAgent: string;
  provider?: string;
  timestamp: number;
  generatedAt?: number; // Legacy field, use timestamp instead
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
    secondaryConditions: number;
  };
  confidence: number;
  provider: string;
  generatedAt: number;
  language: Language;
  // Optional legacy/compatibility fields
  agentType?: string;
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
  enhancedFindings?: EnhancedFindings;
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
  complexity?: 'simple' | 'detailed' | 'technical';
  metadata?: {
    aiProvider?: string;
    processingAgent?: string;
    confidence?: number;
  };
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

// Web Speech API types for browser-based transcription
declare global {
  interface Window {
    SpeechRecognition: SpeechRecognitionStatic;
    webkitSpeechRecognition: SpeechRecognitionStatic;
  }
}

interface SpeechRecognitionStatic {
  new (): SpeechRecognition;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  grammars: SpeechGrammarList;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onaudioend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onaudiostart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
  onnomatch: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onsoundend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onsoundstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onspeechend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onspeechstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  serviceURI: string;
  abort(): void;
  start(): void;
  stop(): void;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: SpeechRecognitionErrorCode;
  readonly message: string;
}

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  readonly confidence: number;
  readonly transcript: string;
}

interface SpeechGrammarList {
  readonly length: number;
  addFromString(string: string, weight?: number): void;
  addFromURI(src: string, weight?: number): void;
  item(index: number): SpeechGrammar;
  [index: number]: SpeechGrammar;
}

interface SpeechGrammar {
  src: string;
  weight: number;
}

type SpeechRecognitionErrorCode = 
  | 'aborted'
  | 'audio-capture'
  | 'bad-grammar' 
  | 'language-not-supported'
  | 'network'
  | 'no-speech'
  | 'not-allowed'
  | 'service-not-allowed';