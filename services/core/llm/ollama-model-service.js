/**
 * Ollama-based Local Model Service for Medical AI
 * Provides local inference using Medical Gemma 2B models via Ollama REST API
 * Much simpler and more reliable than llama.cpp bindings
 */

const http = require('http');
const https = require('https');
const path = require('path');
const fs = require('fs');
const os = require('os');

class OllamaModelService {
  constructor() {
    this.isInitialized = false;
    this.ollamaHost = process.env.OLLAMA_HOST || 'localhost';
    this.ollamaPort = process.env.OLLAMA_PORT || 11434;
    this.baseUrl = `http://${this.ollamaHost}:${this.ollamaPort}`;
    this.availableModels = new Set();
    this.currentModel = null;
    
    // Model configurations optimized for medical text processing
    this.modelConfigs = {
      // New Gemma-3 4B Medical Models (Highest Priority)
      'gemma3-medical-fp16': {
        displayName: 'Gemma-3 Medical FP16 (Ultra High Quality)',
        modelFile: 'gemma3-medical-fp16:latest',
        ramRequirement: 8000, // MB - 4B model with FP16 precision
        contextLength: 4096,
        quality: 'ultra_high',
        speed: 'slow',
        recommended: true, // Best quality for medical analysis
        gemma3: true,
        medicalSpecialized: true,
        description: 'Gemma-3 4B fine-tuned for German medical reports (ultra-high quality, FP16)'
      },
      'gemma3-medical-q8': {
        displayName: 'Gemma-3 Medical Q8 (Excellent Quality)',
        modelFile: 'gemma3-medical-q8:latest',
        ramRequirement: 5000, // MB - 4B model with Q8 quantization
        contextLength: 4096,
        quality: 'excellent',
        speed: 'medium',
        recommended: true, // Excellent balance
        gemma3: true,
        medicalSpecialized: true,
        description: 'Gemma-3 4B German medical (Q8 - excellent quality/speed balance)'
      },
      'gemma3-medical-q5': {
        displayName: 'Gemma-3 Medical Q5 (High Quality)',
        modelFile: 'gemma3-medical-q5:latest',
        ramRequirement: 3500, // MB - 4B model with Q5 quantization
        contextLength: 4096,
        quality: 'high',
        speed: 'fast',
        gemma3: true,
        medicalSpecialized: true,
        description: 'Gemma-3 4B German medical (Q5 - high quality, faster inference)'
      },
      
      // GPT-OSS Models
      'gpt-oss': {
        displayName: 'GPT-OSS-20B (Premium)',
        modelFile: 'gpt-oss:latest',
        ramRequirement: 1000, // MB - Low requirement as model runs on host via API
        contextLength: 4096,
        quality: 'exceptional',
        speed: 'medium',
        recommended: false, // Gemma-3 medical models are now preferred
        description: 'GPT-OSS 20B reasoning model - highest quality for medical reports'
      },
      
      // Legacy Medical Gemma 2B Models
      'medical-gemma-2b': {
        displayName: 'Medical Gemma 2B (Legacy)',
        modelFile: 'medical-gemma-2b:latest',
        ramRequirement: 4000, // MB
        contextLength: 2048,
        quality: 'high',
        speed: 'medium',
        legacy: true,
        description: 'Legacy 2B medical model - superseded by Gemma-3 4B models'
      },
      'medical-gemma-2b-q5': {
        displayName: 'Medical Gemma 2B Q5 (Legacy)',
        modelFile: 'medical-gemma-2b:q5_k_s',
        ramRequirement: 2500, // MB
        contextLength: 2048,
        quality: 'medium',
        speed: 'fast',
        legacy: true,
        description: 'Legacy quantized 2B model'
      },
      'medical-gemma-2b-q4': {
        displayName: 'Medical Gemma 2B Q4 (Legacy)',
        modelFile: 'medical-gemma-2b:q4_k_s',
        ramRequirement: 2000, // MB
        contextLength: 2048,
        quality: 'medium',
        speed: 'fast',
        legacy: true,
        description: 'Legacy further quantized 2B model'
      },
      
      // Fallback Models
      'gemma2:2b': {
        displayName: 'Gemma 2 2B (Fallback)',
        modelFile: 'gemma2:2b',
        ramRequirement: 3000, // MB
        contextLength: 2048,
        quality: 'good',
        speed: 'fast',
        fallback: true,
        description: 'Standard Gemma 2B model as fallback option'
      }
    };
    
    // Default inference parameters optimized for German medical text
    this.defaultParams = {
      temperature: 0.3,        // Lower temperature for more consistent medical responses
      top_p: 0.9,             // Nucleus sampling
      repeat_penalty: 1.1,     // Prevent repetitive text  
      num_predict: 2048,       // Max tokens to generate
      num_ctx: 2048,          // Context window
      seed: -1,               // Random seed (-1 for random)
      stream: false           // We want complete responses
    };
  }

