/**
 * Local GGUF Model Service for Medical AI
 * Provides local inference using Medical Gemma 2B models via llama.cpp
 */

const path = require('path');
const fs = require('fs');
const os = require('os');

class LocalModelService {
  constructor() {
    this.models = new Map(); // Cache for loaded models
    this.currentModel = null;
    this.isInitialized = false;
    this.llamaCpp = null;
    
    // Model configurations optimized for medical text processing
    this.modelConfigs = {
      'medical-gemma-2b-f16': {
        path: 'portable_models/medical-gemma-2b-f16.gguf',
        ramRequirement: 4000, // MB
        contextLength: 2048,
        quality: 'highest',
        speed: 'slowest'
      },
      'medical-gemma-2b-q5_k_s': {
        path: 'portable_models/medical-gemma-2b-q5_k_s.gguf',
        ramRequirement: 2500, // MB
        contextLength: 2048,
        quality: 'high',
        speed: 'medium',
        recommended: true // Best balance for production
      },
      'medical-gemma-2b-q4_k_s': {
        path: 'portable_models/medical-gemma-2b-q4_k_s.gguf',
        ramRequirement: 2000, // MB
        contextLength: 2048,
        quality: 'good',
        speed: 'fast'
      },
      'medical-gemma-2b-q4_0': {
        path: 'portable_models/medical-gemma-2b-q4_0.gguf',
        ramRequirement: 1800, // MB
        contextLength: 2048,
        quality: 'good',
        speed: 'fast'
      },
      'medical-gemma-2b-q3_k_s': {
        path: 'portable_models/medical-gemma-2b-q3_k_s.gguf',
        ramRequirement: 1500, // MB
        contextLength: 2048,
        quality: 'acceptable',
        speed: 'fastest'
      }
    };
    
    // Default inference parameters optimized for German medical text
    this.defaultParams = {
      temperature: 0.3,        // Lower temperature for more consistent medical responses
      topP: 0.9,              // Nucleus sampling
      repeatPenalty: 1.1,     // Prevent repetitive text
      nPredict: 2048,         // Max tokens to generate
      nCtx: 2048,             // Context window
      threads: Math.min(8, os.cpus().length), // Optimize for available CPUs
      batchSize: 512,         // Batch size for processing
      seed: -1                // Random seed (-1 for random)
    };
  }

  /**
   * Initialize the local model service
   */
  async initialize() {
    if (this.isInitialized) {
      return true;
    }

    try {
      console.log('LocalModelService: Initializing...');
      
      // Try to load llama.cpp Node.js bindings
      try {
        // Try different possible llama.cpp bindings
        try {
          this.llamaCpp = require('llama-node');
          console.log('LocalModelService: Using llama-node binding');
        } catch (e) {
          try {
            this.llamaCpp = require('node-llama-cpp');
            console.log('LocalModelService: Using node-llama-cpp binding');
          } catch (e2) {
            try {
              this.llamaCpp = require('@node-llama/node-llama-cpp');
              console.log('LocalModelService: Using @node-llama/node-llama-cpp binding');
            } catch (e3) {
              throw new Error('No llama.cpp Node.js binding found. Please install one of: llama-node, node-llama-cpp, or @node-llama/node-llama-cpp');
            }
          }
        }
      } catch (error) {
        console.warn('LocalModelService: llama.cpp binding not available:', error.message);
        console.log('LocalModelService: To enable local models, install a llama.cpp binding:');
        console.log('  npm install llama-node');
        console.log('  # or');
        console.log('  npm install node-llama-cpp');
        console.log('  # or');
        console.log('  npm install @node-llama/node-llama-cpp');
        return false;
      }

      // Select optimal model based on system resources
      const selectedModel = this.selectOptimalModel();
      console.log(`LocalModelService: Selected model: ${selectedModel}`);

      // Load the selected model
      await this.loadModel(selectedModel);
      
      this.isInitialized = true;
      console.log('LocalModelService: Initialization complete');
      return true;

    } catch (error) {
      console.error('LocalModelService: Initialization failed:', error);
      return false;
    }
  }

