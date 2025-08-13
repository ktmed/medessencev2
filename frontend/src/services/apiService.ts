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

  constructor() {
    // Use current domain for API calls
    this.baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
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

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const report = await response.json();
      console.log('✅ Report generated successfully');
      console.log('- Report ID:', report.id);
      console.log('- AI Provider:', report.metadata?.aiProvider);
      
      return report;

    } catch (error) {
      console.error('❌ Failed to generate report:', error);
      throw new Error(`Report generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate patient summary (placeholder - can be implemented later)
   */
  async generateSummary(
    reportId: string,
    language: Language
  ): Promise<PatientSummary> {
    // For now, return a placeholder - can be implemented as another API route
    console.log('📋 Generating summary (placeholder)');
    
    return {
      id: `summary-${Date.now()}`,
      reportId,
      summary: language === 'de' 
        ? 'Zusammenfassung wird generiert...' 
        : 'Summary is being generated...',
      keyFindings: [],
      recommendations: [],
      language,
      generatedAt: Date.now(),
    };
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