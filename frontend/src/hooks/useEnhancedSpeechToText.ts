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

  const recognitionRef = useRef<any>(null);
  const finalTranscriptRef = useRef('');

  // Medical dictionary for real-time corrections
  const medicalCorrections = useRef(new Map([
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
    ['sono graphie', 'sonographie']
  ]));

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      setHasRecognitionSupport(true);
      recognitionRef.current = new SpeechRecognition();
    } else {
      setHasRecognitionSupport(false);
      setError('Speech recognition not supported in this browser');
    }
  }, []);

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
      setError(`Speech recognition error: ${event.error}`);
      setIsListening(false);
    };

    recognitionRef.current.onend = () => {
      setIsListening(false);
      
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

    // Start recognition
    try {
      recognitionRef.current.start();
    } catch (err: any) {
      setError(`Failed to start speech recognition: ${err.message}`);
      setIsListening(false);
    }
  }, [
    isListening,
    continuous,
    interimResults,
    lang,
    validateTranscription,
    applyMedicalCorrections,
    onTranscriptChange
  ]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  }, [isListening]);

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
    confidence
  };
};