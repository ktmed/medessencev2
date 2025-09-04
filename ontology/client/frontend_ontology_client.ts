/**
 * Frontend Medical Ontology Client
 * TypeScript client for real-time medical ontology integration
 */

export interface CorrectionSuggestion {
  original: string;
  suggested: string;
  confidence: number;
  category: string;
  position: number;
}

export interface AutoCompleteResult {
  suggestion: string;
  category: string;
  frequency: number;
  confidence: number;
}

export interface ExtractedEntity {
  text: string;
  category: string;
  confidence: number;
  position: number;
  context: string;
}

export interface EntityExtractionResult {
  entities: ExtractedEntity[];
  relationships: Array<{
    subject: string;
    predicate: string;
    object: string;
    position: number;
  }>;
  measurements: Array<{
    value: string;
    unit: string;
    position: number;
    context: string;
  }>;
  patterns: string[];
}

export interface TranscriptionRequest {
  text: string;
  context?: string;
  confidence_threshold?: number;
}

export interface AutoCompleteRequest {
  prefix: string;
  max_results?: number;
  category_filter?: string[];
}

export interface EntityExtractionRequest {
  text: string;
  extract_relationships?: boolean;
  extract_measurements?: boolean;
}

/**
 * Medical Ontology Client for real-time frontend integration
 */
export class MedicalOntologyClient {
  private baseUrl: string;
  private cache: Map<string, any> = new Map();
  private cacheTimeout: number = 5 * 60 * 1000; // 5 minutes
  private requestQueue: Map<string, Promise<any>> = new Map();

  constructor(baseUrl: string = 'http://localhost:8002') {
    this.baseUrl = baseUrl;
  }

  /**
   * Check if the ontology service is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      return response.ok;
    } catch (error) {
      console.warn('Ontology service not available:', error);
      return false;
    }
  }

  /**
   * Get real-time transcription corrections
   */
  async correctTranscription(
    text: string,
    context?: string,
    confidenceThreshold: number = 0.8
  ): Promise<CorrectionSuggestion[]> {
    const cacheKey = `correct:${text}:${confidenceThreshold}`;
    
    // Check cache first
    const cached = this.getCached(cacheKey);
    if (cached) {
      return cached;
    }

    // Check if request is already in progress
    if (this.requestQueue.has(cacheKey)) {
      return this.requestQueue.get(cacheKey);
    }

    const request: TranscriptionRequest = {
      text,
      context,
      confidence_threshold: confidenceThreshold
    };

    const promise = this.makeRequest<CorrectionSuggestion[]>('POST', '/correct', request);
    this.requestQueue.set(cacheKey, promise);

    try {
      const result = await promise;
      this.setCache(cacheKey, result);
      return result;
    } finally {
      this.requestQueue.delete(cacheKey);
    }
  }

  /**
   * Get auto-completion suggestions
   */
  async getAutoComplete(
    prefix: string,
    maxResults: number = 10,
    categoryFilter?: string[]
  ): Promise<AutoCompleteResult[]> {
    const cacheKey = `autocomplete:${prefix}:${maxResults}:${JSON.stringify(categoryFilter)}`;
    
    const cached = this.getCached(cacheKey);
    if (cached) {
      return cached;
    }

    if (this.requestQueue.has(cacheKey)) {
      return this.requestQueue.get(cacheKey);
    }

    const request: AutoCompleteRequest = {
      prefix,
      max_results: maxResults,
      category_filter: categoryFilter
    };

    const promise = this.makeRequest<AutoCompleteResult[]>('POST', '/autocomplete', request);
    this.requestQueue.set(cacheKey, promise);

    try {
      const result = await promise;
      this.setCache(cacheKey, result);
      return result;
    } finally {
      this.requestQueue.delete(cacheKey);
    }
  }

  /**
   * Extract structured medical entities from text
   */
  async extractEntities(
    text: string,
    extractRelationships: boolean = true,
    extractMeasurements: boolean = true
  ): Promise<EntityExtractionResult> {
    const cacheKey = `extract:${text}:${extractRelationships}:${extractMeasurements}`;
    
    const cached = this.getCached(cacheKey);
    if (cached) {
      return cached;
    }

    const request: EntityExtractionRequest = {
      text,
      extract_relationships: extractRelationships,
      extract_measurements: extractMeasurements
    };

    const result = await this.makeRequest<EntityExtractionResult>('POST', '/extract', request);
    this.setCache(cacheKey, result);
    return result;
  }