  /**
   * Initialize the Ollama model service
   */
  async initialize() {
    if (this.isInitialized) {
      return true;
    }

    try {
      console.log('OllamaModelService: Initializing...');
      
      // Check if Ollama is running
      const isRunning = await this.checkOllamaStatus();
      if (!isRunning) {
        console.error('OllamaModelService: Ollama server not running at', this.baseUrl);
        console.log('Please start Ollama with: ollama serve');
        return false;
      }

      // Get list of available models
      await this.refreshAvailableModels();
      
      // Select optimal model based on availability and system resources
      const selectedModel = await this.selectOptimalModel();
      if (!selectedModel) {
        console.warn('OllamaModelService: No suitable models found. Please install medical models.');
        console.log('Run the model import script to set up medical models.');
        return false;
      }

      console.log(`OllamaModelService: Selected model: ${selectedModel}`);
      this.currentModel = selectedModel;
      
      // Validate model with a test request
      const isWorking = await this.validateModel(selectedModel);
      if (!isWorking) {
        console.error('OllamaModelService: Model validation failed');
        return false;
      }
      
      this.isInitialized = true;
      console.log('OllamaModelService: Initialization complete');
      return true;

    } catch (error) {
      console.error('OllamaModelService: Initialization failed:', error);
      return false;
    }
  }

  /**
   * Check if Ollama server is running
   */
  async checkOllamaStatus() {
    try {
      const response = await this.makeRequest('GET', '/api/version');
      return response.status === 200;
    } catch (error) {
      console.log('OllamaModelService: Ollama server not accessible:', error.message);
      return false;
    }
  }

  /**
   * Get list of available models from Ollama
   */
  async refreshAvailableModels() {
    try {
      const response = await this.makeRequest('GET', '/api/tags');
      if (response.status === 200) {
        try {
          const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
          this.availableModels = new Set(data.models?.map(m => m.name) || []);
          console.log('OllamaModelService: Available models:', Array.from(this.availableModels));
        } catch (parseError) {
          console.error('OllamaModelService: Failed to parse models list:', parseError.message);
          this.availableModels = new Set();
        }
      }
    } catch (error) {
      console.error('OllamaModelService: Failed to get available models:', error);
      this.availableModels = new Set();
    }
  }

  /**
   * Select optimal model based on availability and system resources
   */
  async selectOptimalModel() {
    const availableRam = os.totalmem() / (1024 * 1024); // Convert to MB
    const freeRam = os.freemem() / (1024 * 1024);
    const safeRam = Math.min(availableRam * 0.7, freeRam * 0.8); // Use max 70% of total or 80% of free

    console.log(`OllamaModelService: System RAM - Total: ${Math.round(availableRam)}MB, Free: ${Math.round(freeRam)}MB, Safe to use: ${Math.round(safeRam)}MB`);

    // Find the best model that fits in available RAM and is actually available
    const suitableModels = Object.entries(this.modelConfigs)
      .filter(([name, config]) => {
        const isAvailable = this.availableModels.has(config.modelFile);
        const fitsInRam = config.ramRequirement <= safeRam;
        return isAvailable && fitsInRam;
      })
      .sort((a, b) => {
        // Priority 1: Gemma-3 medical models (best for German medical analysis)
        if (a[1].gemma3 && a[1].medicalSpecialized && !(b[1].gemma3 && b[1].medicalSpecialized)) return -1;
        if (!(a[1].gemma3 && a[1].medicalSpecialized) && b[1].gemma3 && b[1].medicalSpecialized) return 1;
        
        // Priority 2: Recommended models
        if (a[1].recommended && !b[1].recommended) return -1;
        if (!a[1].recommended && b[1].recommended) return 1;
        
        // Priority 3: Avoid legacy models unless necessary
        if (a[1].legacy && !b[1].legacy) return 1;
        if (!a[1].legacy && b[1].legacy) return -1;
        
        // Priority 4: Avoid fallback models
        if (a[1].fallback && !b[1].fallback) return 1;
        if (!a[1].fallback && b[1].fallback) return -1;
        
        // Priority 5: Higher RAM requirement = better quality
        return b[1].ramRequirement - a[1].ramRequirement;
      });

    if (suitableModels.length === 0) {
      console.warn('OllamaModelService: No suitable models available. Available models:', Array.from(this.availableModels));
      return null;
    }

    const selectedModel = suitableModels[0][1].modelFile;
    const selectedConfig = suitableModels[0][1];
    console.log(`OllamaModelService: Selected ${selectedModel} (${selectedConfig.displayName}, requires ${selectedConfig.ramRequirement}MB RAM, quality: ${selectedConfig.quality})`);
    
    return selectedModel;
  }

