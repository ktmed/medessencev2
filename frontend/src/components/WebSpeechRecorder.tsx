'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Mic, MicOff, AlertCircle, CheckCircle, AlertTriangle, Activity, RefreshCw, Wifi, WifiOff, ChevronDown, ChevronRight, Database, Brain, Sparkles } from 'lucide-react';
import { useEnhancedSpeechToText } from '@/hooks/useEnhancedSpeechToText';
import { Language, TranscriptionData } from '@/types';
import { getMedicalTerm } from '@/utils/languages';
import { generateId } from '@/utils';

interface WebSpeechRecorderProps {
  language: Language;
  onTranscription?: (transcription: TranscriptionData) => void;
  processingMode?: 'cloud' | 'local';
  onProcessingModeChange?: (mode: 'cloud' | 'local') => void;
  className?: string;
}

export default function WebSpeechRecorder({
  language,
  onTranscription,
  processingMode = 'cloud',
  onProcessingModeChange,
  className = ''
}: WebSpeechRecorderProps) {
  const [error, setError] = useState<string | null>(null);
  // Remove duplicate finalTranscript state - use speechFinalTranscript from hook
  const [mounted, setMounted] = useState<boolean>(false);
  const [showDiagnostics, setShowDiagnostics] = useState<boolean>(false);

  const {
    isListening,
    transcript,
    finalTranscript: speechFinalTranscript,
    startListening,
    stopListening,
    resetFinalTranscript,
    hasRecognitionSupport,
    error: speechError,
    validationEnabled,
    toggleValidation,
    getQualityAssessment,
    confidence,
    connectionStatus,
    manualRetry,
    retryCount,
    diagnostics,
    // Ontology-specific properties
    ontologyAvailable,
    ontologyEnhanced
  } = useEnhancedSpeechToText({
    lang: language === 'de' ? 'de-DE' : 'en-US',
    continuous: true,
    interimResults: true,
    medicalValidation: true,
    confidenceThreshold: 0.6,
    onTranscriptChange: useCallback((transcriptData: { text: string; isFinal: boolean; confidence: number; validation?: any }) => {
      // The hook handles accumulation, we just need to pass through final transcripts
      if (transcriptData.isFinal && onTranscription) {
        const transcriptionObj: TranscriptionData = {
          id: generateId(),
          text: transcriptData.text,
          isFinal: true,
          confidence: transcriptData.confidence,
          language: language,
          timestamp: Date.now()
        };
        onTranscription(transcriptionObj);
      }
    }, [language, onTranscription])
  });

  // Handle hydration issue by only showing browser-dependent content after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  // Handle final transcriptions from the hook
  useEffect(() => {
    if (transcript.isFinal && transcript.text.trim() && onTranscription) {
      const transcriptionData: TranscriptionData = {
        id: generateId(),
        text: transcript.text.trim(),
        confidence: transcript.confidence || 0.9,
        timestamp: Date.now(),
        language: language,
        isFinal: true
      };
      onTranscription(transcriptionData);
    }
  }, [transcript, onTranscription, language]);


  const handleToggleRecording = useCallback(() => {
    if (!hasRecognitionSupport) {
      setError('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    setError(null);
    
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening, hasRecognitionSupport]);


  const displayError = error || speechError;

  return (
    <div className={`medical-card ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 med-navy-gradient rounded-xl flex items-center justify-center shadow-md">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold med-text-navy">
              {getMedicalTerm('audioRecording', language)}
            </h3>
            <p className="text-sm text-navy-600">Web Speech API (Browser-based)</p>
            {mounted && (
              <div className="flex items-center space-x-4 mt-2">
                {/* WebSpeech Connection Status */}
                <div className="flex items-center space-x-1">
                  {connectionStatus === 'connected' && <Wifi className="w-4 h-4 text-green-500" />}
                  {connectionStatus === 'disconnected' && <WifiOff className="w-4 h-4 text-red-500" />}
                  {connectionStatus === 'reconnecting' && <RefreshCw className="w-4 h-4 text-yellow-500 animate-spin" />}
                  <span className={`text-xs font-medium ${
                    connectionStatus === 'connected' ? 'text-green-600' :
                    connectionStatus === 'disconnected' ? 'text-red-600' : 'text-yellow-600'
                  }`}>
                    Speech API
                  </span>
                </div>

                {/* Ontology Service Status */}
                <div className="flex items-center space-x-1">
                  {ontologyAvailable ? (
                    <Database className="w-4 h-4 text-blue-500" />
                  ) : (
                    <Database className="w-4 h-4 text-gray-400" />
                  )}
                  <span className={`text-xs font-medium ${
                    ontologyAvailable ? 'text-blue-600' : 'text-gray-500'
                  }`}>
                    Ontology
                  </span>
                  {ontologyEnhanced && (
                    <Sparkles className="w-3 h-3 text-yellow-500" />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Browser Support Warning - only show after mount */}
      {mounted && !hasRecognitionSupport && (
        <div className="mb-4 p-3 bg-error-50 border border-error-200 rounded-md">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-error-600" />
            <p className="text-sm text-error-600">
              Your browser does not support the Web Speech API. Please use Chrome or Edge.
            </p>
          </div>
        </div>
      )}

      {/* Error Display */}
      {displayError && (
        <div className="mb-4 p-3 bg-error-50 border border-error-200 rounded-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-error-600" />
              <p className="text-sm text-error-600">{displayError}</p>
            </div>
            {mounted && connectionStatus === 'disconnected' && !isListening && (
              <button
                onClick={manualRetry}
                className="flex items-center space-x-1 px-2 py-1 bg-error-600 text-white text-xs rounded hover:bg-error-700 transition-colors"
                title="Retry connection"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Retry</span>
              </button>
            )}
          </div>
          {retryCount > 0 && (
            <p className="text-xs text-error-500 mt-1">Retry attempt: {retryCount}/3</p>
          )}
        </div>
      )}

      {/* Recording Controls */}
      <div className="flex items-center justify-center space-x-4 mb-6">
        <button
          onClick={handleToggleRecording}
          disabled={!mounted || !hasRecognitionSupport}
          className={`
            flex items-center justify-center w-16 h-16 rounded-full transition-all duration-300 
            focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-navy-500 shadow-md
            ${mounted && isListening 
              ? 'bg-error-500 hover:bg-error-600 text-white animate-pulse' 
              : 'bg-navy-600 hover:bg-navy-700 text-white'
            } 
            disabled:bg-gray-300 disabled:cursor-not-allowed
          `}
        >
          {mounted && isListening ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
        </button>

        <div className="text-center">
          <p className="font-semibold text-lg med-text-navy">
            {mounted && isListening ? 'Recording...' : 'Ready to record'}
          </p>
          <p className="text-sm text-navy-600">
            {mounted && isListening ? 'Click to stop recording' : 'Click microphone to start'}
          </p>
        </div>
        
        {mounted && isListening && (
          <div className="recording-indicator"></div>
        )}
      </div>

      {/* Medical Validation Controls and Confidence Indicators */}
      {mounted && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-navy-700">Medical Validation</h4>
            <button
              onClick={toggleValidation}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${
                validationEnabled 
                  ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                  : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
              }`}
            >
              {validationEnabled ? 'Enabled' : 'Disabled'}
            </button>
          </div>
          
          {/* Real-time Quality Indicators */}
          {transcript.text && (
            <div className="grid grid-cols-2 gap-4 text-xs">
              {/* Confidence Score */}
              <div className="flex items-center space-x-2">
                <span className="text-navy-600">Confidence:</span>
                <div className={`flex items-center space-x-1 ${
                  confidence >= 0.8 ? 'text-green-600' :
                  confidence >= 0.6 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {confidence >= 0.8 ? <CheckCircle className="w-3 h-3" /> :
                   confidence >= 0.6 ? <AlertTriangle className="w-3 h-3" /> :
                   <AlertCircle className="w-3 h-3" />}
                  <span>{Math.round(confidence * 100)}%</span>
                </div>
              </div>
              
              {/* Quality Assessment */}
              <div className="flex items-center space-x-2">
                <span className="text-navy-600">Quality:</span>
                {(() => {
                  const quality = getQualityAssessment();
                  return (
                    <div className={`flex items-center space-x-1 ${
                      quality.overall === 'excellent' || quality.overall === 'good' ? 'text-green-600' :
                      quality.overall === 'fair' ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      <span className="capitalize">{quality.overall}</span>
                      {quality.issues > 0 && <span>({quality.issues} issues)</span>}
                      {transcript.validation?.ontologyEnhanced && (
                        <Sparkles className="w-3 h-3 text-yellow-500" />
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Medical Corrections Display */}
          {validationEnabled && transcript.validation && transcript.validation.corrections.length > 0 && (
            <div className="mt-3 p-3 bg-blue-50 border-l-4 border-blue-400 rounded text-xs">
              <div className="font-medium text-blue-800 mb-2 flex items-center justify-between">
                <span className="flex items-center space-x-1">
                  <Brain className="w-4 h-4" />
                  <span>Medical Corrections</span>
                </span>
                {transcript.validation.ontologyEnhanced && (
                  <span className="flex items-center space-x-1 text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
                    <Database className="w-3 h-3" />
                    <span className="text-xs font-medium">Enhanced</span>
                  </span>
                )}
              </div>
              <div className="space-y-1">
                {transcript.validation.corrections.slice(0, 3).map((correction, idx) => (
                  <div key={idx} className="flex items-center justify-between text-blue-700">
                    <span className="flex items-center space-x-1">
                      {correction.type?.includes('ontology') ? (
                        <Database className="w-3 h-3 text-blue-600" />
                      ) : (
                        <Brain className="w-3 h-3 text-purple-600" />
                      )}
                      <span>"{correction.original}" → "{correction.corrected}"</span>
                    </span>
                    {correction.confidence && (
                      <span className="text-xs text-gray-500 ml-2">
                        {Math.round(correction.confidence * 100)}%
                      </span>
                    )}
                  </div>
                ))}
                {transcript.validation.corrections.length > 3 && (
                  <div className="text-xs text-gray-500 pt-1">
                    +{transcript.validation.corrections.length - 3} more corrections
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Medical Terms Detected - Only show if ontology enhanced */}
          {validationEnabled && transcript.validation?.ontologyEnhanced && transcript.validation.medicalTermsDetected && transcript.validation.medicalTermsDetected.length > 0 && (
            <div className="mt-2 p-2 bg-green-50 rounded text-xs">
              <div className="font-medium text-green-800 mb-2 flex items-center space-x-1">
                <Database className="w-3 h-3" />
                <span>Terms Detected ({transcript.validation.medicalTermsDetected.length})</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {transcript.validation.medicalTermsDetected.slice(0, 5).map((term, idx) => (
                  <span key={idx} className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                    {term.term}
                  </span>
                ))}
                {transcript.validation.medicalTermsDetected.length > 5 && (
                  <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                    +{transcript.validation.medicalTermsDetected.length - 5}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Validation Warnings */}
          {validationEnabled && transcript.validation && transcript.validation.warnings.length > 0 && (
            <div className="mt-2 p-2 bg-yellow-50 rounded text-xs">
              <div className="font-medium text-yellow-800 mb-1">Warnings:</div>
              {transcript.validation.warnings.map((warning, idx) => (
                <div key={idx} className={`${
                  warning.severity === 'high' ? 'text-red-700' : 
                  warning.severity === 'medium' ? 'text-yellow-700' : 'text-gray-700'
                } flex items-center space-x-1`}>
                  {warning.severity === 'high' ? <AlertCircle className="w-3 h-3" /> :
                   warning.severity === 'medium' ? <AlertTriangle className="w-3 h-3" /> :
                   <AlertCircle className="w-3 h-3" />}
                  <span>{warning.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Live Transcript */}
      <div className="space-y-4">
        <div className="bg-navy-50 rounded-lg p-4 min-h-[100px]">
          <h4 className="text-sm font-medium text-navy-700 mb-2">Live Transcription:</h4>
          <div className="text-sm text-navy-800 overflow-y-auto">
            {mounted && isListening ? (
              /* During recording: show complete current transcription */
              <div>
                {transcript.text ? (
                  <div>
                    <span className="block text-navy-900">{transcript.text}</span>
                    {!transcript.isFinal && (
                      <span className="text-navy-500 italic text-xs ml-2">(speaking...)</span>
                    )}
                  </div>
                ) : (
                  <span className="text-navy-500 italic">Listening...</span>
                )}
              </div>
            ) : (
              /* When not recording: show final complete text */
              <div>
                {speechFinalTranscript ? (
                  <div>
                    <div className="text-xs text-navy-500 mb-1">Final Transcription:</div>
                    <span className="block text-navy-900 whitespace-pre-wrap">{speechFinalTranscript}</span>
                  </div>
                ) : transcript.text ? (
                  <div>
                    <div className="text-xs text-navy-500 mb-1">Last Recording:</div>
                    <span className="block text-navy-900 whitespace-pre-wrap">{transcript.text}</span>
                  </div>
                ) : (
                  <span className="text-navy-400">Your transcription will appear here...</span>
                )}
              </div>
            )}
          </div>
        </div>
        
        {/* Final Transcript Display - shows complete accumulated text */}
        {speechFinalTranscript && (
          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
            <h4 className="text-sm font-medium text-green-700 mb-2">Final:</h4>
            <div className="text-sm text-green-800 whitespace-pre-wrap overflow-y-auto">
              {speechFinalTranscript}
            </div>
          </div>
        )}

        {/* Report Generation Mode Toggle */}
        <div className="pt-4 border-t border-navy-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-navy-700">Report Generation:</span>
              <div className="flex items-center bg-navy-100 rounded-lg p-1">
                <button
                  onClick={() => onProcessingModeChange?.('cloud')}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    processingMode === 'cloud' 
                      ? 'bg-white text-navy-600 shadow-sm' 
                      : 'text-navy-500 hover:text-navy-700'
                  }`}
                  title="Use cloud AI providers for Befund reports (Claude, Gemini, OpenAI)"
                >
                  ☁️ Cloud
                </button>
                <button
                  onClick={() => onProcessingModeChange?.('local')}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    processingMode === 'local' 
                      ? 'bg-white text-navy-600 shadow-sm' 
                      : 'text-navy-500 hover:text-navy-700'
                  }`}
                  title="Use local Ollama models for Befund reports (medical-gemma-2b, gpt-oss:20b)"
                >
                  🖥️ Local
                </button>
              </div>
            </div>
            <div className="text-xs text-navy-500">
              {processingMode === 'cloud' ? 'claude → gemini → openai' : 'medical-gemma-2b → gpt-oss:20b'}
            </div>
          </div>
        </div>

      </div>

      {/* Diagnostics Panel */}
      {mounted && (
        <div className="mt-4 border-t border-navy-200 pt-4">
          <button
            onClick={() => setShowDiagnostics(!showDiagnostics)}
            className="flex items-center space-x-2 text-sm text-navy-600 hover:text-navy-800 transition-colors"
          >
            {showDiagnostics ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            <span>Connection Diagnostics</span>
            <div className={`w-2 h-2 rounded-full ${
              connectionStatus === 'connected' ? 'bg-green-500' :
              connectionStatus === 'reconnecting' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'
            }`}></div>
          </button>
          
          {showDiagnostics && (
            <div className="mt-3 p-3 bg-gray-50 rounded-lg">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Connection Status */}
                <div>
                  <h5 className="text-xs font-medium text-navy-700 mb-2">Status</h5>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span>Connection:</span>
                      <span className={`font-medium ${
                        connectionStatus === 'connected' ? 'text-green-600' :
                        connectionStatus === 'reconnecting' ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {connectionStatus}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span>Retry Count:</span>
                      <span className="font-medium text-navy-600">{retryCount}/5</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span>Confidence:</span>
                      <span className="font-medium text-navy-600">{Math.round(confidence * 100)}%</span>
                    </div>
                  </div>
                </div>

                {/* Diagnostic Log */}
                <div>
                  <h5 className="text-xs font-medium text-navy-700 mb-2">Recent Activity</h5>
                  <div className="max-h-20 overflow-y-auto space-y-1">
                    {diagnostics.length > 0 ? (
                      diagnostics.slice(-5).map((diagnostic, index) => (
                        <div key={index} className="text-xs font-mono text-navy-600 bg-white px-2 py-1 rounded text-ellipsis overflow-hidden">
                          {diagnostic}
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-navy-400 italic">No diagnostic messages yet</div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Troubleshooting Tips */}
              {(connectionStatus === 'disconnected' || retryCount > 2) && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded">
                  <h6 className="text-xs font-medium text-blue-800 mb-2">🛠️ Troubleshooting Tips</h6>
                  <ul className="text-xs text-blue-700 space-y-1">
                    <li>• Check microphone permissions in browser settings</li>
                    <li>• Ensure you're using Chrome or Edge (best support)</li>
                    <li>• Make sure you have a stable internet connection</li>
                    <li>• Try speaking closer to your microphone</li>
                    <li>• Close other tabs using microphone access</li>
                    <li>• Refresh the page if issues persist</li>
                  </ul>
                </div>
              )}

              {/* Manual Actions */}
              <div className="mt-3 pt-3 border-t border-gray-200 flex items-center justify-between">
                <div className="text-xs text-navy-500">
                  {retryCount > 0 ? 
                    `Retrying connection... (${retryCount}/5)` : 
                    'WebSpeech API has 60-second session limits - automatic restarts every 55s'}
                </div>
                {connectionStatus === 'disconnected' && (
                  <button
                    onClick={manualRetry}
                    className="flex items-center space-x-1 px-3 py-1 bg-navy-600 text-white text-xs rounded hover:bg-navy-700 transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Retry Now</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}