  /**
   * Expand medical abbreviations
   */
  async expandAbbreviation(abbreviation: string): Promise<string> {
    const cacheKey = `expand:${abbreviation}`;
    
    const cached = this.getCached(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const result = await this.makeRequest<{ abbreviation: string; expanded: string }>('GET', `/expand/${abbreviation}`);
      this.setCache(cacheKey, result.expanded);
      return result.expanded;
    } catch (error) {
      console.warn(`Failed to expand abbreviation ${abbreviation}:`, error);
      return abbreviation;
    }
  }

  /**
   * Get ontology statistics
   */
  async getStats(): Promise<any> {
    return this.makeRequest('GET', '/stats');
  }

  /**
   * Real-time text processing with all features
   */
  async processText(text: string, options: {
    correctSpelling?: boolean;
    extractEntities?: boolean;
    expandAbbreviations?: boolean;
    confidenceThreshold?: number;
  } = {}): Promise<{
    originalText: string;
    correctedText?: string;
    corrections?: CorrectionSuggestion[];
    entities?: EntityExtractionResult;
    expandedText?: string;
  }> {
    const {
      correctSpelling = true,
      extractEntities = true,
      expandAbbreviations = true,
      confidenceThreshold = 0.8
    } = options;

    const result = {
      originalText: text,
      correctedText: undefined as string | undefined,
      corrections: undefined as CorrectionSuggestion[] | undefined,
      entities: undefined as EntityExtractionResult | undefined,
      expandedText: undefined as string | undefined
    };

    try {
      // Get corrections if requested
      if (correctSpelling) {
        const corrections = await this.correctTranscription(text, undefined, confidenceThreshold);
        result.corrections = corrections;

        // Apply corrections to get corrected text
        if (corrections.length > 0) {
          result.correctedText = await this.applyCorrections(text, corrections);
        }
      }

      // Extract entities if requested
      if (extractEntities) {
        const textForExtraction = result.correctedText || text;
        result.entities = await this.extractEntities(textForExtraction);
      }

      // Expand abbreviations if requested
      if (expandAbbreviations) {
        const textForExpansion = result.correctedText || text;
        result.expandedText = await this.expandAbbreviationsInText(textForExpansion);
      }

    } catch (error) {
      console.error('Error processing text:', error);
    }

    return result;
  }

  /**
   * Apply corrections to text
   */
  private async applyCorrections(text: string, corrections: CorrectionSuggestion[]): Promise<string> {
    if (!corrections.length) {
      return text;
    }

    // Sort corrections by position (descending) to avoid position shifts
    const sortedCorrections = corrections.sort((a, b) => b.position - a.position);
    
    let correctedText = text;
    const words = text.match(/\b\w+\b/g) || [];
    
    for (const correction of sortedCorrections) {
      if (correction.position < words.length) {
        const wordToReplace = words[correction.position];
        correctedText = correctedText.replace(
          new RegExp(`\\b${this.escapeRegExp(wordToReplace)}\\b`),
          correction.suggested
        );
      }
    }

    return correctedText;
  }

  /**
   * Expand abbreviations in text
   */
  private async expandAbbreviationsInText(text: string): Promise<string> {
    const words = text.match(/\b[A-Z]{2,}\b/g) || []; // Find potential abbreviations
    const uniqueWords = [...new Set(words)];
    
    let expandedText = text;
    
    for (const word of uniqueWords) {
      const expanded = await this.expandAbbreviation(word);
      if (expanded !== word) {
        expandedText = expandedText.replace(
          new RegExp(`\\b${this.escapeRegExp(word)}\\b`, 'g'),
          expanded
        );
      }
    }

    return expandedText;
  }

  /**
   * Debounced auto-completion for input fields
   */
  createDebouncedAutoComplete(
    callback: (suggestions: AutoCompleteResult[]) => void,
    delay: number = 300
  ): (prefix: string, categoryFilter?: string[]) => void {
    let timeoutId: NodeJS.Timeout;

    return (prefix: string, categoryFilter?: string[]) => {
      clearTimeout(timeoutId);
      
      if (prefix.length < 2) {
        callback([]);
        return;
      }

      timeoutId = setTimeout(async () => {
        try {
          const suggestions = await this.getAutoComplete(prefix, 10, categoryFilter);
          callback(suggestions);
        } catch (error) {
          console.error('Auto-completion error:', error);
          callback([]);
        }
      }, delay);
    };
  }

