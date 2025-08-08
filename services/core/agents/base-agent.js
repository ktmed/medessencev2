/**
 * Base Specialized Agent
 */
const { ExactTextExtractor } = require('./exact-text-extractor');
const ICDService = require('../icd/icd-service');

class SpecializedAgent {
  constructor(type, multiLLMService = null) {
    this.type = type;
    this.name = `${type}_agent`;
    this.llmService = multiLLMService;
    this.exactExtractor = new ExactTextExtractor();
    
    // Initialize ICD service if LLM service is available
    this.icdService = multiLLMService ? new ICDService(multiLLMService) : null;
  }

  /**
   * Parse report - to be overridden by specific agents
   */
  async parseReport(reportText, language = 'de', metadata = {}) {
    console.log(`${this.name}: Parsing report`);
    
    let sections;
    let aiGenerated = false;
    let aiProvider = null;
    
    // Try LLM service first if available
    if (this.llmService) {
      try {
        console.log(`${this.name}: Attempting LLM-based parsing`);
        const llmResult = await this.llmService.generateReport(reportText, language, {
          ...metadata,
          examination_type: this.type
        });
        
        sections = {
          findings: llmResult.findings || '',
          impression: llmResult.impression || '',
          recommendations: llmResult.recommendations || '',
          technical: llmResult.technicalDetails || ''
        };
        
        aiGenerated = true;
        aiProvider = llmResult.provider;
        console.log(`${this.name}: LLM parsing successful with ${aiProvider}`);
        
      } catch (error) {
        console.log(`${this.name}: LLM parsing failed, falling back to rule-based extraction:`, error.message);
        // Fall back to rule-based extraction
        sections = this.extractSections(reportText);
      }
    } else {
      // No LLM service available, use rule-based extraction
      sections = this.extractSections(reportText);
    }
    
    // Generate enhanced findings if we have AI capabilities
    let enhancedFindings = null;
    let hasEnhancedFindings = false;
    
    if (this.llmService && sections.findings) {
      try {
        enhancedFindings = await this.generateEnhancedFindings(sections.findings, language);
        hasEnhancedFindings = true;
        console.log(`${this.name}: Enhanced findings generated with ${enhancedFindings.structuredFindings.length} findings`);
      } catch (error) {
        console.log(`${this.name}: Enhanced findings generation failed, creating fallback structure:`, error.message);
        // Create fallback enhanced findings structure for frontend display
        enhancedFindings = this.createFallbackEnhancedFindings(sections.findings);
        hasEnhancedFindings = true;
        console.log(`${this.name}: Fallback enhanced findings created`);
      }
    } else if (sections.findings) {
      // Even without LLM service, create basic enhanced findings for consistent UI
      console.log(`${this.name}: No LLM service available, creating basic enhanced findings structure`);
      enhancedFindings = this.createFallbackEnhancedFindings(sections.findings);
      hasEnhancedFindings = true;
    } else if (reportText) {
      // If no sections were found, use the entire report text for Enhanced Findings
      console.log(`${this.name}: No sections extracted, using entire report text for enhanced findings`);
      enhancedFindings = this.createFallbackEnhancedFindings(reportText);
      hasEnhancedFindings = true;
    }
    
    // Generate ICD-10-GM predictions if we have findings and impression
    let icdPredictions = null;
    if (this.icdService && (sections.findings || sections.impression)) {
      try {
        console.log(`${this.name}: Generating ICD-10-GM predictions...`);
        icdPredictions = await this.icdService.predictICDCodes(
          sections.findings || '', 
          sections.impression || '', 
          this.type, 
          language
        );
        console.log(`${this.name}: Generated ${icdPredictions.codes?.length || 0} ICD codes`);
      } catch (error) {
        console.log(`${this.name}: ICD prediction failed, will use fallback:`, error.message);
        // ICD service has its own fallback mechanism
        try {
          icdPredictions = this.icdService.getFallbackICDCodes(
            sections.findings || '', 
            sections.impression || '', 
            this.type
          );
          console.log(`${this.name}: Generated ${icdPredictions.codes?.length || 0} fallback ICD codes`);
        } catch (fallbackError) {
          console.log(`${this.name}: ICD fallback also failed:`, fallbackError.message);
        }
      }
    } else {
      console.log(`${this.name}: ICD service not available or no findings/impression to process`);
    }
    
    // Format for output
    return {
      type: this.type,
      findings: sections.findings || '',
      impression: sections.impression || '',
      recommendations: sections.recommendations || '',
      technicalDetails: sections.technical || sections.technicalDetails || '',
      sections: sections,
      enhancedFindings: enhancedFindings,
      icdPredictions: icdPredictions,
      metadata: {
        ...metadata,
        agent: this.name,
        language: language,
        aiGenerated: aiGenerated,
        aiProvider: aiProvider,
        hasEnhancedFindings: hasEnhancedFindings
      }
    };
  }

