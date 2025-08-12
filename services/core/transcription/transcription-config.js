/**
 * Transcription Service Configuration for Medical Applications
 * Provides configuration and switching between different ASR services
 */

class TranscriptionConfig {
  constructor() {
    this.services = {
      // Web Speech API (Browser-based)
      web_speech: {
        name: 'Web Speech API',
        type: 'browser',
        quality: 'medium',
        latency: 'low',
        medical_support: 'limited',
        languages: ['de-DE', 'en-US'],
        pros: ['Real-time', 'No server required', 'Low latency'],
        cons: ['Browser dependent', 'No medical vocabulary', 'Limited accuracy'],
        use_cases: ['Initial testing', 'Real-time feedback'],
        config: {
          continuous: true,
          interimResults: true,
          maxAlternatives: 1
        }
      },
      
      // OpenAI Whisper (Local/Cloud)
      whisper: {
        name: 'OpenAI Whisper',
        type: 'ai_model',
        quality: 'high',
        latency: 'medium',
        medical_support: 'good',
        languages: ['de', 'en', 'fr', 'es', 'it'],
        pros: ['High accuracy', 'Multilingual', 'Medical terminology'],
        cons: ['Hallucination risk', 'Higher latency', 'Resource intensive'],
        use_cases: ['Final transcription', 'Medical reports'],
        config: {
          model: 'large-v3',
          language: 'de',
          temperature: 0.0, // Reduce creativity/hallucinations
          condition_on_previous_text: false, // Prevent hallucination propagation
          no_speech_threshold: 0.6,
          logprob_threshold: -1.0
        }
      },
      
      // Google Speech-to-Text (Medical specific)
      google_medical: {
        name: 'Google Cloud Speech-to-Text Medical',
        type: 'cloud_api',
        quality: 'very_high',
        latency: 'medium',
        medical_support: 'excellent',
        languages: ['de-DE', 'en-US'],
        pros: ['Medical vocabulary', 'High accuracy', 'Speaker diarization'],
        cons: ['Cost per minute', 'Internet required', 'Privacy concerns'],
        use_cases: ['Professional medical transcription', 'Clinical documentation'],
        config: {
          encoding: 'WEBM_OPUS',
          sampleRateHertz: 16000,
          languageCode: 'de-DE',
          alternativeLanguageCodes: ['en-US'],
          enableAutomaticPunctuation: true,
          useEnhanced: true,
          model: 'medical_dictation', // Medical-specific model
          enableSpeakerDiarization: true,
          diarizationSpeakerCount: 2
        }
      },
      
      // Amazon Transcribe Medical
      amazon_medical: {
        name: 'Amazon Transcribe Medical',
        type: 'cloud_api',
        quality: 'very_high',
        latency: 'medium',
        medical_support: 'excellent',
        languages: ['de-DE', 'en-US'],
        pros: ['Medical-specific', 'HIPAA compliant', 'Specialty support'],
        cons: ['Cost', 'Limited languages', 'Complexity'],
        use_cases: ['Clinical documentation', 'Medical specialties'],
        config: {
          specialty: 'PRIMARYCARE', // Options: PRIMARYCARE, CARDIOLOGY, NEUROLOGY, etc.
          type: 'DICTATION', // DICTATION or CONVERSATION
          languageCode: 'de-DE',
          sampleRate: 16000,
          enableChannelIdentification: true
        }
      },
      
      // Vosk (Local/Offline)
      vosk: {
        name: 'Vosk Speech Recognition',
        type: 'local_model',
        quality: 'medium',
        latency: 'low',
        medical_support: 'customizable',
        languages: ['de', 'en'],
        pros: ['Offline', 'Privacy', 'Customizable vocabulary'],
        cons: ['Lower accuracy', 'Large models', 'Setup complexity'],
        use_cases: ['Privacy-sensitive', 'Offline environments'],
        config: {
          model: 'vosk-model-de-0.21',
          sample_rate: 16000,
          words: true // Enable word-level timestamps
        }
      }
    };
    
    // Current service priority order for fallback
    this.servicePriority = [
      'google_medical',
      'amazon_medical', 
      'whisper',
      'vosk',
      'web_speech'
    ];
    
    // Medical accuracy improvements configuration
    this.medicalEnhancements = {
      enable_validation: true,
      confidence_threshold: 0.6,
      medical_term_boost: 0.1,
      enable_fuzzy_matching: true,
      enable_context_correction: true,
      enable_hallucination_detection: true,
      quality_scoring: true
    };
  }
  
