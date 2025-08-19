import { useState, useEffect, useRef, useCallback } from 'react';

interface MedicalValidation {
  corrections: Array<{
    original: string;
    corrected: string;
    type: string;
  }>;
  warnings: Array<{
    type: string;
    message: string;
    severity: string;
  }>;
  qualityScore: number;
  isValid: boolean;
}

interface TranscriptData {
  text: string;
  isFinal: boolean;
  confidence: number;
  validation?: MedicalValidation;
}

interface UseEnhancedSpeechToTextProps {
  lang?: string;
  continuous?: boolean;
  interimResults?: boolean;
  medicalValidation?: boolean;
  confidenceThreshold?: number;
  onTranscriptChange?: (transcript: TranscriptData) => void;
}

export const useEnhancedSpeechToText = ({
  lang = 'de-DE',
  continuous = true,
  interimResults = true,
  medicalValidation = true,
  confidenceThreshold = 0.6,
  onTranscriptChange
}: UseEnhancedSpeechToTextProps = {}) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptData>({
    text: '',
    isFinal: false,
    confidence: 0
  });
  const [finalTranscript, setFinalTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [hasRecognitionSupport, setHasRecognitionSupport] = useState(false);
  const [validationEnabled, setValidationEnabled] = useState(medicalValidation);
  const [confidence, setConfidence] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'reconnecting'>('disconnected');
  const [retryCount, setRetryCount] = useState(0);
  const [diagnostics, setDiagnostics] = useState<string[]>([]);

  const recognitionRef = useRef<any>(null);
  const finalTranscriptRef = useRef('');
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const connectionHealthRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const sessionStartRef = useRef<number>(Date.now());
  const restartTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const maxRetries = 5; // Increased from 3
  const retryDelayMs = 1000;
  const healthCheckInterval = 5000; // Check connection health every 5 seconds
  const maxSessionDuration = 60000; // 60 seconds max per session (WebSpeech limitation)
  const restartInterval = 55000; // Restart every 55 seconds to prevent timeout

  // Medical dictionary for real-time corrections - Enhanced with cardiology terms
  const medicalCorrections = useRef(new Map([
    // Basic medical terms
    ['mammografie', 'mammographie'],
    ['sonografie', 'sonographie'], 
    ['mama', 'mamma'],
    ['mamme', 'mamma'],
    ['be fund', 'befund'],
    ['be urteilung', 'beurteilung'],
    ['em pfehlung', 'empfehlung'],
    ['auf fällig', 'auffällig'],
    ['un auffällig', 'unauffällig'],
    ['kontrast mittel', 'kontrastmittel'],
    ['gado linium', 'gadolinium'],
    ['tek nik', 'technik'],
    ['se quenz', 'sequenz'],
    ['re konstruktion', 'rekonstruktion'],
    ['ultra schall', 'ultraschall'],
    ['sono graphie', 'sonographie'],
    
    // Cardiology & Echocardiography terms - Based on tester feedback
    ['transdorakale', 'transthorakale'],
    ['trans thorakale', 'transthorakale'],
    ['trans torakale', 'transthorakale'],
    ['echo kardiographie', 'echokardiographie'],
    ['echo kardio graphie', 'echokardiographie'],
    ['linke ventrikel', 'linker ventrikel'],
    ['linke ventrikeln', 'linker ventrikel'],
    ['normotruf', 'normotroph'],
    ['normo troph', 'normotroph'],
    ['wand bewegungsstörungen', 'wandbewegungsstörungen'],
    ['wand bewegung störungen', 'wandbewegungsstörungen'],
    ['lv funktion', 'lv-funktion'],
    ['rechter ventrikeln', 'rechter ventrikel'],
    ['recht ventrikel', 'rechter ventrikel'],
    ['divertiert', 'dilatiert'],
    ['rechts herz', 'rechtsherzbelastung'],
    ['recht herz belastung', 'rechtsherzbelastung'],
    ['perikateguss', 'perikarderguss'],
    ['peri kard erguss', 'perikarderguss'],
    ['pleura erguss', 'pleuraerguss'],
    ['pleura ergusskonfiguration', 'pleuraergusskonfiguration'],
    ['pleura erguss konfiguration', 'pleuraergusskonfiguration'], 
    ['subkristaler', 'subkostaler'],
    ['sub kostaler', 'subkostaler'],
    ['sub kristaler', 'subkostaler'],
    ['b linien', 'b-linien'],
    ['antillionen', 'anterioren'],
    ['antilloren', 'anterioren'],
    ['lungen sonographie', 'lungensonographie'],
    ['intestielle', 'interstitielle'],
    ['inter stitielle', 'interstitielle'],
    ['stau ung', 'stauung'],
    
    // Common pronunciation errors
    ['sys tolische', 'systolische'],
    ['dias tolische', 'diastolische'],
    ['ventri kuläre', 'ventrikuläre'],
    ['myo kardial', 'myokardial'],
    ['endo kardial', 'endokardial'],
    ['kardio vaskulär', 'kardiovaskulär'],
    
    // Technical/procedural terms that are commonly mis-transcribed
    ['doppler echo', 'doppler-echo'],
    ['farb doppler', 'farbdoppler'],
    ['kontinuierlich welle', 'kontinuierliche welle'],
    ['pulsed wave', 'pulsed-wave'],
    ['spectral doppler', 'spektraldoppler']
  ]));

  // Add diagnostic logging
  const addDiagnostic = useCallback((message: string) => {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    const diagnosticMessage = `[${timestamp}] ${message}`;
    console.log('Speech Recognition:', diagnosticMessage);
    setDiagnostics(prev => [...prev.slice(-4), diagnosticMessage]); // Keep last 5 messages
  }, []);

  // Browser compatibility check
  const checkBrowserCompatibility = useCallback(() => {
    const diagnostics = [];
    
    // Check for basic speech recognition support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      diagnostics.push('❌ Speech Recognition API not supported');
      return diagnostics;
    }

    // Check browser type and version
    const userAgent = navigator.userAgent;
    if (userAgent.includes('Chrome')) {
      const chromeVersion = userAgent.match(/Chrome\/(\d+)/)?.[1];
      diagnostics.push(`✅ Chrome ${chromeVersion} detected`);
    } else if (userAgent.includes('Edge')) {
      diagnostics.push('✅ Edge detected');
    } else if (userAgent.includes('Safari')) {
      diagnostics.push('⚠️ Safari detected (limited support)');
    } else {
      diagnostics.push('⚠️ Unknown browser (may have limited support)');
    }

    // Check HTTPS
    if (location.protocol === 'https:') {
      diagnostics.push('✅ HTTPS connection');
    } else {
      diagnostics.push('⚠️ HTTP connection (may cause issues)');
    }

    // Check microphone permissions
    if (navigator.permissions) {
      navigator.permissions.query({ name: 'microphone' as PermissionName }).then(result => {
        if (result.state === 'granted') {
          addDiagnostic('✅ Microphone permission granted');
        } else if (result.state === 'denied') {
          addDiagnostic('❌ Microphone permission denied');
        } else {
          addDiagnostic('⚠️ Microphone permission not yet granted');
        }
      }).catch(() => {
        addDiagnostic('❓ Unable to check microphone permissions');
      });
    }

    return diagnostics;
  }, [addDiagnostic]);

  // Connection health monitoring
  const startHealthMonitoring = useCallback(() => {
    if (connectionHealthRef.current) {
      clearInterval(connectionHealthRef.current);
    }

    connectionHealthRef.current = setInterval(() => {
      const now = Date.now();
      const timeSinceActivity = now - lastActivityRef.current;
      
      // If listening but no activity for more than 10 seconds, consider it stale
      if (isListening && timeSinceActivity > 10000 && connectionStatus === 'connected') {
        addDiagnostic('🔍 Stale connection detected, triggering reconnect');
        attemptReconnection();
      }
    }, healthCheckInterval);
  }, [isListening, connectionStatus, addDiagnostic]);

  // Session management - restart recognition periodically to avoid timeouts
  const scheduleSessionRestart = useCallback(() => {
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
    }

    restartTimeoutRef.current = setTimeout(() => {
      if (isListening && connectionStatus === 'connected') {
        addDiagnostic('🔄 Preventive session restart (WebSpeech API limitation)');
        
        // Gracefully restart the session
        if (recognitionRef.current) {
          recognitionRef.current.stop();
          setTimeout(() => {
            if (isListening) {
              sessionStartRef.current = Date.now();
              startListening();
            }
          }, 1000);
        }
      }
    }, restartInterval);
  }, [isListening, connectionStatus, addDiagnostic]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      if (connectionHealthRef.current) {
        clearInterval(connectionHealthRef.current);
      }
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
      }
      if (recognitionRef.current && isListening) {
        recognitionRef.current.stop();
      }
    };
  }, [isListening]);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      setHasRecognitionSupport(true);
      recognitionRef.current = new SpeechRecognition();
      setConnectionStatus('disconnected');
      
      // Run browser compatibility check
      const browserDiagnostics = checkBrowserCompatibility();
      browserDiagnostics.forEach(diagnostic => addDiagnostic(diagnostic));
      addDiagnostic('🚀 Speech Recognition service initialized');
    } else {
      setHasRecognitionSupport(false);
      setError('Speech recognition not supported in this browser');
      setConnectionStatus('disconnected');
      addDiagnostic('❌ Speech Recognition API not available');
    }
  }, [addDiagnostic, checkBrowserCompatibility]);

  // Retry mechanism for reconnection
  const attemptReconnection = useCallback(() => {
    if (retryCount >= maxRetries) {
      addDiagnostic(`❌ Maximum retries (${maxRetries}) exceeded`);
      setError('Failed to reconnect to transcription service after maximum retries');
      setConnectionStatus('disconnected');
      setRetryCount(0);
      return;
    }

    const attempt = retryCount + 1;
    addDiagnostic(`🔄 Reconnection attempt ${attempt}/${maxRetries}`);
    setConnectionStatus('reconnecting');
    setError(`Connection to transcription service lost. Attempting to reconnect... (${attempt}/${maxRetries})`);
    
    retryTimeoutRef.current = setTimeout(() => {
      setRetryCount(prev => prev + 1);
      
      // Clean up previous recognition instance
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
          recognitionRef.current = null;
        } catch (e) {
          addDiagnostic('⚠️ Error stopping previous recognition instance');
        }
      }
      
      // Recreate recognition instance
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        addDiagnostic('🔧 Recreated recognition instance');
        
        if (isListening) {
          addDiagnostic('🎤 Attempting to restart listening');
          startListening();
        }
      } else {
        addDiagnostic('❌ Failed to recreate recognition instance');
      }
    }, retryDelayMs * attempt); // Exponential backoff
  }, [retryCount, maxRetries, isListening, addDiagnostic]);

  const applyMedicalCorrections = useCallback((text: string): { 
    correctedText: string; 
    corrections: Array<{ original: string; corrected: string; type: string }> 
  } => {
    if (!validationEnabled) {
      return { correctedText: text, corrections: [] };
    }

    let correctedText = text;
    const corrections: Array<{ original: string; corrected: string; type: string }> = [];

    // Apply phonetic corrections
    for (const [incorrect, correct] of Array.from(medicalCorrections.current.entries())) {
      const regex = new RegExp(`\\b${incorrect}\\b`, 'gi');
      if (regex.test(correctedText)) {
        correctedText = correctedText.replace(regex, correct);
        corrections.push({
          original: incorrect,
          corrected: correct,
          type: 'phonetic_correction'
        });
      }
    }

    return { correctedText, corrections };
  }, [validationEnabled]);

  const detectHallucinations = useCallback((text: string): Array<{
    type: string;
    message: string;
    severity: string;
    matches: string[];
  }> => {
    const warnings = [];

    // Known valid German medical terms to avoid false positives
    const validMedicalTerms = new Set([
      'mikrokalifikation', 'mikrokalzifikation', 'magnetresonanztomographie',
      'computertomographie', 'kontrastmittelaufnehmend', 'zystisch', 'zystischer',
      'zystische', 'mastopathisch', 'mastopathische', 'lymphknoten', 'brustdrüse'
    ]);

    // Detect unusually long words (likely hallucinated) - but exclude known medical terms
    const longWordMatches = text.match(/\b[a-zA-ZäöüÄÖÜß]{20,}\b/g);
    if (longWordMatches) {
      const filteredLongWords = longWordMatches.filter(word => 
        !validMedicalTerms.has(word.toLowerCase())
      );
      if (filteredLongWords.length > 0) {
        warnings.push({
          type: 'potential_hallucination',
          message: `Unusually long words detected: ${filteredLongWords.join(', ')}`,
          severity: 'medium',
          matches: filteredLongWords
        });
      }
    }

    // Detect words with too many repeated uncommon letters - but exclude valid terms
    const repeatedLetterMatches = text.match(/\b\w*[xyz]{3,}\w*\b/g);
    if (repeatedLetterMatches) {
      const filteredRepeatedWords = repeatedLetterMatches.filter(word => 
        !validMedicalTerms.has(word.toLowerCase())
      );
      if (filteredRepeatedWords.length > 0) {
        warnings.push({
          type: 'potential_hallucination',
          message: `Words with repeated uncommon letters: ${filteredRepeatedWords.join(', ')}`,
          severity: 'high',
          matches: filteredRepeatedWords
        });
      }
    }

    // Detect too many consecutive consonants - but exclude valid medical terms
    const consonantMatches = text.match(/\b[bcdfghjklmnpqrstvwxyz]{6,}\b/gi);
    if (consonantMatches) {
      const filteredConsonantWords = consonantMatches.filter(word => 
        !validMedicalTerms.has(word.toLowerCase())
      );
      if (filteredConsonantWords.length > 0) {
        warnings.push({
          type: 'potential_hallucination',
          message: `Words with too many consecutive consonants: ${filteredConsonantWords.join(', ')}`,
          severity: 'medium',
          matches: filteredConsonantWords
        });
      }
    }

    return warnings;
  }, []);

  const validateTranscription = useCallback((text: string, confidence: number): MedicalValidation => {
    if (!validationEnabled) {
      return {
        corrections: [],
        warnings: [],
        qualityScore: confidence,
        isValid: true
      };
    }

    // Apply medical corrections
    const { correctedText, corrections } = applyMedicalCorrections(text);

    // Detect potential hallucinations
    const warnings = detectHallucinations(correctedText);

    // Calculate quality score
    let qualityScore = confidence;
    if (warnings.length > 0) {
      qualityScore *= 0.7; // Reduce score for potential hallucinations
    }

    // Check confidence thresholds
    if (confidence < 0.6) {
      warnings.push({
        type: 'low_confidence',
        message: `Low transcription confidence: ${Math.round(confidence * 100)}%`,
        severity: 'high',
        matches: []
      });
    }

    const isValid = qualityScore >= 0.5 && confidence >= confidenceThreshold;

    return {
      corrections,
      warnings,
      qualityScore,
      isValid
    };
  }, [validationEnabled, confidenceThreshold, applyMedicalCorrections, detectHallucinations]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current || isListening) return;

    setError(null);
    setIsListening(true);
    
    // Initialize ref with current finalTranscript value
    finalTranscriptRef.current = finalTranscript;

    // Configure recognition
    recognitionRef.current.continuous = continuous;
    recognitionRef.current.interimResults = interimResults;
    recognitionRef.current.lang = lang;
    recognitionRef.current.maxAlternatives = 3;

    // Event handlers
    recognitionRef.current.onresult = (event: any) => {
      lastActivityRef.current = Date.now(); // Update activity timestamp
      let interimTranscriptText = '';
      let newFinalText = '';
      let highestConfidence = 0;

      // Process only the new results from this event
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcriptPart = result[0].transcript;
        const confidence = result[0].confidence || 0.5;

        highestConfidence = Math.max(highestConfidence, confidence);

        if (result.isFinal) {
          newFinalText += transcriptPart;
        } else {
          interimTranscriptText += transcriptPart;
        }
      }

      // Update interim transcript (this shows what's currently being spoken)
      if (interimTranscriptText) {
        const { correctedText } = applyMedicalCorrections(interimTranscriptText);
        setInterimTranscript(correctedText);
        
        // Create full text including previous final + current interim
        const fullCurrentText = finalTranscriptRef.current + (finalTranscriptRef.current ? ' ' : '') + correctedText;
        const validation = validateTranscription(fullCurrentText.trim(), highestConfidence);
        
        const transcriptData: TranscriptData = {
          text: fullCurrentText.trim(),
          isFinal: false,
          confidence: highestConfidence,
          validation: validation
        };

        setConfidence(highestConfidence);
        setTranscript(transcriptData);
        
        if (onTranscriptChange) {
          onTranscriptChange(transcriptData);
        }
      }

      // Update final transcript (accumulate all final results)
      if (newFinalText) {
        const { correctedText } = applyMedicalCorrections(newFinalText);
        
        // Add the new final text to the existing final transcript
        const updatedFinalTranscript = finalTranscriptRef.current + (finalTranscriptRef.current ? ' ' : '') + correctedText;
        finalTranscriptRef.current = updatedFinalTranscript;
        setFinalTranscript(updatedFinalTranscript);
        
        // Clear interim since it became final
        setInterimTranscript('');
        
        // Send the complete accumulated text
        const validation = validateTranscription(updatedFinalTranscript, highestConfidence);
        
        const transcriptData: TranscriptData = {
          text: updatedFinalTranscript,
          isFinal: true,
          confidence: highestConfidence,
          validation: validation
        };

        setConfidence(highestConfidence);
        setTranscript(transcriptData);
        
        if (onTranscriptChange) {
          onTranscriptChange(transcriptData);
        }
      }
    };

    recognitionRef.current.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      setConnectionStatus('disconnected');
      
      // Handle different error types
      switch (event.error) {
        case 'network':
          setError('Network error - attempting to reconnect...');
          attemptReconnection();
          break;
        case 'service-not-allowed':
          setError('Microphone access denied. Please allow microphone access and refresh.');
          break;
        case 'not-allowed':
          setError('Microphone access not allowed. Please check browser permissions.');
          break;
        case 'no-speech':
          setError('No speech detected. Try speaking closer to the microphone.');
          break;
        case 'audio-capture':
          setError('Audio capture failed. Check microphone connection.');
          break;
        case 'aborted':
          // Don't show error for user-initiated stops
          setError(null);
          break;
        default:
          setError(`Speech recognition error: ${event.error}`);
          // For unknown errors, try to reconnect
          if (isListening) {
            attemptReconnection();
          }
          break;
      }
    };

    recognitionRef.current.onend = () => {
      addDiagnostic('🏁 Recognition ended');
      setIsListening(false);
      
      // Check if this was an unexpected end (not user-initiated)
      const sessionDuration = Date.now() - sessionStartRef.current;
      if (sessionDuration < maxSessionDuration && connectionStatus === 'connected') {
        addDiagnostic(`⚠️ Unexpected end after ${Math.round(sessionDuration/1000)}s - attempting restart`);
        
        // This was likely a service interruption, try to restart
        setTimeout(() => {
          if (hasRecognitionSupport && !isListening) {
            attemptReconnection();
          }
        }, 1000);
      }
      
      // When recording ends, make sure we send the final complete transcript
      if (finalTranscriptRef.current.trim() || interimTranscript.trim()) {
        const completeText = (finalTranscriptRef.current + ' ' + interimTranscript).trim();
        const validation = validateTranscription(completeText, confidence);
        
        const finalTranscriptData: TranscriptData = {
          text: completeText,
          isFinal: true,
          confidence: confidence,
          validation: validation
        };
        
        setTranscript(finalTranscriptData);
        if (onTranscriptChange) {
          onTranscriptChange(finalTranscriptData);
        }
      }
    };

    // Add connection status handlers
    recognitionRef.current.onstart = () => {
      addDiagnostic('✅ Recognition started successfully');
      setConnectionStatus('connected');
      setError(null);
      setRetryCount(0); // Reset retry count on successful connection
      lastActivityRef.current = Date.now();
      sessionStartRef.current = Date.now(); // Track session start
      
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      
      // Start health monitoring
      startHealthMonitoring();
      
      // Schedule preventive restart
      scheduleSessionRestart();
    };

    // Start recognition
    try {
      addDiagnostic('🎤 Starting speech recognition...');
      recognitionRef.current.start();
    } catch (err: any) {
      const errorMsg = `Failed to start speech recognition: ${err.message}`;
      addDiagnostic(`❌ ${errorMsg}`);
      console.error('Failed to start speech recognition:', err);
      setError(errorMsg);
      setIsListening(false);
      setConnectionStatus('disconnected');
      
      // Try to reconnect if the service was previously working
      if (hasRecognitionSupport) {
        attemptReconnection();
      }
    }
  }, [
    isListening,
    continuous,
    interimResults,
    lang,
    validateTranscription,
    applyMedicalCorrections,
    onTranscriptChange,
    hasRecognitionSupport,
    attemptReconnection,
    confidence,
    addDiagnostic,
    startHealthMonitoring,
    scheduleSessionRestart,
    connectionStatus,
    maxSessionDuration
  ]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      addDiagnostic('🛑 Stopping speech recognition');
      recognitionRef.current.stop();
    }
    setConnectionStatus('disconnected');
    
    // Stop health monitoring
    if (connectionHealthRef.current) {
      clearInterval(connectionHealthRef.current);
      connectionHealthRef.current = null;
    }
    
    // Stop session restart timer
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }
  }, [isListening, addDiagnostic]);

  const manualRetry = useCallback(() => {
    setRetryCount(0);
    setError(null);
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    
    if (isListening) {
      stopListening();
      setTimeout(() => startListening(), 500);
    }
  }, [isListening, stopListening, startListening]);

  const resetFinalTranscript = useCallback(() => {
    finalTranscriptRef.current = '';
    setFinalTranscript('');
    setInterimTranscript('');
    setTranscript({
      text: '',
      isFinal: false,
      confidence: 0
    });
    setConfidence(0);
  }, []);

  const toggleValidation = useCallback(() => {
    setValidationEnabled(prev => !prev);
  }, []);

  const getQualityAssessment = useCallback(() => {
    if (!transcript.validation) {
      return {
        overall: 'good',
        confidence: confidence,
        issues: 0
      };
    }

    const issues = transcript.validation.corrections.length + transcript.validation.warnings.length;
    let overall = 'excellent';
    
    if (confidence < 0.6 || issues > 3) {
      overall = 'poor';
    } else if (confidence < 0.8 || issues > 1) {
      overall = 'fair';
    } else if (issues > 0) {
      overall = 'good';
    }

    return {
      overall,
      confidence: confidence,
      issues: issues,
      qualityScore: transcript.validation.qualityScore
    };
  }, [transcript, confidence]);

  return {
    isListening,
    transcript,
    finalTranscript,
    interimTranscript,
    startListening,
    stopListening,
    resetFinalTranscript,
    hasRecognitionSupport,
    error,
    validationEnabled,
    toggleValidation,
    getQualityAssessment,
    confidence,
    connectionStatus,
    manualRetry,
    retryCount,
    diagnostics
  };
};