  /**
   * Validate model with a test request
   */
  async validateModel(modelName) {
    try {
      console.log(`OllamaModelService: Validating model ${modelName}...`);
      
      const testPrompt = 'Test: Generate a simple JSON response with "status": "ok"';
      const requestBody = {
        model: modelName,
        prompt: testPrompt,
        options: {
          ...this.defaultParams,
          num_predict: 50,
          temperature: 0.1
        }
      };

      const startTime = Date.now();
      const response = await this.makeRequest('POST', '/api/generate', requestBody);
      const validationTime = Date.now() - startTime;

      if (response.status === 200) {
        console.log(`OllamaModelService: Model ${modelName} validated successfully in ${validationTime}ms`);
        return true;
      } else {
        console.error(`OllamaModelService: Model validation failed with status ${response.status}`);
        return false;
      }
    } catch (error) {
      console.error(`OllamaModelService: Model validation error:`, error);
      return false;
    }
  }

  /**
   * Generate medical report using Ollama model
   */
  async generateReport(prompt, language = 'de', options = {}) {
    if (!this.isInitialized || !this.currentModel) {
      throw new Error('Ollama model service not initialized or no model loaded');
    }

    try {
      console.log('OllamaModelService: Generating report with Ollama model...');
      
      // Check and limit input size for optimal processing
      const maxInputLength = 4000; // Optimal size for gpt-oss model
      let processedPrompt = prompt;
      
      if (prompt.length > maxInputLength) {
        console.log(`OllamaModelService: Input too long (${prompt.length} chars), truncating to ${maxInputLength} chars`);
        // Try to find a good breaking point (end of sentence or paragraph)
        const truncated = prompt.substring(0, maxInputLength);
        const lastSentence = truncated.lastIndexOf('.');
        const lastParagraph = truncated.lastIndexOf('\n');
        const breakPoint = Math.max(lastSentence, lastParagraph);
        
        processedPrompt = breakPoint > maxInputLength * 0.7 ? 
          prompt.substring(0, breakPoint + 1) : 
          truncated;
          
        console.log(`OllamaModelService: Truncated to ${processedPrompt.length} characters`);
      }
      
      // Optimize prompt for medical context
      const optimizedPrompt = this.optimizePromptForMedical(processedPrompt, language);
      
      // Debug: Log prompt details
      console.log('OllamaModelService: Original prompt length:', prompt.length);
      console.log('OllamaModelService: Processed prompt length:', processedPrompt.length);
      console.log('OllamaModelService: Optimized prompt length:', optimizedPrompt.length);
      
      // Merge options with defaults
      const inferenceParams = {
        ...this.defaultParams,
        ...options,
        temperature: options.temperature || 0.3, // Keep low for medical consistency
        num_predict: options.maxTokens || 2048
      };

      // Prepare request body
      const requestBody = {
        model: this.currentModel,
        prompt: optimizedPrompt,
        options: inferenceParams
      };

      // Generate response using Ollama API with retry logic for empty responses
      const startTime = Date.now();
      let response;
      let inferenceTime;
      let fullResponse = '';
      let retryCount = 0;
      const maxRetries = 3;
      
      // Retry loop for empty responses
      do {
        if (retryCount > 0) {
          console.log(`OllamaModelService: Retrying request (attempt ${retryCount + 1}/${maxRetries}) due to empty response...`);
          // Small delay between retries
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
        }
        
        console.log(`OllamaModelService: Starting attempt ${retryCount + 1}/${maxRetries}`);
        
        const attemptStartTime = Date.now();
        response = await this.makeRequest('POST', '/api/generate', requestBody);
        const attemptTime = Date.now() - attemptStartTime;
        
        if (retryCount === 0) {
          inferenceTime = attemptTime; // Use first attempt time
        }
        
        if (response.status !== 200) {
          throw new Error(`Ollama API returned status ${response.status}: ${response.data}`);
        }
        
        // Quick check for empty response before full parsing
        const quickCheck = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
        const testLines = quickCheck.trim().split('\n').filter(line => line.trim());
        let testResponse = '';
        
        for (const line of testLines) {
          try {
            const jsonObj = JSON.parse(line);
            if (jsonObj.response) {
              testResponse += jsonObj.response;
            }
          } catch (e) {
            // Ignore parse errors for quick check
          }
        }
        
        fullResponse = testResponse.trim();
        
        console.log(`OllamaModelService: Attempt ${retryCount + 1} - Response length: ${fullResponse.length}`);
        if (fullResponse.length === 0) {
          console.log(`OllamaModelService: Empty response detected on attempt ${retryCount + 1}`);
        }
        
        retryCount++;
        
      } while (fullResponse.length === 0 && retryCount < maxRetries);
      
      inferenceTime = Date.now() - startTime;

      // Final validation and parsing of the response
      let responseData;
      try {
        // We already have fullResponse from the retry loop, now get metadata
        const rawData = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
        const lines = rawData.trim().split('\n').filter(line => line.trim());
        let finalData = null;
        
        for (const line of lines) {
          try {
            const jsonObj = JSON.parse(line);
            // Keep the last complete response data for metadata
            if (jsonObj.done !== false) {
              finalData = jsonObj;
            }
          } catch (lineParseError) {
            console.log('OllamaModelService: Skipping invalid JSON line:', line.substring(0, 50));
          }
        }
        
        // Create the final response data structure
        responseData = finalData || { response: fullResponse, prompt_eval_count: 0, eval_count: 0 };
        responseData.response = fullResponse;
        
        // Debug: Log response details
        console.log('OllamaModelService: Raw response length:', fullResponse.length);
        console.log('OllamaModelService: Response preview:', fullResponse.substring(0, 300));
        
        // Final check for empty response after retries
        if (fullResponse.trim().length === 0) {
          console.warn(`OllamaModelService: Empty response after ${retryCount} attempts`);
          throw new Error('Ollama returned empty response after multiple retry attempts');
        }
        
      } catch (parseError) {
        console.error('OllamaModelService: Failed to parse streaming response:', parseError.message);
        console.log('OllamaModelService: Raw response:', response.data?.substring(0, 300));
        throw new Error(`Invalid streaming response from Ollama: ${parseError.message}`);
      }
      console.log(`OllamaModelService: Report generated in ${inferenceTime}ms`);

      // Parse and validate the response
      const parsedResponse = this.parseModelResponse(responseData.response, language);
      
      return {
        ...parsedResponse,
        provider: 'ollama',
        model: this.currentModel,
        inferenceTime: inferenceTime,
        fromCache: false,
        totalTokens: responseData.prompt_eval_count + responseData.eval_count || 0,
        promptTokens: responseData.prompt_eval_count || 0,
        completionTokens: responseData.eval_count || 0
      };

    } catch (error) {
      console.error('OllamaModelService: Report generation failed:', error);
      throw new Error(`Ollama model inference failed: ${error.message}`);
    }
  }

