/**
 * CT Scan Report Specialist Agent
 * Handles computed tomography reports
 */

const SpecializedAgent = require('./base-agent');

class CTScanAgent extends SpecializedAgent {
  constructor(multiLLMService = null) {
    super('ct_scan', multiLLMService);
    
    // Enhanced CT-specific patterns based on dataset analysis
    this.patterns = {
      contrast: /kontrastmittel|km|contrast/i,
      phases: {
        native: /nativ|ohne.?km/i,
        arterial: /arteriell|arterial/i,
        portal: /portal.?venös|portalvenous/i,
        late: /spätphase|delayed/i
      },
      reconstruction: /rekonstruktion|mpr|mip|3d/i,
      density: /(\d+)\s*(?:hu|hounsfield)/gi,
      anatomicalRegions: {
        chest: /thorax|lunge|pulmo/i,
        abdomen: /abdomen|bauch/i,
        pelvis: /becken|pelvis/i,
        head: /schädel|kopf|cranium|cerebr/i,
        neck: /hals|neck|cervical/i
      },
      pathology: {
        nodule: /knoten|nodulus|rundherd/gi,
        infiltrate: /infiltrat|verschattung/gi,
        effusion: /erguss|flüssigkeit/gi,
        embolism: /embolie|embolus/gi,
        hemorrhage: /blutung|hämatom/gi,
        fracture: /fraktur|bruch/gi,
        calcification: /verkalkung|kalzifizierung/gi
      },
      sliceThickness: /schichtdicke[:\s]*(\d+(?:[,\.]\d+)?)\s*mm/i,
      window: /fensterung|window/i
    };
  }

