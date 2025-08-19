'use client';

import React, { useState } from 'react';
import { 
  Users, 
  Download, 
  RefreshCw, 
  CheckCircle, 
  Clock, 
  AlertTriangle,
  Heart,
  Activity,
  Stethoscope,
  Edit3,
  Save,
  X
} from 'lucide-react';
import { PatientSummary, Language, MedicalReport } from '@/types';
import { getMedicalTerm, getLanguageName, getLanguageFlag, SUPPORTED_LANGUAGES } from '@/utils/languages';
import { formatTimestamp, cn } from '@/utils';
import MarkdownRenderer from './MarkdownRenderer';

interface SummaryGeneratorProps {
  summary: PatientSummary | null;
  report: MedicalReport | null;
  isGenerating: boolean;
  language: Language;
  onGenerate?: (reportId: string, language: Language, complexity?: 'simple' | 'detailed' | 'technical') => void;
  onExport?: (summary: PatientSummary) => void;
  onLanguageChange?: (language: Language) => void;
  className?: string;
}

export default function SummaryGenerator({
  summary,
  report,
  isGenerating,
  language,
  onGenerate,
  onExport,
  onLanguageChange,
  className,
}: SummaryGeneratorProps) {
  const [selectedLanguage, setSelectedLanguage] = useState<Language>(language);
  // Always use simple complexity for friendly summaries
  const selectedComplexity = 'simple' as const;
  const [isEditing, setIsEditing] = useState(false);
  const [editedSummary, setEditedSummary] = useState<PatientSummary | null>(null);

  // Sync selectedLanguage with parent language prop changes
  React.useEffect(() => {
    console.log('🔄 SummaryGenerator: Parent language changed to:', language);
    setSelectedLanguage(language);
  }, [language]);

  const handleGenerate = () => {
    console.log('🔍 DEBUG: Generating summary with language:', selectedLanguage, 'complexity:', selectedComplexity);
    if (report && onGenerate) {
      onGenerate(report.id, selectedLanguage, selectedComplexity);
    }
  };

  const handleLanguageChange = (newLanguage: Language) => {
    setSelectedLanguage(newLanguage);
    onLanguageChange?.(newLanguage);
  };

  const startEdit = () => {
    if (summary) {
      setEditedSummary({ ...summary });
      setIsEditing(true);
    }
  };

  const cancelEdit = () => {
    setEditedSummary(null);
    setIsEditing(false);
  };

  const saveEdit = () => {
    // Note: This is a simple client-side edit without API persistence
    // For full implementation, you'd want to add an onSave prop and API endpoint
    console.log('Summary edited locally:', editedSummary);
    setIsEditing(false);
    setEditedSummary(null);
  };

  const updateKeyFinding = (index: number, value: string) => {
    if (editedSummary) {
      const newKeyFindings = [...editedSummary.keyFindings];
      newKeyFindings[index] = value;
      setEditedSummary({ ...editedSummary, keyFindings: newKeyFindings });
    }
  };

  const updateRecommendation = (index: number, value: string) => {
    if (editedSummary) {
      const newRecommendations = [...editedSummary.recommendations];
      newRecommendations[index] = value;
      setEditedSummary({ ...editedSummary, recommendations: newRecommendations });
    }
  };

  const exportSummary = () => {
    if (summary && onExport) {
      onExport(summary);
    } else if (summary) {
      // Default export as formatted text
      const summaryText = formatSummaryForExport(summary);
      const blob = new Blob([summaryText], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `patient-summary-${summary.id}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const formatSummaryForExport = (summary: PatientSummary): string => {
    const headerText = getMedicalTerm('patientSummary', summary.language).toUpperCase();
    return `
${headerText}
${'='.repeat(headerText.length)}

${getMedicalTerm('summaryId', summary.language)}: ${summary.id}
${getMedicalTerm('reportId', summary.language)}: ${summary.reportId}
${getMedicalTerm('generated', summary.language)}: ${formatTimestamp(summary.generatedAt)}
${getMedicalTerm('language', summary.language)}: ${getLanguageName(summary.language)}

${getMedicalTerm('summary', summary.language).toUpperCase()}
${'-'.repeat(getMedicalTerm('summary', summary.language).length)}
${summary.summary}

${getMedicalTerm('keyFindings', summary.language).toUpperCase()}
${'-'.repeat(getMedicalTerm('keyFindings', summary.language).length)}
${summary.keyFindings && summary.keyFindings.length > 0 
  ? summary.keyFindings.map(finding => `• ${finding}`).join('\n')
  : getMedicalTerm('noDataAvailable', summary.language)}

${getMedicalTerm('recommendations', summary.language).toUpperCase()}
${'-'.repeat(getMedicalTerm('recommendations', summary.language).length)}
${summary.recommendations && summary.recommendations.length > 0 
  ? summary.recommendations.map(rec => `• ${rec}`).join('\n')
  : getMedicalTerm('noDataAvailable', summary.language)}

---
${getMedicalTerm('reviewWithProvider', summary.language)}
`.trim();
  };

  return (
    <div className={cn('medical-card', className)}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Users className="w-5 h-5 text-navy-600" />
          <h3 className="text-lg font-semibold med-text-navy">
            Patient {getMedicalTerm('summary', language)}
          </h3>
          <span className="text-sm text-gray-500">
            {getLanguageFlag(selectedLanguage)} {getLanguageName(selectedLanguage)}
          </span>
        </div>

        <div className="flex items-center space-x-2">
          {/* Status Indicator */}
          {isGenerating ? (
            <div className="flex items-center space-x-2 px-3 py-1 bg-warning-50 rounded-full">
              <Clock className="w-4 h-4 text-warning-600 animate-spin" />
              <span className="text-sm text-warning-700">Generating...</span>
            </div>
          ) : summary ? (
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
          {summary && !isGenerating && (
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
                    title="Edit summary"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={exportSummary}
                    className="p-2 text-gray-500 hover:text-gray-700"
                    title="Export summary"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Language Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium med-text-navy mb-3">
          Summary Language
        </label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {SUPPORTED_LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleLanguageChange(lang.code)}
              className={cn(
                'px-3 py-2.5 rounded-lg text-sm font-medium border transition-all duration-200 flex items-center justify-center space-x-2',
                selectedLanguage === lang.code
                  ? 'med-navy-gradient text-white border-transparent shadow-md'
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 hover:shadow-sm'
              )}
            >
              <span className="text-base">{lang.flag}</span>
              <span className="truncate">{lang.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Summary Type Info */}
      <div className="mb-6 p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-xl border border-green-200">
        <div className="flex items-center space-x-3">
          <div className="text-2xl p-2 rounded-lg bg-white/50">
            👤
          </div>
          <div>
            <div className="font-semibold text-gray-900 mb-1">
              Patient-Friendly Summary
            </div>
            <div className="text-sm text-gray-600">
              Easy to understand, friendly language for patient communication
            </div>
          </div>
        </div>
      </div>

      {/* Generate Button */}
      {report && !summary && !isGenerating && (
        <div className="mb-8 text-center">
          <button
            onClick={handleGenerate}
            className="medical-button-primary flex items-center justify-center space-x-2 w-full py-3 text-base font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
          >
            <RefreshCw className="w-5 h-5" />
            <span>Generate Patient Summary</span>
          </button>
          <div className="mt-3 p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-700 font-medium">
              📋 Creating <span className="text-medical-600">{selectedComplexity}</span> summary in <span className="font-semibold">{getLanguageName(selectedLanguage)}</span>
            </p>
          </div>
        </div>
      )}

      {/* Regenerate Button */}
      {report && summary && !isGenerating && (
        <div className="mb-8 text-center">
          <button
            onClick={handleGenerate}
            className="medical-button-secondary flex items-center justify-center space-x-2 w-full py-3 text-base font-semibold rounded-xl shadow-md hover:shadow-lg transition-all duration-200"
          >
            <RefreshCw className="w-5 h-5" />
            <span>Regenerate Summary</span>
          </button>
          <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-700 font-medium">
              🔄 Generate new <span className="text-blue-800">{selectedComplexity}</span> summary in <span className="font-semibold">{getLanguageName(selectedLanguage)}</span>
            </p>
          </div>
        </div>
      )}

      {/* Summary Content */}
      <div className="space-y-6">
        {isGenerating ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="relative mb-6">
                <div className="animate-spin w-12 h-12 border-4 border-medical-200 border-t-medical-600 rounded-full mx-auto" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Heart className="w-5 h-5 text-medical-600 animate-pulse" />
                </div>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-lg max-w-md mx-auto">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Generating Patient Summary</h3>
                <p className="text-gray-600 mb-3">
                  Converting medical terminology to easy-to-understand language
                </p>
                <div className="flex items-center justify-center space-x-2 text-sm text-blue-600">
                  <span className="animate-bounce">🤖</span>
                  <span>AI Processing</span>
                  <span className="animate-bounce animation-delay-100">✨</span>
                </div>
              </div>
            </div>
          </div>
        ) : summary ? (
          <>
            {/* Summary Metadata */}
            <div className="bg-gradient-to-r from-medical-50 to-blue-50 p-5 rounded-xl border-2 border-medical-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-medical-600 rounded-lg">
                    <Heart className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg text-medical-800">
                      Patient-Friendly Summary
                    </h4>
                    <p className="text-sm text-gray-600 mt-0.5">Generated with AI assistance</p>
                  </div>
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-gradient-to-r from-green-500 to-green-600 text-white shadow-sm">
                    Patient-Friendly
                  </span>
                </div>
                {summary.metadata?.aiProvider && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gradient-to-r from-green-500 to-green-600 text-white shadow-sm">
                    ✨ {summary.metadata.aiProvider.toUpperCase()}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm bg-white/60 rounded-lg p-3 backdrop-blur-sm">
                <div className="flex flex-col space-y-1">
                  <span className="font-semibold text-gray-700">Summary ID</span>
                  <span className="text-gray-900 font-mono text-xs bg-gray-100 px-2 py-1 rounded">{summary.id.slice(-8)}</span>
                </div>
                <div className="flex flex-col space-y-1">
                  <span className="font-semibold text-gray-700">Generated</span>
                  <span className="text-gray-900 text-xs">
                    {formatTimestamp(summary.generatedAt)}
                  </span>
                </div>
                {summary.metadata?.confidence && (
                  <div className="flex flex-col space-y-1">
                    <span className="font-semibold text-gray-700">Accuracy</span>
                    <div className="flex items-center space-x-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-gradient-to-r from-green-400 to-green-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${Math.round(summary.metadata.confidence * 100)}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-green-600">
                        {Math.round(summary.metadata.confidence * 100)}%
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Main Summary */}
            <div className="bg-white border-2 border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-200">
              <div className="flex items-center space-x-3 mb-5">
                <div className="p-2 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg">
                  <Stethoscope className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h4 className="font-bold text-lg text-gray-800">
                    {getMedicalTerm('summary', (isEditing ? editedSummary : summary)?.language || 'de')}
                  </h4>
                  <p className="text-sm text-gray-600">Main medical findings overview</p>
                </div>
              </div>
              {isEditing ? (
                <textarea
                  value={editedSummary?.summary || ''}
                  onChange={(e) => setEditedSummary(prev => prev ? { ...prev, summary: e.target.value } : null)}
                  className="w-full h-40 px-4 py-3 border-2 border-gray-300 rounded-xl resize-vertical focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                  placeholder="Edit summary content..."
                />
              ) : (
                <div className="prose prose-sm max-w-none bg-gray-50 rounded-xl p-4">
                  <MarkdownRenderer 
                    content={summary.summary} 
                    className="text-gray-800 leading-relaxed text-base"
                  />
                </div>
              )}
            </div>

            {/* Key Findings */}
            {((isEditing ? editedSummary : summary)?.keyFindings && ((isEditing ? editedSummary : summary)?.keyFindings?.length || 0) > 0) && (
              <div className="bg-white border-2 border-orange-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-200">
                <div className="flex items-center space-x-3 mb-5">
                  <div className="p-2 bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg">
                    <Activity className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg text-gray-800">
                      {getMedicalTerm('keyFindings', (isEditing ? editedSummary : summary)?.language || 'de')}
                    </h4>
                    <p className="text-sm text-gray-600">Important observations and results</p>
                  </div>
                </div>
                {isEditing ? (
                  <div className="space-y-3">
                    {editedSummary?.keyFindings.map((finding, index) => (
                      <div key={index} className="flex items-start space-x-3">
                        <div className="w-3 h-3 bg-orange-500 rounded-full mt-3 flex-shrink-0 shadow-sm" />
                        <input
                          type="text"
                          value={finding}
                          onChange={(e) => updateKeyFinding(index, e.target.value)}
                          className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200"
                          placeholder="Key finding..."
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-gradient-to-r from-orange-50 to-yellow-50 rounded-xl p-4">
                    <ul className="space-y-3">
                      {summary.keyFindings.map((finding, index) => (
                        <li key={index} className="flex items-start space-x-3">
                          <div className="w-2.5 h-2.5 bg-gradient-to-r from-orange-500 to-orange-600 rounded-full mt-2 flex-shrink-0 shadow-sm" />
                          <span className="text-gray-800 font-medium leading-relaxed">{finding}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Recommendations */}
            {((isEditing ? editedSummary : summary)?.recommendations && ((isEditing ? editedSummary : summary)?.recommendations?.length || 0) > 0) && (
              <div className="bg-white border-2 border-green-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-200">
                <div className="flex items-center space-x-3 mb-5">
                  <div className="p-2 bg-gradient-to-r from-green-500 to-green-600 rounded-lg">
                    <CheckCircle className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg text-gray-800">
                      {getMedicalTerm('recommendations', (isEditing ? editedSummary : summary)?.language || 'de')}
                    </h4>
                    <p className="text-sm text-gray-600">Next steps and care recommendations</p>
                  </div>
                </div>
                {isEditing ? (
                  <div className="space-y-3">
                    {editedSummary?.recommendations.map((recommendation, index) => (
                      <div key={index} className="flex items-start space-x-3">
                        <div className="w-3 h-3 bg-green-500 rounded-full mt-3 flex-shrink-0 shadow-sm" />
                        <input
                          type="text"
                          value={recommendation}
                          onChange={(e) => updateRecommendation(index, e.target.value)}
                          className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200"
                          placeholder="Recommendation..."
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4">
                    <ul className="space-y-3">
                      {summary.recommendations.map((recommendation, index) => (
                        <li key={index} className="flex items-start space-x-3">
                          <div className="w-2.5 h-2.5 bg-gradient-to-r from-green-500 to-green-600 rounded-full mt-2 flex-shrink-0 shadow-sm" />
                          <span className="text-gray-800 font-medium leading-relaxed">{recommendation}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Disclaimer */}
            <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border-2 border-amber-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-start space-x-3">
                <div className="p-2 bg-gradient-to-r from-amber-500 to-amber-600 rounded-lg flex-shrink-0">
                  <AlertTriangle className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <h5 className="font-bold text-amber-800 text-base mb-2">⚠️ Important Medical Notice</h5>
                  <div className="text-sm text-amber-800 leading-relaxed space-y-2">
                    <p className="font-medium">
                      This summary has been automatically generated using AI and is intended for patient education purposes only.
                    </p>
                    <p>
                      📋 <strong>Always consult your healthcare provider</strong> for proper medical interpretation, diagnosis, and treatment recommendations.
                    </p>
                    <p>
                      🩺 This summary does not replace professional medical advice or clinical judgment.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : !report ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="bg-white rounded-xl p-8 shadow-lg max-w-md mx-auto">
                <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                  <Users className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">No Report Available</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Generate a medical report first to create a patient summary
                </p>
                <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3">
                  💡 Complete a transcription and generate a report to get started
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="bg-gradient-to-r from-blue-50 to-medical-50 rounded-xl p-8 shadow-lg max-w-md mx-auto border-2 border-blue-200">
                <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-r from-blue-500 to-medical-600 rounded-full flex items-center justify-center">
                  <Users className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Ready to Generate Summary</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Click the generate button above to create a patient-friendly summary
                </p>
                <div className="text-xs text-blue-700 bg-blue-100 rounded-lg p-3">
                  ✨ AI will convert medical terminology into easy-to-understand language
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}