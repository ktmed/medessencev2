/**
 * Exact Text Extractor for Medical Reports
 * Ensures all extracted content is EXACTLY from the source text
 * No modifications, no generation, no truncation
 */

class ExtractedSection {
  constructor(name, startPos, endPos, content, header) {
    this.name = name;
    this.startPos = startPos;
    this.endPos = endPos;
    this.content = content;
    this.header = header;
  }

  /**
   * Get section with surrounding context
   */
  getWithContext(fullText, before = 500, after = 200) {
    const contextStart = Math.max(0, this.startPos - before);
    const contextEnd = Math.min(fullText.length, this.endPos + after);
    return fullText.substring(contextStart, contextEnd);
  }
}

class ExactTextExtractor {
  constructor() {
    // Common section headers in German medical reports
    this.sectionHeaders = [
      // German headers
      'Indikation', 'Fragestellung', 'Klinische Angaben', 'Anamnese', 'Klinik',
      'Technik', 'Methode', 'Untersuchungstechnik', 'Protokoll',
      'Befund', 'Befunde', 'Beschreibung',
      'Beurteilung', 'Zusammenfassung', 'Bewertung', 'Schlussfolgerung',
      'Diagnose', 'Diagnosen',
      'Empfehlung', 'Procedere', 'Weiteres Vorgehen',
      'Vergleich', 'Voruntersuchung',
      'Kontrastmittel', 'KM',
      'Limitation', 'Einschränkung',
      // English headers (sometimes used)
      'Indication', 'Clinical History', 'Technique', 'Findings',
      'Impression', 'Assessment', 'Recommendation', 'Comparison'
    ];

    // Common end markers for sections
    this.endMarkers = [
      'Mit freundlichen Grüßen',
      'Mit kollegialen Grüßen',
      'Hochachtungsvoll',
      'Dr. med.',
      'Prof. Dr.',
      'Facharzt für',
      'Fachärztin für'
    ];
  }

  /**
   * Extract all sections from the report preserving exact text
   */
  extractSections(text) {
    const sections = [];
    const textLower = text.toLowerCase();
    
    // Find all potential section headers
    const potentialSections = [];
    
    for (const header of this.sectionHeaders) {
      const headerLower = header.toLowerCase();
      
      // Look for header followed by colon
      const searchPatterns = [
        headerLower + ':',
        headerLower + ' :',
        '\n' + headerLower + ':',
        '\n' + headerLower + ' :'
      ];
      
      for (const pattern of searchPatterns) {
        let pos = 0;
        while (true) {
          pos = textLower.indexOf(pattern, pos);
          if (pos === -1) break;
          
          // Find the actual header in original case
          let headerStart = pos;
          if (pattern.startsWith('\n')) {
            headerStart += 1;
          }
          
          // Find end of header (after colon)
          const headerEnd = text.indexOf(':', headerStart) + 1;
          if (headerEnd === 0) {
            pos += 1;
            continue;
          }
          
          const actualHeader = text.substring(headerStart, headerEnd).trim();
          
          potentialSections.push({
            name: header,
            header: actualHeader,
            start: headerStart,
            contentStart: headerEnd
          });
          
          pos = headerEnd;
        }
      }
    }
    
    // Sort by position
    potentialSections.sort((a, b) => a.start - b.start);
    
    // Determine section boundaries
    for (let i = 0; i < potentialSections.length; i++) {
      const section = potentialSections[i];
      const startPos = section.start;
      const contentStart = section.contentStart;
      
      // Find end of section
      let endPos;
      if (i + 1 < potentialSections.length) {
        // Next section starts
        endPos = potentialSections[i + 1].start;
      } else {
        // Look for end markers or end of text
        endPos = text.length;
        for (const marker of this.endMarkers) {
          const markerPos = text.indexOf(marker, contentStart);
          if (markerPos !== -1 && markerPos < endPos) {
            endPos = markerPos;
          }
        }
      }
      
      // Extract exact content
      const content = text.substring(contentStart, endPos).trim();
      
      if (content) {  // Only add non-empty sections
        sections.push(new ExtractedSection(
          section.name,
          startPos,
          endPos,
          content,
          section.header
        ));
      }
    }
    
    return sections;
  }

