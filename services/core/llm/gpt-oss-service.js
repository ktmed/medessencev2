/**
 * GPT-OSS-20B Local Model Service for Medical AI
 * Provides local inference using GPT-OSS-20B via GGUF format and llama.cpp
 * High-performance offline processing for medical report generation
 */

// Dynamic import for ESM compatibility
let llama = null;
const path = require('path');
const fs = require('fs');
const os = require('os');

class GPTOSSModelService {
  constructor() {
    this.isInitialized = false;
    this.model = null;
    this.context = null;
    this.chatSession = null;
    
    // Model configurations optimized for medical text processing
    this.modelConfigs = {
      'gpt-oss-20b-q4': {
        displayName: 'GPT-OSS-20B Q4_K_M (Recommended)',
        fileName: 'gpt-oss-20b-q4_k_m.gguf',
        downloadUrl: 'https://huggingface.co/lmstudio-community/gpt-oss-20b-GGUF/resolve/main/gpt-oss-20b-q4_k_m.gguf',
        ramRequirement: 14000, // MB - 14GB recommended 
        contextLength: 4096,
        quality: 'excellent',
        speed: 'medium',
        recommended: true,
        description: 'Q4_K_M quantized model with excellent quality for medical reports'
      },
      'gpt-oss-20b-q5': {
        displayName: 'GPT-OSS-20B Q5 (High Quality)',
        fileName: 'gpt-oss-20b-q5_k_m.gguf',
        downloadUrl: 'https://huggingface.co/lmstudio-community/gpt-oss-20b-GGUF/resolve/main/gpt-oss-20b-q5_k_m.gguf',
        ramRequirement: 16000, // MB - 16GB recommended
        contextLength: 4096,
        quality: 'highest',
        speed: 'slower',
        description: 'Maximum quality for complex medical analysis'
      },
      'gpt-oss-20b-q3': {
        displayName: 'GPT-OSS-20B Q3 (Fast)',
        fileName: 'gpt-oss-20b-q3_k_m.gguf',
        downloadUrl: 'https://huggingface.co/lmstudio-community/gpt-oss-20b-GGUF/resolve/main/gpt-oss-20b-q3_k_m.gguf',
        ramRequirement: 8000, // MB - 8GB minimum
        contextLength: 4096,
        quality: 'good',
        speed: 'fast',
        description: 'Faster inference for lower-end hardware'
      }
    };

    // Model storage paths
    this.modelsDir = process.env.GPT_OSS_MODELS_PATH || path.join(__dirname, '../../../gpt-oss-models');
    this.selectedModel = process.env.GPT_OSS_MODEL || 'gpt-oss-20b-q4';
    
    // Performance settings
    this.settings = {
      threads: process.env.GPT_OSS_THREADS || Math.max(1, os.cpus().length - 2),
      temperature: 0.3, // Conservative for medical accuracy
      maxTokens: 2048,
      topP: 0.9,
      repeatPenalty: 1.1,
      contextSize: 4096
    };
  }

  /**
   * Initialize the GPT-OSS-20B model service
   */
  async initialize() {
    try {
      console.log('GPTOSSModelService: Initializing GPT-OSS-20B...');
      
      // Load node-llama-cpp dynamically for ESM compatibility
      if (!llama) {
        try {
          llama = await import('node-llama-cpp');
          console.log('GPTOSSModelService: node-llama-cpp loaded successfully');
        } catch (importError) {
          console.error('GPTOSSModelService: Failed to import node-llama-cpp:', importError.message);
          return false;
        }
      }
      
      // Check system requirements
      const sysCheck = await this.checkSystemRequirements();
      if (!sysCheck.suitable) {
        console.log('GPTOSSModelService: System requirements not met:', sysCheck.issues);
        return false;
      }

      // Ensure models directory exists
      await this.ensureModelsDirectory();

      // Download model if needed
      const modelPath = await this.ensureModelDownloaded();
      if (!modelPath) {
        console.log('GPTOSSModelService: Failed to download model');
        return false;
      }

      // Initialize llama.cpp with the new v3.x API
      console.log('GPTOSSModelService: Loading model with llama.cpp...');
      
      // First get a Llama instance
      const llamaInstance = await llama.getLlama();
      
      // Load the GGUF model
      this.model = await llamaInstance.loadModel({
        modelPath: modelPath,
        gpuLayers: this.detectGpuLayers()
      });

      // Create context for inference
      this.context = await this.model.createContext({
        contextSize: this.settings.contextSize,
        batchSize: 512,
        threads: this.settings.threads
      });
      
      this.isInitialized = true;
      console.log('GPTOSSModelService: Successfully initialized');
      console.log(`GPTOSSModelService: Model: ${this.selectedModel}`);
      console.log(`GPTOSSModelService: Threads: ${this.settings.threads}`);
      console.log(`GPTOSSModelService: Context size: ${this.settings.contextSize}`);
      
      return true;

    } catch (error) {
      console.error('GPTOSSModelService: Initialization failed:', error);
      this.isInitialized = false;
      return false;
    }
  }