  /**
   * Create fallback enhanced findings structure when LLM generation fails
   */
  createFallbackEnhancedFindings(findingsText) {
    if (!findingsText) {
      return null;
    }

    // Create basic structured findings by identifying key medical terms and phrases
    const structuredFindings = [];
    const medicalTerms = this.extractMedicalTerms(findingsText);
    
    // If we have medical terms from exact extraction, use them
    if (medicalTerms && medicalTerms.length > 0) {
      medicalTerms.forEach((term, index) => {
        // Determine significance based on keywords
        let significance = 'general';
        const termText = term.text.toLowerCase();
        
        if (termText.includes('kritisch') || termText.includes('dringend') || 
            termText.includes('sofort') || termText.includes('notfall') ||
            termText.includes('critical') || termText.includes('urgent') ||
            termText.includes('hochgradig') || termText.includes('schwerwiegend') ||
            termText.includes('malign') || termText.includes('karzinom')) {
          significance = 'critical';
        } else if (termText.includes('auffällig') || termText.includes('pathologisch') ||
                   termText.includes('verdächtig') || termText.includes('unklar') ||
                   termText.includes('stenose') || termText.includes('vorfall') ||
                   termText.includes('significant') || termText.includes('abnormal') ||
                   termText.includes('mittelgradig') || termText.includes('moderate')) {
          significance = 'significant';
        }

        // Determine category based on content
        let category = 'General';
        if (termText.includes('bandscheibe') || termText.includes('disc')) {
          category = 'Bandscheibenerkrankung';
        } else if (termText.includes('stenose') || termText.includes('stenosis')) {
          category = 'Spinalkanalstenose';
        } else if (termText.includes('spondyl')) {
          category = 'Spondylose';
        } else if (termText.includes('neuroforamen')) {
          category = 'Neuroforamenstenose';
        } else if (termText.includes('ligament')) {
          category = 'Ligamentpathologie';
        }

        structuredFindings.push({
          text: term.text.trim(),
          significance: significance,
          category: category,
          sourceSpan: {
            start: term.start || 0,
            end: term.end || term.text.length
          }
        });
      });
    } else {
      // If no medical terms found, create a single general finding
      structuredFindings.push({
        text: findingsText.trim(),
        significance: 'general',
        category: 'Befund',
        sourceSpan: {
          start: 0,
          end: findingsText.length
        }
      });
    }

    return {
      content: findingsText,
      structuredFindings: structuredFindings,
      originalText: findingsText
    };
  }

  /**
   * Generate enhanced findings with significance highlighting
   */
  async generateEnhancedFindings(findingsText, language = 'de') {
    if (!this.llmService || !findingsText) {
      return null;
    }

    const prompt = language === 'de' ? 
      `Analysiere den folgenden medizinischen Befundtext und erstelle eine strukturierte Liste von Befunden mit Signifikanz-Bewertung.

Befundtext:
"""
${findingsText}
"""

Erstelle eine JSON-Antwort mit folgender Struktur:
{
  "content": "Der vollständige Befundtext",
  "structuredFindings": [
    {
      "text": "Spezifischer Befund oder Beobachtung",
      "significance": "general|significant|critical",
      "category": "Kategorie des Befunds (z.B. Anatomie, Pathologie, Measurement)",
      "sourceSpan": {"start": 0, "end": 50}
    }
  ],
  "originalText": "Der ursprüngliche Text"
}

Signifikanz-Levels:
- "general": Normale oder unspezifische Befunde
- "significant": Auffälligkeiten die Aufmerksamkeit erfordern
- "critical": Kritische oder dringende Befunde

Gib nur gültiges JSON zurück, keine zusätzlichen Erklärungen.` :
      `Analyze the following medical findings text and create a structured list of findings with significance assessment.

Findings text:
"""
${findingsText}
"""

Create a JSON response with this structure:
{
  "content": "The complete findings text",
  "structuredFindings": [
    {
      "text": "Specific finding or observation",
      "significance": "general|significant|critical",
      "category": "Finding category (e.g. Anatomy, Pathology, Measurement)",
      "sourceSpan": {"start": 0, "end": 50}
    }
  ],
  "originalText": "The original text"
}

Significance levels:
- "general": Normal or non-specific findings
- "significant": Notable findings requiring attention
- "critical": Critical or urgent findings

Return only valid JSON, no additional explanations.`;

    try {
      const response = await this.llmService.generateResponse(prompt, {
        temperature: 0.1,
        maxTokens: 2000
      });

      // Parse the JSON response
      const enhancedFindings = JSON.parse(response.trim());
      
      // Validate the structure
      if (!enhancedFindings.structuredFindings || !Array.isArray(enhancedFindings.structuredFindings)) {
        throw new Error('Invalid enhanced findings structure');
      }

      // Ensure each finding has required fields
      enhancedFindings.structuredFindings = enhancedFindings.structuredFindings.map((finding, index) => ({
        text: finding.text || '',
        significance: finding.significance || 'general',
        category: finding.category || 'General',
        sourceSpan: finding.sourceSpan || { start: 0, end: findingsText.length }
      }));

      // Set defaults
      enhancedFindings.content = enhancedFindings.content || findingsText;
      enhancedFindings.originalText = enhancedFindings.originalText || findingsText;

      return enhancedFindings;
      
    } catch (error) {
      console.error(`Enhanced findings generation error:`, error.message);
      // Return a fallback structure
      return {
        content: findingsText,
        structuredFindings: [],
        originalText: findingsText
      };
    }
  }