  /**
   * Create real-time correction handler
   */
  createRealtimeCorrector(
    onCorrection: (corrections: CorrectionSuggestion[]) => void,
    debounceMs: number = 500
  ): (text: string) => void {
    let timeoutId: NodeJS.Timeout;

    return (text: string) => {
      clearTimeout(timeoutId);

      if (text.length < 10) {
        onCorrection([]);
        return;
      }

      timeoutId = setTimeout(async () => {
        try {
          const corrections = await this.correctTranscription(text);
          onCorrection(corrections);
        } catch (error) {
          console.error('Real-time correction error:', error);
          onCorrection([]);
        }
      }, debounceMs);
    };
  }

  /**
   * Utility methods
   */
  private async makeRequest<T>(method: string, endpoint: string, body?: any): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  private getCached<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    return null;
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });

    // Clean old cache entries
    if (this.cache.size > 1000) {
      const entries = Array.from(this.cache.entries());
      const now = Date.now();
      
      // Remove expired entries
      entries.forEach(([key, value]) => {
        if (now - value.timestamp > this.cacheTimeout) {
          this.cache.delete(key);
        }
      });

      // If still too big, remove oldest entries
      if (this.cache.size > 1000) {
        const sortedEntries = entries
          .filter(([_, value]) => now - value.timestamp <= this.cacheTimeout)
          .sort((a, b) => a[1].timestamp - b[1].timestamp);
        
        const keysToRemove = sortedEntries.slice(0, this.cache.size - 800).map(([key]) => key);
        keysToRemove.forEach(key => this.cache.delete(key));
      }
    }
  }

  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

/**
 * React Hook for Medical Ontology
 */
export function useMedicalOntology(baseUrl?: string) {
  const client = new MedicalOntologyClient(baseUrl);

  return {
    client,
    
    // Convenience methods
    correctText: (text: string, confidenceThreshold?: number) => 
      client.correctTranscription(text, undefined, confidenceThreshold),
    
    autoComplete: (prefix: string, maxResults?: number, categoryFilter?: string[]) =>
      client.getAutoComplete(prefix, maxResults, categoryFilter),
    
    extractEntities: (text: string, extractRelationships?: boolean, extractMeasurements?: boolean) =>
      client.extractEntities(text, extractRelationships, extractMeasurements),
    
    expandAbbreviation: (abbreviation: string) =>
      client.expandAbbreviation(abbreviation),
    
    processText: (text: string, options?: any) =>
      client.processText(text, options),
    
    isAvailable: () => client.isAvailable(),
    
    getStats: () => client.getStats()
  };
}

/**
 * Utility functions for UI integration
 */
export class OntologyUIUtils {
  
  /**
   * Create suggestion chips for corrections
   */
  static createCorrectionChips(corrections: CorrectionSuggestion[]): HTMLElement[] {
    return corrections.map(correction => {
      const chip = document.createElement('div');
      chip.className = 'ontology-correction-chip';
      chip.innerHTML = `
        <span class="original">${correction.original}</span>
        <span class="arrow">→</span>
        <span class="suggested">${correction.suggested}</span>
        <span class="confidence">${(correction.confidence * 100).toFixed(0)}%</span>
        <span class="category">${correction.category}</span>
      `;
      return chip;
    });
  }

  /**
   * Highlight entities in text
   */
  static highlightEntities(text: string, entities: ExtractedEntity[]): string {
    let highlightedText = text;
    
    // Sort entities by position (descending) to avoid position shifts
    const sortedEntities = entities.sort((a, b) => b.position - a.position);
    
    for (const entity of sortedEntities) {
      const beforeText = highlightedText.substring(0, entity.position);
      const entityText = entity.text;
      const afterText = highlightedText.substring(entity.position + entity.text.length);
      
      const highlightedEntity = `<span class="ontology-entity ontology-entity-${entity.category}" data-category="${entity.category}" data-confidence="${entity.confidence}">${entityText}</span>`;
      
      highlightedText = beforeText + highlightedEntity + afterText;
    }
    
    return highlightedText;
  }

  /**
   * Create auto-complete dropdown
   */
  static createAutoCompleteDropdown(suggestions: AutoCompleteResult[], onSelect: (suggestion: AutoCompleteResult) => void): HTMLElement {
    const dropdown = document.createElement('div');
    dropdown.className = 'ontology-autocomplete-dropdown';
    
    suggestions.forEach(suggestion => {
      const item = document.createElement('div');
      item.className = 'ontology-autocomplete-item';
      item.innerHTML = `
        <span class="suggestion">${suggestion.suggestion}</span>
        <span class="category">${suggestion.category}</span>
        <span class="confidence">${(suggestion.confidence * 100).toFixed(0)}%</span>
      `;
      
      item.addEventListener('click', () => onSelect(suggestion));
      dropdown.appendChild(item);
    });
    
    return dropdown;
  }
}

// Default export
export default MedicalOntologyClient;