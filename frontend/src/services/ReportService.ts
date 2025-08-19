/**
 * Report Service - Clean Business Logic Layer
 * Separates API calls and state management from UI components
 */

import { apiService } from './apiService';
import { 
  MedicalReport, 
  PatientSummary, 
  Language, 
  TranscriptionData,
  normalizeTimestamp,
  validateApiResponse,
  MedicalReportSchema,
  PatientSummarySchema
} from '@/lib/validation';

// ==================== TYPES ====================

export type ReportState = 
  | { status: 'idle' }
  | { status: 'generating'; transcriptionId: string }
  | { status: 'enhancing'; report: MedicalReport }
  | { status: 'complete'; report: MedicalReport }
  | { status: 'error'; error: string; partialReport?: MedicalReport };

export type SummaryState = 
  | { status: 'idle' }
  | { status: 'generating'; reportId: string }
  | { status: 'complete'; summary: PatientSummary }
  | { status: 'error'; error: string };

export interface ReportServiceConfig {
  onStateChange?: (state: ReportState) => void;
  onSummaryStateChange?: (state: SummaryState) => void;
  validateResponses?: boolean;
}

// ==================== REPORT SERVICE ====================

export class ReportService {
  private reportState: ReportState = { status: 'idle' };
  private summaryState: SummaryState = { status: 'idle' };
  private config: ReportServiceConfig;

  constructor(config: ReportServiceConfig = {}) {
    this.config = {
      validateResponses: true,
      ...config
    };
  }

  // ==================== STATE MANAGEMENT ====================

  getReportState(): ReportState {
    return this.reportState;
  }

  getSummaryState(): SummaryState {
    return this.summaryState;
  }

  private setReportState(state: ReportState) {
    this.reportState = state;
    this.config.onStateChange?.(state);
    
    console.log('📊 Report State Changed:', {
      status: state.status,
      hasReport: 'report' in state,
      hasError: 'error' in state,
      timestamp: new Date().toISOString()
    });
  }

  private setSummaryState(state: SummaryState) {
    this.summaryState = state;
    this.config.onSummaryStateChange?.(state);
    
    console.log('📋 Summary State Changed:', {
      status: state.status,
      hasSummary: 'summary' in state,
      hasError: 'error' in state,
      timestamp: new Date().toISOString()
    });
  }

  // ==================== REPORT OPERATIONS ====================

