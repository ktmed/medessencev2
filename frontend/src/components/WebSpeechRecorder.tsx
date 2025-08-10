'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Mic, MicOff, AlertCircle, Activity } from 'lucide-react';
import { useSpeechToText } from '@/hooks/useSpeechToText';
import { multiLLMService } from '@/services/multiLLMService';
import { Language, TranscriptionData } from '@/types';
import { getMedicalTerm } from '@/utils/languages';
import { generateId } from '@/utils';

interface WebSpeechRecorderProps {
  language: Language;
  onTranscription?: (transcription: TranscriptionData) => void;
  onRefinedTranscription?: (refined: string) => void;
  className?: string;
}

export default function WebSpeechRecorder({
  language,
  onTranscription,
  onRefinedTranscription,
  className = ''
}: WebSpeechRecorderProps) {
  const [refinedText, setRefinedText] = useState<string>('');
  const [isRefining, setIsRefining] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [finalTranscript, setFinalTranscript] = useState<string>('');

  const {
    isListening,
    transcript,
    startListening,
    stopListening,
    hasRecognitionSupport,
    error: speechError
  } = useSpeechToText({
    lang: language === 'de' ? 'de-DE' : 'en-US',
    continuous: true,
    interimResults: true,
  });

  // Handle final transcriptions
  useEffect(() => {
    if (!isListening && transcript.final) {
      const newFinal = finalTranscript 
        ? `${finalTranscript} ${transcript.final}`.trim() 
        : transcript.final;
      
      setFinalTranscript(newFinal);
      
      // Create TranscriptionData object
      if (onTranscription) {
        const transcriptionData: TranscriptionData = {
          id: generateId(),
          text: newFinal,
          confidence: 0.9, // Web Speech API doesn't provide confidence, use default
          timestamp: Date.now(),
          language: language,
          isFinal: true
        };
        onTranscription(transcriptionData);
      }
    }
  }, [transcript.final, isListening, finalTranscript, onTranscription, language]);

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
      setFinalTranscript('');
      setRefinedText('');
      startListening();
    }
  }, [isListening, startListening, stopListening, hasRecognitionSupport]);

  const handleRefineTranscript = useCallback(async () => {
    if (!finalTranscript || isRefining) return;
    
    setIsRefining(true);
    setError(null);
    
    try {
      const refined = await multiLLMService.refineTranscript(finalTranscript);
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
  }, [finalTranscript, isRefining, onRefinedTranscription]);

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

      {/* Browser Support Warning */}
      {!hasRecognitionSupport && (
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
          disabled={!hasRecognitionSupport}
          className={`
            flex items-center justify-center w-16 h-16 rounded-full transition-all duration-300 
            focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-navy-500 shadow-md
            ${isListening 
              ? 'bg-error-500 hover:bg-error-600 text-white animate-pulse' 
              : 'bg-navy-600 hover:bg-navy-700 text-white'
            } 
            disabled:bg-gray-300 disabled:cursor-not-allowed
          `}
        >
          {isListening ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
        </button>

        <div className="text-center">
          <p className="font-semibold text-lg med-text-navy">
            {isListening ? 'Recording...' : 'Ready to record'}
          </p>
          <p className="text-sm text-navy-600">
            {isListening ? 'Click to stop recording' : 'Click microphone to start'}
          </p>
        </div>
        
        {isListening && (
          <div className="w-4 h-4 rounded-full bg-error-500 animate-pulse"></div>
        )}
      </div>

      {/* Live Transcript */}
      <div className="space-y-4">
        <div className="bg-navy-50 rounded-lg p-4 min-h-[100px]">
          <h4 className="text-sm font-medium text-navy-700 mb-2">Live Transcription:</h4>
          <div className="text-sm text-navy-800">
            {finalTranscript && (
              <span className="block mb-1">{finalTranscript}</span>
            )}
            {isListening && transcript.interim && (
              <span className="text-navy-500 italic">{transcript.interim}</span>
            )}
            {!finalTranscript && !transcript.interim && (
              <span className="text-navy-400">Your transcription will appear here...</span>
            )}
          </div>
        </div>

        {/* AI Refinement */}
        {finalTranscript && (
          <div className="flex items-center justify-between pt-4 border-t border-navy-200">
            <div className="text-sm">
              <span className="font-medium text-navy-700">German Medical AI Refinement</span>
              <p className="text-navy-600">Available providers: {multiLLMService.getAvailableProviders().join(', ')}</p>
            </div>
            <button
              onClick={handleRefineTranscript}
              disabled={isRefining || !finalTranscript || isListening}
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
          </div>
        )}

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