  /**
   * Parse CT scan report using LLM first, then exact text extraction as fallback
   */
  async parseReport(reportText, language = 'de', metadata = {}) {
    console.log(`${this.name}: Processing CT scan report`);
    
    // First try the base agent's LLM-based parsing
    try {
      if (this.llmService) {
        console.log(`${this.name}: Attempting LLM-based parsing`);
        const baseResult = await super.parseReport(reportText, language, metadata);
        
        // If LLM processing succeeded, enhance with CT scan-specific data
        if (baseResult.metadata?.aiGenerated) {
          return this.enhanceWithCTScanData(baseResult, reportText, metadata);
        }
      }
    } catch (error) {
      console.log(`${this.name}: LLM parsing failed, falling back to exact extraction:`, error.message);
    }
    
    // Fallback to exact text extraction
    console.log(`${this.name}: Using exact text extraction`);
    
    const result = {
      type: 'ct_scan',
      findings: '',
      impression: '',
      recommendations: '',
      technicalDetails: '',
      sections: {},
      contrastInfo: {},
      anatomicalFindings: {},
      densityMeasurements: [],
      pathologies: [],
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

    // Extract CT scan-specific data
    result.contrastInfo = this.extractContrastInfo(reportText);
    result.anatomicalFindings = this.extractAnatomicalFindings(reportText);
    result.densityMeasurements = this.extractDensityMeasurements(reportText);
    result.pathologies = this.extractPathologies(reportText);
    
    // Create training examples
    result.trainingExamples = this.createTrainingExamples(reportText, metadata);
    
    // Add specialized sections
    result.sections = {
      exactSections: exactSections,
      contrastProtocol: result.contrastInfo,
      regionalFindings: result.anatomicalFindings,
      measurements: result.densityMeasurements,
      comparison: this.extractComparison(reportText),
      reconstructions: this.extractReconstructionInfo(reportText),
      medicalTerms: this.extractMedicalTerms(reportText),
      pathologySentences: this.exactExtractor.findPathologySentences(reportText)
    };
    
    return result;
  }

  /**
   * Enhance LLM-generated result with CT scan-specific data
   */
  enhanceWithCTScanData(baseResult, reportText, metadata) {
    console.log(`${this.name}: Enhancing LLM result with CT scan-specific data`);
    
    // Add CT scan-specific sections to the base result
    const exactSections = this.exactExtractor.extractSections(reportText);
    baseResult.exactSections = exactSections;
    baseResult.trainingExamples = this.createTrainingExamples(reportText, metadata);
    
    // Extract CT scan-specific data
    baseResult.contrastInfo = this.extractContrastInfo(reportText);
    baseResult.anatomicalFindings = this.extractAnatomicalFindings(reportText);
    baseResult.densityMeasurements = this.extractDensityMeasurements(reportText);
    baseResult.pathologies = this.extractPathologies(reportText);
    
    // Add specialized sections
    baseResult.sections = {
      ...baseResult.sections,
      exactSections: exactSections,
      contrastProtocol: baseResult.contrastInfo,
      regionalFindings: baseResult.anatomicalFindings,
      measurements: baseResult.densityMeasurements,
      comparison: this.extractComparison(reportText),
      reconstructions: this.extractReconstructionInfo(reportText),
      medicalTerms: this.extractMedicalTerms(reportText),
      pathologySentences: this.exactExtractor.findPathologySentences(reportText)
    };
    
    return baseResult;
  }

  /**
   * Extract contrast information
   */
  extractContrastInfo(text) {
    const info = {
      used: false,
      agent: null,
      amount: null,
      phases: [],
      reactions: null
    };
    
    if (!this.patterns.contrast.test(text)) {
      return info;
    }
    
    info.used = true;
    
    // Extract contrast agent
    const agentPatterns = [
      /ultravist/i,
      /imeron/i,
      /optiray/i,
      /omnipaque/i,
      /(\d+)\s*ml\s*(?:km|kontrastmittel)/i
    ];
    
    for (const pattern of agentPatterns) {
      const match = text.match(pattern);
      if (match) {
        if (/ml/.test(match[0])) {
          info.amount = match[1] + ' ml';
        } else {
          info.agent = match[0];
        }
      }
    }
    
    // Extract phases
    for (const [phase, pattern] of Object.entries(this.patterns.phases)) {
      if (pattern.test(text)) {
        info.phases.push(phase);
      }
    }
    
    // Check for reactions
    if (/allergie|reaktion|unverträglich/i.test(text)) {
      const reactionMatch = text.match(/(?:keine\s*)?(?:allergie|reaktion|unverträglich)[^.]+/i);
      if (reactionMatch) {
        info.reactions = reactionMatch[0];
      }
    }
    
    return info;
  }

  /**
   * Extract anatomical findings by region
   */
  extractAnatomicalFindings(text) {
    const findings = {};
    
    for (const [region, pattern] of Object.entries(this.patterns.anatomicalRegions)) {
      const sentences = this.extractRegionSentences(text, pattern);
      if (sentences.length > 0) {
        findings[region] = {
          present: true,
          findings: sentences,
          pathologies: this.detectRegionPathologies(sentences.join(' '))
        };
      }
    }
    
    return findings;
  }

  /**
   * Extract sentences mentioning a region
   */
  extractRegionSentences(text, regionPattern) {
    const sentences = [];
    const sentenceRegex = /[^.!?]+[.!?]+/g;
    const allSentences = text.match(sentenceRegex) || [];
    
    for (const sentence of allSentences) {
      if (regionPattern.test(sentence)) {
        sentences.push(sentence.trim());
      }
    }
    
    return sentences;
  }

  /**
   * Extract density measurements
   */
  extractDensityMeasurements(text) {
    const measurements = [];
    const matches = [...text.matchAll(this.patterns.density)];
    
    for (const match of matches) {
      const context = text.substring(
        Math.max(0, match.index - 100),
        Math.min(text.length, match.index + match[0].length + 100)
      );
      
      // Try to identify what was measured
      const structure = this.identifyMeasuredStructure(context);
      
      measurements.push({
        value: match[1] + ' HU',
        structure: structure,
        context: context.trim()
      });
    }
    
    return measurements;
  }

  /**
   * Identify what structure was measured
   */
  identifyMeasuredStructure(context) {
    const structures = {
      'Leber': /leber|hepar/i,
      'Milz': /milz|lien/i,
      'Niere': /niere/i,
      'Lymphknoten': /lymphknoten|ln/i,
      'Flüssigkeit': /flüssigkeit|erguss|aszites/i,
      'Blut': /blut|hämatom/i,
      'Fett': /fett/i,
      'Knochen': /knochen|ossär/i,
      'Weichteile': /weichteil/i
    };
    
    for (const [name, pattern] of Object.entries(structures)) {
      if (pattern.test(context)) {
        return name;
      }
    }
    
    return 'unspecified';
  }

  /**
   * Extract pathologies
   */
  extractPathologies(text) {
    const pathologies = [];
    
    for (const [type, pattern] of Object.entries(this.patterns.pathology)) {
      if (pattern.test(text)) {
        const matches = [...text.matchAll(pattern)];
        for (const match of matches) {
          const context = text.substring(
            Math.max(0, match.index - 150),
            Math.min(text.length, match.index + match[0].length + 150)
          );
          
          // Extract size if mentioned
          const sizeMatch = context.match(/(\d+(?:[,\.]\d+)?)\s*(?:cm|mm)/);
          
          pathologies.push({
            type: type,
            term: match[0],
            size: sizeMatch ? sizeMatch[0] : null,
            location: this.extractLocation(context),
            context: context.trim()
          });
        }
      }
    }
    
    return pathologies;
  }

  /**
   * Extract location from context
   */
  extractLocation(context) {
    // Common location patterns
    const locationPatterns = {
      'rechts': /rechts|rechtsseitig|re\./i,
      'links': /links|linksseitig|li\./i,
      'beidseits': /beidseits|bilateral/i,
      'oberlappen': /oberlappen|ol/i,
      'mittellappen': /mittellappen|ml/i,
      'unterlappen': /unterlappen|ul/i,
      'segment': /segment\s*[sivx]+/i
    };
    
    const locations = [];
    
    for (const [name, pattern] of Object.entries(locationPatterns)) {
      if (pattern.test(context)) {
        locations.push(name);
      }
    }
    
    return locations.length > 0 ? locations.join(', ') : null;
  }

  /**
   * Detect region-specific pathologies
   */
  detectRegionPathologies(text) {
    const pathologies = [];
    
    for (const [type, pattern] of Object.entries(this.patterns.pathology)) {
      if (pattern.test(text)) {
        pathologies.push(type);
      }
    }
    
    return pathologies;
  }

  /**
   * Extract reconstruction information
   */
  extractReconstructionInfo(text) {
    if (!this.patterns.reconstruction.test(text)) {
      return null;
    }
    
    const info = {
      types: [],
      sliceThickness: null
    };
    
    // Check reconstruction types
    const reconTypes = {
      'MPR': /mpr|multiplanar/i,
      'MIP': /mip|maximum.?intensity/i,
      '3D': /3d.?rekonstruktion/i,
      'VRT': /vrt|volume.?rendering/i
    };
    
    for (const [type, pattern] of Object.entries(reconTypes)) {
      if (pattern.test(text)) {
        info.types.push(type);
      }
    }
    
    // Extract slice thickness
    const sliceMatch = text.match(this.patterns.sliceThickness);
    if (sliceMatch) {
      info.sliceThickness = sliceMatch[1] + ' mm';
    }
    
    return info.types.length > 0 || info.sliceThickness ? info : null;
  }

  /**
   * Extract comparison with prior studies
   */
  extractComparison(text) {
    const patterns = [
      /vergleich[^:]*:[^.]+(?:\.[^.]+)?/i,
      /im vergleich[^.]+voraufnahme[^.]+/i,
      /verlaufskontrolle[^.]+/i,
      /keine\s*voraufnahmen/i
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return match[0].trim();
      }
    }
    
    return null;
  }

