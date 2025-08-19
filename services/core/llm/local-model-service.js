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
      // Superior Gemma-3 4B Models (German Medical Specialized)
      'gemma-3-medical-fp16': {
        path: '/Users/keremtomak/Documents/work/01-Active-Projects/med-essence/DEVELOPMENT/gemma3_medical_models/gemma-medical-fp16.gguf',
        ramRequirement: 8000, // MB - 4B model requires more RAM
        contextLength: 4096,  // Larger context for complex medical reports
        quality: 'highest',
        speed: 'slowest',
        modelSize: '4B',
        language: 'german',
        description: 'Gemma-3 4B fine-tuned for German medical reports (highest quality)'
      },
      'gemma-3-medical-q8_0': {
        path: '/Users/keremtomak/Documents/work/01-Active-Projects/med-essence/DEVELOPMENT/gemma3_medical_models/gemma-medical-Q8_0.gguf',
        ramRequirement: 5000, // MB
        contextLength: 4096,
        quality: 'very_high',
        speed: 'slow',
        modelSize: '4B',
        language: 'german',
        recommended: true, // Best balance for production
        description: 'Gemma-3 4B German medical (Q8 - excellent quality/speed balance)'
      },
      'gemma-3-medical-q5_1': {
        path: '/Users/keremtomak/Documents/work/01-Active-Projects/med-essence/DEVELOPMENT/gemma3_medical_models/gemma-medical-Q5_1.gguf',
        ramRequirement: 3500, // MB
        contextLength: 4096,
        quality: 'high',
        speed: 'medium',
        modelSize: '4B',
        language: 'german',
        description: 'Gemma-3 4B German medical (Q5 - good balance)'
      },
      'gemma-3-medical-q4_0': {
        path: '/Users/keremtomak/Documents/work/01-Active-Projects/med-essence/DEVELOPMENT/gemma3_medical_models/gemma-medical-Q4_0.gguf',
        ramRequirement: 2800, // MB
        contextLength: 4096,
        quality: 'good',
        speed: 'fast',
        modelSize: '4B',
        language: 'german',
        description: 'Gemma-3 4B German medical (Q4 - fast inference)'
      },
      
      // Legacy Gemma-2B Models (kept for compatibility)
      'medical-gemma-2b-f16': {
        path: 'portable_models/medical-gemma-2b-f16.gguf',
        ramRequirement: 4000, // MB
        contextLength: 2048,
        quality: 'highest',
        speed: 'slowest',
        modelSize: '2B',
        legacy: true
      },
      'medical-gemma-2b-q5_k_s': {
        path: 'portable_models/medical-gemma-2b-q5_k_s.gguf',
        ramRequirement: 2500, // MB
        contextLength: 2048,
        quality: 'high',
        speed: 'medium',
        modelSize: '2B',
        legacy: true
      },
      'medical-gemma-2b-q4_k_s': {
        path: 'portable_models/medical-gemma-2b-q4_k_s.gguf',
        ramRequirement: 2000, // MB
        contextLength: 2048,
        quality: 'good',
        speed: 'fast',
        modelSize: '2B',
        legacy: true
      },
      'medical-gemma-2b-q4_0': {
        path: 'portable_models/medical-gemma-2b-q4_0.gguf',
        ramRequirement: 1800, // MB
        contextLength: 2048,
        quality: 'good',
        speed: 'fast',
        modelSize: '2B',
        legacy: true
      },
      'medical-gemma-2b-q3_k_s': {
        path: 'portable_models/medical-gemma-2b-q3_k_s.gguf',
        ramRequirement: 1500, // MB
        contextLength: 2048,
        quality: 'acceptable',
        speed: 'fastest',
        modelSize: '2B',
        legacy: true
      }
    };
    
    // Default inference parameters optimized for German medical text
    this.defaultParams = {
      temperature: 0.25,      // Very low temperature for medical accuracy
      topP: 0.85,             // Nucleus sampling - focused on high-probability tokens
      topK: 50,               // Limit to top 50 tokens for consistency
      repeatPenalty: 1.15,    // Stronger penalty to prevent repetitive medical text
      nPredict: 4096,         // Max tokens for complex German medical reports
      nCtx: 4096,             // Larger context window for Gemma-3 4B models
      threads: Math.min(8, os.cpus().length), // Optimize for available CPUs
      batchSize: 256,         // Smaller batch for better quality with 4B models
      seed: -1,               // Random seed (-1 for random)
      // German medical specific parameters
      penalizeNl: false,      // Don't penalize newlines (important for report structure)
      mirostat: 0,            // Disable mirostat for deterministic medical output
      mirostatEta: 0.1,       // Mirostat learning rate (if enabled)
      mirostatTau: 5.0        // Mirostat target entropy (if enabled)
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
      
      // Try to load llama.cpp Node.js bindings with better error handling
      try {
        console.log('LocalModelService: Attempting to load llama.cpp bindings...');
        
        // Try different possible llama.cpp bindings with proper ES module handling
        let bindingFound = false;
        const bindings = [
          { name: 'node-llama-cpp', pkg: 'node-llama-cpp', esm: true },
          { name: 'llama-node', pkg: 'llama-node', esm: false },
          { name: '@node-llama/node-llama-cpp', pkg: '@node-llama/node-llama-cpp', esm: false }
        ];

        for (const binding of bindings) {
          try {
            console.log(`LocalModelService: Trying ${binding.name}...`);
            
            if (binding.esm && binding.name === 'node-llama-cpp') {
              // Handle ESM for node-llama-cpp v3+
              console.log(`LocalModelService: Loading ${binding.name} as ESM module...`);
              this.llamaCpp = await import(binding.pkg);
              console.log(`✅ LocalModelService: Successfully loaded ${binding.name} (ESM)`);
            } else {
              // Handle CommonJS modules
              this.llamaCpp = require(binding.pkg);
              console.log(`✅ LocalModelService: Successfully loaded ${binding.name} (CommonJS)`);
            }
            
            bindingFound = true;
            break;
          } catch (e) {
            console.log(`❌ LocalModelService: ${binding.name} not available:`, e.code || e.message);
          }
        }

        if (!bindingFound) {
          throw new Error('No working llama.cpp Node.js binding found');
        }

        // Test if the binding actually works
        const hasLlamaModel = this.llamaCpp.LlamaModel || this.llamaCpp.default?.LlamaModel;
        const hasGetLlama = this.llamaCpp.getLlama || this.llamaCpp.default?.getLlama;
        
        if (hasLlamaModel || hasGetLlama) {
          console.log('✅ LocalModelService: Binding validation successful');
          console.log('Available APIs:', {
            LlamaModel: !!hasLlamaModel,
            getLlama: !!hasGetLlama,
            isDefault: !!this.llamaCpp.default
          });
        } else {
          console.warn('⚠️  LocalModelService: Binding loaded but may not be fully compatible');
          console.log('Available methods:', Object.keys(this.llamaCpp));
          if (this.llamaCpp.default) {
            console.log('Default export methods:', Object.keys(this.llamaCpp.default));
          }
        }

      } catch (error) {
        console.error('❌ LocalModelService: llama.cpp binding initialization failed:', error.message);
        console.log('');
        console.log('🔧 To enable Gemma-3 models, install a compatible llama.cpp binding:');
        console.log('  npm install node-llama-cpp         # Recommended');
        console.log('  npm install llama-node            # Alternative');
        console.log('  npm install @node-llama/node-llama-cpp  # Alternative');
        console.log('');
        console.log('⚠️  Demo will continue in fallback mode with rule-based extraction');
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
        // Priority 1: Prefer Gemma-3 4B models over legacy 2B models
        const aIsGemma3 = a[1].modelSize === '4B';
        const bIsGemma3 = b[1].modelSize === '4B';
        if (aIsGemma3 && !bIsGemma3) return -1;
        if (!aIsGemma3 && bIsGemma3) return 1;
        
        // Priority 2: Prefer recommended models
        if (a[1].recommended && !b[1].recommended) return -1;
        if (!a[1].recommended && b[1].recommended) return 1;
        
        // Priority 3: Prefer German-specialized models
        if (a[1].language === 'german' && b[1].language !== 'german') return -1;
        if (a[1].language !== 'german' && b[1].language === 'german') return 1;
        
        // Priority 4: Prefer higher quality (more RAM = better quality)
        return b[1].ramRequirement - a[1].ramRequirement;
      });

    if (suitableModels.length === 0) {
      console.warn('LocalModelService: No suitable model found for available RAM. Using smallest Gemma-3 model.');
      return 'gemma-3-medical-q4_0'; // Fallback to smallest Gemma-3 4B model
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

    // Handle both relative and absolute paths
    const modelPath = path.isAbsolute(config.path) ? 
      config.path : 
      path.resolve(process.cwd(), config.path);
    
    if (!fs.existsSync(modelPath)) {
      throw new Error(`Model file not found: ${modelPath}`);
    }

    console.log(`LocalModelService: Loading model from ${modelPath}...`);

    try {
      console.log(`LocalModelService: Initializing model with ${config.ramRequirement}MB RAM requirement...`);
      
      // Different API handling based on the binding type and ESM structure
      let modelInstance;
      
      // Get the actual API from ESM import
      const api = this.llamaCpp;
      const { LlamaModel, LlamaContext, LlamaChatSession, getLlama } = api;
      
      if (LlamaModel) {
        // node-llama-cpp v3+ API (ESM)
        console.log('LocalModelService: Using node-llama-cpp v3+ API (ESM)');
        
        try {
          // Get Llama instance first
          const llama = await getLlama();
          
          // Load model
          const model = await llama.loadModel({
            modelPath: modelPath,
            gpuLayers: 0, // CPU only for compatibility
            useMlock: false
          });
          
          // Create context and chat session
          const context = await model.createContext({
            contextSize: config.contextLength,
            batchSize: this.defaultParams.batchSize
          });
          
          const contextSequence = context.getSequence();
          const chatSession = new LlamaChatSession({
            contextSequence: contextSequence
          });
          
          modelInstance = {
            model: model,
            context: context,
            chatSession: chatSession,
            generate: async (prompt, params) => {
              try {
                console.log('LocalModelService: Starting inference with node-llama-cpp v3+...');
                
                // Use chat session for more stable completion
                const response = await chatSession.prompt(prompt, {
                  maxTokens: params.nPredict || this.defaultParams.nPredict,
                  temperature: params.temperature || this.defaultParams.temperature,
                  topP: params.topP || this.defaultParams.topP,
                  topK: params.topK || this.defaultParams.topK,
                  repeatPenalty: params.repeatPenalty || this.defaultParams.repeatPenalty
                });
                
                console.log('LocalModelService: Inference completed');
                return response || '';
              } catch (error) {
                console.error('Generation error:', error);
                throw error;
              }
            }
          };
        } catch (error) {
          console.error('Failed to initialize node-llama-cpp v3+ model:', error);
          throw error;
        }
        
      } else if (api.LLM || api.LLama) {
        // llama-node API (uses LLM or LLama class)
        console.log('LocalModelService: Using llama-node API');
        
        const LLMClass = api.LLM || api.LLama;
        const model = new LLMClass();
        await model.load({
          model: modelPath,
          n_ctx: config.contextLength,
          n_threads: this.defaultParams.threads,
          n_gpu_layers: 0, // CPU only for compatibility
          use_mlock: false,
          embedding: false,
          n_batch: this.defaultParams.batchSize
        });
        
        modelInstance = {
          model: model,
          generate: async (prompt, params) => {
            try {
              console.log('LocalModelService: Starting inference with llama-node...');
              const response = await model.createCompletion({
                prompt: prompt,
                n_predict: params.nPredict || this.defaultParams.nPredict,
                temperature: params.temperature || this.defaultParams.temperature,
                top_p: params.topP || this.defaultParams.topP,
                top_k: params.topK || this.defaultParams.topK,
                repeat_penalty: params.repeatPenalty || this.defaultParams.repeatPenalty,
                seed: this.defaultParams.seed
              });
              console.log('LocalModelService: Inference completed');
              return response.choices?.[0]?.text || response.content || response;
            } catch (error) {
              console.error('Generation error:', error);
              throw error;
            }
          }
        };
      } else if (api.load || api.createCompletion) {
        // Alternative API fallback
        console.log('LocalModelService: Using generic binding API');
        modelInstance = {
          generate: async (prompt, params) => {
            // Simple fallback implementation
            return "Fallback mode: " + prompt.substring(0, 200) + "...";
          }
        };
      } else {
        console.error('Available API methods:', Object.keys(api));
        throw new Error('Unknown llama.cpp binding API structure');
      }

      this.models.set(modelName, modelInstance);
      this.currentModel = modelInstance;
      this.currentModelName = modelName;
      
      console.log(`✅ LocalModelService: Model ${modelName} loaded successfully`);
      console.log(`📊 Model details: ${config.quality} quality, ${config.contextLength} context, ${config.ramRequirement}MB RAM`);
      return modelInstance;

    } catch (error) {
      console.error(`❌ LocalModelService: Failed to load model ${modelName}:`, error.message);
      console.error('Stack trace:', error.stack);
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
    // Enhanced medical context for Gemma-3 4B German medical models
    const medicalContext = language === 'de' ? 
      `Du bist ein hochspezialisierter medizinischer KI-Assistent, der mit deutschen Radiologie-Befunden trainiert wurde. Du analysierst medizinische Texte mit höchster Präzision und extrahierst strukturierte medizinische Informationen.

KRITISCHE ANWEISUNGEN FÜR DEUTSCHE MEDIZIN:
- Verwende AUSSCHLIESSLICH deutsche medizinische Fachterminologie
- Beachte deutsche Rechtschreibung und medizinische Abkürzungen (z.B. "Z.n.", "V.a.", "DD", "unauffällig")
- Halte dich STRIKT an das vorgegebene JSON-Schema ohne Abweichungen
- Extrahiere ALLE medizinischen Befunde, Diagnosen, Messungen und Empfehlungen vollständig
- Ignoriere administrative Inhalte (Adressen, Briefköpfe, Kontaktdaten, etc.)
- Erkenne deutsche Anatomie-Begriffe und Modalitäten korrekt
- Berücksichtige deutsche medizinische Syntax und Satzbau
- Bei Unklarheiten bevorzuge medizinisch konservative Interpretationen

QUALITÄTSKRITERIEN:
- Medizinische Genauigkeit vor Vollständigkeit
- Strukturierte, einheitliche Formatierung
- Konsistente Verwendung medizinischer Abkürzungen
- Vollständige Übertragung aller Messwerte und Befunde

` : 
      `You are a highly specialized medical AI assistant trained on radiology reports. You analyze medical texts with highest precision and extract structured medical information.

CRITICAL INSTRUCTIONS FOR MEDICAL ANALYSIS:
- Use ONLY medical terminology and standard abbreviations
- Strictly follow the given JSON schema without deviations  
- Extract ALL medical findings, diagnoses, measurements and recommendations completely
- Ignore administrative content (addresses, letterheads, contact information, etc.)
- Recognize anatomical terms and modalities correctly
- For ambiguities, prefer medically conservative interpretations

QUALITY CRITERIA:
- Medical accuracy over completeness
- Structured, consistent formatting
- Complete transfer of all measurements and findings

`;

    // Add model-specific optimization hints for Gemma-3 4B
    const modelHints = language === 'de' ?
      `[GEMMA-3 GERMAN MEDICAL MODE] Nutze deine spezialisierte deutsche medizinische Ausbildung für maximale Genauigkeit.

` :
      `[GEMMA-3 MEDICAL MODE] Use your specialized medical training for maximum accuracy.

`;

    // Combine context with original prompt
    return modelHints + medicalContext + originalPrompt;
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
      // Handle both relative and absolute paths
      const modelPath = path.isAbsolute(config.path) ? 
        config.path : 
        path.resolve(process.cwd(), config.path);
      const fileExists = fs.existsSync(modelPath);
      const canRun = config.ramRequirement <= availableRam;

      models.push({
        name,
        path: config.path,
        ramRequirement: config.ramRequirement,
        quality: config.quality,
        speed: config.speed,
        contextLength: config.contextLength,
        modelSize: config.modelSize || 'unknown',
        language: config.language || 'general',
        description: config.description || 'Medical model',
        recommended: config.recommended || false,
        legacy: config.legacy || false,
        fileExists,
        canRun,
        current: name === this.currentModelName
      });
    }

    return models.sort((a, b) => {
      // Priority 1: Gemma-3 4B models first
      const aIsGemma3 = a.modelSize === '4B';
      const bIsGemma3 = b.modelSize === '4B';
      if (aIsGemma3 && !bIsGemma3) return -1;
      if (!aIsGemma3 && bIsGemma3) return 1;
      
      // Priority 2: Recommended models
      if (a.recommended && !b.recommended) return -1;
      if (!a.recommended && b.recommended) return 1;
      
      // Priority 3: German-specialized models
      if (a.language === 'german' && b.language !== 'german') return -1;
      if (a.language !== 'german' && b.language === 'german') return 1;
      
      // Priority 4: Higher RAM requirement = better quality
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