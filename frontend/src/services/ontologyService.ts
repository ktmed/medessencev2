/**
 * Real-time Ontology Service Client
 * Provides semantic medical term validation and enhancement during live transcription
 */

interface OntologyValidationResponse {
  success: boolean;
  data?: {
    enhanced_text: string;
    corrections: Array<{
      original: string;
      corrected: string;
      confidence: number;
      type: 'medical_term' | 'phonetic' | 'semantic';
    }>;
    medical_terms_detected: Array<{
      term: string;
      category: string;
      confidence: number;
      position: number;
    }>;
    quality_score: number;
    suggestions?: Array<{
      original: string;
      suggested: string;
      confidence: number;
    }>;
  };
  error?: string;
}

interface OntologyValidationRequest {
  text: string;
  language: 'de' | 'en';
  real_time: boolean;
  context?: 'transcription' | 'final';
}

class OntologyService {
  private baseUrl: string = process.env.NEXT_PUBLIC_ONTOLOGY_URL || 'http://localhost:8002';
  private cache: Map<string, { data: OntologyValidationResponse; timestamp: number }> = new Map();
  private cacheTimeout: number = 30000; // 30 seconds cache for real-time
  private requestQueue: Map<string, Promise<OntologyValidationResponse>> = new Map();
  
  /**
   * Validate and enhance text using ontology service with caching
   */
  async validateText(request: OntologyValidationRequest): Promise<OntologyValidationResponse> {
    const cacheKey = `${request.text.toLowerCase().trim()}_${request.language}_${request.context || 'transcription'}`;
    
    // Check cache first for real-time performance
    if (request.real_time) {
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }
    }

    // Check if request is already in progress (deduplication)
    const existingRequest = this.requestQueue.get(cacheKey);
    if (existingRequest) {
      return existingRequest;
    }

    // Create new request
    const requestPromise = this.makeRequest(request);
    this.requestQueue.set(cacheKey, requestPromise);

    try {
      const result = await requestPromise;
      
      // Cache successful results
      if (result.success && request.real_time) {
        this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
        
        // Cleanup old cache entries
        this.cleanupCache();
      }
      
      return result;
    } finally {
      // Remove from queue when done
      this.requestQueue.delete(cacheKey);
    }
  }

  /**
   * Make the actual HTTP request to ontology service
   */
  private async makeRequest(request: OntologyValidationRequest): Promise<OntologyValidationResponse> {
    try {
      // For real-time requests, use shorter timeout
      const timeout = request.real_time ? 2000 : 5000;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(`${this.baseUrl}/correct`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Accept': 'application/json; charset=utf-8',
        },
        body: JSON.stringify({
          text: request.text,
          context: this.detectModality(request.text),
          confidence_threshold: 0.7
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Ontology service error: ${response.status}`);
      }

      const data = await response.json();
      
      // Transform response to our format
      return this.transformResponse(data, request.text);
      
    } catch (error: any) {
      console.warn('Ontology service request failed:', error.message);
      
      // For real-time requests, fail gracefully
      if (request.real_time) {
        return {
          success: false,
          error: 'Real-time validation temporarily unavailable'
        };
      }
      
      throw error;
    }
  }

  /**
   * Transform ontology service response to our format
   */
  private transformResponse(data: any, originalText: string): OntologyValidationResponse {
    // Handle direct array response from /correct endpoint
    if (Array.isArray(data)) {
      const corrections = data.map((item: any) => ({
        original: item.original,
        corrected: item.suggested,
        confidence: item.confidence || 0.85,
        type: 'medical_term' as const
      }));

      // Build enhanced text by applying corrections
      let enhancedText = originalText;
      corrections.forEach(correction => {
        enhancedText = enhancedText.replace(correction.original, correction.corrected);
      });

      return {
        success: true,
        data: {
          enhanced_text: enhancedText,
          corrections,
          medical_terms_detected: data.filter((item: any) => item.category).map((item: any, index: number) => ({
            term: item.suggested,
            category: item.category || 'medical',
            confidence: item.confidence || 0.8,
            position: item.position || index
          })),
          quality_score: corrections.length > 0 ? 0.9 : 0.8,
          suggestions: []
        }
      };
    }

    // Handle object response format (legacy)
    if (!data.success && !data.data) {
      return { success: false, error: data.error || 'Unknown error' };
    }

    const responseData = data.data || data || {};
    
    // Extract corrections from ontology response
    const corrections: Array<{
      original: string;
      corrected: string;
      confidence: number;
      type: 'medical_term' | 'phonetic' | 'semantic';
    }> = [];

    // Check if enhanced text differs from original (indicates corrections)
    const enhancedText = responseData.enhanced_transcription || originalText;
    if (enhancedText !== originalText) {
      // Try to identify specific corrections
      corrections.push({
        original: originalText,
        corrected: enhancedText,
        confidence: responseData.confidence || 0.85,
        type: 'semantic'
      });
    }

    // Extract medical terms detected
    const medicalTerms = (responseData.extracted_findings || []).map((finding: any, index: number) => ({
      term: finding.text || finding.term,
      category: finding.category || 'medical',
      confidence: finding.confidence || 0.8,
      position: index
    }));

    return {
      success: true,
      data: {
        enhanced_text: enhancedText,
        corrections,
        medical_terms_detected: medicalTerms,
        quality_score: responseData.quality_score || responseData.confidence || 0.8,
        suggestions: responseData.suggestions || []
      }
    };
  }

  /**
   * Detect medical modality from text content
   */
  private detectModality(text: string): string {
    const content = text.toLowerCase();
    if (content.includes('mammographie') || content.includes('mammografie')) return 'mammographie';
    if (content.includes('sonographie') || content.includes('ultraschall')) return 'sonographie';
    if (content.includes(' ct ') || content.includes('computertomographie')) return 'ct';
    if (content.includes(' mrt ') || content.includes(' mr ') || content.includes('magnetresonanz')) return 'mrt';
    if (content.includes('röntgen') || content.includes('x-ray')) return 'röntgen';
    if (content.includes('echo') || content.includes('kardio')) return 'echokardiographie';
    return 'unspecified';
  }

  /**
   * Clean up old cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    this.cache.forEach((value, key) => {
      if (now - value.timestamp > this.cacheTimeout) {
        keysToDelete.push(key);
      }
    });
    
    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Check if ontology service is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1000);

      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get service statistics for diagnostics
   */
  async getStatistics(): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.warn('Failed to get ontology statistics:', error);
    }
    return null;
  }

  /**
   * Clear cache manually
   */
  clearCache(): void {
    this.cache.clear();
    this.requestQueue.clear();
  }
}

// Singleton instance
export const ontologyService = new OntologyService();

export type { OntologyValidationResponse, OntologyValidationRequest };