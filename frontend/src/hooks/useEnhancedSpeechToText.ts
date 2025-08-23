import { useState, useEffect, useRef, useCallback } from 'react';
import { ontologyService, OntologyValidationResponse } from '@/services/ontologyService';

interface MedicalValidation {
  corrections: Array<{
    original: string;
    corrected: string;
    type: string;
    confidence?: number;
  }>;
  warnings: Array<{
    type: string;
    message: string;
    severity: string;
  }>;
  qualityScore: number;
  isValid: boolean;
  ontologyEnhanced?: boolean;
  medicalTermsDetected?: Array<{
    term: string;
    category: string;
    confidence: number;
  }>;
  semanticQuality?: number;
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
  const [ontologyAvailable, setOntologyAvailable] = useState<boolean>(false);
  const [ontologyEnhanced, setOntologyEnhanced] = useState<boolean>(false);

  const recognitionRef = useRef<any>(null);
  const finalTranscriptRef = useRef('');
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const connectionHealthRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const sessionStartRef = useRef<number>(Date.now());
  const restartTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const ontologyDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const maxRetries = 5; // Increased from 3
  const retryDelayMs = 1000;
  const healthCheckInterval = 5000; // Check connection health every 5 seconds
  const maxSessionDuration = 60000; // 60 seconds max per session (WebSpeech limitation)
  const restartInterval = 55000; // Restart every 55 seconds to prevent timeout

  // Voice punctuation commands for German and English
  const punctuationCommands = useRef(new Map([
    // German punctuation commands
    ['komma', ','],
    ['punkt', '.'],
    ['fragezeichen', '?'],
    ['ausrufungszeichen', '!'],
    ['ausrufezeichen', '!'],
    ['doppelpunkt', ':'],
    ['semikolon', ';'],
    ['strichpunkt', ';'],
    ['gedankenstrich', ' – '],
    ['bindestrich', '-'],
    ['anführungszeichen', '"'],
    ['anführungszeichen auf', '"'],
    ['anführungszeichen zu', '"'],
    ['klammer auf', '('],
    ['klammer zu', ')'],
    ['eckige klammer auf', '['],
    ['eckige klammer zu', ']'],
    ['geschweifte klammer auf', '{'],
    ['geschweifte klammer zu', '}'],
    
    // English punctuation commands
    ['comma', ','],
    ['period', '.'],
    ['full stop', '.'],
    ['question mark', '?'],
    ['exclamation mark', '!'],
    ['exclamation point', '!'],
    ['colon', ':'],
    ['semicolon', ';'],
    ['dash', ' – '],
    ['hyphen', '-'],
    ['quote', '"'],
    ['quotation mark', '"'],
    ['open quote', '"'],
    ['close quote', '"'],
    ['open parenthesis', '('],
    ['close parenthesis', ')'],
    ['left parenthesis', '('],
    ['right parenthesis', ')'],
    ['open bracket', '['],
    ['close bracket', ']'],
    ['left bracket', '['],
    ['right bracket', ']'],
    ['open brace', '{'],
    ['close brace', '}'],
    ['left brace', '{'],
    ['right brace', '}'],
  ]));

