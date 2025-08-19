/**
 * API Service for Vercel Functions
 * Replaces WebSocket communication with direct API calls
 */

import { MedicalReport, PatientSummary, Language } from '@/types';

interface GenerateReportRequest {
  transcriptionId: string;
  language: string;
  transcriptionText: string;
  processingMode?: 'cloud' | 'local';
}

interface GenerateReportResponse {
  report?: MedicalReport;
  error?: string;
  details?: string;
}

export class APIService {
  private baseUrl: string;
  private cache: Map<string, { data: any; timestamp: number; ttl: number }>;
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    // Use current domain for API calls
    this.baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    this.cache = new Map();
    
    // Clean up cache every 10 minutes
    if (typeof window !== 'undefined') {
      setInterval(() => this.cleanupCache(), 10 * 60 * 1000);
    }
  }

  private getCacheKey(endpoint: string, params: any): string {
    return `${endpoint}_${JSON.stringify(params)}`;
  }

  private isValidCache(item: { timestamp: number; ttl: number }): boolean {
    return Date.now() - item.timestamp < item.ttl;
  }

  private cleanupCache(): void {
    const keysToDelete: string[] = [];
    this.cache.forEach((item, key) => {
      if (!this.isValidCache(item)) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => this.cache.delete(key));
  }

  private getFromCache<T>(cacheKey: string): T | null {
    const item = this.cache.get(cacheKey);
    if (item && this.isValidCache(item)) {
      console.log('🎯 Cache hit for:', cacheKey.split('_')[0]);
      return item.data;
    }
    return null;
  }

  private setCache<T>(cacheKey: string, data: T, ttl: number = this.DEFAULT_TTL): void {
    this.cache.set(cacheKey, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  /**
   * Clear all cache - useful for debugging
   */
  clearCache(): void {
    console.log('🗑️ Clearing API service cache');
    this.cache.clear();
  }

  /**
   * Generate medical report using AI providers
   */
  async generateReport(
    transcriptionId: string,
    language: Language,
    transcriptionText: string,
    processingMode: 'cloud' | 'local' = 'cloud'
  ): Promise<MedicalReport> {
    console.log('🌐 API Service: Generating report');
    console.log('- Transcription ID:', transcriptionId);
    console.log('- Language:', language);
    console.log('- Text length:', transcriptionText.length);
    console.log('- Processing mode:', processingMode);
    
    // Always clear cache for report generation to ensure fresh data during debugging
    console.log('🗑️ Clearing cache for fresh report generation');
    this.clearCache();

    try {
      const response = await fetch(`${this.baseUrl}/api/generate-report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transcriptionId,
          language,
          transcriptionText,
          processingMode,
        } as GenerateReportRequest),
      });

      console.log('📡 API Response Status:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API Error Response:', errorText);
        try {
          const errorData = JSON.parse(errorText);
          throw new Error(errorData.error || errorData.details || `HTTP ${response.status}: ${response.statusText}`);
        } catch (e) {
          throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
        }
      }

      const report = await response.json();
      console.log('✅ Report generated successfully');
      console.log('- Report ID:', report.id);
      console.log('- AI Provider:', report.metadata?.aiProvider);
      console.log('- AI Generated:', report.metadata?.aiGenerated);
      console.log('- Report Type:', report.type);
      console.log('🔍 METADATA RECEIVED BY API SERVICE:');
      console.log('- Agent:', report.metadata?.agent);
      console.log('- Full metadata:', report.metadata);
      
      return report;

    } catch (error) {
      console.error('❌ Failed to generate report:', error);
      throw new Error(`Report generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate patient summary using AI providers
   */
  async generateSummary(
    reportId: string,
    reportContent: string,
    language: Language,
    complexity: 'simple' | 'detailed' | 'technical' = 'detailed',
    processingMode: 'cloud' | 'local' = 'cloud'
  ): Promise<PatientSummary> {
    console.log('🌐 API Service: Generating summary');
    console.log('- Report ID:', reportId);
    console.log('- Language:', language);
    console.log('- Content length:', reportContent.length);
    console.log('- Complexity:', complexity);
    console.log('- Processing mode:', processingMode);

    // Check cache first (shorter content gets longer cache)
    const cacheKey = this.getCacheKey('summary', { reportContent: reportContent.substring(0, 100), language, complexity, processingMode });
    const cached = this.getFromCache<PatientSummary>(cacheKey);
    if (cached) return cached;

    try {
      const response = await fetch(`${this.baseUrl}/api/generate-summary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reportId,
          reportContent,
          language,
          complexity,
          processingMode,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const summary = await response.json();
      console.log('✅ Summary generated successfully');
      console.log('- Summary ID:', summary.id);
      console.log('- Key findings:', summary.keyFindings.length);
      
      // Cache the result
      this.setCache(cacheKey, summary, 10 * 60 * 1000); // 10 minutes for summaries
      
      return summary;

    } catch (error) {
      console.error('❌ Failed to generate summary:', error);
      throw new Error(`Summary generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate ICD codes using AI providers
   */
  async generateICDCodes(
    reportId: string,
    reportContent: string,
    language: Language,
    codeSystem: 'ICD-10-GM' | 'ICD-10' | 'ICD-11' = 'ICD-10-GM',
    processingMode: 'cloud' | 'local' = 'cloud'
  ): Promise<import('@/types').ICDPredictions> {
    console.log('🌐 API Service: Generating ICD codes');
    console.log('- Report ID:', reportId);
    console.log('- Language:', language);
    console.log('- Content length:', reportContent.length);
    console.log('- Code system:', codeSystem);
    console.log('- Processing mode:', processingMode);

    // Check cache first
    const cacheKey = this.getCacheKey('icd', { reportContent: reportContent.substring(0, 150), language, codeSystem, processingMode });
    const cached = this.getFromCache<import('@/types').ICDPredictions>(cacheKey);
    if (cached) return cached;

    try {
      const response = await fetch(`${this.baseUrl}/api/generate-icd`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reportId,
          reportContent,
          language,
          codeSystem,
          processingMode,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const icdCodes = await response.json();
      console.log('✅ ICD codes generated successfully');
      console.log('- Total codes:', icdCodes.codes?.length || 0);
      console.log('- Primary diagnoses:', icdCodes.summary?.primaryDiagnoses || 0);
      console.log('- Provider:', icdCodes.provider);
      
      // Cache the result (longer cache for ICD codes)
      this.setCache(cacheKey, icdCodes, 15 * 60 * 1000); // 15 minutes for ICD codes
      
      return icdCodes;

    } catch (error) {
      console.error('❌ Failed to generate ICD codes:', error);
      throw new Error(`ICD code generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate enhanced findings using AI providers
   */
  async generateEnhancedFindings(
    reportId: string,
    reportContent: string,
    language: Language
  ): Promise<import('@/types').EnhancedFindings> {
    console.log('🌐 API Service: Generating enhanced findings');
    console.log('- Report ID:', reportId);
    console.log('- Language:', language);
    console.log('- Content length:', reportContent.length);

    // Check cache first
    const cacheKey = this.getCacheKey('enhanced-findings', { reportContent: reportContent.substring(0, 100), language });
    const cached = this.getFromCache<import('@/types').EnhancedFindings>(cacheKey);
    if (cached) return cached;

    try {
      const response = await fetch(`${this.baseUrl}/api/generate-enhanced-findings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reportId,
          reportContent,
          language,
        }),
      });

      console.log('📡 Enhanced Findings API Response Status:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Enhanced Findings API Error Response:', errorText);
        try {
          const errorData = JSON.parse(errorText);
          throw new Error(errorData.error || errorData.details || `HTTP ${response.status}: ${response.statusText}`);
        } catch (e) {
          throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
        }
      }

      const enhancedFindings = await response.json();
      console.log('✅ Enhanced findings generated successfully');
      console.log('- Normal findings count:', enhancedFindings.normalFindings?.length || 0);
      console.log('- Pathological findings count:', enhancedFindings.pathologicalFindings?.length || 0);
      
      // Cache the result (longer cache for enhanced findings)
      this.setCache(cacheKey, enhancedFindings, 20 * 60 * 1000); // 20 minutes for enhanced findings
      
      return enhancedFindings;

    } catch (error) {
      console.error('❌ Failed to generate enhanced findings:', error);
      throw new Error(`Enhanced findings generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check API health
   */
  async checkHealth(): Promise<{ status: string; timestamp: number }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/health`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ API health check passed');
      
      return {
        status: 'healthy',
        timestamp: Date.now(),
        ...data
      };

    } catch (error) {
      console.error('❌ API health check failed:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const apiService = new APIService();