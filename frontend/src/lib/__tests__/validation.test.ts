import {
  validateTranscription,
  validateReportData,
  validateICDCode,
  validateLanguage,
  sanitizeInput,
  validateModality,
  validatePatientData
} from '../validation'

describe('Medical Validation Functions', () => {
  describe('validateTranscription', () => {
    it('accepts valid German medical transcription', () => {
      const validText = 'Mammographie-Untersuchung zeigt unauffällige Befunde beidseits'
      const result = validateTranscription(validText)
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('rejects empty transcription', () => {
      const result = validateTranscription('')
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Transcription text is required')
    })

    it('rejects transcription that is too short', () => {
      const result = validateTranscription('Test')
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Transcription must be at least 10 characters')
    })

    it('rejects transcription that is too long', () => {
      const longText = 'a'.repeat(10001)
      const result = validateTranscription(longText)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Transcription must not exceed 10000 characters')
    })

    it('detects and sanitizes potential XSS attempts', () => {
      const xssText = 'Normal text <script>alert("XSS")</script> more text'
      const result = validateTranscription(xssText)
      expect(result.isValid).toBe(true)
      expect(result.sanitizedText).not.toContain('<script>')
      expect(result.warnings).toContain('Input was sanitized for security')
    })

    it('validates German medical terminology', () => {
      const medicalTerms = [
        'Computertomographie',
        'Magnetresonanztomographie',
        'Sonographie',
        'Röntgen',
        'Befund',
        'Beurteilung',
        'Empfehlung'
      ]
      
      medicalTerms.forEach(term => {
        const result = validateTranscription(`${term} durchgeführt ohne pathologische Veränderungen`)
        expect(result.isValid).toBe(true)
        expect(result.detectedTerms).toContain(term.toLowerCase())
      })
    })
  })

  describe('validateICDCode', () => {
    it('validates correct ICD-10-GM format', () => {
      const validCodes = ['Z12.31', 'C50.9', 'K76.9', 'M79.3', 'R93.1']
      
      validCodes.forEach(code => {
        const result = validateICDCode(code)
        expect(result.isValid).toBe(true)
        expect(result.errors).toHaveLength(0)
      })
    })

    it('rejects invalid ICD code formats', () => {
      const invalidCodes = ['ABC.12', '12.34', 'Z1234', 'Z12.', '.31']
      
      invalidCodes.forEach(code => {
        const result = validateICDCode(code)
        expect(result.isValid).toBe(false)
        expect(result.errors).toContain('Invalid ICD-10 code format')
      })
    })

    it('identifies mammography-related ICD codes', () => {
      const mammographyCodes = ['Z12.31', 'C50.9', 'N63']
      
      mammographyCodes.forEach(code => {
        const result = validateICDCode(code, 'mammography')
        expect(result.isValid).toBe(true)
        expect(result.modalityMatch).toBe(true)
      })
    })

    it('warns about modality mismatch', () => {
      const result = validateICDCode('Z01.0', 'mammography') // Eye examination code
      expect(result.isValid).toBe(true)
      expect(result.modalityMatch).toBe(false)
      expect(result.warnings).toContain('ICD code may not match the specified modality')
    })
  })

  describe('validateModality', () => {
    it('accepts valid modalities', () => {
      const validModalities = [
        'mammography',
        'ultrasound',
        'ct_scan',
        'mri',
        'xray',
        'pet_scan'
      ]
      
      validModalities.forEach(modality => {
        const result = validateModality(modality)
        expect(result.isValid).toBe(true)
      })
    })

    it('rejects invalid modalities', () => {
      const result = validateModality('invalid_modality')
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Invalid modality type')
    })

    it('provides modality-specific validation rules', () => {
      const result = validateModality('mammography')
      expect(result.isValid).toBe(true)
      expect(result.validationRules).toMatchObject({
        requiresPatientGender: true,
        minimumAge: 35,
        typicalDuration: '15-30 minutes'
      })
    })
  })

  describe('validateLanguage', () => {
    it('accepts supported languages', () => {
      const supportedLanguages = ['de', 'en', 'fr', 'tr']
      
      supportedLanguages.forEach(lang => {
        const result = validateLanguage(lang)
        expect(result.isValid).toBe(true)
      })
    })

    it('defaults to German for invalid language', () => {
      const result = validateLanguage('invalid')
      expect(result.isValid).toBe(false)
      expect(result.defaultLanguage).toBe('de')
      expect(result.warnings).toContain('Unsupported language, defaulting to German')
    })
  })

  describe('sanitizeInput', () => {
    it('removes HTML tags', () => {
      const input = '<p>Test <b>text</b></p>'
      const result = sanitizeInput(input)
      expect(result).toBe('Test text')
    })

    it('removes script tags completely', () => {
      const input = 'Safe text <script>alert("XSS")</script> more text'
      const result = sanitizeInput(input)
      // The sanitization might normalize spaces, so check for single space
      expect(result).toBe('Safe text more text')
    })

    it('preserves German special characters', () => {
      const input = 'Röntgen-Übersicht für Patientin Müller'
      const result = sanitizeInput(input)
      expect(result).toBe('Röntgen-Übersicht für Patientin Müller')
    })

    it('normalizes whitespace', () => {
      const input = 'Text   with    multiple     spaces'
      const result = sanitizeInput(input)
      expect(result).toBe('Text with multiple spaces')
    })
  })

  describe('validateReportData', () => {
    it('validates complete report structure', () => {
      const validReport = {
        transcription: 'Mammographie-Untersuchung zeigt unauffällige Befunde',
        modality: 'mammography',
        language: 'de',
        patientInfo: {
          age: 45,
          gender: 'female'
        },
        findings: 'Keine pathologischen Veränderungen',
        recommendations: 'Routine-Screening in 2 Jahren'
      }
      
      const result = validateReportData(validReport)
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('detects missing required fields', () => {
      const incompleteReport = {
        transcription: 'Test',
        // missing modality and other fields
      }
      
      const result = validateReportData(incompleteReport)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Modality is required')
    })

    it('validates patient age for mammography', () => {
      const report = {
        transcription: 'Mammographie-Screening',
        modality: 'mammography',
        language: 'de',
        patientInfo: {
          age: 25, // Too young for routine mammography
          gender: 'female'
        }
      }
      
      const result = validateReportData(report)
      expect(result.warnings).toContain('Patient age (25) is below typical mammography screening age (35+)')
    })

    it('validates gender requirements for mammography', () => {
      const report = {
        transcription: 'Mammographie-Untersuchung',
        modality: 'mammography',
        language: 'de',
        patientInfo: {
          age: 45,
          gender: 'male'
        }
      }
      
      const result = validateReportData(report)
      expect(result.warnings).toContain('Mammography for male patients is uncommon')
    })
  })

  describe('validatePatientData', () => {
    it('validates complete patient information', () => {
      const patient = {
        id: 'PAT-123',
        age: 45,
        gender: 'female',
        name: 'Müller, Anna',
        dateOfBirth: '1980-03-15'
      }
      
      const result = validatePatientData(patient)
      expect(result.isValid).toBe(true)
    })

    it('validates age range', () => {
      const youngPatient = { age: -1 }
      const oldPatient = { age: 150 }
      
      expect(validatePatientData(youngPatient).isValid).toBe(false)
      expect(validatePatientData(oldPatient).isValid).toBe(false)
    })

    it('validates gender values', () => {
      const validGenders = ['male', 'female', 'other', 'unknown']
      
      validGenders.forEach(gender => {
        const result = validatePatientData({ gender })
        expect(result.isValid).toBe(true)
      })
      
      const invalidResult = validatePatientData({ gender: 'invalid' })
      expect(invalidResult.isValid).toBe(false)
    })

    it('sanitizes patient name', () => {
      const patient = {
        name: '<script>alert("XSS")</script>Müller'
      }
      
      const result = validatePatientData(patient)
      expect(result.sanitizedData.name).toBe('Müller')
    })
  })

  describe('German Medical Dictionary Validation', () => {
    it('recognizes common German medical terms', () => {
      const germanTerms = [
        'unauffällig',
        'pathologisch',
        'Kontrastmittel',
        'Befund',
        'Beurteilung',
        'Empfehlung',
        'beidseits',
        'rechts',
        'links',
        'ventral',
        'dorsal',
        'kranial',
        'kaudal'
      ]
      
      germanTerms.forEach(term => {
        const text = `Die Untersuchung zeigt ${term} Veränderungen`
        const result = validateTranscription(text)
        expect(result.detectedTerms).toContain(term.toLowerCase())
      })
    })

    it('detects anatomical terms in German', () => {
      const anatomicalTerms = [
        'Leber',
        'Lunge',
        'Herz',
        'Niere',
        'Milz',
        'Pankreas',
        'Gallenblase',
        'Magen',
        'Darm',
        'Wirbelsäule'
      ]
      
      anatomicalTerms.forEach(term => {
        const text = `${term} ohne pathologische Veränderungen`
        const result = validateTranscription(text)
        expect(result.detectedTerms).toContain(term.toLowerCase())
      })
    })
  })
})