  /**
   * Check if system meets requirements for GPT-OSS-20B
   */
  async checkSystemRequirements() {
    const config = this.modelConfigs[this.selectedModel];
    const totalMemory = os.totalmem() / 1024 / 1024; // Convert to MB
    const freeMemory = os.freemem() / 1024 / 1024;
    
    const issues = [];
    let suitable = true;

    // Check RAM requirement
    if (totalMemory < config.ramRequirement) {
      issues.push(`Insufficient RAM: ${Math.round(totalMemory)}MB available, ${config.ramRequirement}MB required`);
      suitable = false;
    }

    // Check available memory
    if (freeMemory < config.ramRequirement * 0.7) {
      issues.push(`Low available memory: ${Math.round(freeMemory)}MB free, ${Math.round(config.ramRequirement * 0.7)}MB needed`);
    }

    // Check CPU cores
    const cores = os.cpus().length;
    if (cores < 4) {
      issues.push(`Limited CPU cores: ${cores} available, 4+ recommended`);
    }

    return { suitable, issues, totalMemory, freeMemory, cores };
  }

  /**
   * Ensure models directory exists
   */
  async ensureModelsDirectory() {
    if (!fs.existsSync(this.modelsDir)) {
      fs.mkdirSync(this.modelsDir, { recursive: true });
      console.log('GPTOSSModelService: Created models directory:', this.modelsDir);
    }
  }

  /**
   * Ensure the selected model is downloaded
   */
  async ensureModelDownloaded() {
    const config = this.modelConfigs[this.selectedModel];
    const modelPath = path.join(this.modelsDir, config.fileName);

    if (fs.existsSync(modelPath)) {
      console.log('GPTOSSModelService: Model already downloaded:', config.fileName);
      return modelPath;
    }

    console.log('GPTOSSModelService: Downloading model...', config.fileName);
    console.log('GPTOSSModelService: This may take several minutes depending on your connection');
    
    try {
      await this.downloadModel(config.downloadUrl, modelPath);
      console.log('GPTOSSModelService: Model downloaded successfully');
      return modelPath;
    } catch (error) {
      console.error('GPTOSSModelService: Failed to download model:', error);
      return null;
    }
  }

  /**
   * Download model from Hugging Face
   */
  async downloadModel(url, outputPath) {
    const https = require('https');
    const fs = require('fs');
    
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(outputPath);
      
      https.get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
          return;
        }

        const totalSize = parseInt(response.headers['content-length'], 10);
        let downloadedSize = 0;
        let lastProgress = 0;

        response.on('data', (chunk) => {
          downloadedSize += chunk.length;
          const progress = Math.round((downloadedSize / totalSize) * 100);
          
          // Log progress every 10%
          if (progress >= lastProgress + 10) {
            console.log(`GPTOSSModelService: Download progress: ${progress}%`);
            lastProgress = progress;
          }
        });

        response.pipe(file);