  /**
   * Select optimal model based on available system resources
   */
  selectOptimalModel() {
    const availableRam = os.totalmem() / (1024 * 1024); // Convert to MB
    const freeRam = os.freemem() / (1024 * 1024);
    const safeRam = Math.min(availableRam * 0.7, freeRam * 0.8); // Use max 70% of total or 80% of free

    console.log(`LocalModelService: System RAM - Total: ${Math.round(availableRam)}MB, Free: ${Math.round(freeRam)}MB, Safe to use: ${Math.round(safeRam)}MB`);

    // Find the best model that fits in available RAM
    const suitableModels = Object.entries(this.modelConfigs)
      .filter(([name, config]) => config.ramRequirement <= safeRam)
      .sort((a, b) => {
        // Prefer recommended models, then by quality (higher RAM requirement = better quality)
        if (a[1].recommended && !b[1].recommended) return -1;
        if (!a[1].recommended && b[1].recommended) return 1;
        return b[1].ramRequirement - a[1].ramRequirement;
      });

    if (suitableModels.length === 0) {
      console.warn('LocalModelService: No suitable model found for available RAM. Using smallest model.');
      return 'medical-gemma-2b-q3_k_s';
    }

    const selectedModel = suitableModels[0][0];
    const selectedConfig = suitableModels[0][1];
    console.log(`LocalModelService: Selected ${selectedModel} (requires ${selectedConfig.ramRequirement}MB RAM, quality: ${selectedConfig.quality})`);
    
    return selectedModel;
  }

  /**
   * Load a specific model
   */
  async loadModel(modelName) {
    if (!this.llamaCpp) {
      throw new Error('llama.cpp binding not available');
    }

    const config = this.modelConfigs[modelName];
    if (!config) {
      throw new Error(`Unknown model: ${modelName}`);
    }

    const modelPath = path.resolve(process.cwd(), config.path);
    
    if (!fs.existsSync(modelPath)) {
      throw new Error(`Model file not found: ${modelPath}`);
    }

    console.log(`LocalModelService: Loading model from ${modelPath}...`);

    try {
      // The exact API depends on which llama.cpp binding is used
      // This is a generic interface that should work with most bindings
      const modelInstance = await this.llamaCpp.load({
        modelPath: modelPath,
        ...this.defaultParams,
        nCtx: config.contextLength
      });

      this.models.set(modelName, modelInstance);
      this.currentModel = modelInstance;
      this.currentModelName = modelName;
      
      console.log(`LocalModelService: Model ${modelName} loaded successfully`);
      return modelInstance;

    } catch (error) {
      console.error(`LocalModelService: Failed to load model ${modelName}:`, error);
      throw error;
    }
  }

  /**
   * Generate medical report using local model
   */
  async generateReport(prompt, language = 'de', options = {}) {
    if (!this.isInitialized || !this.currentModel) {
      throw new Error('Local model service not initialized or no model loaded');
    }

    try {
      console.log('LocalModelService: Generating report with local model...');
      
      // Optimize prompt for medical context
      const optimizedPrompt = this.optimizePromptForMedical(prompt, language);
      
      // Merge options with defaults
      const inferenceParams = {
        ...this.defaultParams,
        ...options,
        temperature: options.temperature || 0.3, // Keep low for medical consistency
        nPredict: options.maxTokens || 2048
      };

      // Generate response using the current model
      const startTime = Date.now();
      const response = await this.currentModel.generate(optimizedPrompt, inferenceParams);
      const inferenceTime = Date.now() - startTime;

      console.log(`LocalModelService: Report generated in ${inferenceTime}ms`);

      // Parse and validate the response
      const parsedResponse = this.parseModelResponse(response, language);
      
      return {
        ...parsedResponse,
        provider: 'local-gguf',
        model: this.currentModelName,
        inferenceTime: inferenceTime,
        fromCache: false
      };

    } catch (error) {
      console.error('LocalModelService: Report generation failed:', error);
      throw new Error(`Local model inference failed: ${error.message}`);
    }
  }

