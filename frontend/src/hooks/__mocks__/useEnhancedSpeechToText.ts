// Mock for useEnhancedSpeechToText hook
export const useEnhancedSpeechToText = jest.fn(() => ({
  isListening: false,
  transcript: {
    text: '',
    isFinal: false,
    confidence: 0,
    validation: undefined
  },
  finalTranscript: '',
  interimTranscript: '',
  startListening: jest.fn(),
  stopListening: jest.fn(),
  resetFinalTranscript: jest.fn(),
  hasRecognitionSupport: true,
  error: null,
  validationEnabled: true,
  toggleValidation: jest.fn(),
  getQualityAssessment: jest.fn(() => ({
    overall: 'good',
    confidence: 0.95,
    issues: 0,
    qualityScore: 0.95
  })),
  confidence: 0.95,
  connectionStatus: 'connected' as const,
  manualRetry: jest.fn(),
  retryCount: 0,
  diagnostics: []
}));