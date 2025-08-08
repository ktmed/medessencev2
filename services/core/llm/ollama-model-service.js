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
      'gpt-oss': {
        displayName: 'GPT-OSS-20B (Premium)',
        modelFile: 'gpt-oss:latest',
        ramRequirement: 1000, // MB - Low requirement as model runs on host via API
        contextLength: 4096,
        quality: 'exceptional',
        speed: 'medium',
        recommended: true,
        description: 'GPT-OSS 20B reasoning model - highest quality for medical reports'
      },
      'medical-gemma-2b': {
        displayName: 'Medical Gemma 2B (Default)',
        modelFile: 'medical-gemma-2b:latest',
        ramRequirement: 4000, // MB
        contextLength: 2048,
        quality: 'highest',
        speed: 'medium',
        recommended: false, // GPT-OSS is now preferred
        description: 'Best balance of quality and performance for medical reports'
      },
      'medical-gemma-2b-q5': {
        displayName: 'Medical Gemma 2B Q5',
        modelFile: 'medical-gemma-2b:q5_k_s',
        ramRequirement: 2500, // MB
        contextLength: 2048,
        quality: 'high',
        speed: 'fast',
        description: 'Quantized version with good quality and faster inference'
      },
      'medical-gemma-2b-q4': {
        displayName: 'Medical Gemma 2B Q4',
        modelFile: 'medical-gemma-2b:q4_k_s',
        ramRequirement: 2000, // MB
        contextLength: 2048,
        quality: 'good',
        speed: 'fast',
        description: 'Further quantized for lower resource usage'
      },
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
        // Prefer recommended models, then by quality (higher RAM requirement = better quality)
        if (a[1].recommended && !b[1].recommended) return -1;
        if (!a[1].recommended && b[1].recommended) return 1;
        if (a[1].fallback && !b[1].fallback) return 1;
        if (!a[1].fallback && b[1].fallback) return -1;
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
      
      // Optimize prompt for medical context
      const optimizedPrompt = this.optimizePromptForMedical(prompt, language);
      
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

      // Generate response using Ollama API
      const startTime = Date.now();
      const response = await this.makeRequest('POST', '/api/generate', requestBody);
      const inferenceTime = Date.now() - startTime;

      if (response.status !== 200) {
        throw new Error(`Ollama API returned status ${response.status}: ${response.data}`);
      }

      let responseData;
      try {
        // Handle Ollama's streaming response format - multiple JSON objects separated by newlines
        const rawData = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
        
        // Parse streaming JSON response (each line is a separate JSON object)
        const lines = rawData.trim().split('\n').filter(line => line.trim());
        let fullResponse = '';
        let finalData = null;
        
        for (const line of lines) {
          try {
            const jsonObj = JSON.parse(line);
            if (jsonObj.response) {
              fullResponse += jsonObj.response;
            }
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
    // Add medical context and formatting instructions
    const medicalContext = language === 'de' ? 
      `Du bist ein spezialisierter medizinischer AI-Assistent für deutsche Radiologie-Befunde. Antworte präzise und strukturiert im JSON-Format.

WICHTIGE ANWEISUNGEN:
- Verwende ausschließlich medizinische Fachsprache
- Halte dich strikt an das vorgegebene JSON-Schema
- Extrahiere ALLE medizinischen Informationen vollständig
- Ignoriere administrative Inhalte (Adressen, Briefköpfe, etc.)
- Antworte NUR mit einem gültigen JSON-Objekt, ohne zusätzlichen Text

` : 
      `You are a specialized medical AI assistant for radiology reports. Respond precisely and structured in JSON format.

IMPORTANT INSTRUCTIONS:
- Use only medical terminology
- Strictly follow the given JSON schema
- Extract ALL medical information completely
- Ignore administrative content (addresses, letterheads, etc.)
- Respond ONLY with a valid JSON object, without additional text

`;

    // Combine context with original prompt
    return medicalContext + originalPrompt;
  }

  /**
   * Parse model response and ensure valid JSON structure
   */
  parseModelResponse(response, language) {
    try {
      // Extract JSON from response (models sometimes add extra text)
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in model response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
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
        parsed.findings = { content: parsed.findings, structuredFindings: [] };
      }

      // Ensure structured findings format
      if (parsed.findings && typeof parsed.findings === 'string') {
        parsed.findings = {
          content: parsed.findings,
          structuredFindings: this.createBasicStructuredFindings(parsed.findings)
        };
      } else if (parsed.findings && typeof parsed.findings === 'object' && !parsed.findings.content) {
        // If findings is an object but doesn't have the expected structure, add missing parts
        parsed.findings.content = parsed.findings.content || '';
        parsed.findings.structuredFindings = parsed.findings.structuredFindings || [];
      }

      return parsed;

    } catch (error) {
      console.error('OllamaModelService: Failed to parse model response:', error);
      console.log('OllamaModelService: Raw response:', response.substring(0, 500) + '...');
      
      // Return fallback structure
      return {
        technicalDetails: '',
        findings: {
          content: response.substring(0, 1000), // Take first 1000 chars as fallback
          structuredFindings: this.createBasicStructuredFindings(response.substring(0, 1000))
        },
        impression: '',
        recommendations: '',
        parseError: true,
        originalResponse: response
      };
    }
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
    const config = Object.values(this.modelConfigs).find(c => c.modelFile === modelName);
    if (!config) {
      throw new Error(`Unknown model: ${modelName}`);
    }

    if (this.currentModel === modelName) {
      console.log(`OllamaModelService: Already using model ${modelName}`);
      return true;
    }

    console.log(`OllamaModelService: Switching to model ${modelName}...`);
    
    try {
      // Validate the new model
      const isWorking = await this.validateModel(modelName);
      if (!isWorking) {
        throw new Error('Model validation failed');
      }

      this.currentModel = modelName;
      console.log(`OllamaModelService: Successfully switched to ${modelName}`);
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