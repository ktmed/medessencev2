/**
 * Spine MRI Report Specialist Agent
 * Handles spine MRI reports with exact text extraction
 */

const SpecializedAgent = require('./base-agent');

class SpineMRIAgent extends SpecializedAgent {
  constructor(multiLLMService = null) {
    super('spine_mri', multiLLMService);
    
    // Spine-specific patterns for identification only
    this.patterns = {
      segments: /([LBCH]WK\s*\d+(?:\/\d+)?|[LBCH]WK\s*\d+\/[SBC]WK\s*\d+)/gi,
      pathology: {
        stenosis: /stenose|einengung/i,
        herniation: /bandscheibenvorfall|prolaps|protrusion|extrusion/i,
        degeneration: /degeneration|chondrose|osteochondrose/i,
        spondylolisthesis: /spondylolisthesis|wirbelgleiten/i,
        fracture: /fraktur|bruch/i,
        edema: /ödem|knochenmarködem/i,
        tumor: /tumor|metastase|raumforderung/i
      },
      severity: {
        high: /hochgradig|schwer|erheblich|ausgeprägt/i,
        medium: /mittelgradig|mäßig|deutlich/i,
        low: /geringgradig|gering|leicht|diskret/i
      }
    };
    
    // Spine level mapping
    this.spineRegions = {
      cervical: ['HWK', 'CWK', 'C'],
      thoracic: ['BWK', 'TWK', 'T', 'Th'],
      lumbar: ['LWK', 'L'],
      sacral: ['SWK', 'S']
    };
  }