  /**
   * Get optimal service configuration based on requirements
   */
  getOptimalService(requirements = {}) {
    const {
      quality = 'high',
      privacy = 'medium',
      realtime = false,
      medical_accuracy = true,
      language = 'de',
      budget = 'medium'
    } = requirements;
    
    let scores = {};
    
    Object.keys(this.services).forEach(serviceId => {
      const service = this.services[serviceId];
      let score = 0;
      
      // Quality scoring
      const qualityMap = { low: 1, medium: 2, high: 3, very_high: 4 };
      if (qualityMap[service.quality] >= qualityMap[quality]) {
        score += 3;
      }
      
      // Medical support scoring
      const medicalMap = { none: 0, limited: 1, good: 2, excellent: 3 };
      if (medical_accuracy && medicalMap[service.medical_support] >= 2) {
        score += 3;
      }
      
      // Privacy scoring
      if (privacy === 'high' && service.type === 'browser' || service.type === 'local_model') {
        score += 2;
      }
      
      // Real-time requirement
      if (realtime && service.latency === 'low') {
        score += 2;
      }
      
      // Language support
      if (service.languages.includes(language) || service.languages.includes(`${language}-DE`)) {
        score += 1;
      }
      
      // Budget considerations
      if (budget === 'low' && (service.type === 'browser' || service.type === 'local_model')) {
        score += 1;
      }
      
      scores[serviceId] = score;
    });
    
    // Find best service
    const bestService = Object.keys(scores).reduce((a, b) => scores[a] > scores[b] ? a : b);
    
    return {
      service: bestService,
      config: this.services[bestService],
      score: scores[bestService],
      alternatives: Object.keys(scores)
        .sort((a, b) => scores[b] - scores[a])
        .slice(1, 3)
        .map(id => ({ id, score: scores[id] }))
    };
  }
  
  /**
   * Get service-specific configuration for medical transcription
   */
  getMedicalConfig(serviceId, medicalContext = 'general') {
    const service = this.services[serviceId];
    if (!service) return null;
    
    let config = { ...service.config };
    
    // Apply medical-specific configurations
    switch (serviceId) {
      case 'whisper':
        config.prompt = this.getMedicalPrompt(medicalContext, 'de');
        config.temperature = 0.0; // Reduce hallucinations
        break;
        
      case 'google_medical':
        config.speechContexts = [{
          phrases: this.getMedicalPhrases('de'),
          boost: 20 // High boost for medical terms
        }];
        break;
        
      case 'amazon_medical':
        if (medicalContext === 'radiology') {
          config.specialty = 'RADIOLOGY';
        } else if (medicalContext === 'cardiology') {
          config.specialty = 'CARDIOLOGY';
        }
        break;
        
      case 'vosk':
        config.custom_vocabulary = this.getMedicalVocabulary('de');
        break;
    }
    
    return config;
  }
  
  /**
   * Generate medical context prompt for Whisper
   */
  getMedicalPrompt(context, language) {
    const prompts = {
      de: {
        general: 'Radiologischer Befund: Computertomographie, Magnetresonanztomographie, Röntgen, Ultraschall, Mammographie',
        radiology: 'MRT Befund Lendenwirbelsäule: Bandscheibenvorfall, Stenose, Wirbelkörper, Spinalkanal',
        mammography: 'Mammographie Befund: Digitale Mammographie, Hochfrequenzsonographie, Parenchym, BI-RADS',
        spine: 'Wirbelsäulen MRT: LWK, BWK, HWK, Bandscheibe, Pseudospondylolisthesis, Neuroforamenstenose'
      }
    };
    
    return prompts[language]?.[context] || prompts[language]?.general || '';
  }
  
