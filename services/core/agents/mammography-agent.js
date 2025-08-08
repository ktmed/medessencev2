/**
 * Mammography Report Specialist Agent
 * Handles mammography and breast ultrasound reports with exact text extraction
 */

const SpecializedAgent = require('./base-agent');

class MammographyAgent extends SpecializedAgent {
  constructor(multiLLMService = null) {
    super('mammography', multiLLMService);
    
    // Mammography-specific patterns
    this.patterns = {
      mammography: /(?:digitale\s*)?(?:vollfeld-)?mammographie[^:]*:([\s\S]*?)(?=hochfrequenz|sonographie|beurteilung|empfehlung|mit freundlichen|$)/i,
      ultrasound: /(?:hochfrequenz)?sonographie[^:]*:([\s\S]*?)(?=beurteilung|empfehlung|mit freundlichen|$)/i,
      birads: /kategorie\s*(rechts|links|beidseits|bds\.?)\s*(\d+)/gi,
      density: /brustdichte\s*([a-d]|[a-d]\s*-\s*[a-d])/i,
      findings: {
        calcification: /(?:mikro)?verkalkung|kalk/i,
        mass: /herd|raumforderung|tumor|knoten/i,
        fibroadenoma: /fibroadenom/i,
        cyst: /zyste/i,
        asymmetry: /asymmetrie/i
      }
    };
  }