  /**
   * Parse spine MRI report using LLM first, then exact text extraction as fallback
   */
  async parseReport(reportText, language = 'de', metadata = {}) {
    console.log(`${this.name}: Processing spine MRI report`);
    
    // First try the base agent's LLM-based parsing
    try {
      if (this.llmService) {
        console.log(`${this.name}: Attempting LLM-based parsing`);
        const baseResult = await super.parseReport(reportText, language, metadata);
        
        // If LLM processing succeeded, enhance with spine MRI-specific data
        if (baseResult.metadata?.aiGenerated) {
          return this.enhanceWithSpineMRIData(baseResult, reportText, metadata);
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
        type: 'spine_mri',
        findings: '',
        impression: '',
        recommendations: '',
        technicalDetails: '',
        sections: {},
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
    
    // Add spine MRI-specific fields
    result.spineSegments = {};
    result.pathologyOverview = {};
    result.exactSections = [];
    result.trainingExamples = [];

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
    
    // Extract spine segments with exact text
    result.spineSegments = this.extractSegmentFindingsExact(reportText);
    
    // Extract pathology sentences
    result.pathologyOverview = this.extractPathologyExact(reportText);
    
    // Create training examples
    result.trainingExamples = this.createSpineTrainingExamples(reportText, metadata);
    
    // Add specialized sections
    result.sections = {
      exactSections: exactSections,
      segmentFindings: result.spineSegments,
      pathologyAnalysis: result.pathologyOverview,
      spineRegions: this.categorizeByRegion(result.spineSegments)
    };
    
    return result;
  }

  /**
   * Enhance LLM-generated result with spine MRI-specific data
   */
  enhanceWithSpineMRIData(baseResult, reportText, metadata) {
    console.log(`${this.name}: Enhancing LLM result with spine MRI-specific data`);
    
    // Add spine MRI-specific sections to the base result
    const exactSections = this.exactExtractor.extractSections(reportText);
    baseResult.exactSections = exactSections;
    baseResult.trainingExamples = this.createTrainingExamples(reportText, metadata);
    
    // Extract spine MRI-specific data
    baseResult.spineSegments = this.extractSegmentFindingsExact(reportText);
    baseResult.pathologyOverview = this.extractPathologyExact(reportText);
    
    // Add specialized sections
    baseResult.sections = {
      ...baseResult.sections,
      exactSections: exactSections,
      segmentFindings: baseResult.spineSegments,
      pathologyAnalysis: baseResult.pathologyOverview,
      spineRegions: this.categorizeByRegion(baseResult.spineSegments),
      medicalTerms: this.extractMedicalTerms(reportText),
      pathologySentences: this.exactExtractor.findPathologySentences(reportText)
    };
    
    return baseResult;
  }

  /**
   * Extract segment findings using exact text
   */
  extractSegmentFindingsExact(text) {
    const segments = {};
    
    // Find all segment mentions
    const segmentMatches = [...text.matchAll(this.patterns.segments)];
    
    for (const match of segmentMatches) {
      const segment = match[1];
      const position = match.index;
      
      // Find the sentence containing this segment
      const sentences = this.exactExtractor.findPathologySentences(text);
      
      for (const sentence of sentences) {
        if (sentence.text.includes(segment)) {
          if (!segments[segment]) {
            segments[segment] = [];
          }
          
          // Create training pair for this segment finding
          const trainingPair = this.exactExtractor.createTrainingPair(
            text,
            sentence.start,
            sentence.end
          );
          
          if (trainingPair) {
            segments[segment].push({
              segment: segment,
              exactText: sentence.text,
              inputContext: trainingPair.input,
              pathologies: this.detectPathologiesInText(sentence.text)
            });
          }
        }
      }
    }
    
    return segments;
  }

  /**
   * Extract pathology with exact text
   */
  extractPathologyExact(text) {
    const pathologies = {};
    
    // Get all pathology sentences
    const pathologySentences = this.exactExtractor.findPathologySentences(text);
    
    for (const sentence of pathologySentences) {
      // Classify pathology type
      for (const [pathType, pattern] of Object.entries(this.patterns.pathology)) {
        if (pattern.test(sentence.text)) {
          if (!pathologies[pathType]) {
            pathologies[pathType] = [];
          }
          
          // Detect severity
          let severity = 'unspecified';
          for (const [level, severityPattern] of Object.entries(this.patterns.severity)) {
            if (severityPattern.test(sentence.text)) {
              severity = level;
              break;
            }
          }
          
          // Find segments mentioned
          const segmentMatches = [...sentence.text.matchAll(this.patterns.segments)];
          const segments = segmentMatches.map(m => m[1]);
          
          pathologies[pathType].push({
            exactText: sentence.text,
            severity: severity,
            segments: segments,
            start: sentence.start,
            end: sentence.end
          });
        }
      }
    }
    
    return pathologies;
  }

  /**
   * Create spine-specific training examples
   */
  createSpineTrainingExamples(text, metadata) {
    const examples = [];
    
    // Get base training examples from parent class
    const baseExamples = this.createTrainingExamples(text, metadata);
    examples.push(...baseExamples);
    
    // Add spine-specific examples
    
    // Stenosis findings
    const stenosisFindings = this.exactExtractor.findPathologySentences(text);
    for (const finding of stenosisFindings) {
      if (/stenose|einengung/i.test(finding.text)) {
        const trainingPair = this.exactExtractor.createTrainingPair(
          text,
          finding.start,
          finding.end
        );
        
        if (trainingPair) {
          trainingPair.instruction = "Beschreibe die Stenosen in diesem MRT-Befund:";
          trainingPair.metadata = {
            ...metadata,
            agent: this.name,
            pathologyType: 'stenosis'
          };
          examples.push(trainingPair);
          break; // One example per type
        }
      }
    }
    
    // Disc herniation findings
    for (const finding of stenosisFindings) {
      if (/bandscheibenvorfall|prolaps|protrusion/i.test(finding.text)) {
        const trainingPair = this.exactExtractor.createTrainingPair(
          text,
          finding.start,
          finding.end
        );
        
        if (trainingPair) {
          trainingPair.instruction = "Beschreibe die Bandscheibenbefunde:";
          trainingPair.metadata = {
            ...metadata,
            agent: this.name,
            pathologyType: 'disc_herniation'
          };
          examples.push(trainingPair);
          break;
        }
      }
    }
    
    return examples;
  }

  /**
   * Detect pathologies in exact text
   */
  detectPathologiesInText(text) {
    const detected = [];
    
    for (const [pathType, pattern] of Object.entries(this.patterns.pathology)) {
      if (pattern.test(text)) {
        // Detect severity
        let severity = 'unspecified';
        for (const [level, severityPattern] of Object.entries(this.patterns.severity)) {
          if (severityPattern.test(text)) {
            severity = level;
            break;
          }
        }
        
        detected.push({
          type: pathType,
          severity: severity
        });
      }
    }
    
    return detected;
  }

  /**
   * Categorize segments by spine region
   */
  categorizeByRegion(segments) {
    const regions = {
      cervical: [],
      thoracic: [],
      lumbar: [],
      sacral: []
    };
    
    for (const [segment, findings] of Object.entries(segments)) {
      let categorized = false;
      
      for (const [region, prefixes] of Object.entries(this.spineRegions)) {
        for (const prefix of prefixes) {
          if (segment.includes(prefix)) {
            regions[region].push({
              segment: segment,
              findings: findings
            });
            categorized = true;
            break;
          }
        }
        if (categorized) break;
      }
    }
    
    return regions;
  }
}

module.exports = SpineMRIAgent;