'use client';

import React, { useState } from 'react';
import { AlertTriangle, Info, AlertCircle, Eye, ChevronDown, ChevronUp, MapPin, Ruler, Eye as EyeIcon } from 'lucide-react';
import { EnhancedFindings } from '@/types';

interface EnhancedFindingsProps {
  enhancedFindings: EnhancedFindings;
  isEditing?: boolean;
  onContentChange?: (content: string) => void;
  className?: string;
}

export default function EnhancedFindingsNew({
  enhancedFindings,
  isEditing = false,
  onContentChange,
  className = ''
}: EnhancedFindingsProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    normal: true,
    pathological: true,
    special: false,
    measurements: false,
    localizations: false
  });

  // Debug log enhanced findings data
  React.useEffect(() => {
    console.log('🔍 New Enhanced Findings Debug:', {
      normalFindings: enhancedFindings.normalFindings?.length || 0,
      pathologicalFindings: enhancedFindings.pathologicalFindings?.length || 0,
      specialObservations: enhancedFindings.specialObservations?.length || 0,
      measurements: enhancedFindings.measurements?.length || 0,
      localizations: enhancedFindings.localizations?.length || 0,
      confidence: enhancedFindings.confidence,
      processingAgent: enhancedFindings.processingAgent
    });
  }, [enhancedFindings]);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const renderSection = (
    title: string,
    items: string[],
    sectionKey: string,
    icon: React.ReactNode,
    colorClasses: string
  ) => {
    if (!items || items.length === 0) return null;

    const isExpanded = expandedSections[sectionKey];

    return (
      <div className={`bg-white border rounded-lg ${colorClasses}`}>
        <button
          onClick={() => toggleSection(sectionKey)}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center space-x-3">
            {icon}
            <span className="font-semibold text-gray-900">{title}</span>
            <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-sm">
              {items.length}
            </span>
          </div>
          {isExpanded ? 
            <ChevronUp className="w-4 h-4 text-gray-500" /> : 
            <ChevronDown className="w-4 h-4 text-gray-500" />
          }
        </button>
        
        {isExpanded && (
          <div className="px-4 pb-4 border-t border-gray-100">
            <ul className="space-y-2 mt-3">
              {items.map((item, index) => (
                <li key={index} className="flex items-start space-x-2">
                  <span className="w-2 h-2 bg-gray-400 rounded-full mt-2 flex-shrink-0" />
                  <span className="text-gray-700 leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  const totalFindings = (
    (enhancedFindings.normalFindings?.length || 0) +
    (enhancedFindings.pathologicalFindings?.length || 0) +
    (enhancedFindings.specialObservations?.length || 0) +
    (enhancedFindings.measurements?.length || 0) +
    (enhancedFindings.localizations?.length || 0)
  );

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Enhanced Findings Overview */}
      <div className="bg-gradient-to-r from-navy-50 to-orange-50 p-4 rounded-lg border border-navy-200">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-lg font-semibold text-blue-900 flex items-center">
            <Eye className="w-5 h-5 mr-2" />
            Enhanced Findings Analysis
          </h4>
          <div className="text-sm text-blue-700">
            {totalFindings} structured findings
          </div>
        </div>
        
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center space-x-4">
            <span className="text-blue-700">
              Agent: <strong>{enhancedFindings.processingAgent}</strong>
            </span>
            <span className="text-blue-700">
              Confidence: <strong>{Math.round(enhancedFindings.confidence * 100)}%</strong>
            </span>
          </div>
          <div className="text-blue-600 text-xs">
            {new Date(enhancedFindings.timestamp).toLocaleString()}
          </div>
        </div>
      </div>

      {/* Findings Sections */}
      <div className="space-y-3">
        {/* Normal Findings */}
        {renderSection(
          'Normal Findings',
          enhancedFindings.normalFindings,
          'normal',
          <Info className="w-5 h-5 text-green-600" />,
          'border-green-200'
        )}

        {/* Pathological Findings */}
        {renderSection(
          'Pathological Findings',
          enhancedFindings.pathologicalFindings,
          'pathological',
          <AlertTriangle className="w-5 h-5 text-red-600" />,
          'border-red-200'
        )}

        {/* Special Observations */}
        {renderSection(
          'Special Observations',
          enhancedFindings.specialObservations,
          'special',
          <EyeIcon className="w-5 h-5 text-blue-600" />,
          'border-blue-200'
        )}

        {/* Measurements */}
        {renderSection(
          'Measurements',
          enhancedFindings.measurements,
          'measurements',
          <Ruler className="w-5 h-5 text-purple-600" />,
          'border-purple-200'
        )}

        {/* Localizations */}
        {renderSection(
          'Localizations',
          enhancedFindings.localizations,
          'localizations',
          <MapPin className="w-5 h-5 text-orange-600" />,
          'border-orange-200'
        )}
      </div>

      {/* Edit Mode */}
      {isEditing && (
        <div className="bg-white border rounded-lg p-4">
          <h5 className="font-semibold text-gray-900 mb-3">Edit Enhanced Findings</h5>
          <div className="text-sm text-gray-600 mb-3">
            Note: Enhanced findings are generated by AI and cannot be directly edited. 
            To modify findings, edit the main report and regenerate.
          </div>
        </div>
      )}
    </div>
  );
}