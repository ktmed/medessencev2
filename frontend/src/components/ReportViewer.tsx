'use client';

import React, { useState } from 'react';
import { FileText, Download, Edit3, Save, X, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { MedicalReport, Language } from '@/types';
import { getMedicalTerm, getLanguageName, getLanguageFlag } from '@/utils/languages';
import { formatTimestamp, cn } from '@/utils';
import MarkdownRenderer from './MarkdownRenderer';
import EnhancedFindingsNew from './EnhancedFindingsNew';
import ICDPredictionsComponent from './ICDPredictions';

interface ReportViewerProps {
  report: MedicalReport | null;
  isGenerating: boolean;
  language: Language;
  onExport?: (report: MedicalReport) => void;
  onSave?: (report: MedicalReport) => void;
  className?: string;
}

export default function ReportViewer({
  report,
  isGenerating,
  language,
  onExport,
  onSave,
  className,
}: ReportViewerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedReport, setEditedReport] = useState<MedicalReport | null>(null);

  const startEdit = () => {
    if (report) {
      setEditedReport({ ...report });
      setIsEditing(true);
    }
  };

  const cancelEdit = () => {
    setEditedReport(null);
    setIsEditing(false);
  };

  const saveEdit = () => {
    if (editedReport && onSave) {
      onSave(editedReport);
      setIsEditing(false);
      setEditedReport(null);
    }
  };

  const exportReport = () => {
    if (report && onExport) {
      onExport(report);
    } else if (report) {
      // Default export as formatted text
      const reportText = formatReportForExport(report);
      const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `medical-report-${report.id}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const formatSectionContent = (content: any): string => {
    if (!content) return '';
    
    // Handle objects and convert them to readable text
    if (typeof content === 'object') {
      try {
        // Check if it's a JSON object with useful properties
        if (content.followUp || content.request || content.findings || content.impression) {
          let result = '';
          
          if (content.findings) {
            result += `**Befund:**\n${formatContentValue(content.findings)}\n\n`;
          }
          
          if (content.impression) {
            result += `**Beurteilung:**\n${formatContentValue(content.impression)}\n\n`;
          }
          
          if (content.followUp) {
            result += `**Nachsorge:**\n${formatContentValue(content.followUp)}\n\n`;
          }
          
          if (content.request) {
            result += `**Weitere Maßnahmen:**\n${formatContentValue(content.request)}\n\n`;
          }
          
          return result.trim();
        }
        
        // For other objects, try to format as key-value pairs
        return Object.entries(content)
          .filter(([key, value]) => value && key !== '__proto__')
          .map(([key, value]) => {
            const formattedKey = key.charAt(0).toUpperCase() + key.slice(1);
            return `**${formattedKey}:**\n${formatContentValue(value)}`;
          })
          .join('\n\n');
      } catch (e) {
        return String(content);
      }
    }
    
    return String(content);
  };

  const formatContentValue = (value: any): string => {
    if (!value) return '';
    if (typeof value === 'string') {
      // Clean up string formatting issues
      return value
        .replace(/\\n/g, '\n')
        .replace(/\s+/g, ' ')
        .trim();
    }
    if (typeof value === 'object') {
      try {
        // Handle arrays
        if (Array.isArray(value)) {
          return value
            .map(item => `• ${formatContentValue(item)}`)
            .join('\n');
        }
        
        // Handle nested objects - format them nicely
        const entries = Object.entries(value).filter(([key, val]) => val && key !== '__proto__');
        if (entries.length === 0) return '';
        
        return entries
          .map(([key, val]) => {
            const formattedKey = key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1');
            return `**${formattedKey}:** ${formatContentValue(val)}`;
          })
          .join('\n\n');
      } catch (e) {
        return String(value);
      }
    }
    return String(value);
  };

  const formatReportForExport = (report: MedicalReport): string => {
    return `
MEDICAL RADIOLOGY REPORT
========================

Report ID: ${report.id}
Generated: ${formatTimestamp(report.generatedAt)}
Language: ${getLanguageName(report.language)}
${report.patientId ? `Patient ID: ${report.patientId}` : ''}

${getMedicalTerm('findings', report.language).toUpperCase()}
${'-'.repeat(getMedicalTerm('findings', report.language).length)}
${formatContentValue(report.findings)}

${getMedicalTerm('impression', report.language).toUpperCase()}  
${'-'.repeat(getMedicalTerm('impression', report.language).length)}
${formatContentValue(report.impression)}

${getMedicalTerm('recommendations', report.language).toUpperCase()}
${'-'.repeat(getMedicalTerm('recommendations', report.language).length)}
${formatContentValue(report.recommendations)}

TECHNICAL DETAILS
-----------------
${formatContentValue(report.technicalDetails)}
`.trim();
  };

  const updateEditedField = (field: keyof MedicalReport, value: string) => {
    if (editedReport) {
      setEditedReport({
        ...editedReport,
        [field]: value,
      });
    }
  };

  const currentReport = isEditing ? editedReport : report;

  // Debug logging for ICD predictions
  React.useEffect(() => {
    if (currentReport) {
      console.log('🔍 ReportViewer Debug:');
      console.log('  Has icdPredictions:', !!currentReport.icdPredictions);
      console.log('  Has sections:', !!currentReport.sections);
      console.log('  Sections length:', currentReport.sections?.length || 0);
      console.log('  Using sections path:', !!(currentReport.sections && currentReport.sections.length > 0));
      if (currentReport.icdPredictions) {
        console.log('  ICD Structure:', currentReport.icdPredictions);
        console.log('  ICD Codes Count:', currentReport.icdPredictions.codes?.length || 0);
      } else {
        console.log('  Available keys:', Object.keys(currentReport));
      }
    }
  }, [currentReport]);

  // Validate enhanced findings data - more robust checking
  const hasValidEnhancedFindings = React.useMemo(() => {
    if (!currentReport?.enhancedFindings) {
      return false;
    }

    // Primary validation - check if enhanced findings have content
    const hasContent = !!(
      (currentReport.enhancedFindings.normalFindings && currentReport.enhancedFindings.normalFindings.length > 0) ||
      (currentReport.enhancedFindings.pathologicalFindings && currentReport.enhancedFindings.pathologicalFindings.length > 0) ||
      (currentReport.enhancedFindings.specialObservations && currentReport.enhancedFindings.specialObservations.length > 0)
    );
    
    // Fallback validation - check if metadata indicates enhanced findings exist
    const metadataValidation = !!(
      currentReport?.metadata?.hasEnhancedFindings &&
      currentReport.enhancedFindings
    );
    
    const result = hasContent || metadataValidation;
    
    // Log only when enhanced findings are detected for debugging
    if (currentReport.enhancedFindings) {
      console.log('Enhanced Findings Validation:', {
        normalFindingsCount: currentReport.enhancedFindings.normalFindings?.length || 0,
        pathologicalFindingsCount: currentReport.enhancedFindings.pathologicalFindings?.length || 0,
        specialObservationsCount: currentReport.enhancedFindings.specialObservations?.length || 0,
        metadataFlag: currentReport?.metadata?.hasEnhancedFindings,
        validationResult: result
      });
    }
    
    return result;
  }, [currentReport?.enhancedFindings, currentReport?.metadata]);

  const getAgentDisplayName = (agentName: string): string => {
    if (!agentName) return 'Unknown Agent';
    
    const agentDisplayNames: { [key: string]: string } = {
      'mammography_agent': 'Mammography Specialist',
      'spine_mri_agent': 'Spine MRI Specialist', 
      'oncology_agent': 'Oncology Specialist',
      'cardiac_agent': 'Cardiac Imaging Specialist',
      'pathology_agent': 'Pathology Specialist',
      'ct_scan_agent': 'CT Scan Specialist',
      'ultrasound_agent': 'Ultrasound Specialist',
      'general_agent': 'General Radiology Agent',
      'base_agent': 'Base Medical Agent'
    };
    
    return agentDisplayNames[agentName] || `${agentName.replace(/_/g, ' ').replace(/agent/gi, '').trim()} Specialist`;
  };

  return (
    <div className={cn('medical-card', className)}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <FileText className="w-5 h-5 text-medical-600" />
          <h3 className="text-lg font-semibold text-gray-900">
            {getMedicalTerm('findings', language)} Report
          </h3>
          <span className="text-sm text-gray-500">
            {getLanguageFlag(language)} {getLanguageName(language)}
          </span>
        </div>

        <div className="flex items-center space-x-2">
          {/* Status Indicator */}
          {isGenerating ? (
            <div className="flex items-center space-x-2 px-3 py-1 bg-warning-50 rounded-full">
              <Clock className="w-4 h-4 text-warning-600 animate-spin" />
              <span className="text-sm text-warning-700">Generating...</span>
            </div>
          ) : report ? (
            <div className="flex items-center space-x-2 px-3 py-1 bg-success-50 rounded-full">
              <CheckCircle className="w-4 h-4 text-success-600" />
              <span className="text-sm text-success-700">Complete</span>
            </div>
          ) : (
            <div className="flex items-center space-x-2 px-3 py-1 bg-gray-50 rounded-full">
              <AlertTriangle className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-600">Waiting</span>
            </div>
          )}

          {/* Action Buttons */}
          {report && !isGenerating && (
            <>
              {isEditing ? (
                <>
                  <button
                    onClick={saveEdit}
                    className="p-2 text-success-600 hover:text-success-700"
                    title="Save changes"
                  >
                    <Save className="w-4 h-4" />
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="p-2 text-gray-500 hover:text-gray-700"
                    title="Cancel editing"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={startEdit}
                    className="p-2 text-gray-500 hover:text-gray-700"
                    title="Edit report"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={exportReport}
                    className="p-2 text-gray-500 hover:text-gray-700"
                    title="Export report"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Report Content */}
      <div className="space-y-6">
        {isGenerating ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin w-8 h-8 border-4 border-medical-200 border-t-medical-600 rounded-full mx-auto mb-4" />
              <p className="text-gray-600">Generating medical report from transcription...</p>
              <p className="text-sm text-gray-500 mt-2">This may take a few moments</p>
            </div>
          </div>
        ) : currentReport ? (
          <>
            {/* Agent Information Box */}
            {currentReport.metadata && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                      <span className="text-white font-bold text-sm">JS</span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <h4 className="text-sm font-semibold text-blue-900">
                        Processing Agent: {getAgentDisplayName(currentReport.metadata.agent || 'unknown')}
                      </h4>
                      {currentReport.metadata.aiGenerated && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          AI-Enhanced
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-4 mt-1 text-xs text-blue-700">
                      <span>Type: {currentReport.type || 'general'}</span>
                      {currentReport.metadata.aiProvider && (
                        <span>LLM: {currentReport.metadata.aiProvider}</span>
                      )}
                      {currentReport.classification?.confidence && (
                        <span>Confidence: {Math.round(currentReport.classification.confidence * 100)}%</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
            {/* Report Metadata */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-600">Report ID:</span>
                  <span className="ml-2 text-gray-900">{currentReport.id}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-600">Generated:</span>
                  <span className="ml-2 text-gray-900">
                    {formatTimestamp(currentReport.generatedAt)}
                  </span>
                </div>
                {currentReport.patientId && (
                  <div>
                    <span className="font-medium text-gray-600">Patient ID:</span>
                    <span className="ml-2 text-gray-900">{currentReport.patientId}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Dynamic Sections Display */}
            {currentReport.sections && currentReport.sections.length > 0 ? (
              // Use dynamic sections if available
              currentReport.sections.map((section, index) => (
                <div key={`section-${section.order}-${index}`} className="medical-report">
                  {/* Check if this is the Findings/Befund section and we have enhanced findings */}
                  {(section.title === 'Befund' || section.title === 'Findings') && hasValidEnhancedFindings ? (
                    <>
                      <h3 className="flex items-center">
                        {section.title}
                        <span className="ml-2 med-orange-gradient text-white px-2 py-1 rounded-full text-xs font-bold">
                          ENHANCED
                        </span>
                      </h3>
                      <EnhancedFindingsNew
                        enhancedFindings={currentReport.enhancedFindings!}
                        sourceContent={`${currentReport.findings}\n\n${currentReport.impression}\n\n${currentReport.recommendations}`}
                        isEditing={isEditing}
                        onContentChange={(content) => updateEditedField('findings', content)}
                      />
                    </>
                  ) : (
                    <>
                      <h3>{section.title}</h3>
                      {isEditing ? (
                        <textarea
                          value={section.content}
                          onChange={(e) => {
                            // For now, editing dynamic sections is not supported
                            // This would require updating the sections array
                          }}
                          className="medical-input min-h-[120px] resize-vertical"
                          placeholder={`Enter ${section.title.toLowerCase()}...`}
                          disabled
                        />
                      ) : (
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <MarkdownRenderer 
                            content={formatSectionContent(section.content) || `No ${section.title.toLowerCase()} recorded.`} 
                            className="text-gray-700"
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))
            ) : null}
            
            
            {!(currentReport.sections && currentReport.sections.length > 0) ? (
              // Fallback to legacy display
              <div className="space-y-6">
                {/* Enhanced Findings Section */}
                {hasValidEnhancedFindings ? (
                  <div className="medical-report">
                    <h3 className="flex items-center">
                      {getMedicalTerm('findings', language)}
                      <span className="ml-2 med-orange-gradient text-white px-2 py-1 rounded-full text-xs font-bold">
                        ENHANCED
                      </span>
                    </h3>
                    <EnhancedFindingsNew
                      enhancedFindings={currentReport.enhancedFindings!}
                      sourceContent={`${currentReport.findings}\n\n${currentReport.impression}\n\n${currentReport.recommendations}`}
                      isEditing={isEditing}
                      onContentChange={(content) => updateEditedField('findings', content)}
                    />
                  </div>
                ) : (
                  // Traditional Findings Section
                  <div className="medical-report">
                    <h3>{getMedicalTerm('findings', language)}</h3>
                    {isEditing ? (
                      <textarea
                        value={currentReport.findings}
                        onChange={(e) => updateEditedField('findings', e.target.value)}
                        className="medical-input min-h-[120px] resize-vertical"
                        placeholder={`Enter ${getMedicalTerm('findings', language).toLowerCase()}...`}
                      />
                    ) : (
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <MarkdownRenderer 
                          content={formatSectionContent(currentReport.findings) || 'No findings recorded.'} 
                          className="text-gray-700"
                        />
                      </div>
                    )}
                  </div>
                )}


                {/* Impression Section */}
                <div className="medical-report">
                  <h3>{getMedicalTerm('impression', language)}</h3>
                  {isEditing ? (
                    <textarea
                      value={currentReport.impression}
                      onChange={(e) => updateEditedField('impression', e.target.value)}
                      className="medical-input min-h-[120px] resize-vertical"
                      placeholder={`Enter ${getMedicalTerm('impression', language).toLowerCase()}...`}
                    />
                  ) : (
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <MarkdownRenderer 
                        content={formatSectionContent(currentReport.impression) || 'No impression recorded.'} 
                        className="text-gray-700"
                      />
                    </div>
                  )}
                </div>

                {/* Recommendations Section */}
                <div className="medical-report">
                  <h3>{getMedicalTerm('recommendations', language)}</h3>
                  {isEditing ? (
                    <textarea
                      value={currentReport.recommendations}
                      onChange={(e) => updateEditedField('recommendations', e.target.value)}
                      className="medical-input min-h-[120px] resize-vertical"
                      placeholder={`Enter ${getMedicalTerm('recommendations', language).toLowerCase()}...`}
                    />
                  ) : (
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <MarkdownRenderer 
                        content={formatSectionContent(currentReport.recommendations) || 'No recommendations recorded.'} 
                        className="text-gray-700"
                      />
                    </div>
                  )}
                </div>

                {/* Technical Details */}
                <details className="medical-report">
                  <summary className="cursor-pointer font-semibold text-gray-700 hover:text-gray-900">
                    Technical Details
                  </summary>
                  {isEditing ? (
                    <textarea
                      value={currentReport.technicalDetails}
                      onChange={(e) => updateEditedField('technicalDetails', e.target.value)}
                      className="medical-input min-h-[80px] resize-vertical mt-2"
                      placeholder="Enter technical details..."
                    />
                  ) : (
                    <div className="bg-gray-50 p-3 rounded mt-2">
                      <MarkdownRenderer 
                        content={formatSectionContent(currentReport.technicalDetails) || 'No technical details recorded.'} 
                        className="text-gray-600 text-sm"
                      />
                    </div>
                  )}
                </details>
              </div>
            ) : null}
          </>
        ) : (
          <div className="flex items-center justify-center h-64">
            <div className="text-center text-gray-500">
              <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium mb-2">No Report Generated</p>
              <p className="text-sm">
                Complete a transcription to generate a medical report
              </p>
            </div>
          </div>
        )}

        {/* ICD-10-GM Predictions Section - Always render after main report as separate card */}
        {currentReport && currentReport.icdPredictions && (
          <div className="mt-6">
            <ICDPredictionsComponent 
              predictions={currentReport.icdPredictions}
            />
          </div>
        )}
      </div>
    </div>
  );
}