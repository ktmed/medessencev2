/**
 * Hybrid Model Service - Combines Ollama and Transformers
 * Automatically selects the best available service based on model requirements and system capabilities
 * Provides unified API for both Ollama and Transformers backends
 */

const OllamaModelService = require('./ollama-model-service');
const TransformersModelService = require('./transformers-model-service');

class HybridModelService {
  constructor() {
    this.ollamaService = new OllamaModelService();
    this.transformersService = new TransformersModelService();
    this.currentProvider = null;
    this.isInitialized = false;
    this.preferredProvider = 'ollama'; // Default preference
  }

  /**
   * Initialize both services and determine best provider
   */
  async initialize() {
    try {
      console.log('HybridModelService: Initializing hybrid service...');
      
      const results = await Promise.allSettled([
        this.initializeOllama(),
        this.initializeTransformers()
      ]);
      
      const ollamaAvailable = results[0].status === 'fulfilled';
      const transformersAvailable = results[1].status === 'fulfilled';
      
      console.log(`HybridModelService: Ollama available: ${ollamaAvailable}`);
      console.log(`HybridModelService: Transformers available: ${transformersAvailable}`);
      
      // Select default provider
      if (ollamaAvailable && this.preferredProvider === 'ollama') {
        this.currentProvider = 'ollama';
        console.log('HybridModelService: Using Ollama as primary provider');
      } else if (transformersAvailable) {
        this.currentProvider = 'transformers';
        console.log('HybridModelService: Using Transformers as primary provider');
      } else if (ollamaAvailable) {
        this.currentProvider = 'ollama';
        console.log('HybridModelService: Using Ollama as fallback provider');
      } else {
        throw new Error('No model providers available');
      }
      
      this.isInitialized = true;
      console.log('HybridModelService: Initialization complete');
      return true;
      
    } catch (error) {
      console.error('HybridModelService: Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Initialize Ollama service
   */
  async initializeOllama() {
    try {
      await this.ollamaService.initialize();
      console.log('HybridModelService: Ollama service initialized');
      return true;
    } catch (error) {
      console.warn('HybridModelService: Ollama initialization failed:', error.message);
      throw error;
    }
  }

  /**
   * Initialize Transformers service
   */
  async initializeTransformers() {
    try {
      await this.transformersService.initialize();
      console.log('HybridModelService: Transformers service initialized');
      return true;
    } catch (error) {
      console.warn('HybridModelService: Transformers initialization failed:', error.message);
      throw error;
    }
  }

  /**
   * Get current service instance
   */
  getCurrentService() {
    if (this.currentProvider === 'ollama') {
      return this.ollamaService;
    } else if (this.currentProvider === 'transformers') {
      return this.transformersService;
    } else {
      throw new Error('No active provider');
    }
  }

  /**
   * Generate medical report using current provider
   */
  async generateReport(text, language = 'de', metadata = {}) {
    try {
      const service = this.getCurrentService();
      console.log(`HybridModelService: Generating report with ${this.currentProvider}...`);
      
      const result = await service.generateReport(text, language, metadata);
      
      // Add provider information
      result.provider = this.currentProvider;
      result.hybridService = true;
      
      return result;
      
    } catch (error) {
      console.error(`HybridModelService: Generation failed with ${this.currentProvider}:`, error);
      
      // Try fallback provider
      if (await this.tryFallback()) {
        console.log(`HybridModelService: Retrying with ${this.currentProvider}...`);
        return await this.generateReport(text, language, metadata);
      }
      
      throw error;
    }
  }

  /**
   * Try switching to fallback provider
   */
  async tryFallback() {
    if (this.currentProvider === 'ollama') {
      try {
        // Check if transformers is available
        const health = await this.transformersService.healthCheck();
        if (health.status === 'ok') {
          this.currentProvider = 'transformers';
          console.log('HybridModelService: Switched to Transformers fallback');
          return true;
        }
      } catch (error) {
        console.warn('HybridModelService: Transformers fallback failed:', error);
      }
    } else if (this.currentProvider === 'transformers') {
      try {
        // Check if Ollama is available
        const health = await this.ollamaService.healthCheck();
        if (health.status === 'ok') {
          this.currentProvider = 'ollama';
          console.log('HybridModelService: Switched to Ollama fallback');
          return true;
        }
      } catch (error) {
        console.warn('HybridModelService: Ollama fallback failed:', error);
      }
    }
    
    return false;
  }

  /**
   * Get available models from all providers
   */
  async getAvailableModels() {
    const models = [];
    
    // Get Ollama models
    try {
      if (this.ollamaService.isInitialized) {
        const ollamaModels = await this.ollamaService.getAvailableModels();
        models.push(...ollamaModels.map(model => ({
          ...model,
          provider: 'ollama',
          providerLabel: 'Ollama'
        })));
      }
    } catch (error) {
      console.warn('HybridModelService: Failed to get Ollama models:', error);
    }
    
    // Get Transformers models
    try {
      if (this.transformersService.isInitialized) {
        const transformerModels = await this.transformersService.getAvailableModels();
        models.push(...transformerModels.map(model => ({
          ...model,
          provider: 'transformers',
          providerLabel: 'Transformers',
          name: `tf-${model.name}` // Prefix to avoid conflicts
        })));
      }
    } catch (error) {
      console.warn('HybridModelService: Failed to get Transformers models:', error);
    }
    
    // Sort by quality and provider preference
    return models.sort((a, b) => {
      // Prefer current provider
      if (a.provider === this.currentProvider && b.provider !== this.currentProvider) return -1;
      if (b.provider === this.currentProvider && a.provider !== this.currentProvider) return 1;
      
      // Then by medical specialization
      if (a.medicalSpecialized && !b.medicalSpecialized) return -1;
      if (b.medicalSpecialized && !a.medicalSpecialized) return 1;
      
      // Then by recommendation
      if (a.recommended && !b.recommended) return -1;
      if (b.recommended && !a.recommended) return 1;
      
      // Finally by RAM requirement (higher is better if can run)
      if (a.canRun && b.canRun) {
        return b.ramRequirement - a.ramRequirement;
      }
      
      return a.displayName.localeCompare(b.displayName);
    });
  }

  /**
   * Switch model (handles provider switching)
   */
  async switchModel(modelName) {
    // Determine target provider from model name
    let targetProvider = this.currentProvider;
    let actualModelName = modelName;
    
    if (modelName.startsWith('tf-')) {
      targetProvider = 'transformers';
      actualModelName = modelName.substring(3); // Remove 'tf-' prefix
    } else {
      // Check if model exists in Ollama
      try {
        const ollamaModels = await this.ollamaService.getAvailableModels();
        const ollamaModel = ollamaModels.find(m => m.name === modelName);
        if (ollamaModel) {
          targetProvider = 'ollama';
        }
      } catch (error) {
        console.warn('HybridModelService: Could not check Ollama models:', error);
      }
    }
    
    console.log(`HybridModelService: Switching to ${actualModelName} via ${targetProvider}...`);
    
    // Switch provider if needed
    if (targetProvider !== this.currentProvider) {
      this.currentProvider = targetProvider;
      console.log(`HybridModelService: Provider switched to ${targetProvider}`);
    }
    
    // Switch model using appropriate service
    const service = this.getCurrentService();
    await service.switchModel(actualModelName);
    
    console.log(`HybridModelService: Successfully switched to ${actualModelName} via ${targetProvider}`);
    return true;
  }

  /**
   * Health check for all services
   */
  async healthCheck() {
    const health = {
      hybrid: true,
      currentProvider: this.currentProvider,
      providers: {}
    };
    
    // Check Ollama
    try {
      health.providers.ollama = await this.ollamaService.healthCheck();
    } catch (error) {
      health.providers.ollama = { status: 'error', error: error.message };
    }
    
    // Check Transformers
    try {
      health.providers.transformers = await this.transformersService.healthCheck();
    } catch (error) {
      health.providers.transformers = { status: 'error', error: error.message };
    }
    
    // Overall status
    const currentService = health.providers[this.currentProvider];
    health.status = currentService?.status || 'error';
    health.model = currentService?.model || 'unknown';
    
    return health;
  }

  /**
   * Set provider preference
   */
  setProviderPreference(provider) {
    if (['ollama', 'transformers'].includes(provider)) {
      this.preferredProvider = provider;
      console.log(`HybridModelService: Provider preference set to ${provider}`);
    }
  }

  /**
   * Switch provider manually
   */
  async switchProvider(provider) {
    if (!['ollama', 'transformers'].includes(provider)) {
      throw new Error(`Invalid provider: ${provider}`);
    }
    
    // Check if target provider is available
    const targetService = provider === 'ollama' ? this.ollamaService : this.transformersService;
    
    if (!targetService.isInitialized) {
      throw new Error(`Provider ${provider} is not initialized`);
    }
    
    const health = await targetService.healthCheck();
    if (health.status !== 'ok') {
      throw new Error(`Provider ${provider} is not healthy: ${health.error}`);
    }
    
    this.currentProvider = provider;
    console.log(`HybridModelService: Switched to provider ${provider}`);
    return true;
  }

  /**
   * Cleanup both services
   */
  async cleanup() {
    console.log('HybridModelService: Cleaning up hybrid service...');
    
    await Promise.allSettled([
      this.ollamaService.cleanup(),
      this.transformersService.cleanup()
    ]);
    
    console.log('HybridModelService: Cleanup complete');
  }
}

module.exports = HybridModelService;