/**
 * Medical Transcription Validator
 * Validates and corrects medical transcriptions for accuracy
 */

const fs = require('fs');
const path = require('path');

class MedicalTranscriptionValidator {
  constructor() {
    this.dictionary = null;
    this.validationStats = {
      totalValidations: 0,
      correctionsApplied: 0,
      hallucinationsDetected: 0,
      lowConfidenceFlags: 0
    };
    this.loadMedicalDictionary();
  }

  /**
   * Load the enhanced medical dictionary
   */
  loadMedicalDictionary() {
    try {
      const dictionaryPath = path.join(__dirname, '../../../data/medical_dictionaries/enhanced-de-medical.json');
      const dictionaryData = fs.readFileSync(dictionaryPath, 'utf8');
      this.dictionary = JSON.parse(dictionaryData);
      console.log('MedicalValidator: Enhanced German medical dictionary loaded successfully');
    } catch (error) {
      console.error('MedicalValidator: Failed to load medical dictionary:', error.message);
      this.dictionary = { 
        phonetic_corrections: {},
        medical_terms: {},
        hallucination_patterns: [],
        confidence_thresholds: {}
      };
    }
  }

  /**
   * Validate and correct a transcription
   * @param {string} text - The transcription text
   * @param {number} confidence - Confidence score from speech recognition
   * @param {string} context - Medical context (mammography, ultrasound, etc.)
   * @returns {Object} Validation result with corrections and warnings
   */
  validateTranscription(text, confidence = 1.0, context = null) {
    this.validationStats.totalValidations++;

    const result = {
      originalText: text,
      correctedText: text,
      confidence: confidence,
      qualityScore: 1.0,
      corrections: [],
      warnings: [],
      flags: [],
      isValid: true
    };

    // Step 1: Apply phonetic corrections
    result.correctedText = this.applyPhoneticCorrections(result.correctedText, result.corrections);

    // Step 2: Detect and flag hallucinations
    const hallucinations = this.detectHallucinations(result.correctedText);
    if (hallucinations.length > 0) {
      result.warnings.push(...hallucinations);
      result.flags.push('potential_hallucination');
      result.qualityScore *= 0.7;
      this.validationStats.hallucinationsDetected++;
    }

    // Step 3: Validate medical terminology
    const medicalValidation = this.validateMedicalTerminology(result.correctedText, context);
    if (medicalValidation.unknownTerms.length > 0) {
      result.warnings.push({
        type: 'unknown_medical_terms',
        message: `Unknown medical terms: ${medicalValidation.unknownTerms.join(', ')}`,
        severity: 'medium'
      });
      result.qualityScore *= 0.8;
    }

    // Step 4: Check confidence thresholds
    if (confidence < this.dictionary.confidence_thresholds.flag_for_review_below) {
      result.flags.push('low_confidence');
      result.warnings.push({
        type: 'low_confidence',
        message: `Low transcription confidence: ${Math.round(confidence * 100)}%`,
        severity: 'high'
      });
      this.validationStats.lowConfidenceFlags++;
    }

    // Step 5: Calculate final quality score
    result.qualityScore = Math.max(0.1, result.qualityScore * confidence);
    
    // Step 6: Determine if transcription should be accepted
    result.isValid = result.qualityScore >= 0.5 && 
                    confidence >= this.dictionary.confidence_thresholds.minimum_for_final_transcription;

    if (result.corrections.length > 0) {
      this.validationStats.correctionsApplied++;
    }

    return result;
  }

  /**
   * Apply phonetic corrections to common medical term misrecognitions
   */
  applyPhoneticCorrections(text, corrections) {
    let correctedText = text;
    
    if (!this.dictionary.phonetic_corrections) {
      return correctedText;
    }

    // Apply each phonetic correction
    Object.entries(this.dictionary.phonetic_corrections).forEach(([correct, variants]) => {
      variants.forEach(variant => {
        // Case-insensitive replacement with word boundaries
        const regex = new RegExp(`\\b${this.escapeRegex(variant)}\\b`, 'gi');
        if (regex.test(correctedText)) {
          correctedText = correctedText.replace(regex, correct);
          corrections.push({
            type: 'phonetic_correction',
            original: variant,
            corrected: correct,
            position: 'multiple'
          });
        }
      });
    });

    return correctedText;
  }

  /**
   * Detect potential hallucinations using pattern matching
   */
  detectHallucinations(text) {
    const warnings = [];
    
    if (!this.dictionary.hallucination_patterns) {
      return warnings;
    }

    this.dictionary.hallucination_patterns.forEach(pattern => {
      const regex = new RegExp(pattern.pattern, 'g');
      const matches = text.match(regex);
      
      if (matches) {
        // Filter out exceptions (valid medical terms that might trigger false positives)
        const filteredMatches = matches.filter(match => {
          if (pattern.exceptions && pattern.exceptions.length > 0) {
            return !pattern.exceptions.some(exception => 
              match.toLowerCase().includes(exception.toLowerCase()) ||
              exception.toLowerCase().includes(match.toLowerCase())
            );
          }
          return true;
        });
        
        // Only add warning if there are matches after filtering exceptions
        if (filteredMatches.length > 0) {
          warnings.push({
            type: 'potential_hallucination',
            message: `${pattern.description}: ${filteredMatches.join(', ')}`,
            severity: pattern.severity,
            matches: filteredMatches
          });
        }
      }
    });

    return warnings;
  }

