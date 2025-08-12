'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Mic, MicOff, AlertCircle, Activity, CheckCircle, AlertTriangle } from 'lucide-react';
import { useEnhancedSpeechToText } from '@/hooks/useEnhancedSpeechToText';
import { multiLLMService } from '@/services/multiLLMService';
import { Language, TranscriptionData } from '@/types';
import { getMedicalTerm } from '@/utils/languages';
import { generateId } from '@/utils';

interface WebSpeechRecorderProps {
  language: Language;
  onTranscription?: (transcription: TranscriptionData) => void;
  onRefinedTranscription?: (refined: string) => void;
  processingMode?: 'cloud' | 'local';
  onProcessingModeChange?: (mode: 'cloud' | 'local') => void;
  className?: string;
}

export default function WebSpeechRecorder({
  language,
  onTranscription,
  onRefinedTranscription,
  processingMode = 'cloud',
  onProcessingModeChange,
  className = ''
}: WebSpeechRecorderProps) {
  const [error, setError] = useState<string | null>(null);
  const [refinedText, setRefinedText] = useState<string>('');
  const [isRefining, setIsRefining] = useState<boolean>(false);
  // Remove duplicate finalTranscript state - use speechFinalTranscript from hook
  const [mounted, setMounted] = useState<boolean>(false);

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
    confidence
  } = useEnhancedSpeechToText({
    lang: language === 'de' ? 'de-DE' : 'en-US',
    continuous: true,
    interimResults: true,
    medicalValidation: true,
    confidenceThreshold: 0.6,
    onTranscriptChange: useCallback((transcriptData) => {
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

  const handleRefineTranscript = useCallback(async () => {
    if (!speechFinalTranscript || isRefining) return;
    
    setIsRefining(true);
    setError(null);
    
    try {
      // Always use local processing for transcription refinement (simple text cleanup)
      const refined = await multiLLMService.refineTranscript(speechFinalTranscript, 'local');
      setRefinedText(refined);
      if (onRefinedTranscription) {
        onRefinedTranscription(refined);
      }
    } catch (err) {
      console.error('Failed to refine transcript:', err);
      setError('Failed to refine transcript. Please check your API keys and try again.');
    } finally {
      setIsRefining(false);
    }
  }, [speechFinalTranscript, isRefining, onRefinedTranscription]);

  const handleToggleRecording = useCallback(() => {
    if (!hasRecognitionSupport) {
      setError('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    setError(null);
    
    if (isListening) {
      stopListening();
    } else {
      // Reset on new recording
      setRefinedText('');
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
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-error-600" />
            <p className="text-sm text-error-600">{displayError}</p>
          </div>
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
          <div className="w-4 h-4 rounded-full bg-error-500 animate-pulse"></div>
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
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Medical Corrections Display */}
          {validationEnabled && transcript.validation && transcript.validation.corrections.length > 0 && (
            <div className="mt-3 p-2 bg-blue-50 rounded text-xs">
              <div className="font-medium text-blue-800 mb-1">Medical Corrections Applied:</div>
              {transcript.validation.corrections.map((correction, idx) => (
                <div key={idx} className="text-blue-700">
                  "{correction.original}" → "{correction.corrected}"
                </div>
              ))}
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
        <div className="flex items-center justify-between pt-4 border-t border-navy-200">
          <div className="flex items-center space-x-4">
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
            For Befund reports: {processingMode === 'cloud' ? 'claude → gemini → openai' : 'medical-gemma-2b → gpt-oss:20b'}
          </div>
        </div>

        {/* AI Refinement */}
        <div className="flex items-center justify-between pt-4">
          <div className="text-sm">
            {!speechFinalTranscript && (
              <p className="text-navy-500 text-xs mt-1">Record audio to enable refinement</p>
            )}
          </div>
          
          {speechFinalTranscript && (
            <button
              onClick={handleRefineTranscript}
              disabled={!mounted || isRefining || !speechFinalTranscript || isListening}
              className="medical-button-success flex items-center space-x-2 disabled:opacity-50"
            >
              {isRefining ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Refining...</span>
                </>
              ) : (
                <>
                  <Activity className="w-4 h-4" />
                  <span>Refine with AI</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Refined Output */}
        {refinedText && (
          <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
            <h4 className="text-sm font-medium text-orange-700 mb-2">AI-Refined Medical Notes:</h4>
            <div className="text-sm text-orange-800 whitespace-pre-wrap">{refinedText}</div>
          </div>
        )}
      </div>
    </div>
  );
}