  /**
   * Extract a specific section type from the report
   */
  extractByType(text, sectionType) {
    const sections = this.extractSections(text);
    
    // Map section types to possible headers
    const typeMapping = {
      'indication': ['Indikation', 'Fragestellung', 'Klinische Angaben', 'Anamnese', 'Indication'],
      'technique': ['Technik', 'Methode', 'Untersuchungstechnik', 'Protokoll', 'Technique'],
      'findings': ['Befund', 'Befunde', 'Beschreibung', 'Findings'],
      'assessment': ['Beurteilung', 'Zusammenfassung', 'Bewertung', 'Impression', 'Assessment'],
      'recommendation': ['Empfehlung', 'Procedere', 'Weiteres Vorgehen', 'Recommendation']
    };
    
    const possibleHeaders = typeMapping[sectionType.toLowerCase()] || [];
    
    for (const section of sections) {
      if (possibleHeaders.includes(section.name)) {
        return section;
      }
    }
    
    return null;
  }

  /**
   * Find measurements in text and return exact positions
   */
  findMeasurements(text) {
    const measurements = [];
    const units = ['mm', 'cm', 'ml', 'mg', 'HU', 'kV', 'mAs', 'Tesla', 'T'];
    
    for (const unit of units) {
      let pos = 0;
      while (true) {
        pos = text.indexOf(unit, pos);
        if (pos === -1) break;
        
        // Look backwards for number
        let start = pos - 1;
        while (start >= 0 && (
          !isNaN(text[start]) || 
          text[start] === '.' || 
          text[start] === ',' || 
          text[start] === ' '
        )) {
          start--;
        }
        start++;
        
        // Look forward to complete unit
        let end = pos + unit.length;
        
        // Extend to sentence boundary
        while (end < text.length && !'.!?\n'.includes(text[end])) {
          end++;
        }
        if (end < text.length && text[end] === '.') {
          end++;
        }
        
        const measurementText = text.substring(start, end).trim();
        if (measurementText && /\d/.test(measurementText)) {
          measurements.push({
            start: start,
            end: end,
            text: measurementText
          });
        }
        
        pos = end;
      }
    }
    
    return measurements;
  }

  /**
   * Find sentences containing pathological findings
   */
  findPathologySentences(text) {
    const findings = [];
    
    // Pathological finding keywords
    const pathologyKeywords = [
      'unauffällig', 'regelrecht', 'normal', 'ohne Nachweis',
      'Tumor', 'Metastase', 'Läsion', 'Herdbefund',
      'Stenose', 'Einengung', 'Kompression',
      'Entzündung', 'Infektion', 'Abszess',
      'Fraktur', 'Ruptur', 'Riss',
      'Zyste', 'Knoten', 'Verkalkung',
      'Erguss', 'Flüssigkeit', 'Ödem'
    ];
    
    // Split text into sentences
    const sentences = [];
    let start = 0;
    for (let i = 0; i < text.length; i++) {
      if ('.!?'.includes(text[i])) {
        sentences.push({
          start: start,
          end: i + 1,
          text: text.substring(start, i + 1).trim()
        });
        start = i + 1;
      }
    }
    
    // Check each sentence for pathology keywords
    for (const sentence of sentences) {
      const sentenceLower = sentence.text.toLowerCase();
      for (const keyword of pathologyKeywords) {
        if (sentenceLower.includes(keyword.toLowerCase())) {
          findings.push(sentence);
          break;
        }
      }
    }
    
    return findings;
  }

  /**
   * Extract exact text span with validation
   */
  extractExactSpan(text, start, end) {
    if (start < 0 || end > text.length || start >= end) {
      return '';
    }
    return text.substring(start, end);
  }

  /**
   * Create a training input-output pair ensuring output is in input
   */
  createTrainingPair(text, outputStart, outputEnd, contextBefore = 500, contextAfter = 200) {
    // Extract exact output
    const output = this.extractExactSpan(text, outputStart, outputEnd);
    if (!output) {
      return null;
    }
    
    // Get context ensuring it contains the output
    let contextStart = Math.max(0, outputStart - contextBefore);
    let contextEnd = Math.min(text.length, outputEnd + contextAfter);
    
    let inputText = this.extractExactSpan(text, contextStart, contextEnd);
    
    // Validate output is in input
    if (!inputText.includes(output)) {
      // Expand context if needed
      contextStart = Math.max(0, outputStart - contextBefore * 2);
      contextEnd = Math.min(text.length, outputEnd + contextAfter * 2);
      inputText = this.extractExactSpan(text, contextStart, contextEnd);
    }
    
    if (inputText.includes(output)) {
      return {
        input: inputText,
        output: output,
        validation: {
          outputPosition: inputText.indexOf(output),
          outputInInput: true
        }
      };
    }
    
    return null;
  }
}

module.exports = { ExactTextExtractor, ExtractedSection };