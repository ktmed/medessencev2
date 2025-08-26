// Manual mock for useEnhancedSpeechToText hook
export const useEnhancedSpeechToText = jest.fn(() => ({
  // Basic speech recognition state
  isListening: false,
  transcript: { text: '', isFinal: false, confidence: 0 },
  finalTranscript: '',
  interimTranscript: '',
  
  // Control functions
  startListening: jest.fn(),
  stopListening: jest.fn(),
  resetFinalTranscript: jest.fn(),
  
  // Support and validation
  hasRecognitionSupport: true,
  error: null,
  validationEnabled: true,
  toggleValidation: jest.fn(),
  
  // Quality assessment
  quality: {
    overall: 'good',
    confidence: 0.95,
    medicalAccuracy: 0.98,
    grammarScore: 0.92
  },
  getQualityAssessment: jest.fn(() => ({ 
    overall: 'good', 
    confidence: 0.95, 
    issues: 0 
  })),
  confidence: 0.95,
  
  // Connection management
  connectionStatus: 'connected',
  manualRetry: jest.fn(),
  retryCount: 0,
  diagnostics: [],
  
  // Ontology integration
  ontologyAvailable: true,
  ontologyEnhanced: false
}));