  /**
   * Validate medical terminology against dictionary
   */
  validateMedicalTerminology(text, context = null) {
    const result = {
      validTerms: [],
      unknownTerms: [],
      contextScore: 1.0
    };

    if (!this.dictionary.medical_terms) {
      return result;
    }

    // Extract potential medical terms (words longer than 4 characters)
    const words = text.toLowerCase().match(/\b[a-zA-ZäöüÄÖÜß]{4,}\b/g) || [];
    
    // Create a flat list of all valid medical terms
    const allMedicalTerms = new Set();
    this.flattenMedicalTerms(this.dictionary.medical_terms, allMedicalTerms);

    words.forEach(word => {
      if (allMedicalTerms.has(word.toLowerCase())) {
        result.validTerms.push(word);
      } else if (this.isLikelyMedicalTerm(word)) {
        // Only flag as unknown if it looks medical but isn't in our dictionary
        result.unknownTerms.push(word);
      }
    });

    // Context validation
    if (context && this.dictionary.contextual_validation && this.dictionary.contextual_validation[context + '_context']) {
      const contextTerms = this.dictionary.contextual_validation[context + '_context'];
      const contextFound = words.filter(word => 
        contextTerms.some(term => term.toLowerCase().includes(word) || word.includes(term.toLowerCase()))
      );
      result.contextScore = contextFound.length > 0 ? 1.0 : 0.8;
    }

    return result;
  }

  /**
   * Helper to flatten nested medical terms structure
   */
  flattenMedicalTerms(terms, termSet) {
    if (Array.isArray(terms)) {
      terms.forEach(term => termSet.add(term.toLowerCase()));
    } else if (typeof terms === 'object' && terms !== null) {
      Object.values(terms).forEach(value => {
        this.flattenMedicalTerms(value, termSet);
      });
    }
  }

  /**
   * Check if a word looks like it could be medical terminology
   */
  isLikelyMedicalTerm(word) {
    // Medical terms often have certain patterns
    const medicalPatterns = [
      /.*graphie$/i,      // mammographie, sonographie
      /.*tomie$/i,        // anatomie
      /.*skopie$/i,       // laparoskopie
      /.*pathie$/i,       // myopathie
      /.*itis$/i,         // arthritis
      /.*ose$/i,          // diagnose
      /.*isch$/i,         // pathologisch
      /.*om$/i,           // karzinom, lipom
      /.*gen$/i,          // röntgen
      /.*lymph.*$/i,      // lymphknoten
      /.*karpal.*$/i,     // radiokarpal
    ];

    return medicalPatterns.some(pattern => pattern.test(word)) && word.length > 5;
  }

  /**
   * Real-time validation for streaming transcription
   */
  validateStreamingText(text, confidence, context = null) {
    // For streaming, use faster validation with fewer checks
    const result = {
      text: text,
      confidence: confidence,
      warnings: [],
      corrections: []
    };

    // Only apply critical corrections in real-time
    if (this.dictionary.phonetic_corrections) {
      Object.entries(this.dictionary.phonetic_corrections).slice(0, 10).forEach(([correct, variants]) => {
        variants.forEach(variant => {
          if (text.toLowerCase().includes(variant.toLowerCase())) {
            const regex = new RegExp(`\\b${this.escapeRegex(variant)}\\b`, 'gi');
            result.text = result.text.replace(regex, correct);
            result.corrections.push({
              original: variant,
              corrected: correct
            });
          }
        });
      });
    }

    // Flag very low confidence
    if (confidence < 0.5) {
      result.warnings.push({
        type: 'very_low_confidence',
        message: 'Very low confidence transcription',
        severity: 'high'
      });
    }

    return result;
  }

  /**
   * Get validation statistics
   */
  getValidationStats() {
    const uptime = process.uptime();
    return {
      ...this.validationStats,
      averageValidationsPerMinute: Math.round((this.validationStats.totalValidations / uptime) * 60),
      correctionRate: this.validationStats.totalValidations > 0 
        ? (this.validationStats.correctionsApplied / this.validationStats.totalValidations * 100).toFixed(2) + '%'
        : '0%',
      hallucinationRate: this.validationStats.totalValidations > 0 
        ? (this.validationStats.hallucinationsDetected / this.validationStats.totalValidations * 100).toFixed(2) + '%'
        : '0%'
    };
  }

  /**
   * Add user correction to improve future validations
   */
  addUserCorrection(original, corrected, context = null) {
    // In a production system, this would update the dictionary
    // For now, we'll just log it
    console.log(`MedicalValidator: User correction logged - "${original}" → "${corrected}" (context: ${context})`);
    
    // TODO: Implement machine learning feedback loop
    // This could update phonetic corrections or add new medical terms
  }

  /**
   * Escape special regex characters
   */
  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Get suggestions for a potentially incorrect term
   */
  getSuggestions(term, context = null, maxSuggestions = 3) {
    const suggestions = [];
    
    if (!this.dictionary.medical_terms) {
      return suggestions;
    }

    const allTerms = new Set();
    this.flattenMedicalTerms(this.dictionary.medical_terms, allTerms);
    
    // Find terms with similar characters or phonetics
    const termArray = Array.from(allTerms);
    const similarities = termArray.map(dictTerm => ({
      term: dictTerm,
      similarity: this.calculateSimilarity(term.toLowerCase(), dictTerm)
    }))
    .filter(item => item.similarity > 0.5)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, maxSuggestions);

    return similarities.map(item => item.term);
  }

  /**
   * Simple string similarity calculation (Levenshtein-based)
   */
  calculateSimilarity(str1, str2) {
    const len1 = str1.length;
    const len2 = str2.length;
    const maxLen = Math.max(len1, len2);
    
    if (maxLen === 0) return 1.0;
    
    // Simple character-based similarity
    let matches = 0;
    const minLen = Math.min(len1, len2);
    
    for (let i = 0; i < minLen; i++) {
      if (str1[i] === str2[i]) matches++;
    }
    
    return matches / maxLen;
  }
}

module.exports = MedicalTranscriptionValidator;