  /**
   * Optimize prompt specifically for medical Ollama models
   */
  optimizePromptForMedical(originalPrompt, language) {
    // Simplified medical context - focus on natural language first, then structure
    const medicalContext = language === 'de' ? 
      `Du bist ein spezialisierter medizinischer AI-Assistent für deutsche Radiologie-Befunde.

AUFGABE: Analysiere den folgenden medizinischen Befund und erstelle einen strukturierten Bericht.

ANWEISUNGEN:
- Fokussiere dich auf die medizinischen Inhalte
- Ignoriere Adressen, Briefköpfe und administrative Daten  
- Extrahiere die wichtigsten Befunde und Beurteilungen
- Antworte auf Deutsch in klarer, verständlicher Form

Medizinischer Befund:

` : 
      `You are a specialized medical AI assistant for radiology reports.

TASK: Analyze the following medical report and create a structured assessment.

INSTRUCTIONS:
- Focus on medical content only
- Ignore addresses, letterheads, and administrative data
- Extract key findings and assessments
- Respond in clear, understandable language

Medical Report:

`;

    // Combine context with original prompt
    return medicalContext + originalPrompt;
  }

  /**
   * Parse model response and ensure valid JSON structure
   */
  parseModelResponse(response, language) {
    try {
      // First try to extract JSON from response (models sometimes add extra text)
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          return this.validateAndStructureResponse(parsed, response);
        } catch (jsonError) {
          console.warn('OllamaModelService: Failed to parse JSON, falling back to text processing');
        }
      }
      