  /**
   * Extract sections from report using exact text extraction
   */
  extractSections(text) {
    const sections = {};
    
    // Use exact text extractor to get sections
    const extractedSections = this.exactExtractor.extractSections(text);
    
    // Map extracted sections to expected structure
    for (const section of extractedSections) {
      if (section.name.toLowerCase() === 'indikation' || 
          section.name.toLowerCase() === 'fragestellung' ||
          section.name.toLowerCase() === 'klinische angaben') {
        sections.indication = section.content;
      } else if (section.name.toLowerCase() === 'technik' || 
                 section.name.toLowerCase() === 'methode' ||
                 section.name.toLowerCase() === 'protokoll') {
        sections.technical = section.content;
      } else if (section.name.toLowerCase() === 'befund' || 
                 section.name.toLowerCase() === 'befunde' ||
                 section.name.toLowerCase() === 'findings') {
        sections.findings = section.content;
      } else if (section.name.toLowerCase() === 'beurteilung' || 
                 section.name.toLowerCase() === 'zusammenfassung' ||
                 section.name.toLowerCase() === 'impression') {
        sections.impression = section.content;
      } else if (section.name.toLowerCase() === 'empfehlung' || 
                 section.name.toLowerCase() === 'procedere' ||
                 section.name.toLowerCase() === 'recommendation') {
        sections.recommendations = section.content;
      }
    }
    
    return sections;
  }

  /**
   * Clean extracted text - NO MODIFICATIONS for exact text matching
   * @deprecated Use exact text extraction instead
   */
  cleanExtractedText(text) {
    // Return text as-is to preserve exact matching
    return text;
  }

  /**
   * Extract medical terms with exact positions
   */
  extractMedicalTerms(text) {
    if (!text) return [];
    
    // Find pathology sentences containing medical terms
    const pathologySentences = this.exactExtractor.findPathologySentences(text);
    const terms = [];
    
    // Extract exact terms from sentences
    for (const sentence of pathologySentences) {
      // Add the exact sentence text that contains medical terms
      terms.push({
        text: sentence.text,
        start: sentence.start,
        end: sentence.end
      });
    }
    
    return terms;
  }

  /**
   * Create training examples with exact text matching
   */
  createTrainingExamples(text, metadata = {}) {
    const examples = [];
    const sections = this.exactExtractor.extractSections(text);
    
    for (const section of sections) {
      // Create training pair for each section
      const trainingPair = this.exactExtractor.createTrainingPair(
        text,
        section.startPos,
        section.endPos
      );
      
      if (trainingPair) {
        trainingPair.instruction = this.getInstructionForSection(section.name, metadata);
        trainingPair.metadata = {
          ...metadata,
          agent: this.name,
          sectionType: section.name
        };
        examples.push(trainingPair);
      }
    }
    
    return examples;
  }

  /**
   * Get instruction for a section type
   */
  getInstructionForSection(sectionName, metadata) {
    const instructions = {
      'Indikation': `Was ist die klinische Fragestellung für diese ${metadata.examination_type || this.type} Untersuchung?`,
      'Fragestellung': `Was ist die klinische Fragestellung für diese ${metadata.examination_type || this.type} Untersuchung?`,
      'Technik': 'Beschreibe die verwendete Untersuchungstechnik:',
      'Befund': `Beschreibe die Befunde dieser ${this.type} Untersuchung:`,
      'Beurteilung': 'Fasse die radiologische Beurteilung zusammen:',
      'Empfehlung': 'Welche Empfehlungen werden gegeben?'
    };
    
    return instructions[sectionName] || `Extrahiere ${sectionName}:`;
  }
}

module.exports = SpecializedAgent;