  /**
   * Parse mammography report using LLM first, then exact text extraction as fallback
   */
  async parseReport(reportText, language = 'de', metadata = {}) {
    console.log(`${this.name}: Processing mammography report`);
    
    // First try the base agent's LLM-based parsing
    try {
      if (this.llmService) {
        console.log(`${this.name}: Attempting LLM-based parsing`);
        const baseResult = await super.parseReport(reportText, language, metadata);
        
        // If LLM processing succeeded, enhance with mammography-specific data
        if (baseResult.metadata?.aiGenerated) {
          return this.enhanceWithMammographyData(baseResult, reportText, metadata);
        }
      }
    } catch (error) {
      console.log(`${this.name}: LLM parsing failed, falling back to exact extraction:`, error.message);
    }
    
    // Fallback to exact text extraction
    console.log(`${this.name}: Using exact text extraction`);
    
    const result = {
      type: 'mammography',
      findings: '',
      impression: '',
      recommendations: '',
      technicalDetails: '',
      sections: {},
      biradsClassification: null,
      breastDensity: null,
      lesions: [],
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
    
    // Extract BI-RADS with exact text
    result.biradsClassification = this.extractBiradsExact(reportText);
    
    // Extract breast density with exact text
    result.breastDensity = this.extractDensityExact(reportText);
    
    // Extract lesions with exact text
    result.lesions = this.extractLesionsExact(reportText);
    
    // Create training examples
    result.trainingExamples = this.createMammographyTrainingExamples(reportText, metadata);
    
    // Add specialized sections
    result.sections = {
      exactSections: exactSections,
      birads: result.biradsClassification,
      density: result.breastDensity,
      lesions: result.lesions
    };
    
    return result;
  }

  /**
   * Enhance LLM-generated result with mammography-specific data
   */
  enhanceWithMammographyData(baseResult, reportText, metadata) {
    console.log(`${this.name}: Enhancing LLM result with mammography-specific data`);
    
    // Add mammography-specific sections to the base result
    const exactSections = this.exactExtractor.extractSections(reportText);
    baseResult.exactSections = exactSections;
    baseResult.trainingExamples = this.createTrainingExamples(reportText, metadata);
    
    // Extract BI-RADS and other mammography-specific data
    baseResult.biradsClassification = this.extractBiradsExact(reportText);
    baseResult.breastDensity = this.extractBreastDensity(reportText);
    baseResult.lesions = this.extractLesionsExact(reportText);
    
    // Add specialized sections
    baseResult.sections = {
      ...baseResult.sections,
      exactSections: exactSections,
      medicalTerms: this.extractMedicalTerms(reportText),
      pathologySentences: this.exactExtractor.findPathologySentences(reportText)
    };
    
    return baseResult;
  }

  /**
   * Comprehensive extraction when LLM is not available
   */
  comprehensiveExtraction(reportText, language, metadata) {
    // Extract all sections
    const sections = this.extractAllSections(reportText);
    
    // Build comprehensive findings
    let findings = '';
    
    // Add clinical history
    if (sections.clinicalHistory) {
      findings += '**Klinische Angaben und Anamnese:**\n' + sections.clinicalHistory + '\n\n';
    }
    
    // Add clinical examination
    if (sections.clinicalExam) {
      findings += '**Klinischer Untersuchungsbefund:**\n' + sections.clinicalExam + '\n\n';
    }
    
    // Add technical details at the beginning if found
    if (sections.technical) {
      findings += '**Technische Details:**\n' + sections.technical + '\n\n';
    }
    
    // Add mammography findings
    if (sections.mammography) {
      findings += '**Mammographie:**\n' + sections.mammography + '\n\n';
    }
    
    // Add ultrasound findings
    if (sections.ultrasound) {
      findings += '**Sonographie:**\n' + sections.ultrasound + '\n\n';
    }
    
    // Extract structured data
    const birads = this.extractBiradsExact(reportText);
    const breastDensity = this.extractBreastDensity(reportText);
    
    return {
      type: this.type,
      findings: findings.trim(),
      impression: sections.assessment || 'Siehe Befund.',
      recommendations: sections.recommendations || 'Weitere klinische Korrelation empfohlen.',
      technicalDetails: sections.technical || '',
      birads: birads,
      breastDensity: breastDensity,
      sections: sections,
      metadata: {
        ...metadata,
        agent: this.name,
        language: language,
        aiGenerated: false
      }
    };
  }

  /**
   * Extract all sections from the report
   */
  extractAllSections(text) {
    const sections = {};
    
    // Clinical history and indication
    const historyPatterns = [
      /klinik\s*und\s*rechtfertigende\s*indikation(?:sstellung)?[:\s]*([\s\S]*?)(?=klinisch|digitale|mammographie|mammadiagnostik|$)/i,
      /indikation[:\s]*([\s\S]*?)(?=klinisch|digitale|mammographie|$)/i
    ];
    
    for (const pattern of historyPatterns) {
      const match = text.match(pattern);
      if (match && match[1].trim()) {
        sections.clinicalHistory = this.cleanText(match[1]);
        break;
      }
    }
    
    // Clinical examination
    const examPatterns = [
      /klinischer\s*untersuchungsbefund[:\s]*([\s\S]*?)(?=digitale|mammographie|mammadiagnostik|$)/i,
      /klinisch[:\s]*([\s\S]*?)(?=digitale|mammographie|$)/i
    ];
    
    for (const pattern of examPatterns) {
      const match = text.match(pattern);
      if (match && match[1].trim()) {
        sections.clinicalExam = this.cleanText(match[1]);
        break;
      }
    }
    
    // Technical details - look for various patterns
    const techPatterns = [
      /mammadiagnostik[^:]*vom[^:]+\s*([^:]+)(?=:)/i,
      /(?:dig\.\s*)?(?:vollfeld-)?mammographie\s*([^:]+)(?=:)/i
    ];
    
    for (const pattern of techPatterns) {
      const match = text.match(pattern);
      if (match && match[1].trim()) {
        sections.technical = this.cleanText(match[1]);
        break;
      }
    }
    
    // Mammography findings
    const mammoPatterns = [
      /(?:dig\.\s*)?(?:vollfeld-)?mammographie[^:]*:([\s\S]*?)(?=hochfrequenz|sonographie|beurteilung|empfehlung|mit freundlichen|$)/i,
      /mammographie[^:]*:([\s\S]*?)(?=hochfrequenz|sonographie|beurteilung|$)/i
    ];
    
    for (const pattern of mammoPatterns) {
      const match = text.match(pattern);
      if (match && match[1].trim()) {
        sections.mammography = this.cleanText(match[1]);
        break;
      }
    }
    
    // Ultrasound findings
    const sonoPatterns = [
      /hochfrequenzsonographie[^:]*:([\s\S]*?)(?=beurteilung|empfehlung|mit freundlichen|$)/i,
      /sonographie[^:]*:([\s\S]*?)(?=beurteilung|empfehlung|$)/i
    ];
    
    for (const pattern of sonoPatterns) {
      const match = text.match(pattern);
      if (match && match[1].trim()) {
        sections.ultrasound = this.cleanText(match[1]);
        break;
      }
    }
    
    // Assessment/Beurteilung
    const assessmentPatterns = [
      /beurteilung(?:\s*und\s*empfehlung)?[:\s]*([\s\S]*?)(?=empfehlung|mit freundlichen|$)/i,
      /beurteilung[:\s]*([\s\S]*?)(?=mit freundlichen|$)/i
    ];
    
    for (const pattern of assessmentPatterns) {
      const match = text.match(pattern);
      if (match && match[1].trim() && !match[1].includes('Empfehlung:')) {
        sections.assessment = this.cleanText(match[1]);
        break;
      }
    }
    
    // Recommendations
    const recommendationPatterns = [
      /empfehlung[:\s]*([\s\S]*?)(?=mit freundlichen|befundergänzung|$)/i,
      /procedere[:\s]*([\s\S]*?)(?=mit freundlichen|$)/i
    ];
    
    for (const pattern of recommendationPatterns) {
      const match = text.match(pattern);
      if (match && match[1].trim()) {
        sections.recommendations = this.cleanText(match[1]);
        break;
      }
    }
    
    // Look for supplement/addendum
    const supplementPattern = /befundergänzung[^:]*:([\s\S]*?)(?=mit freundlichen|$)/i;
    const supplementMatch = text.match(supplementPattern);
    if (supplementMatch) {
      sections.recommendations = (sections.recommendations || '') + '\n\n**Befundergänzung:**\n' + this.cleanText(supplementMatch[1]);
    }
    
    return sections;
  }

  /**
   * Extract BI-RADS using exact text
   */
  extractBiradsExact(text) {
    const sentences = this.exactExtractor.findPathologySentences(text);
    const birads = {
      right: null,
      left: null,
      overall: null,
      exactText: null
    };
    
    for (const sentence of sentences) {
      // Look for BI-RADS categories
      const categoryPattern = /kategorie\s*(?:rechts|r\.?)\s*(\d+)[,\s]*(?:links|l\.?)\s*(\d+)/i;
      const match = sentence.text.match(categoryPattern);
      
      if (match) {
        birads.right = parseInt(match[1]);
        birads.left = parseInt(match[2]);
        birads.exactText = sentence.text;
        birads.position = { start: sentence.start, end: sentence.end };
        break;
      }
      
      // Try individual matches
      const rightMatch = sentence.text.match(/kategorie\s*(?:rechts|r\.?)\s*(\d+)/i);
      const leftMatch = sentence.text.match(/kategorie\s*(?:links|l\.?)\s*(\d+)/i);
      const bothMatch = sentence.text.match(/kategorie\s*(?:beidseits|bds\.?)\s*(\d+)/i);
      
      if (rightMatch || leftMatch || bothMatch) {
        if (rightMatch) birads.right = parseInt(rightMatch[1]);
        if (leftMatch) birads.left = parseInt(leftMatch[1]);
        if (bothMatch) {
          birads.right = birads.left = parseInt(bothMatch[1]);
        }
        birads.exactText = sentence.text;
        birads.position = { start: sentence.start, end: sentence.end };
        break;
      }
    }
    
    // Set overall as highest category
    if (birads.right || birads.left) {
      birads.overall = Math.max(birads.right || 0, birads.left || 0);
    }
    
    return birads.exactText ? birads : null;
  }

  /**
   * Extract breast density using exact text
   */
  extractBreastDensity(text) {
    return this.extractDensityExact(text);
  }

  /**
   * Extract breast density using exact text
   */
  extractDensityExact(text) {
    const sentences = this.exactExtractor.findPathologySentences(text);
    
    for (const sentence of sentences) {
      const densityMatch = sentence.text.match(/brustdichte\s*([a-d](?:\s*-\s*[a-d])?)/i);
      if (densityMatch) {
        return {
          category: densityMatch[1].toUpperCase(),
          exactText: sentence.text,
          position: { start: sentence.start, end: sentence.end }
        };
      }
    }
    
    return null;
  }

  /**
   * Extract lesions using exact text
   */
  extractLesionsExact(text) {
    const lesions = [];
    const sentences = this.exactExtractor.findPathologySentences(text);
    
    for (const sentence of sentences) {
      let lesionType = null;
      
      // Check for lesion types
      for (const [type, pattern] of Object.entries(this.patterns.findings)) {
        if (pattern.test(sentence.text)) {
          lesionType = type;
          break;
        }
      }
      
      if (lesionType) {
        // Extract measurements if any
        const measurements = this.exactExtractor.findMeasurements(sentence.text);
        
        lesions.push({
          type: lesionType,
          exactText: sentence.text,
          measurements: measurements.map(m => m.text),
          position: { start: sentence.start, end: sentence.end }
        });
      }
    }
    
    return lesions;
  }

  /**
   * Create mammography-specific training examples
   */
  createMammographyTrainingExamples(text, metadata) {
    const examples = [];
    
    // Get base training examples from parent class
    const baseExamples = this.createTrainingExamples(text, metadata);
    examples.push(...baseExamples);
    
    // Add mammography-specific examples
    
    // BI-RADS classification
    const birads = this.extractBiradsExact(text);
    if (birads) {
      const trainingPair = this.exactExtractor.createTrainingPair(
        text,
        birads.position.start,
        birads.position.end
      );
      
      if (trainingPair) {
        trainingPair.instruction = "Welche BI-RADS Klassifikation wurde vergeben?";
        trainingPair.metadata = {
          ...metadata,
          agent: this.name,
          extractionType: 'birads'
        };
        examples.push(trainingPair);
      }
    }
    
    // Breast density
    const density = this.extractDensityExact(text);
    if (density) {
      const trainingPair = this.exactExtractor.createTrainingPair(
        text,
        density.position.start,
        density.position.end
      );
      
      if (trainingPair) {
        trainingPair.instruction = "Welche Brustdichte liegt vor?";
        trainingPair.metadata = {
          ...metadata,
          agent: this.name,
          extractionType: 'density'
        };
        examples.push(trainingPair);
      }
    }
    
    return examples;
  }

  /**
   * Clean extracted text - DEPRECATED
   * @deprecated Use exact text extraction instead
   */
  cleanText(text) {
    return text;
  }
}

module.exports = MammographyAgent;