  /**
   * Get medical phrases for speech context
   */
  getMedicalPhrases(language) {
    const phrases = {
      de: [
        'Computertomographie', 'Magnetresonanztomographie', 'Röntgen',
        'Bandscheibenvorfall', 'Stenose', 'Wirbelsäule', 'Lendenwirbelsäule',
        'Mammographie', 'Hochfrequenzsonographie', 'Parenchymdichte',
        'LWK', 'BWK', 'HWK', 'Befund', 'Beurteilung', 'Empfehlung',
        'Pseudospondylolisthesis', 'Neuroforamenstenose', 'Spinalkanalstenose'
      ]
    };
    
    return phrases[language] || [];
  }
  
  /**
   * Get medical vocabulary for custom models
   */
  getMedicalVocabulary(language) {
    // This would load from the enhanced medical dictionary
    return [
      'computertomographie', 'magnetresonanztomographie', 'röntgen',
      'bandscheibenvorfall', 'stenose', 'wirbelsäule', 'mammographie',
      'befund', 'beurteilung', 'empfehlung', 'diagnose'
    ];
  }
  
  /**
   * Validate transcription service health
   */
  async validateServiceHealth(serviceId) {
    const service = this.services[serviceId];
    if (!service) return { status: 'error', message: 'Unknown service' };
    
    try {
      switch (service.type) {
        case 'browser':
          return this.validateWebSpeechAPI();
        case 'local_model':
          return await this.validateLocalService(serviceId);
        case 'cloud_api':
          return await this.validateCloudService(serviceId);
        default:
          return { status: 'unknown', message: 'Service type not recognized' };
      }
    } catch (error) {
      return { status: 'error', message: error.message };
    }
  }
  
  validateWebSpeechAPI() {
    if (typeof window === 'undefined') {
      return { status: 'unavailable', message: 'Not in browser environment' };
    }
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      return { status: 'unsupported', message: 'Browser does not support Web Speech API' };
    }
    
    return { status: 'available', message: 'Web Speech API ready' };
  }
  
  async validateLocalService(serviceId) {
    // Check if local service is running
    const ports = { vosk: 8002, whisper: 8001 };
    const port = ports[serviceId];
    
    if (!port) return { status: 'error', message: 'Unknown local service' };
    
    try {
      const response = await fetch(`http://localhost:${port}/health`);
      if (response.ok) {
        return { status: 'available', message: `${serviceId} service running` };
      }
      return { status: 'unavailable', message: `${serviceId} service not responding` };
    } catch (error) {
      return { status: 'unavailable', message: `Cannot connect to ${serviceId} service` };
    }
  }
  
  async validateCloudService(serviceId) {
    // This would check API keys and connectivity
    const apiKeys = {
      google_medical: process.env.GOOGLE_CLOUD_KEY,
      amazon_medical: process.env.AWS_ACCESS_KEY_ID
    };
    
    const apiKey = apiKeys[serviceId];
    if (!apiKey) {
      return { status: 'misconfigured', message: `Missing API key for ${serviceId}` };
    }
    
    return { status: 'configured', message: `${serviceId} API key configured` };
  }
  
  /**
   * Get service recommendations based on accuracy analysis
   */
  getAccuracyRecommendations(currentService, accuracyIssues = []) {
    const recommendations = [];
    
    if (accuracyIssues.includes('medical_terms')) {
      recommendations.push({
        issue: 'Poor medical terminology recognition',
        recommendation: 'Switch to Google Medical or Amazon Transcribe Medical',
        urgency: 'high'
      });
    }
    
    if (accuracyIssues.includes('hallucinations')) {
      recommendations.push({
        issue: 'AI hallucinations detected',
        recommendation: 'Enable medical validation and reduce Whisper temperature to 0',
        urgency: 'critical'
      });
    }
    
    if (accuracyIssues.includes('low_confidence')) {
      recommendations.push({
        issue: 'Low transcription confidence',
        recommendation: 'Improve microphone quality or switch to higher-quality service',
        urgency: 'medium'
      });
    }
    
    return recommendations;
  }
}

module.exports = TranscriptionConfig;