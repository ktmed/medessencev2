'use client';

import React, { useState } from 'react';
import { AlertTriangle, Info, AlertCircle, Eye, ChevronDown, ChevronUp } from 'lucide-react';

interface StructuredFinding {
  text: string;
  significance: 'general' | 'significant' | 'critical';
  sourceSpan: { start: number; end: number };
  category: string;
}

interface EnhancedFindingsData {
  content: string;
  structuredFindings: StructuredFinding[];
  originalText: string;
}

interface EnhancedFindingsProps {
  enhancedFindings: EnhancedFindingsData;
  isEditing?: boolean;
  onContentChange?: (content: string) => void;
  className?: string;
}

export default function EnhancedFindings({
  enhancedFindings,
  isEditing = false,
  onContentChange,
  className = ''
}: EnhancedFindingsProps) {
  const [hoveredFinding, setHoveredFinding] = useState<StructuredFinding | null>(null);
  const [showAllFindings, setShowAllFindings] = useState(false);
  const [selectedSignificance, setSelectedSignificance] = useState<string>('all');

  // Debug log enhanced findings data (only when needed for debugging)
  React.useEffect(() => {
    if (enhancedFindings.structuredFindings?.length > 0) {
      console.log('🔍 Enhanced Findings Debug:', {
        contentLength: enhancedFindings.content?.length,
        structuredFindingsCount: enhancedFindings.structuredFindings?.length,
        firstFinding: enhancedFindings.structuredFindings?.[0]
      });
    }
  }, [enhancedFindings]);

  const getSignificanceColor = (significance: string) => {
    switch (significance) {
      case 'critical':
        return 'bg-red-100 border-red-300 text-red-800 hover:bg-red-150';
      case 'significant':
        return 'bg-yellow-100 border-yellow-300 text-yellow-800 hover:bg-yellow-150';
      default:
        return 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-150';
    }
  };

  const getSignificanceIcon = (significance: string) => {
    switch (significance) {
      case 'critical':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      case 'significant':
        return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
      default:
        return <Info className="w-4 h-4 text-gray-500" />;
    }
  };

  const getSignificanceBadge = (significance: string) => {
    switch (significance) {
      case 'critical':
        return 'bg-red-500 text-white';
      case 'significant':
        return 'bg-yellow-500 text-white';
      default:
        return 'bg-gray-400 text-white';
    }
  };

  const highlightSourceText = (text: string, sourceSpan: { start: number; end: number }, findingText?: string) => {
    if (!text || sourceSpan.start < 0 || sourceSpan.end <= sourceSpan.start) {
      console.log('🔍 Highlight Debug - Invalid span:', { textLength: text?.length, sourceSpan });
      return text;
    }

    // Validate that the span is within text bounds
    if (sourceSpan.start >= text.length || sourceSpan.end > text.length) {
      console.log('🔍 Highlight Debug - Span out of bounds:', {
        textLength: text.length,
        sourceSpan,
        findingText
      });
      
      // Fallback: try to find the finding text manually
      if (findingText) {
        const fuzzyIndex = text.toLowerCase().indexOf(findingText.toLowerCase());
        if (fuzzyIndex !== -1) {
          const correctedSpan = {
            start: fuzzyIndex,
            end: fuzzyIndex + findingText.length
          };
          console.log('🔍 Using fuzzy match span:', correctedSpan);
          return highlightSourceText(text, correctedSpan);
        }
      }
      
      return text;
    }

    const before = text.substring(0, sourceSpan.start);
    const highlighted = text.substring(sourceSpan.start, sourceSpan.end);
    const after = text.substring(sourceSpan.end);

    // Debug logging for highlighting issues - detailed analysis
    console.log('🔍 Detailed Highlight Debug:', {
      findingText: findingText,
      highlighted: highlighted,
      sourceSpan,
      textLength: text.length,
      contextBefore: before.slice(-50),
      contextAfter: after.slice(0, 50),
      isCorrect: highlighted.toLowerCase().includes(findingText?.toLowerCase().substring(0, 10) || '')
    });

    return (
      <>
        {before}
        <mark className="bg-blue-200 px-1 rounded font-medium">
          {highlighted}
        </mark>
        {after}
      </>
    );
  };

  const filteredFindings = enhancedFindings.structuredFindings.filter(finding => 
    selectedSignificance === 'all' || finding.significance === selectedSignificance
  );

  const significanceCounts = {
    critical: enhancedFindings.structuredFindings.filter(f => f.significance === 'critical').length,
    significant: enhancedFindings.structuredFindings.filter(f => f.significance === 'significant').length,
    general: enhancedFindings.structuredFindings.filter(f => f.significance === 'general').length
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Significance Overview */}
      <div className="bg-gradient-to-r from-navy-50 to-orange-50 p-4 rounded-lg border border-navy-200">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-lg font-semibold text-blue-900 flex items-center">
            <Eye className="w-5 h-5 mr-2" />
            Enhanced Findings Analysis
          </h4>
          <div className="text-sm text-blue-700">
            {enhancedFindings.structuredFindings.length} findings identified
          </div>
        </div>
        
        {/* Significance Filter Buttons */}
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => setSelectedSignificance('all')}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              selectedSignificance === 'all' 
                ? 'bg-blue-600 text-white' 
                : 'bg-white text-blue-600 border border-blue-200 hover:bg-blue-50'
            }`}
          >
            All ({enhancedFindings.structuredFindings.length})
          </button>
          
          {significanceCounts.critical > 0 && (
            <button
              onClick={() => setSelectedSignificance('critical')}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                selectedSignificance === 'critical'
                  ? 'bg-red-600 text-white'
                  : 'bg-white text-red-600 border border-red-200 hover:bg-red-50'
              }`}
            >
              Critical ({significanceCounts.critical})
            </button>
          )}
          
          {significanceCounts.significant > 0 && (
            <button
              onClick={() => setSelectedSignificance('significant')}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                selectedSignificance === 'significant'
                  ? 'bg-yellow-600 text-white'
                  : 'bg-white text-yellow-600 border border-yellow-200 hover:bg-yellow-50'
              }`}
            >
              Significant ({significanceCounts.significant})
            </button>
          )}
          
          {significanceCounts.general > 0 && (
            <button
              onClick={() => setSelectedSignificance('general')}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                selectedSignificance === 'general'
                  ? 'bg-gray-600 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              General ({significanceCounts.general})
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Structured Findings List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h5 className="font-semibold text-gray-900">Structured Findings</h5>
            <button
              onClick={() => setShowAllFindings(!showAllFindings)}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center"
            >
              {showAllFindings ? 'Show Less' : 'Show All'}
              {showAllFindings ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
            </button>
          </div>
          
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {(showAllFindings ? filteredFindings : filteredFindings.slice(0, 5)).map((finding, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg border cursor-pointer transition-all duration-200 ${getSignificanceColor(finding.significance)}`}
                onMouseEnter={() => setHoveredFinding(finding)}
                onMouseLeave={() => setHoveredFinding(null)}
              >
                <div className="flex items-start space-x-2">
                  {getSignificanceIcon(finding.significance)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${getSignificanceBadge(finding.significance)}`}>
                        {finding.significance.toUpperCase()}
                      </span>
                      <span className="text-xs text-gray-600 bg-white px-2 py-1 rounded">
                        {finding.category}
                      </span>
                    </div>
                    <p className="text-sm font-medium leading-relaxed">
                      {finding.text}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {filteredFindings.length > 5 && !showAllFindings && (
            <div className="text-center py-2">
              <button
                onClick={() => setShowAllFindings(true)}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                +{filteredFindings.length - 5} more findings
              </button>
            </div>
          )}
        </div>

        {/* Source Text with Highlighting */}
        <div className="space-y-3">
          <h5 className="font-semibold text-gray-900">Source Text</h5>
          <div className="bg-gray-50 p-4 rounded-lg border max-h-96 overflow-y-auto">
            {hoveredFinding ? (
              <div className="space-y-3">
                <div className="bg-blue-100 p-2 rounded border-l-4 border-blue-500">
                  <p className="text-sm font-medium text-blue-900">
                    Highlighting: {hoveredFinding.category} - {hoveredFinding.significance}
                  </p>
                </div>
                <div className="text-sm leading-relaxed">
                  {highlightSourceText(enhancedFindings.content, hoveredFinding.sourceSpan, hoveredFinding.text)}
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-600 leading-relaxed">
                <p className="italic mb-2">Hover over findings to see source text highlighting</p>
                <div className="text-gray-800">
                  {enhancedFindings.content}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Mode - Full Text Editor */}
      {isEditing && (
        <div className="bg-white border rounded-lg p-4">
          <h5 className="font-semibold text-gray-900 mb-3">Edit Findings Content</h5>
          <textarea
            value={enhancedFindings.content}
            onChange={(e) => onContentChange?.(e.target.value)}
            className="w-full h-32 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-vertical font-mono text-sm"
            placeholder="Edit findings content..."
          />
        </div>
      )}
    </div>
  );
}