  /**
   * Extract findings
   */
  extractFindings(text) {
    const patterns = [
      /befund[e]?[:\s]+([^]*?)(?:beurteilung|impression|zusammenfassung|$)/i,
      /ct.?befund[:\s]+([^]*?)(?:beurteilung|$)/i
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return this.formatCTFindings(match[1].trim());
      }
    }
    
    return '';
  }

  /**
   * Format CT findings - DEPRECATED, use exact text instead
   * @deprecated
   */
  formatCTFindings(findings) {
    // Return findings as-is to preserve exact text
    return findings;
  }

  /**
   * Extract assessment
   */
  extractAssessment(text) {
    const patterns = [
      /beurteilung[:\s]+([^]*?)(?:empfehlung|procedere|mit freundlichen|$)/i,
      /zusammenfassung[:\s]+([^]*?)(?:empfehlung|mit freundlichen|$)/i,
      /impression[:\s]+([^]*?)(?:recommendation|$)/i
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }
    
    return '';
  }

  /**
   * Extract recommendations
   */
  extractRecommendations(text) {
    const patterns = [
      /empfehlung[en]?[:\s]+([^]*?)(?:mit freundlichen|$)/i,
      /kontrolle[:\s]+([^]*?)(?:mit freundlichen|$)/i,
      /procedere[:\s]+([^]*?)(?:mit freundlichen|$)/i
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        let recommendations = match[1].trim();
        recommendations = recommendations.replace(/mit freundlichen.*$/si, '').trim();
        return recommendations;
      }
    }
    
    return '';
  }

  /**
   * Extract technical details
   */
  extractTechnicalDetails(text) {
    const details = [];
    
    // Scanner type
    const scannerMatch = text.match(/\d+.?zeilen?|slice|schicht/i);
    if (scannerMatch) {
      details.push(scannerMatch[0]);
    }
    
    // Contrast protocol
    if (this.patterns.contrast.test(text)) {
      const contrastMatch = text.match(/kontrastmittel[^.]+/i);
      if (contrastMatch) {
        details.push(contrastMatch[0]);
      }
    }
    
    // Slice thickness
    const sliceMatch = text.match(this.patterns.sliceThickness);
    if (sliceMatch) {
      details.push(`Schichtdicke: ${sliceMatch[1]} mm`);
    }
    
    // Window settings
    if (this.patterns.window.test(text)) {
      details.push('Mehrere Fensterungen');
    }
    
    return details.length > 0 
      ? details.join(', ')
      : 'Standard CT-Untersuchung';
  }
}

module.exports = CTScanAgent;