  /**
   * Optimize prompt specifically for medical GGUF models
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

` : 
      `You are a specialized medical AI assistant for radiology reports. Respond precisely and structured in JSON format.

IMPORTANT INSTRUCTIONS:
- Use only medical terminology
- Strictly follow the given JSON schema
- Extract ALL medical information completely
- Ignore administrative content (addresses, letterheads, etc.)

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
      
      // Validate required fields
      const requiredFields = ['findings', 'impression'];
      for (const field of requiredFields) {
        if (!parsed[field]) {
          console.warn(`LocalModelService: Missing required field '${field}', using fallback`);
          parsed[field] = '';
        }
      }

      // Ensure structured findings format
      if (parsed.findings && typeof parsed.findings === 'object' && !parsed.findings.content) {
        // If findings is an object but doesn't have the expected structure, convert it
        if (typeof parsed.findings === 'string') {
          parsed.findings = {
            content: parsed.findings,
            structuredFindings: []
          };
        }
      }

      return parsed;

    } catch (error) {
      console.error('LocalModelService: Failed to parse model response:', error);
      console.log('LocalModelService: Raw response:', response);
      
      // Return fallback structure
      return {
        technicalDetails: '',
        findings: {
          content: response.substring(0, 1000), // Take first 1000 chars as fallback
          structuredFindings: []
        },
        impression: '',
        recommendations: '',
        parseError: true,
        originalResponse: response
      };
    }
  }

  /**
   * Check if local models are available and working
   */
  async healthCheck() {
    try {
      if (!this.isInitialized) {
        return {
          status: 'not_initialized',
          available: false,
          message: 'Local model service not initialized'
        };
      }

      if (!this.currentModel) {
        return {
          status: 'no_model_loaded',
          available: false,
          message: 'No model currently loaded'
        };
      }

      // Test with a simple prompt
      const testPrompt = 'Test: Generate a simple JSON response with "status": "ok"';
      const testStart = Date.now();
      
      try {
        await this.currentModel.generate(testPrompt, {
          ...this.defaultParams,
          nPredict: 50,
          temperature: 0.1
        });
        
        const responseTime = Date.now() - testStart;
        
        return {
          status: 'healthy',
          available: true,
          model: this.currentModelName,
          responseTime: responseTime,
          ramUsage: this.modelConfigs[this.currentModelName]?.ramRequirement || 'unknown'
        };
        
      } catch (error) {
        return {
          status: 'inference_error',
          available: false,
          message: `Model inference failed: ${error.message}`
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
   * Get information about available models
   */
  getAvailableModels() {
    const models = [];
    const availableRam = os.freemem() / (1024 * 1024);

    for (const [name, config] of Object.entries(this.modelConfigs)) {
      const modelPath = path.resolve(process.cwd(), config.path);
      const fileExists = fs.existsSync(modelPath);
      const canRun = config.ramRequirement <= availableRam;

      models.push({
        name,
        path: config.path,
        ramRequirement: config.ramRequirement,
        quality: config.quality,
        speed: config.speed,
        contextLength: config.contextLength,
        recommended: config.recommended || false,
        fileExists,
        canRun,
        current: name === this.currentModelName
      });
    }

    return models.sort((a, b) => {
      if (a.recommended && !b.recommended) return -1;
      if (!a.recommended && b.recommended) return 1;
      return b.ramRequirement - a.ramRequirement;
    });
  }

  /**
   * Switch to a different model
   */
  async switchModel(modelName) {
    if (!this.modelConfigs[modelName]) {
      throw new Error(`Unknown model: ${modelName}`);
    }

    if (this.currentModelName === modelName) {
      console.log(`LocalModelService: Already using model ${modelName}`);
      return true;
    }

    console.log(`LocalModelService: Switching to model ${modelName}...`);
    
    try {
      await this.loadModel(modelName);
      console.log(`LocalModelService: Successfully switched to ${modelName}`);
      return true;
    } catch (error) {
      console.error(`LocalModelService: Failed to switch to ${modelName}:`, error);
      throw error;
    }
  }

  /**
   * Clean up resources
   */
  async cleanup() {
    console.log('LocalModelService: Cleaning up...');
    
    for (const [name, model] of this.models) {
      try {
        if (model && typeof model.cleanup === 'function') {
          await model.cleanup();
        }
      } catch (error) {
        console.error(`LocalModelService: Error cleaning up model ${name}:`, error);
      }
    }
    
    this.models.clear();
    this.currentModel = null;
    this.isInitialized = false;
    
    console.log('LocalModelService: Cleanup complete');
  }
}

module.exports = LocalModelService;