  // Paragraph and formatting commands
  const formatCommands = useRef(new Map([
    // German formatting commands
    ['neue zeile', '\n'],
    ['zeilenumbruch', '\n'],
    ['neuer absatz', '\n\n'],
    ['absatz', '\n\n'],
    ['neue linie', '\n'],
    ['leerzeile', '\n\n'],
    
    // English formatting commands
    ['new line', '\n'],
    ['line break', '\n'],
    ['new paragraph', '\n\n'],
    ['paragraph', '\n\n'],
    ['paragraph break', '\n\n'],
    ['blank line', '\n\n'],
  ]));

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
      if (ontologyDebounceRef.current) {
        clearTimeout(ontologyDebounceRef.current);
      }
    };
  }, [isListening]);

  // Check ontology service availability on mount
  useEffect(() => {
    const checkOntologyService = async () => {
      try {
        const available = await ontologyService.isAvailable();
        setOntologyAvailable(available);
        if (available) {
          addDiagnostic('🧬 Ontology service available for real-time enhancement');
        } else {
          addDiagnostic('⚠️ Ontology service unavailable - using local corrections only');
        }
      } catch (error) {
        setOntologyAvailable(false);
        addDiagnostic('❌ Failed to check ontology service availability');
      }
    };

    checkOntologyService();
  }, [addDiagnostic]);

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

  // Process voice punctuation and formatting commands
  const processPunctuationCommands = useCallback((text: string): string => {
    let processedText = text;
    
    // First, process punctuation commands
    for (const [command, punctuation] of Array.from(punctuationCommands.current.entries())) {
      // Create regex to match the command as a separate word
      const regex = new RegExp(`\\b${command}\\b`, 'gi');
      if (regex.test(processedText)) {
        // Replace command with punctuation and handle spacing
        processedText = processedText.replace(regex, (match, offset) => {
          const beforeChar = offset > 0 ? processedText[offset - 1] : '';
          const afterChar = offset + match.length < processedText.length ? processedText[offset + match.length] : '';
          
          // Handle spacing around punctuation
          if (punctuation === ',' || punctuation === '.' || punctuation === '?' || punctuation === '!' || punctuation === ':' || punctuation === ';') {
            // Remove space before punctuation, ensure space after (unless at end)
            return punctuation + (afterChar && afterChar !== ' ' ? ' ' : '');
          } else if (punctuation === '(' || punctuation === '[' || punctuation === '{') {
            // Opening brackets: space before, no space after
            return (beforeChar && beforeChar !== ' ' ? ' ' : '') + punctuation;
          } else if (punctuation === ')' || punctuation === ']' || punctuation === '}') {
            // Closing brackets: no space before, space after
            return punctuation + (afterChar && afterChar !== ' ' ? ' ' : '');
          } else {
            // Other punctuation like quotes, dashes
            return punctuation;
          }
        });
      }
    }
    
    // Then, process formatting commands
    for (const [command, format] of Array.from(formatCommands.current.entries())) {
      const regex = new RegExp(`\\b${command}\\b`, 'gi');
      if (regex.test(processedText)) {
        processedText = processedText.replace(regex, format);
      }
    }
    
    // Clean up extra spaces that might have been created
    processedText = processedText.replace(/\s+/g, ' ').trim();
    
    // Handle capitalization after sentence-ending punctuation
    processedText = processedText.replace(/([.!?])\s+(\w)/g, (match, punctuation, letter) => {
      return punctuation + ' ' + letter.toUpperCase();
    });
    
    // Capitalize first letter of text
    if (processedText.length > 0) {
      processedText = processedText.charAt(0).toUpperCase() + processedText.slice(1);
    }
    
    return processedText;
  }, []);

  // Enhanced medical corrections with ontology integration
  const applyMedicalCorrections = useCallback(async (text: string, isRealTime: boolean = false): Promise<{ 
    correctedText: string; 
    corrections: Array<{ original: string; corrected: string; type: string; confidence?: number }>;
    ontologyEnhanced: boolean;
    medicalTermsDetected?: Array<{ term: string; category: string; confidence: number }>;
    semanticQuality?: number;
  }> => {
    if (!validationEnabled) {
      return { correctedText: text, corrections: [], ontologyEnhanced: false };
    }

    let correctedText = text;
    const corrections: Array<{ original: string; corrected: string; type: string; confidence?: number }> = [];
    let ontologyData: OntologyValidationResponse | null = null;

    // First process punctuation commands
    correctedText = processPunctuationCommands(correctedText);

    // Apply local phonetic corrections first (fast, synchronous)
    for (const [incorrect, correct] of Array.from(medicalCorrections.current.entries())) {
      const regex = new RegExp(`\\b${incorrect}\\b`, 'gi');
      if (regex.test(correctedText)) {
        correctedText = correctedText.replace(regex, correct);
        corrections.push({
          original: incorrect,
          corrected: correct,
          type: 'phonetic_correction',
          confidence: 0.9
        });
      }
    }

    // Try ontology service enhancement if available and text is substantial enough
    if (ontologyAvailable && correctedText.trim().length > 10) {
      try {
        // For real-time, use debounced ontology validation
        if (isRealTime) {
          // Clear existing debounce timer
          if (ontologyDebounceRef.current) {
            clearTimeout(ontologyDebounceRef.current);
          }

          // Only call ontology service for longer texts or final transcripts
          if (correctedText.length > 20 || !isRealTime) {
            ontologyData = await ontologyService.validateText({
              text: correctedText,
              language: lang.startsWith('de') ? 'de' : 'en',
              real_time: isRealTime,
              context: isRealTime ? 'transcription' : 'final'
            });
          }
        } else {
          // For final transcripts, always use ontology service
          ontologyData = await ontologyService.validateText({
            text: correctedText,
            language: lang.startsWith('de') ? 'de' : 'en',
            real_time: false,
            context: 'final'
          });
        }

        // Process ontology response if successful
        if (ontologyData?.success && ontologyData.data) {
          const { enhanced_text, corrections: ontologyCorrections, medical_terms_detected } = ontologyData.data;
          
          // Use enhanced text if it's significantly different
          if (enhanced_text && enhanced_text !== correctedText && enhanced_text.length > correctedText.length * 0.8) {
            const originalText = correctedText;
            correctedText = enhanced_text;
            
            // Add ontology corrections
            if (ontologyCorrections && ontologyCorrections.length > 0) {
              corrections.push(...ontologyCorrections.map(corr => ({
                original: corr.original,
                corrected: corr.corrected,
                type: `ontology_${corr.type}`,
                confidence: corr.confidence
              })));
            } else if (enhanced_text !== originalText) {
              // Add general semantic correction if specific corrections not provided
              corrections.push({
                original: originalText,
                corrected: enhanced_text,
                type: 'ontology_semantic',
                confidence: ontologyData.data.quality_score || 0.85
              });
            }

            setOntologyEnhanced(true);
            
            return {
              correctedText,
              corrections,
              ontologyEnhanced: true,
              medicalTermsDetected: medical_terms_detected,
              semanticQuality: ontologyData.data.quality_score
            };
          }
        }
      } catch (error) {
        // Ontology service failed - fall back to local corrections silently
        if (isRealTime) {
          console.warn('Real-time ontology validation failed:', error);
        } else {
          addDiagnostic('⚠️ Ontology service temporarily unavailable');
        }
      }
    }

    return { 
      correctedText, 
      corrections, 
      ontologyEnhanced: false,
      semanticQuality: undefined
    };
  }, [validationEnabled, processPunctuationCommands, ontologyAvailable, lang, addDiagnostic]);

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

  const validateTranscription = useCallback(async (text: string, confidence: number, isRealTime: boolean = false): Promise<MedicalValidation> => {
    if (!validationEnabled) {
      return {
        corrections: [],
        warnings: [],
        qualityScore: confidence,
        isValid: true,
        ontologyEnhanced: false
      };
    }

    // Apply enhanced medical corrections with ontology integration
    const { 
      correctedText, 
      corrections, 
      ontologyEnhanced, 
      medicalTermsDetected, 
      semanticQuality 
    } = await applyMedicalCorrections(text, isRealTime);

    // Detect potential hallucinations in the corrected text
    const warnings = detectHallucinations(correctedText);

    // Calculate quality score - factor in semantic quality from ontology
    let qualityScore = confidence;
    
    // Boost quality score if ontology enhanced and semantic quality is good
    if (ontologyEnhanced && semanticQuality) {
      qualityScore = Math.max(qualityScore, semanticQuality * 0.9); // Use 90% of semantic quality as baseline
    }
    
    if (warnings.length > 0) {
      qualityScore *= 0.7; // Reduce score for potential hallucinations
    }

    // Add ontology-specific warnings
    if (ontologyAvailable && !ontologyEnhanced && text.length > 20 && isRealTime) {
      warnings.push({
        type: 'ontology_unavailable',
        message: 'Ontology service enhancement temporarily unavailable',
        severity: 'low',
        matches: []
      });
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

    // Add medical terms quality indicator
    if (medicalTermsDetected && medicalTermsDetected.length > 0) {
      const medicalTermsCount = medicalTermsDetected.length;
      const avgMedicalConfidence = medicalTermsDetected.reduce((sum, term) => sum + term.confidence, 0) / medicalTermsCount;
      
      if (avgMedicalConfidence > 0.8) {
        qualityScore = Math.min(qualityScore + 0.1, 1.0); // Boost for good medical term recognition
      }
    }

    const isValid = qualityScore >= 0.5 && confidence >= confidenceThreshold;

    return {
      corrections,
      warnings,
      qualityScore,
      isValid,
      ontologyEnhanced,
      medicalTermsDetected,
      semanticQuality
    };
  }, [validationEnabled, confidenceThreshold, applyMedicalCorrections, detectHallucinations, ontologyAvailable]);

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
        // For interim results, use fast local corrections without ontology (to avoid delay)
        applyMedicalCorrections(interimTranscriptText, true).then(({ correctedText }) => {
          setInterimTranscript(correctedText);
          
          // Create full text including previous final + current interim
          const fullCurrentText = finalTranscriptRef.current + (finalTranscriptRef.current ? ' ' : '') + correctedText;
          
          // Use async validation for real-time enhancement
          validateTranscription(fullCurrentText.trim(), highestConfidence, true).then(validation => {
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
          }).catch(error => {
            console.warn('Real-time validation failed:', error);
            // Fall back to basic transcript without validation
            const transcriptData: TranscriptData = {
              text: fullCurrentText.trim(),
              isFinal: false,
              confidence: highestConfidence
            };

            setConfidence(highestConfidence);
            setTranscript(transcriptData);
            
            if (onTranscriptChange) {
              onTranscriptChange(transcriptData);
            }
          });
        }).catch(error => {
          console.warn('Medical corrections failed:', error);
          // Use original text if corrections fail
          setInterimTranscript(interimTranscriptText);
          const fullCurrentText = finalTranscriptRef.current + (finalTranscriptRef.current ? ' ' : '') + interimTranscriptText;
          
          const transcriptData: TranscriptData = {
            text: fullCurrentText.trim(),
            isFinal: false,
            confidence: highestConfidence
          };

          setConfidence(highestConfidence);
          setTranscript(transcriptData);
          
          if (onTranscriptChange) {
            onTranscriptChange(transcriptData);
          }
        });
      }

      // Update final transcript (accumulate all final results)
      if (newFinalText) {
        // For final results, use full ontology enhancement
        applyMedicalCorrections(newFinalText, false).then(({ correctedText }) => {
          // Add the new final text to the existing final transcript
          const updatedFinalTranscript = finalTranscriptRef.current + (finalTranscriptRef.current ? ' ' : '') + correctedText;
          finalTranscriptRef.current = updatedFinalTranscript;
          setFinalTranscript(updatedFinalTranscript);
          
          // Clear interim since it became final
          setInterimTranscript('');
          
          // Send the complete accumulated text with full validation
          validateTranscription(updatedFinalTranscript, highestConfidence, false).then(validation => {
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
          }).catch(error => {
            console.warn('Final validation failed:', error);
            // Fall back to basic transcript
            const transcriptData: TranscriptData = {
              text: updatedFinalTranscript,
              isFinal: true,
              confidence: highestConfidence
            };

            setConfidence(highestConfidence);
            setTranscript(transcriptData);
            
            if (onTranscriptChange) {
              onTranscriptChange(transcriptData);
            }
          });
        }).catch(error => {
          console.warn('Final corrections failed:', error);
          // Use original text
          const updatedFinalTranscript = finalTranscriptRef.current + (finalTranscriptRef.current ? ' ' : '') + newFinalText;
          finalTranscriptRef.current = updatedFinalTranscript;
          setFinalTranscript(updatedFinalTranscript);
          setInterimTranscript('');
          
          const transcriptData: TranscriptData = {
            text: updatedFinalTranscript,
            isFinal: true,
            confidence: highestConfidence
          };

          setConfidence(highestConfidence);
          setTranscript(transcriptData);
          
          if (onTranscriptChange) {
            onTranscriptChange(transcriptData);
          }
        });
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
        
        // Apply full enhancement for the final complete text
        validateTranscription(completeText, confidence, false).then(validation => {
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
        }).catch(error => {
          console.warn('Final session validation failed:', error);
          // Send without validation
          const finalTranscriptData: TranscriptData = {
            text: completeText,
            isFinal: true,
            confidence: confidence
          };
          
          setTranscript(finalTranscriptData);
          if (onTranscriptChange) {
            onTranscriptChange(finalTranscriptData);
          }
        });
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
    diagnostics,
    // Ontology-specific properties
    ontologyAvailable,
    ontologyEnhanced
  };
};