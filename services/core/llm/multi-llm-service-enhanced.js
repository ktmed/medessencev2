/**
 * Enhanced Multi-LLM Service with Ontology Integration
 * Extends the base multi-LLM service with semantic enhancement capabilities
 */

const MultiLLMService = require('./multi-llm-service');
const OntologyService = require('../../../backend/services/ontologyService');

class EnhancedMultiLLMService extends MultiLLMService {
  constructor() {
    super();
    this.ontologyService = new OntologyService();
    this.useOntologyEnhancement = process.env.USE_ONTOLOGY_ENHANCEMENT !== 'false';
    console.log(`Ontology enhancement: ${this.useOntologyEnhancement ? 'ENABLED' : 'DISABLED'}`);
  }

  /**
   * Create enhanced report prompt with ontology context
   */
  async createEnhancedReportPrompt(transcriptionText, language, metadata) {
    // Get the base prompt
    const basePrompt = this.createReportPrompt(transcriptionText, language, metadata);
    
    // If ontology enhancement is disabled, return base prompt
    if (!this.useOntologyEnhancement) {
      return {
        prompt: basePrompt,
        ontologyData: null,
        enhanced: false
      };
    }

    try {
      // Enhance with ontology
      const enhancement = await this.ontologyService.enhanceReportPrompt(
        transcriptionText,
        metadata.modality || 'mammographie',
        {
          patientId: metadata.patientId,
          age: metadata.age,
          gender: metadata.gender
        }
      );

      if (enhancement.hasEnhancement) {
        console.log('✅ Report prompt enhanced with ontology context');
        return {
          prompt: enhancement.enhancedPrompt,
          ontologyData: enhancement.ontologyData,
          enhanced: true
        };
      }

      return {
        prompt: basePrompt,
        ontologyData: null,
        enhanced: false
      };
    } catch (error) {
      console.warn('⚠️ Ontology enhancement failed, using base prompt:', error.message);
      return {
        prompt: basePrompt,
        ontologyData: null,
        enhanced: false,
        error: error.message
      };
    }
  }

  /**
   * Generate a radiology report with ontology enhancement
   */
  async generateReport(transcriptionText, language = 'de', metadata = {}, processingMode = 'cloud') {
    // Check cache first
    const cacheKey = this.generateCacheKey(transcriptionText, language, 'report');
    const cachedResponse = this.getCachedResponse(cacheKey);
    if (cachedResponse) {
      return {
        ...cachedResponse,
        cached: true
      };
    }

    // Create enhanced prompt with ontology
    const promptData = await this.createEnhancedReportPrompt(transcriptionText, language, metadata);
    const prompt = promptData.prompt;
    
    // For local processing, use Ollama models
    if (processingMode === 'local') {
      const result = await this.generateReportWithOllama(prompt, language, transcriptionText);
      
      // Add ontology data if available
      if (promptData.ontologyData) {
        result.ontologyEnhancement = promptData.ontologyData;
        result.ontologyEnhanced = true;
      }
      
      return result;
    }
    
    let lastError = null;
    
    // Try each provider in order
    for (const provider of this.providers) {
      try {
        console.log(`Attempting report generation with ${provider.name}...`);
        
        const result = await provider.handler(prompt, language);
        
        if (result) {
          // Add ontology data if available
          if (promptData.ontologyData) {
            result.ontologyEnhancement = promptData.ontologyData;
            result.ontologyEnhanced = true;
            
            // Merge ICD suggestions from ontology with LLM results
            if (promptData.ontologyData.suggested_icd_codes?.length > 0) {
              result.icdCodes = result.icdCodes || [];
              
              // Add unique ontology suggestions
              promptData.ontologyData.suggested_icd_codes.forEach(ontologyCode => {
                const exists = result.icdCodes.some(code => 
                  code.code === ontologyCode.code
                );
                
                if (!exists) {
                  result.icdCodes.push({
                    code: ontologyCode.code,
                    description: ontologyCode.description,
                    confidence: ontologyCode.confidence,
                    source: 'ontology'
                  });
                }
              });
              
              // Sort by confidence
              result.icdCodes.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
            }
          }
          
          // Cache the successful response
          this.setCachedResponse(cacheKey, result);
          
          console.log(`✅ Successfully generated report with ${provider.name}${promptData.enhanced ? ' (ontology-enhanced)' : ''}`);
          return result;
        }
      } catch (error) {
        lastError = error;
        console.error(`❌ ${provider.name} failed:`, error.message);
        
        // Log specific error details for debugging
        if (error.response) {
          console.error(`Response status: ${error.response.status}`);
          console.error(`Response data:`, error.response.data);
        }
        
        continue; // Try next provider
      }
    }
    
    // All providers failed
    throw new Error(`All LLM providers failed. Last error: ${lastError?.message}`);
  }