        file.on('finish', () => {
          file.close();
          console.log('GPTOSSModelService: Download completed');
          resolve();
        });

      }).on('error', (error) => {
        fs.unlink(outputPath, () => {}); // Delete partial download
        reject(error);
      });
    });
  }

  /**
   * Detect optimal GPU layers for acceleration
   */
  detectGpuLayers() {
    // Basic GPU detection - can be enhanced based on system
    const gpuMemory = process.env.GPT_OSS_GPU_MEMORY;
    if (gpuMemory) {
      // Rough estimation: 1GB GPU memory can handle ~10 layers
      return Math.floor(parseInt(gpuMemory) / 1024 * 10);
    }
    
    // Default: try some GPU layers
    return process.env.GPT_OSS_GPU_LAYERS || 20;
  }

  /**
   * Generate medical report using GPT-OSS-20B
   */
  async generateReport(prompt, language = 'de', options = {}) {
    if (!this.isInitialized || !this.context) {
      throw new Error('GPT-OSS-20B model not initialized');
    }

    const startTime = Date.now();
    
    try {
      // Create medical-focused prompt
      const medicalPrompt = this.createMedicalPrompt(prompt, language);
      
      console.log('GPTOSSModelService: Generating response...');
      console.log('GPTOSSModelService: Prompt length:', medicalPrompt.length);

      // Create a LlamaChat session for text generation
      if (!this.chatSession) {
        // Use LlamaChat which handles the context and wrapper automatically
        const sequence = this.context.getSequence();
        this.chatSession = new llama.LlamaChat({
          context: this.context,
          sequence: sequence
        });
      }
      
      // Generate response using the v3.x LlamaChat API
      const response = await this.chatSession.generateResponse(medicalPrompt, {
        temperature: options.temperature || this.settings.temperature,
        maxTokens: options.maxTokens || this.settings.maxTokens,
        topP: options.topP || this.settings.topP,
        repeatPenalty: this.settings.repeatPenalty
      });

      const inferenceTime = Date.now() - startTime;
      
      console.log(`GPTOSSModelService: Generated ${response.length} characters in ${inferenceTime}ms`);
      
      // Parse response as JSON if possible
      let parsedResponse;
      try {
        // Try to extract JSON from response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedResponse = JSON.parse(jsonMatch[0]);
        } else {
          // Fallback to text parsing
          parsedResponse = this.parseTextResponse(response);
        }
      } catch (parseError) {
        console.log('GPTOSSModelService: JSON parsing failed, using text parsing');
        parsedResponse = this.parseTextResponse(response);
      }

      return {
        ...parsedResponse,
        inferenceTime,
        modelUsed: this.selectedModel,
        tokensGenerated: Math.round(response.length / 4), // Rough token estimate
        provider: 'gpt-oss-20b'
      };

    } catch (error) {
      console.error('GPTOSSModelService: Generation failed:', error);
      throw new Error(`GPT-OSS-20B generation error: ${error.message}`);
    }
  }

  /**
   * Create medical-focused prompt for GPT-OSS-20B
   */
  createMedicalPrompt(transcriptionText, language) {
    const languageInstructions = {
      de: 'Erstelle einen strukturierten deutschen Radiologie-Befund',
      en: 'Create a structured English radiology report',
      tr: 'Türkçe yapılandırılmış radyoloji raporu oluştur'
    };

    return `<|im_start|>system
You are a medical AI assistant specializing in radiology report generation. Create structured medical reports from transcribed dictations with high accuracy and proper medical terminology.

Key requirements:
- Generate structured JSON output with medical sections
- Maintain medical accuracy and terminology
- Focus only on medical content, ignore administrative details
- Use appropriate medical language for the specified language: ${language}
<|im_end|>

<|im_start|>user
${languageInstructions[language] || languageInstructions.de}

Transkription:
${transcriptionText}

Erstelle eine strukturierte JSON-Antwort mit folgenden Abschnitten:
- technicalDetails: Technische Details der Untersuchung
- findings: Detaillierte medizinische Befunde
- impression: Zusammenfassung und Bewertung
- recommendations: Empfehlungen für weitere Maßnahmen

Format: Nur JSON-Ausgabe, keine zusätzlichen Erklärungen.
<|im_end|>

<|im_start|>assistant
`;
  }

  /**
   * Parse text response when JSON parsing fails
   */
  parseTextResponse(text) {
    // Simple text parsing as fallback
    const sections = {
      technicalDetails: '',
      findings: text.trim(),
      impression: '',
      recommendations: ''
    };

    // Try to extract sections if they exist
    const patterns = {
      technicalDetails: /(?:Technik|Technical)[:\s]+(.*?)(?=\n(?:Befund|Findings|Beurteilung)|$)/is,
      findings: /(?:Befund|Findings)[:\s]+(.*?)(?=\n(?:Beurteilung|Impression)|$)/is,
      impression: /(?:Beurteilung|Impression)[:\s]+(.*?)(?=\n(?:Empfehlung|Recommendations)|$)/is,
      recommendations: /(?:Empfehlung|Recommendations)[:\s]+(.*?)$/is
    };

    for (const [key, pattern] of Object.entries(patterns)) {
      const match = text.match(pattern);
      if (match && match[1]) {
        sections[key] = match[1].trim();
      }
    }

    return sections;
  }

  /**
   * Health check for the GPT-OSS service
   */
  async healthCheck() {
    const memoryUsage = process.memoryUsage();
    const config = this.modelConfigs[this.selectedModel];
    
    return {
      available: this.isInitialized,
      model: this.selectedModel,
      modelDisplayName: config?.displayName || 'Unknown',
      memoryUsage: {
        rss: Math.round(memoryUsage.rss / 1024 / 1024), // MB
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
        external: Math.round(memoryUsage.external / 1024 / 1024) // MB
      },
      settings: this.settings,
      message: this.isInitialized ? 'GPT-OSS-20B ready for inference' : 'GPT-OSS-20B not initialized'
    };
  }

  /**
   * Get available models and their configurations
   */
  getAvailableModels() {
    return Object.entries(this.modelConfigs).map(([key, config]) => ({
      id: key,
      ...config,
      downloaded: fs.existsSync(path.join(this.modelsDir, config.fileName)),
      active: key === this.selectedModel
    }));
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    if (this.chatSession) {
      // Chat session cleanup is handled automatically
      this.chatSession = null;
    }
    
    if (this.context) {
      await this.context.dispose();
      this.context = null;
    }
    
    if (this.model) {
      await this.model.dispose();
      this.model = null;
    }
    
    this.isInitialized = false;
    console.log('GPTOSSModelService: Cleanup completed');
  }
}

module.exports = GPTOSSModelService;