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
  const [selectedComplexity, setSelectedComplexity] = useState<'simple' | 'detailed' | 'technical'>('detailed');
  const [isEditing, setIsEditing] = useState(false);
  const [editedSummary, setEditedSummary] = useState<PatientSummary | null>(null);

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
    return `
PATIENT-FRIENDLY MEDICAL SUMMARY
================================

Summary ID: ${summary.id}
Report ID: ${summary.reportId}
Generated: ${formatTimestamp(summary.generatedAt)}
Language: ${getLanguageName(summary.language)}

${getMedicalTerm('summary', summary.language).toUpperCase()}
${'-'.repeat(getMedicalTerm('summary', summary.language).length)}
${summary.summary}

${getMedicalTerm('keyFindings', summary.language).toUpperCase()}
${'-'.repeat(getMedicalTerm('keyFindings', summary.language).length)}
${summary.keyFindings && summary.keyFindings.length > 0 
  ? summary.keyFindings.map(finding => `• ${finding}`).join('\n')
  : 'No key findings available.'}

${getMedicalTerm('recommendations', summary.language).toUpperCase()}
${'-'.repeat(getMedicalTerm('recommendations', summary.language).length)}
${summary.recommendations && summary.recommendations.length > 0 
  ? summary.recommendations.map(rec => `• ${rec}`).join('\n')
  : 'No recommendations available.'}

---
This summary has been generated automatically and should be reviewed with your healthcare provider.
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
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Summary Language
        </label>
        <div className="flex flex-wrap gap-2">
          {SUPPORTED_LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleLanguageChange(lang.code)}
              className={cn(
                'px-3 py-2 rounded-md text-sm font-medium border transition-colors',
                selectedLanguage === lang.code
                  ? 'bg-medical-100 border-medical-300 text-medical-800'
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
              )}
            >
              <span className="mr-2">{lang.flag}</span>
              {lang.name}
            </button>
          ))}
        </div>
      </div>

      {/* Complexity Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Summary Complexity
        </label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            {
              value: 'simple' as const,
              title: 'Simple',
              description: 'Patient-friendly, easy to understand',
              icon: '👤'
            },
            {
              value: 'detailed' as const,
              title: 'Detailed',
              description: 'Comprehensive medical summary',
              icon: '📋'
            },
            {
              value: 'technical' as const,
              title: 'Technical',
              description: 'Professional medical terminology',
              icon: '🔬'
            }
          ].map((complexity) => (
            <button
              key={complexity.value}
              onClick={() => setSelectedComplexity(complexity.value)}
              className={cn(
                'p-4 text-left rounded-lg border transition-colors',
                selectedComplexity === complexity.value
                  ? 'bg-medical-50 border-medical-300 text-medical-800'
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
              )}
            >
              <div className="flex items-start space-x-3">
                <span className="text-2xl">{complexity.icon}</span>
                <div>
                  <div className="font-semibold text-sm">{complexity.title}</div>
                  <div className="text-xs text-gray-600 mt-1">
                    {complexity.description}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Generate Button */}
      {report && !summary && !isGenerating && (
        <div className="mb-6">
          <button
            onClick={handleGenerate}
            className="medical-button-primary flex items-center space-x-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Generate Patient Summary</span>
          </button>
          <p className="text-sm text-gray-500 mt-2">
            Create a {selectedComplexity} summary in {getLanguageName(selectedLanguage)}
          </p>
        </div>
      )}

      {/* Regenerate Button */}
      {report && summary && !isGenerating && (
        <div className="mb-6">
          <button
            onClick={handleGenerate}
            className="medical-button-secondary flex items-center space-x-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Regenerate Summary</span>
          </button>
          <p className="text-sm text-gray-500 mt-2">
            Generate a new {selectedComplexity} summary in {getLanguageName(selectedLanguage)}
          </p>
        </div>
      )}

      {/* Summary Content */}
      <div className="space-y-6">
        {isGenerating ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin w-8 h-8 border-4 border-medical-200 border-t-medical-600 rounded-full mx-auto mb-4" />
              <p className="text-gray-600">Generating patient-friendly summary...</p>
              <p className="text-sm text-gray-500 mt-2">
                Converting medical terminology to easy-to-understand language
              </p>
            </div>
          </div>
        ) : summary ? (
          <>
            {/* Summary Metadata */}
            <div className="bg-medical-50 p-4 rounded-lg border border-medical-200">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <Heart className="w-5 h-5 text-medical-600" />
                  <h4 className="font-semibold text-medical-800">
                    Patient-Friendly Summary
                  </h4>
                  {summary.complexity && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {summary.complexity.charAt(0).toUpperCase() + summary.complexity.slice(1)}
                    </span>
                  )}
                </div>
                {summary.metadata?.aiProvider && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    AI-Enhanced ({summary.metadata.aiProvider})
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-600">Summary ID:</span>
                  <span className="ml-2 text-gray-900">{summary.id}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-600">Generated:</span>
                  <span className="ml-2 text-gray-900">
                    {formatTimestamp(summary.generatedAt)}
                  </span>
                </div>
                {summary.metadata?.confidence && (
                  <div>
                    <span className="font-medium text-gray-600">Confidence:</span>
                    <span className="ml-2 text-gray-900">
                      {Math.round(summary.metadata.confidence * 100)}%
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Main Summary */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-center space-x-2 mb-4">
                <Stethoscope className="w-5 h-5 text-gray-600" />
                <h4 className="font-semibold text-gray-800">
                  {getMedicalTerm('summary', (isEditing ? editedSummary : summary)?.language || 'de')}
                </h4>
              </div>
              {isEditing ? (
                <textarea
                  value={editedSummary?.summary || ''}
                  onChange={(e) => setEditedSummary(prev => prev ? { ...prev, summary: e.target.value } : null)}
                  className="w-full h-40 px-4 py-3 border border-gray-300 rounded-lg resize-vertical focus:outline-none focus:ring-2 focus:ring-medical-500 focus:border-transparent"
                  placeholder="Edit summary content..."
                />
              ) : (
                <div className="prose prose-sm max-w-none">
                  <MarkdownRenderer 
                    content={summary.summary} 
                    className="text-gray-700 leading-relaxed"
                  />
                </div>
              )}
            </div>

            {/* Key Findings */}
            {((isEditing ? editedSummary : summary)?.keyFindings && ((isEditing ? editedSummary : summary)?.keyFindings?.length || 0) > 0) && (
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex items-center space-x-2 mb-4">
                  <Activity className="w-5 h-5 text-gray-600" />
                  <h4 className="font-semibold text-gray-800">
                    {getMedicalTerm('keyFindings', (isEditing ? editedSummary : summary)?.language || 'de')}
                  </h4>
                </div>
                {isEditing ? (
                  <div className="space-y-3">
                    {editedSummary?.keyFindings.map((finding, index) => (
                      <div key={index} className="flex items-start space-x-3">
                        <div className="w-2 h-2 bg-medical-500 rounded-full mt-3 flex-shrink-0" />
                        <input
                          type="text"
                          value={finding}
                          onChange={(e) => updateKeyFinding(index, e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-medical-500 focus:border-transparent"
                          placeholder="Key finding..."
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {summary.keyFindings.map((finding, index) => (
                      <li key={index} className="flex items-start space-x-3">
                        <div className="w-2 h-2 bg-medical-500 rounded-full mt-2 flex-shrink-0" />
                        <span className="text-gray-700">{finding}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Recommendations */}
            {((isEditing ? editedSummary : summary)?.recommendations && ((isEditing ? editedSummary : summary)?.recommendations?.length || 0) > 0) && (
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex items-center space-x-2 mb-4">
                  <CheckCircle className="w-5 h-5 text-gray-600" />
                  <h4 className="font-semibold text-gray-800">
                    {getMedicalTerm('recommendations', (isEditing ? editedSummary : summary)?.language || 'de')}
                  </h4>
                </div>
                {isEditing ? (
                  <div className="space-y-3">
                    {editedSummary?.recommendations.map((recommendation, index) => (
                      <div key={index} className="flex items-start space-x-3">
                        <div className="w-2 h-2 bg-success-500 rounded-full mt-3 flex-shrink-0" />
                        <input
                          type="text"
                          value={recommendation}
                          onChange={(e) => updateRecommendation(index, e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-medical-500 focus:border-transparent"
                          placeholder="Recommendation..."
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {summary.recommendations.map((recommendation, index) => (
                      <li key={index} className="flex items-start space-x-3">
                        <div className="w-2 h-2 bg-success-500 rounded-full mt-2 flex-shrink-0" />
                        <span className="text-gray-700">{recommendation}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Disclaimer */}
            <div className="bg-warning-50 border border-warning-200 rounded-lg p-4">
              <div className="flex items-start space-x-2">
                <AlertTriangle className="w-5 h-5 text-warning-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-warning-800">
                  <p className="font-medium mb-1">Important Notice</p>
                  <p>
                    This summary has been automatically generated and is intended for patient education only. 
                    Please discuss these findings with your healthcare provider for proper medical interpretation 
                    and treatment recommendations.
                  </p>
                </div>
              </div>
            </div>
          </>
        ) : !report ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center text-gray-500">
              <Users className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium mb-2">No Report Available</p>
              <p className="text-sm">
                Generate a medical report first to create a patient summary
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-64">
            <div className="text-center text-gray-500">
              <Users className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium mb-2">Ready to Generate Summary</p>
              <p className="text-sm">
                Click the generate button above to create a patient-friendly summary
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}