      // Fallback: Parse as natural language medical text
      console.log('OllamaModelService: Processing as natural language response');
      return this.parseNaturalLanguageResponse(response, language);
      
    } catch (error) {
      console.error('OllamaModelService: Failed to parse model response:', error);
      console.log('OllamaModelService: Raw response:', response.substring(0, 500) + '...');
      
      // Return fallback structure with actual response content
      return this.createFallbackResponse(response);
    }
  }
  
  validateAndStructureResponse(parsed, originalResponse) {
    // Validate required fields and provide defaults
    if (!parsed.findings) {
      console.warn(`OllamaModelService: Missing required field 'findings', using fallback`);
      parsed.findings = { content: 'No findings extracted from response', structuredFindings: [] };
    }
    
    if (!parsed.impression) {
      console.warn(`OllamaModelService: Missing required field 'impression', using fallback`);
      parsed.impression = 'No impression extracted from response';
    }
    
    // Ensure findings is properly structured
    if (typeof parsed.findings === 'string') {
      const structuredFindings = this.createBasicStructuredFindings(parsed.findings);
      parsed.findings = { 
        content: parsed.findings, 
        structuredFindings: structuredFindings
      };
    } else if (parsed.findings && typeof parsed.findings === 'object' && !parsed.findings.content) {
      // If findings is an object but doesn't have the expected structure, add missing parts
      parsed.findings.content = parsed.findings.content || '';
      parsed.findings.structuredFindings = parsed.findings.structuredFindings || [];
    }
    
    // Generate enhanced findings for proper UI display
    const structuredFindings = parsed.findings?.structuredFindings || this.createBasicStructuredFindings(parsed.findings?.content || '');
    parsed.enhancedFindings = this.convertToEnhancedFindings(structuredFindings);
    
    // Ensure other required fields exist
    parsed.technicalDetails = parsed.technicalDetails || '';
    parsed.recommendations = parsed.recommendations || 'Weitere klinische Korrelation empfohlen.';
    
    return parsed;
  }

  /**
   * Create basic structured findings for fallback cases
   */
  createBasicStructuredFindings(text) {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
    const structuredFindings = [];
    
    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i].trim();
      if (sentence.length === 0) continue;
      
      // Determine significance based on keywords
      let significance = 'general';
      const criticalKeywords = ['kritisch', 'dringend', 'notfall', 'sofort', 'akut', 'schwer', 'malign', 'tumor', 'karzinom', 'metastasen'];
      const significantKeywords = ['auffällig', 'pathologisch', 'verdacht', 'stenose', 'vorfall', 'entzündung', 'infektion', 'läsion'];
      
      const lowerSentence = sentence.toLowerCase();
      if (criticalKeywords.some(keyword => lowerSentence.includes(keyword))) {
        significance = 'critical';
      } else if (significantKeywords.some(keyword => lowerSentence.includes(keyword))) {
        significance = 'significant';
      }
      
      // Determine category
      let category = 'Befund';
      if (lowerSentence.includes('messung') || lowerSentence.includes('größe') || lowerSentence.includes('durchmesser')) {
        category = 'Messung';
      } else if (lowerSentence.includes('diagnose') || lowerSentence.includes('verdacht')) {
        category = 'Diagnose';
      } else if (lowerSentence.includes('pathologie') || lowerSentence.includes('histologie')) {
        category = 'Pathologie';
      }
      
      // Calculate source span (approximate)
      const startIndex = text.indexOf(sentence);
      const endIndex = startIndex + sentence.length;
      
      structuredFindings.push({
        text: sentence,
        significance: significance,
        sourceSpan: { start: Math.max(0, startIndex), end: endIndex },
        category: category
      });
    }
    
    return structuredFindings;
  }

  /**
   * Convert structured findings to enhanced findings format for proper UI display
   */
  convertToEnhancedFindings(structuredFindings) {
    console.log('Converting structured findings to enhanced findings format...');
    
    const normalFindings = [];
    const pathologicalFindings = [];
    const specialObservations = [];
    const measurements = [];
    const localizations = [];
    
    structuredFindings.forEach(finding => {
      const text = finding.text;
      const significance = finding.significance;
      const category = finding.category;
      
      // Skip administrative text (contains addresses, dates, doctor names, etc.)
      if (this.isAdministrativeText(text)) {
        return;
      }
      
      // Categorize findings based on significance and medical content
      if (category === 'Messung' || text.match(/\d+[\.,]?\d*\s*(mm|cm|m|ml|l|grad|°|prozent|%)/i)) {
        measurements.push(text);
      } else if (text.match(/(links|rechts|beidseits|mittig|zentral|lateral|medial|anterior|posterior|cranial|caudal|proximal|distal|dorsal|ventral)/i)) {
        localizations.push(text);
      } else if (significance === 'critical' || text.match(/(karzinom|tumor|malign|metastasen|adenokarzinom|bronchialkarzinom)/i)) {
        pathologicalFindings.push(text);
      } else if (significance === 'significant' || text.match(/(auffällig|pathologisch|verdacht|entzündung|stenose|läsion)/i)) {
        pathologicalFindings.push(text);
      } else if (text.match(/(unauffällig|normal|regelrecht|physiologisch|keine.*auffälligkeiten|ohne.*befund)/i)) {
        normalFindings.push(text);
      } else if (text.length > 30 && category !== 'Befund') {
        specialObservations.push(text);
      }
    });
    
    console.log('Enhanced findings categorized:', {
      normalFindings: normalFindings.length,
      pathologicalFindings: pathologicalFindings.length,
      specialObservations: specialObservations.length,
      measurements: measurements.length,
      localizations: localizations.length
    });
    
    return {
      normalFindings: normalFindings.slice(0, 5), // Limit to prevent UI overload
      pathologicalFindings: pathologicalFindings.slice(0, 5),
      specialObservations: specialObservations.slice(0, 5),
      measurements: measurements.slice(0, 3),
      localizations: localizations.slice(0, 3),
      confidence: 0.8, // Backend processing confidence
      processingAgent: 'ollama_backend_enhanced',
      timestamp: Date.now()
    };
  }

  /**
   * Check if text contains administrative content that should be filtered out
   */
  isAdministrativeText(text) {
    const adminPatterns = [
      /Allianz.*Mörkenstraße/i,
      /Dr\..*med\./i,
      /Herrn.*Prof\./i,
      /Sehr geehrter.*Kollege/i,
      /\d{2}\.\d{2}\.\d{4}/i, // Dates
      /\d{5}\s+\w+/i, // Postal codes + cities
      /Nachrichtlich an:/i,
      /berichten über/i,
      /behandelten/i,
      /XXXXXXXXXXXX/i // Anonymized data
    ];
    
    return adminPatterns.some(pattern => pattern.test(text));
  }

  /**
   * Parse natural language medical text response from Ollama
   */
  parseNaturalLanguageResponse(response, language) {
    console.log('OllamaModelService: Parsing natural language response, length:', response.length);
    
    // Clean up the response by removing any non-medical content
    let cleanedResponse = response.trim();
    
    // Remove model artifacts and prompts
    cleanedResponse = cleanedResponse
      .replace(/^(Assistant:|AI:|Model:|Response:|Answer:)/gi, '')
      .replace(/^(Here is|Here are|Based on|According to)/gi, '')
      .trim();
    
    // Extract medical sections using common German patterns
    const sections = this.extractMedicalSections(cleanedResponse, language);
    
    // Create structured findings from the response
    const structuredFindings = this.createBasicStructuredFindings(sections.findings || cleanedResponse);
    
    // Convert structured findings to enhanced findings format for proper UI display
    const enhancedFindings = this.convertToEnhancedFindings(structuredFindings);
    
    return {
      technicalDetails: sections.technique || '',
      findings: {
        content: sections.findings || cleanedResponse,
        structuredFindings: structuredFindings
      },
      impression: sections.impression || this.generateBasicImpression(cleanedResponse, language),
      recommendations: sections.recommendations || this.generateBasicRecommendations(language),
      enhancedFindings: enhancedFindings, // Add enhanced findings for proper UI display
      metadata: {
        source: 'ollama-natural-language',
        originalLength: response.length,
        processedLength: cleanedResponse.length,
        hasEnhancedFindings: true
      }
    };
  }

  /**
   * Extract medical sections from natural language text
   */
  extractMedicalSections(text, language) {
    const sections = {};
    
    // Handle Ollama's markdown-formatted response
    console.log('OllamaModelService: Extracting sections from response length:', text.length);
    
    // First try to extract from Ollama's structured format
    const markdownSections = this.extractFromMarkdownFormat(text);
    if (markdownSections.findings || markdownSections.impression) {
      console.log('OllamaModelService: Using markdown extraction');
      return markdownSections;
    }
    
    // German medical section patterns (original format)
    const patterns = {
      technique: /(?:Technik|Untersuchung|Methode)[:：]?\s*([^.]*(?:\.[^.]*){0,2})/gi,
      findings: /(?:Befund|Befunde|Bildgebung)[:：]?\s*([\s\S]*?)(?=(?:Beurteilung|Impression|Empfehlung|Mit freundlichen|$))/gi,
      impression: /(?:Beurteilung|Impression|Diagnose|Zusammenfassung)[:：]?\s*([\s\S]*?)(?=(?:Empfehlung|Mit freundlichen|$))/gi,
      recommendations: /(?:Empfehlung|Empfehlungen|Procedere|Weiteres Vorgehen)[:：]?\s*([\s\S]*?)(?=Mit freundlichen|$)/gi
    };
    
    // Extract each section
    for (const [sectionName, pattern] of Object.entries(patterns)) {
      const match = text.match(pattern);
      if (match && match[1]) {
        sections[sectionName] = match[1].trim();
      }
    }
    
    // If no specific findings section found, use the entire meaningful text
    if (!sections.findings) {
      // Remove headers, addresses, and signatures, but keep medical content
      const cleanedText = text
        .replace(/^.*?(?:Sehr geehrte?r?.*?,|geb\.\s*am\s*[\d.]+)/gi, '')
        .replace(/Mit freundlichen.*$/gi, '')
        .replace(/Dr\.\s*med\..*$/gi, '')
        .replace(/^\*\*.*?\*\*$/gm, '') // Remove markdown headers
        .replace(/^#{1,6}\s+.*$/gm, '') // Remove markdown headers
        .replace(/^---+$/gm, '') // Remove markdown dividers
        .trim();
      
      if (cleanedText.length > 50) {
        sections.findings = cleanedText;
      }
    }
    
    console.log('OllamaModelService: Extracted sections:', Object.keys(sections));
    return sections;
  }
  
  /**
   * Extract medical content from Ollama's markdown-formatted response
   */
  extractFromMarkdownFormat(text) {
    const sections = {};
    
    // Look for structured medical content patterns in Ollama's output
    const lines = text.split('\n');
    let currentSection = '';
    let currentContent = [];
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Skip empty lines, markdown formatting
      if (!trimmedLine || trimmedLine.startsWith('---') || trimmedLine.startsWith('**Radiologischer')) {
        continue;
      }
      
      // Detect section headers
      if (trimmedLine.match(/^#{1,3}\s*(Technik|Befund|Beurteilung|Empfehlung)/i)) {
        // Save previous section
        if (currentSection && currentContent.length > 0) {
          sections[currentSection] = currentContent.join(' ').trim();
        }
        
        // Start new section
        const sectionMatch = trimmedLine.match(/^#{1,3}\s*(Technik|Befund|Beurteilung|Empfehlung)/i);
        if (sectionMatch) {
          currentSection = sectionMatch[1].toLowerCase();
          if (currentSection === 'befund') currentSection = 'findings';
          if (currentSection === 'beurteilung') currentSection = 'impression';
          if (currentSection === 'empfehlung') currentSection = 'recommendations';
          if (currentSection === 'technik') currentSection = 'technique';
          currentContent = [];
        }
      } else if (trimmedLine.startsWith('**') && trimmedLine.includes(':')) {
        // Handle bold headers like "**Indikation:**"
        const content = trimmedLine.replace(/^\*\*.*?\*\*:?\s*/, '');
        if (content) {
          currentContent.push(content);
        }
      } else if (trimmedLine.startsWith('-') || trimmedLine.includes(':')) {
        // Handle bullet points and key-value pairs
        const content = trimmedLine.replace(/^[-•]\s*/, '').replace(/^\*\*.*?\*\*:?\s*/, '');
        if (content && content.length > 3) {
          currentContent.push(content);
        }
      } else if (trimmedLine.length > 10) {
        // Regular content lines
        currentContent.push(trimmedLine);
      }
    }
    
    // Save final section
    if (currentSection && currentContent.length > 0) {
      sections[currentSection] = currentContent.join(' ').trim();
    }
    
    // If no structured sections found, extract key medical information
    if (Object.keys(sections).length === 0) {
      const medicalContent = text
        .replace(/^\*\*.*?\*\*$/gm, '') // Remove markdown headers
        .replace(/^#{1,6}.*$/gm, '') // Remove headers
        .replace(/^---+$/gm, '') // Remove dividers
        .replace(/\*\*/g, '') // Remove bold formatting
        .split('\n')
        .filter(line => line.trim().length > 10)
        .join(' ')
        .trim();
        
      if (medicalContent.length > 50) {
        sections.findings = medicalContent;
      }
    }
    
    return sections;
  }

  /**
   * Generate basic impression from medical text
   */
  generateBasicImpression(text, language) {
    // Look for existing assessment patterns
    const assessmentMatch = text.match(/(?:unauffällig|auffällig|pathologisch|normal|regelrecht|verändert)/gi);
    
    if (assessmentMatch) {
      return `Befund zeigt ${assessmentMatch.join(', ').toLowerCase()} Veränderungen.`;
    }
    
    // Fallback based on language
    return language === 'de' ? 'Siehe Befund für Details.' : 'See findings for details.';
  }

  /**
   * Generate basic recommendations
   */
  generateBasicRecommendations(language) {
    return language === 'de' ? 
      'Weitere klinische Korrelation und ärztliche Beurteilung empfohlen.' :
      'Further clinical correlation and medical assessment recommended.';
  }

  /**
   * Create fallback response structure
   */
  createFallbackResponse(response) {
    const structuredFindings = this.createBasicStructuredFindings(response.substring(0, 1000));
    const enhancedFindings = this.convertToEnhancedFindings(structuredFindings);
    
    return {
      technicalDetails: '',
      findings: {
        content: response.substring(0, 1000), // Take first 1000 chars as fallback
        structuredFindings: structuredFindings
      },
      impression: 'Automatische Analyse des medizinischen Befundes.',
      recommendations: 'Weitere klinische Korrelation empfohlen.',
      enhancedFindings: enhancedFindings, // Add enhanced findings for proper UI display
      metadata: {
        source: 'ollama-fallback',
        originalLength: response.length,
        fallbackUsed: true,
        hasEnhancedFindings: true
      }
    };
  }

  /**
   * Check if Ollama models are available and working
   */
  async healthCheck() {
    try {
      if (!this.isInitialized) {
        return {
          status: 'not_initialized',
          available: false,
          message: 'Ollama model service not initialized'
        };
      }

      if (!this.currentModel) {
        return {
          status: 'no_model_loaded',
          available: false,
          message: 'No model currently loaded'
        };
      }

      // Check Ollama server status
      const isRunning = await this.checkOllamaStatus();
      if (!isRunning) {
        return {
          status: 'ollama_not_running',
          available: false,
          message: 'Ollama server not running'
        };
      }

      // Test with a simple prompt - just check if model responds
      const testPrompt = 'Hello';
      const requestBody = {
        model: this.currentModel,
        prompt: testPrompt,
        stream: false,
        options: {
          ...this.defaultParams,
          num_predict: 10,
          temperature: 0.1
        }
      };

      const testStart = Date.now();
      const response = await this.makeRequest('POST', '/api/generate', requestBody);
      const responseTime = Date.now() - testStart;
      
      if (response.status === 200) {
        let responseData;
        try {
          responseData = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
        } catch (parseError) {
          console.log('OllamaModelService: Response not JSON, but model responded:', response.data?.substring(0, 100));
          // Model responded but not in JSON format - still healthy
          responseData = { response: 'Model responded successfully' };
        }
        
        const modelConfig = Object.values(this.modelConfigs).find(c => c.modelFile === this.currentModel);
        
        return {
          status: 'healthy',
          available: true,
          model: this.currentModel,
          modelDisplayName: modelConfig?.displayName || this.currentModel,
          responseTime: responseTime,
          ramUsage: modelConfig?.ramRequirement || 'unknown',
          ollamaVersion: await this.getOllamaVersion(),
          testResponse: responseData.response ? responseData.response.substring(0, 50) : 'Model responded'
        };
      } else {
        return {
          status: 'inference_error',
          available: false,
          message: `Model inference failed with status ${response.status}`
        };
      }

    } catch (error) {
      return {
        status: 'error',
        available: false,
        message: error.message
      };
    }
  }

  /**
   * Get Ollama version
   */
  async getOllamaVersion() {
    try {
      const response = await this.makeRequest('GET', '/api/version');
      if (response.status === 200) {
        try {
          const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
          return data.version || 'unknown';
        } catch (parseError) {
          console.log('OllamaModelService: Could not parse version response:', parseError.message);
          return 'unknown';
        }
      }
    } catch (error) {
      console.log('OllamaModelService: Could not get Ollama version:', error.message);
    }
    return 'unknown';
  }

  /**
   * Get information about available models and their status
   */
  async getAvailableModels() {
    await this.refreshAvailableModels();
    const models = [];
    const availableRam = os.freemem() / (1024 * 1024);

    for (const [name, config] of Object.entries(this.modelConfigs)) {
      const isAvailable = this.availableModels.has(config.modelFile);
      const canRun = config.ramRequirement <= availableRam;

      models.push({
        name,
        displayName: config.displayName,
        modelFile: config.modelFile,
        ramRequirement: config.ramRequirement,
        quality: config.quality,
        speed: config.speed,
        contextLength: config.contextLength,
        recommended: config.recommended || false,
        fallback: config.fallback || false,
        description: config.description,
        isAvailable,
        canRun,
        current: config.modelFile === this.currentModel
      });
    }

    return models.sort((a, b) => {
      if (a.current) return -1;
      if (b.current) return 1;
      if (a.recommended && !b.recommended) return -1;
      if (!a.recommended && b.recommended) return 1;
      if (a.fallback && !b.fallback) return 1;
      if (!a.fallback && b.fallback) return -1;
      return b.ramRequirement - a.ramRequirement;
    });
  }

  /**
   * Switch to a different model
   */
  async switchModel(modelName) {
    // First try to find by configuration key, then by modelFile
    let config = this.modelConfigs[modelName];
    if (!config) {
      // Try to find by modelFile name
      config = Object.values(this.modelConfigs).find(c => c.modelFile === modelName);
    }
    
    if (!config) {
      throw new Error(`Unknown model: ${modelName}`);
    }
    
    // Use the actual modelFile for validation and switching
    const actualModelFile = config.modelFile;

    if (this.currentModel === actualModelFile) {
      console.log(`OllamaModelService: Already using model ${actualModelFile}`);
      return true;
    }

    console.log(`OllamaModelService: Switching to model ${actualModelFile}...`);
    
    try {
      // Validate the new model using the actual modelFile
      const isWorking = await this.validateModel(actualModelFile);
      if (!isWorking) {
        throw new Error('Model validation failed');
      }

      this.currentModel = actualModelFile;
      console.log(`OllamaModelService: Successfully switched to ${actualModelFile}`);
      return true;
    } catch (error) {
      console.error(`OllamaModelService: Failed to switch to ${modelName}:`, error);
      throw error;
    }
  }

  /**
   * Pull/download a model from Ollama registry
   */
  async pullModel(modelName) {
    try {
      console.log(`OllamaModelService: Pulling model ${modelName}...`);
      
      const requestBody = { name: modelName };
      const response = await this.makeRequest('POST', '/api/pull', requestBody, 300000); // 5 minute timeout for large models
      
      if (response.status === 200) {
        console.log(`OllamaModelService: Model ${modelName} pulled successfully`);
        await this.refreshAvailableModels();
        return true;
      } else {
        throw new Error(`Failed to pull model: ${response.status} - ${response.data}`);
      }
    } catch (error) {
      console.error(`OllamaModelService: Failed to pull model ${modelName}:`, error);
      throw error;
    }
  }

  /**
   * Make HTTP request to Ollama API
   */
  makeRequest(method, endpoint, data = null, timeout = 30000) {
    return new Promise((resolve, reject) => {
      const url = new URL(endpoint, this.baseUrl);
      const options = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'RadiologyAI-OllamaService/1.0'
        },
        timeout: timeout
      };

      const req = http.request(options, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            data: responseData,
            headers: res.headers
          });
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Request timeout after ${timeout}ms`));
      });

      if (data) {
        req.write(JSON.stringify(data));
      }
      
      req.end();
    });
  }

  /**
   * Clean up resources (Ollama handles model lifecycle automatically)
   */
  async cleanup() {
    console.log('OllamaModelService: Cleaning up...');
    
    this.availableModels.clear();
    this.currentModel = null;
    this.isInitialized = false;
    
    console.log('OllamaModelService: Cleanup complete');
  }
}

module.exports = OllamaModelService;