  /**
   * Generates a medical report with atomic state management
   */
  async generateReport(
    transcriptionId: string,
    language: Language,
    transcriptionText: string,
    processingMode: 'cloud' | 'local' = 'cloud'
  ): Promise<void> {
    this.setReportState({ status: 'generating', transcriptionId });

    try {
      console.log('🚀 ReportService: Starting report generation');
      
      // Generate base report
      const rawReport = await apiService.generateReport(
        transcriptionId,
        language,
        transcriptionText,
        processingMode
      );

      // Validate and normalize the response
      const report = this.normalizeReport(rawReport);
      
      if (this.config.validateResponses) {
        validateApiResponse(MedicalReportSchema, report, 'Generated Report');
      }

      this.setReportState({ status: 'complete', report });

      // Auto-enhance if AI was successful
      if (report.metadata?.aiGenerated && this.shouldEnhanceFindings(report)) {
        await this.enhanceReportFindings(report);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ ReportService: Report generation failed:', errorMessage);
      
      this.setReportState({ 
        status: 'error', 
        error: errorMessage 
      });
      
      throw error;
    }
  }

  /**
   * Enhances report findings if needed
   */
  private async enhanceReportFindings(report: MedicalReport): Promise<void> {
    this.setReportState({ status: 'enhancing', report });

    try {
      const reportContent = `${report.findings}\n\n${report.impression}\n\n${report.recommendations}`;
      
      const enhancedFindings = await apiService.generateEnhancedFindings(
        report.id,
        reportContent,
        report.language
      );

      const enhancedReport: MedicalReport = {
        ...report,
        enhancedFindings: {
          ...enhancedFindings,
          timestamp: normalizeTimestamp(enhancedFindings.timestamp)
        }
      };

      if (this.config.validateResponses) {
        validateApiResponse(MedicalReportSchema, enhancedReport, 'Enhanced Report');
      }

      this.setReportState({ status: 'complete', report: enhancedReport });
      
    } catch (error) {
      console.warn('⚠️ ReportService: Enhancement failed, keeping base report:', error);
      // Keep the original report, don't fail the entire operation
      this.setReportState({ status: 'complete', report });
    }
  }

  /**
   * Determines if report needs enhanced findings
   */
  private shouldEnhanceFindings(report: MedicalReport): boolean {
    if (!report.enhancedFindings) return true;
    
    const { normalFindings, pathologicalFindings, specialObservations } = report.enhancedFindings;
    
    // Check if we have meaningful findings (not fallback)
    const hasMeaningfulFindings = (
      (normalFindings && normalFindings.length > 0) ||
      (pathologicalFindings && pathologicalFindings.length > 0) ||
      (specialObservations && specialObservations.length > 0)
    );

    // Check for fallback indicators
    const isFallback = normalFindings?.some(finding => 
      finding.includes('Strukturierte Befunde nicht verfügbar') ||
      finding.includes('Structured findings not available') ||
      finding.includes('Siehe Originalbefund')
    ) || report.enhancedFindings.processingAgent === 'fallback';

    return !hasMeaningfulFindings || isFallback;
  }

  // ==================== SUMMARY OPERATIONS ====================

  /**
   * Generates a patient summary with atomic state management
   */
  async generateSummary(
    reportId: string,
    reportContent: string,
    language: Language,
    complexity: 'simple' | 'detailed' | 'technical' = 'simple'
  ): Promise<void> {
    this.setSummaryState({ status: 'generating', reportId });

    try {
      console.log('📋 ReportService: Starting summary generation');
      
      const rawSummary = await apiService.generateSummary(
        reportId,
        reportContent,
        language,
        complexity
      );

      // Validate and normalize the response
      const summary = this.normalizeSummary(rawSummary);
      
      if (this.config.validateResponses) {
        validateApiResponse(PatientSummarySchema, summary, 'Generated Summary');
      }

      this.setSummaryState({ status: 'complete', summary });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ ReportService: Summary generation failed:', errorMessage);
      
      this.setSummaryState({ 
        status: 'error', 
        error: errorMessage 
      });
      
      throw error;
    }
  }

  // ==================== DATA NORMALIZATION ====================

  /**
   * Normalizes report data to ensure consistency
   */
  private normalizeReport(report: any): MedicalReport {
    return {
      ...report,
      generatedAt: normalizeTimestamp(report.generatedAt || report.timestamp),
      enhancedFindings: report.enhancedFindings ? {
        ...report.enhancedFindings,
        timestamp: normalizeTimestamp(report.enhancedFindings.timestamp || report.enhancedFindings.generatedAt)
      } : undefined,
      icdPredictions: report.icdPredictions ? {
        ...report.icdPredictions,
        generatedAt: normalizeTimestamp(report.icdPredictions.generatedAt)
      } : undefined
    };
  }

  /**
   * Normalizes summary data to ensure consistency
   */
  private normalizeSummary(summary: any): PatientSummary {
    return {
      ...summary,
      generatedAt: normalizeTimestamp(summary.generatedAt || summary.timestamp)
    };
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Resets all state to idle
   */
  reset(): void {
    this.setReportState({ status: 'idle' });
    this.setSummaryState({ status: 'idle' });
  }

  /**
   * Gets the current report if available
   */
  getCurrentReport(): MedicalReport | null {
    return this.reportState.status === 'complete' ? this.reportState.report : null;
  }

  /**
   * Gets the current summary if available
   */
  getCurrentSummary(): PatientSummary | null {
    return this.summaryState.status === 'complete' ? this.summaryState.summary : null;
  }

  /**
   * Checks if operations are in progress
   */
  isGenerating(): boolean {
    return this.reportState.status === 'generating' || 
           this.reportState.status === 'enhancing' ||
           this.summaryState.status === 'generating';
  }
}