  /**
   * Generate ICD codes with ontology enhancement
   */
  async generateICDCodes(text, language = 'de', modality = null) {
    // Check cache first
    const cacheKey = this.generateCacheKey(text, language, 'icd');
    const cachedResponse = this.getCachedResponse(cacheKey);
    if (cachedResponse) {
      return {
        ...cachedResponse,
        cached: true
      };
    }

    let result = {
      codes: [],
      source: 'llm'
    };

    // First, try to get suggestions from ontology
    if (this.useOntologyEnhancement) {
      try {
        const ontologySuggestions = await this.ontologyService.suggestICDCodes(text, modality, 10);
        
        if (ontologySuggestions.total_suggestions > 0) {
          // Combine text-based and modality-specific suggestions
          const allSuggestions = [
            ...ontologySuggestions.text_based_suggestions,
            ...ontologySuggestions.modality_specific_suggestions
          ];
          
          result.codes = allSuggestions.map(s => ({
            code: s.code,
            description: s.description,
            confidence: s.confidence,
            source: 'ontology'
          }));
          
          console.log(`✅ Generated ${result.codes.length} ICD codes from ontology`);
        }
      } catch (error) {
        console.warn('⚠️ Ontology ICD suggestion failed:', error.message);
      }
    }

    // Then, enhance with LLM suggestions
    try {
      const prompt = this.createICDPrompt(text, language);
      
      for (const provider of this.providers) {
        try {
          console.log(`Attempting ICD generation with ${provider.name}...`);
          const llmResult = await provider.handler(prompt, language);
          
          if (llmResult && llmResult.codes) {
            // Merge LLM codes with ontology codes
            llmResult.codes.forEach(llmCode => {
              const exists = result.codes.some(code => code.code === llmCode.code);
              if (!exists) {
                result.codes.push({
                  ...llmCode,
                  source: 'llm'
                });
              }
            });
            
            break; // Success, don't try other providers
          }
        } catch (error) {
          console.error(`${provider.name} ICD generation failed:`, error.message);
          continue;
        }
      }
    } catch (error) {
      console.error('LLM ICD generation failed:', error.message);
    }

    // Sort by confidence and limit to top 10
    result.codes.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
    result.codes = result.codes.slice(0, 10);
    
    // Cache the result
    this.setCachedResponse(cacheKey, result);
    
    return result;
  }

  /**
   * Analyze report with ontology
   */
  async analyzeReportWithOntology(reportText) {
    if (!this.useOntologyEnhancement) {
      return null;
    }

    try {
      const analysis = await this.ontologyService.analyzeReport(reportText);
      console.log(`✅ Report analyzed: ${analysis.entities.length} entities, ${analysis.relationships.length} relationships`);
      return analysis;
    } catch (error) {
      console.error('Report analysis failed:', error.message);
      return null;
    }
  }

  /**
   * Get ontology statistics
   */
  async getOntologyStatistics() {
    if (!this.useOntologyEnhancement) {
      return null;
    }

    try {
      return await this.ontologyService.getStatistics();
    } catch (error) {
      console.error('Failed to get ontology statistics:', error.message);
      return null;
    }
  }
}

// Export singleton instance
let enhancedServiceInstance = null;

function getEnhancedMultiLLMService() {
  if (!enhancedServiceInstance) {
    enhancedServiceInstance = new EnhancedMultiLLMService();
  }
  return enhancedServiceInstance;
}

module.exports = {
  EnhancedMultiLLMService,
  getEnhancedMultiLLMService
};