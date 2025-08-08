/**
 * Pathology Report Agent
 * Handles pathology reports with exact text extraction
 */

const SpecializedAgent = require('./base-agent');

class PathologyAgent extends SpecializedAgent {
  constructor(multiLLMService = null) {
    super('pathology', multiLLMService);
  }

  /**
   * Parse report using LLM first, then exact text extraction as fallback
   */
  async parseReport(reportText, language = 'de', metadata = {}) {
    console.log(`${this.name}: Processing pathology report`);
    
    // First try the base agent's LLM-based parsing
    try {
      if (this.llmService) {
        console.log(`${this.name}: Attempting LLM-based parsing`);
        const baseResult = await super.parseReport(reportText, language, metadata);
        
        // If LLM processing succeeded, enhance with pathology-specific data
        if (baseResult.metadata?.aiGenerated) {
          return this.enhanceWithPathologyData(baseResult, reportText, metadata);
        }
      }
    } catch (error) {
      console.log(`${this.name}: LLM parsing failed, falling back to exact extraction:`, error.message);
    }
    
    // Fallback to exact text extraction
    console.log(`${this.name}: Using exact text extraction`);
    
    const result = {
      type: this.type,
      findings: '',
      impression: '',
      recommendations: '',
      technicalDetails: '',
      sections: {},
      exactSections: [],
      trainingExamples: [],
      metadata: {
        ...metadata,
        agent: this.name,
        language: language
      }
    };

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
   * Enhance LLM-generated result with pathology-specific data
   */
  enhanceWithPathologyData(baseResult, reportText, metadata) {
    console.log(`${this.name}: Enhancing LLM result with pathology-specific data`);
    
    // Add pathology-specific sections to the base result
    const exactSections = this.exactExtractor.extractSections(reportText);
    baseResult.exactSections = exactSections;
    baseResult.trainingExamples = this.createTrainingExamples(reportText, metadata);
    
    // Add specialized sections
    baseResult.sections = {
      ...baseResult.sections,
      exactSections: exactSections,
      medicalTerms: this.extractMedicalTerms(reportText),
      pathologySentences: this.exactExtractor.findPathologySentences(reportText)
    };
    
    return baseResult;
  }
}

module.exports = PathologyAgent;