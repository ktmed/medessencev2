/**
 * Oncology Report Agent
 * Handles oncology reports with exact text extraction
 */

const SpecializedAgent = require('./base-agent');

class OncologyAgent extends SpecializedAgent {
  constructor(multiLLMService = null) {
    super('oncology', multiLLMService);
  }

  /**
   * Parse report using LLM first, then exact text extraction as fallback
   */
  async parseReport(reportText, language = 'de', metadata = {}) {
    console.log(`${this.name}: Processing oncology report`);
    
    // First try the base agent's LLM-based parsing
    try {
      if (this.llmService) {
        console.log(`${this.name}: Attempting LLM-based parsing`);
        const baseResult = await super.parseReport(reportText, language, metadata);
        
        // If LLM processing succeeded, enhance with oncology-specific data
        if (baseResult.metadata?.aiGenerated) {
          return this.enhanceWithOncologyData(baseResult, reportText, metadata);
        }
      }
    } catch (error) {
      console.log(`${this.name}: LLM parsing failed, falling back to exact extraction:`, error.message);
    }
    
    // Fallback to exact text extraction
    console.log(`${this.name}: Using exact text extraction`);
    
    // First try to get base result with Enhanced Findings and ICD predictions
    let result;
    try {
      result = await super.parseReport(reportText, language, metadata);
      console.log(`${this.name}: Got base result with ICD predictions: ${!!result.icdPredictions}`);
    } catch (baseError) {
      console.log(`${this.name}: Base agent parsing also failed, creating minimal result:`, baseError.message);
      result = {
        type: this.type,
        findings: '',
        impression: '',
        recommendations: '',
        technicalDetails: '',
        sections: {},
        exactSections: [],
        trainingExamples: [],
        enhancedFindings: null,
        icdPredictions: null,
        metadata: {
          ...metadata,
          agent: this.name,
          language: language,
          aiGenerated: false,
          hasEnhancedFindings: false
        }
      };
    }

    // Extract exact sections
    const exactSections = this.exactExtractor.extractSections(reportText);
    result.exactSections = exactSections;
    
    // Map sections to result fields
    for (const section of exactSections) {
      if (section.name.toLowerCase() === 'befund' || section.name.toLowerCase() === 'findings') {
        result.findings = section.content;
      } else if (section.name.toLowerCase() === 'beurteilung' || section.name.toLowerCase() === 'impression') {
        result.impression = section.content;
      } else if (section.name.toLowerCase() === 'empfehlung' || section.name.toLowerCase() === 'recommendation') {
        result.recommendations = section.content;
      } else if (section.name.toLowerCase() === 'technik' || section.name.toLowerCase() === 'technique') {
        result.technicalDetails = section.content;
      }
    }
    
    // Create training examples
    result.trainingExamples = this.createTrainingExamples(reportText, metadata);
    
    // Add specialized sections
    result.sections = {
      exactSections: exactSections,
      medicalTerms: this.extractMedicalTerms(reportText),
      pathologySentences: this.exactExtractor.findPathologySentences(reportText)
    };
    
    return result;
  }

  /**
   * Enhance LLM-generated result with oncology-specific data
   */
  enhanceWithOncologyData(baseResult, reportText, metadata) {
    console.log(`${this.name}: Enhancing LLM result with oncology-specific data`);
    console.log(`🔥 ONCOLOGY DEBUG: Starting enhancement, baseResult keys:`, Object.keys(baseResult));
    console.log(`🔥 ONCOLOGY DEBUG: BaseResult has icdPredictions:`, !!baseResult.icdPredictions);
    
    // PRESERVE ALL BASE RESULT FIELDS including icdPredictions and enhancedFindings
    const enhancedResult = { ...baseResult };
    
    // Add oncology-specific sections to the base result
    const exactSections = this.exactExtractor.extractSections(reportText);
    enhancedResult.exactSections = exactSections;
    enhancedResult.trainingExamples = this.createTrainingExamples(reportText, metadata);
    
    // Add specialized sections (merge with existing sections)
    enhancedResult.sections = {
      ...enhancedResult.sections,
      exactSections: exactSections,
      medicalTerms: this.extractMedicalTerms(reportText),
      pathologySentences: this.exactExtractor.findPathologySentences(reportText)
    };
    
    // Debug log to verify ICD preservation
    console.log(`${this.name}: Enhanced result has icdPredictions: ${!!enhancedResult.icdPredictions}`);
    if (enhancedResult.icdPredictions) {
      console.log(`${this.name}: Enhanced result ICD count: ${enhancedResult.icdPredictions.codes?.length || 0}`);
    }
    
    return enhancedResult;
  }
}

module.exports = OncologyAgent;