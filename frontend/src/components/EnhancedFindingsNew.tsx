'use client';

import React, { useState } from 'react';
import { AlertTriangle, Info, AlertCircle, Eye, ChevronDown, ChevronUp, MapPin, Ruler, Eye as EyeIcon } from 'lucide-react';
import { EnhancedFindings } from '@/types';

interface FindingItem {
  text: string;
  category: 'normal' | 'pathological' | 'special' | 'measurements' | 'localizations';
  significance: 'general' | 'significant' | 'critical';
}

interface EnhancedFindingsProps {
  enhancedFindings: EnhancedFindings;
  sourceContent?: string; // Original report content for highlighting
  isEditing?: boolean;
  onContentChange?: (content: string) => void;
  className?: string;
}

export default function EnhancedFindingsNew({
  enhancedFindings,
  sourceContent,
  isEditing = false,
  onContentChange,
  className = ''
}: EnhancedFindingsProps) {
  const [hoveredFinding, setHoveredFinding] = useState<FindingItem | null>(null);
  const [showSourceText, setShowSourceText] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    normal: true,
    pathological: true,
    special: false,
    measurements: false,
    localizations: false
  });

  // Convert categorized findings to a combined array for hover interactions
  const allFindings: FindingItem[] = React.useMemo(() => {
    const findings: FindingItem[] = [];
    
    enhancedFindings.normalFindings?.forEach(text => 
      findings.push({ text, category: 'normal', significance: 'general' })
    );
    enhancedFindings.pathologicalFindings?.forEach(text => 
      findings.push({ text, category: 'pathological', significance: 'critical' })
    );
    enhancedFindings.specialObservations?.forEach(text => 
      findings.push({ text, category: 'special', significance: 'significant' })
    );
    enhancedFindings.measurements?.forEach(text => 
      findings.push({ text, category: 'measurements', significance: 'general' })
    );
    enhancedFindings.localizations?.forEach(text => 
      findings.push({ text, category: 'localizations', significance: 'general' })
    );
    
    return findings;
  }, [enhancedFindings]);

  // Use provided source content or fallback
  const sourceText = React.useMemo(() => {
    if (sourceContent) {
      return sourceContent;
    }
    return "Source text not available. Enhanced findings were generated from the medical report content, but the original text is not available for highlighting.";
  }, [sourceContent]);

  // Debug log enhanced findings data
  React.useEffect(() => {
    console.log('🔍 New Enhanced Findings Debug:', {
      normalFindings: enhancedFindings.normalFindings?.length || 0,
      pathologicalFindings: enhancedFindings.pathologicalFindings?.length || 0,
      specialObservations: enhancedFindings.specialObservations?.length || 0,
      measurements: enhancedFindings.measurements?.length || 0,
      localizations: enhancedFindings.localizations?.length || 0,
      confidence: enhancedFindings.confidence,
      processingAgent: enhancedFindings.processingAgent,
      totalFindings: allFindings.length,
      hasSourceContent: !!sourceContent,
      sourceContentLength: sourceContent?.length || 0
    });

    // Log some example findings for debugging
    if (allFindings.length > 0) {
      console.log('🔍 Sample findings for debugging:', allFindings.slice(0, 3).map(f => ({
        text: f.text,
        category: f.category,
        significance: f.significance
      })));
    }
  }, [enhancedFindings, allFindings, sourceContent]);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

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

  const getCategoryLabel = (category: string) => {
    const labels = {
      normal: 'Normal Finding',
      pathological: 'Pathological Finding', 
      special: 'Special Observation',
      measurements: 'Measurement',
      localizations: 'Localization'
    };
    return labels[category as keyof typeof labels] || category;
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'pathological':
        return <AlertTriangle className="w-5 h-5 text-red-600" />;
      case 'special':
        return <EyeIcon className="w-5 h-5 text-blue-600" />;
      case 'measurements':
        return <Ruler className="w-5 h-5 text-purple-600" />;
      case 'localizations':
        return <MapPin className="w-5 h-5 text-orange-600" />;
      default:
        return <Info className="w-5 h-5 text-green-600" />;
    }
  };

  const highlightFindingInText = (text: string, finding: FindingItem): React.ReactNode => {
    if (!finding || !text) return text;
    
    console.log('🔍 Highlighting attempt:', {
      findingText: finding.text,
      category: finding.category,
      significance: finding.significance,
      sourceTextLength: text.length,
      sourcePreview: text.substring(0, 200) + '...'
    });
    
    const findingText = finding.text.toLowerCase().trim();
    const lowerText = text.toLowerCase();
    
    // Try multiple matching strategies
    let highlightResults: Array<{start: number, end: number, matchType: string}> = [];
    
    // Strategy 1: Exact match
    let index = lowerText.indexOf(findingText);
    if (index !== -1) {
      highlightResults.push({
        start: index,
        end: index + finding.text.length,
        matchType: 'exact'
      });
    }

    // Strategy 1.5: Try exact match without common prefixes/suffixes
    if (highlightResults.length === 0) {
      // Remove common medical report prefixes/suffixes that might differ
      const cleanedFinding = findingText
        .replace(/^(keine|kein|unauffällige|unauffälliger|normale|normaler|regelrechte|regelrechter)\s+/g, '')
        .replace(/\s+(darstellbar|erkennbar|nachweisbar|vorliegend)$/g, '')
        .trim();
      
      if (cleanedFinding && cleanedFinding !== findingText) {
        const cleanIndex = lowerText.indexOf(cleanedFinding);
        if (cleanIndex !== -1) {
          highlightResults.push({
            start: cleanIndex,
            end: cleanIndex + cleanedFinding.length,
            matchType: 'cleaned-exact'
          });
        }
      }
    }
    
    // Strategy 2: Category-specific matching strategies
    if (highlightResults.length === 0) {
      if (finding.category === 'normal') {
        // For normal findings, try to match the core anatomical structure or finding
        const normalKeywords = findingText
          .replace(/^(keine|kein|unauffällige|unauffälliger|normale|normaler|regelrechte|regelrechter)\s+/g, '')
          .replace(/\s+(darstellbar|erkennbar|nachweisbar|vorliegend|auffälligkeiten|pathologie)$/g, '')
          .split(/[\s,.-]+/)
          .filter(word => word.length > 3)
          .slice(0, 2); // Take first 2 core terms

        console.log('🔍 Normal finding core terms:', normalKeywords);
        
        for (const keyword of normalKeywords) {
          const keywordIndex = lowerText.indexOf(keyword);
          if (keywordIndex !== -1) {
            // Extend to find the full sentence or phrase around this keyword
            const sentenceStart = Math.max(0, text.lastIndexOf('.', keywordIndex) + 1);
            const sentenceEnd = Math.min(text.length, text.indexOf('.', keywordIndex + keyword.length));
            const actualEnd = sentenceEnd === -1 ? text.length : sentenceEnd;
            
            highlightResults.push({
              start: sentenceStart,
              end: actualEnd,
              matchType: `normal-context-${keyword}`
            });
            break;
          }
        }
      } else if (finding.category === 'measurements') {
        // For measurements, look for numbers and units
        const measurementPattern = /\d+[\.,]?\d*\s*(mm|cm|m|ml|l|grad|°|prozent|%)/i;
        const match = text.match(measurementPattern);
        
        if (match && match.index !== undefined) {
          const contextStart = Math.max(0, match.index - 30);
          const contextEnd = Math.min(text.length, match.index + match[0].length + 30);
          
          highlightResults.push({
            start: contextStart,
            end: contextEnd,
            matchType: 'measurement-context'
          });
        }
      } else if (finding.category === 'localizations') {
        // For localizations, look for anatomical terms
        const anatomicalTerms = findingText
          .split(/[\s,.-]+/)
          .filter(word => word.length > 3 && !/^(links|rechts|beidseits|mittig|zentral|lateral|medial|anterior|posterior)$/i.test(word))
          .slice(0, 2);

        console.log('🔍 Anatomical terms for localization:', anatomicalTerms);
        
        for (const term of anatomicalTerms) {
          const termIndex = lowerText.indexOf(term);
          if (termIndex !== -1) {
            const contextStart = Math.max(0, termIndex - 40);
            const contextEnd = Math.min(text.length, termIndex + term.length + 40);
            
            highlightResults.push({
              start: contextStart,
              end: contextEnd,
              matchType: `localization-${term}`
            });
            break;
          }
        }
      }
    }
    
    // Strategy 3: General fuzzy word matching (fallback)
    if (highlightResults.length === 0) {
      const stopWords = ['der', 'die', 'das', 'und', 'oder', 'in', 'an', 'auf', 'bei', 'mit', 'zu', 'von', 'für', 'durch', 'über', 'unter', 'vor', 'nach', 'zwischen', 'während', 'ohne', 'gegen', 'um', 'the', 'and', 'or', 'in', 'on', 'at', 'by', 'with', 'to', 'from', 'for', 'through', 'over', 'under', 'before', 'after', 'between', 'during', 'without', 'against', 'around', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'ist', 'sind', 'war', 'waren', 'haben', 'hat', 'hatte', 'werden', 'wird', 'wurde', 'wurden', 'sein', 'gewesen', 'worden', 'keine', 'kein', 'unauffällige', 'normale', 'regelrechte'];
      
      const meaningfulWords = findingText
        .split(/[\s,.-]+/)
        .filter(word => word.length > 3 && !stopWords.includes(word.toLowerCase()))
        .slice(0, 2); // Take first 2 meaningful words
      
      console.log('🔍 Meaningful words for general fuzzy matching:', meaningfulWords);
      
      for (const word of meaningfulWords) {
        const wordIndex = lowerText.indexOf(word);
        if (wordIndex !== -1) {
          const contextStart = Math.max(0, wordIndex - 30);
          const contextEnd = Math.min(text.length, wordIndex + word.length + 50);
          
          highlightResults.push({
            start: contextStart,
            end: contextEnd,
            matchType: `fuzzy-${word}`
          });
          break;
        }
      }
    }
    
    // Strategy 4: Medical term matching (final fallback)
    if (highlightResults.length === 0) {
      // Look for any significant medical terms that might be mentioned
      const medicalTerms = findingText.match(/\b[a-zA-ZäöüÄÖÜß]{5,}\b/g) || [];
      for (const term of medicalTerms.slice(0, 2)) { // Only try first 2 longest terms
        const termIndex = lowerText.indexOf(term.toLowerCase());
        if (termIndex !== -1) {
          const contextStart = Math.max(0, termIndex - 20);
          const contextEnd = Math.min(text.length, termIndex + term.length + 20);
          
          highlightResults.push({
            start: contextStart,
            end: contextEnd,
            matchType: `medical-term-${term}`
          });
          break;
        }
      }
    }
    
    if (highlightResults.length === 0) {
      console.log('❌ No highlighting match found for:', finding.text);
      return (
        <div className="text-sm leading-relaxed">
          <div className="bg-yellow-50 p-2 rounded border-l-4 border-yellow-400 mb-2">
            <p className="text-sm text-yellow-700">
              <strong>Finding:</strong> {finding.text}
            </p>
            <p className="text-xs text-yellow-600 mt-1">
              No exact match found in source text. This finding may be a summarized or interpreted conclusion.
            </p>
          </div>
          <div className="text-gray-700">{text}</div>
        </div>
      );
    }
    
    // Use the first (best) match
    const match = highlightResults[0];
    const before = text.substring(0, match.start);
    const highlighted = text.substring(match.start, match.end);
    const after = text.substring(match.end);
    
    console.log('✅ Highlighting successful:', {
      matchType: match.matchType,
      highlighted: highlighted.substring(0, 100) + '...',
      start: match.start,
      end: match.end
    });
    
    return (
      <>
        {before}
        <mark className="bg-blue-200 px-1 rounded font-medium border border-blue-300">
          {highlighted}
        </mark>
        {after}
      </>
    );
  };


  const totalFindings = allFindings.length;
  const significanceCounts = {
    critical: allFindings.filter(f => f.significance === 'critical').length,
    significant: allFindings.filter(f => f.significance === 'significant').length,
    general: allFindings.filter(f => f.significance === 'general').length
  };

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
            {totalFindings} findings identified
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

        {/* Significance Overview */}
        <div className="flex flex-wrap gap-2 mt-3">
          {significanceCounts.critical > 0 && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
              <AlertCircle className="w-3 h-3 mr-1" />
              Critical ({significanceCounts.critical})
            </span>
          )}
          {significanceCounts.significant > 0 && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
              <AlertTriangle className="w-3 h-3 mr-1" />
              Significant ({significanceCounts.significant})
            </span>
          )}
          {significanceCounts.general > 0 && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
              <Info className="w-3 h-3 mr-1" />
              General ({significanceCounts.general})
            </span>
          )}
        </div>
      </div>

      {/* Main Content Area - Two Column Layout with Hover Interactions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Structured Findings List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h5 className="font-semibold text-gray-900">Structured Findings</h5>
            <button
              onClick={() => setShowSourceText(!showSourceText)}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center"
            >
              {showSourceText ? 'Hide Source' : 'Show Source'}
              <Eye className="w-4 h-4 ml-1" />
            </button>
          </div>
          
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {allFindings.map((finding, index) => {
              // Quick check for highlighting capability
              const canHighlight = sourceContent && (
                sourceContent.toLowerCase().includes(finding.text.toLowerCase()) ||
                finding.text.toLowerCase().split(/[\s,.-]+/)
                  .filter(word => word.length > 3)
                  .some(word => sourceContent.toLowerCase().includes(word))
              );

              return (
                <div
                  key={index}
                  className={`p-3 rounded-lg border cursor-pointer transition-all duration-200 ${getSignificanceColor(finding.significance)} ${hoveredFinding === finding ? 'ring-2 ring-blue-400' : ''}`}
                  onMouseEnter={() => setHoveredFinding(finding)}
                  onMouseLeave={() => setHoveredFinding(null)}
                >
                  <div className="flex items-start space-x-2">
                    {getSignificanceIcon(finding.significance)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-600 bg-white px-2 py-1 rounded flex items-center">
                          {getCategoryIcon(finding.category)}
                          <span className="ml-1">{getCategoryLabel(finding.category)}</span>
                          {canHighlight && (
                            <span className="ml-1 w-2 h-2 bg-green-500 rounded-full" title="Can highlight in source text"></span>
                          )}
                          {!canHighlight && sourceContent && (
                            <span className="ml-1 w-2 h-2 bg-orange-400 rounded-full" title="Limited highlighting available"></span>
                          )}
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                          finding.significance === 'critical' ? 'bg-red-500 text-white' :
                          finding.significance === 'significant' ? 'bg-yellow-500 text-white' :
                          'bg-gray-400 text-white'
                        }`}>
                          {finding.significance.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-sm font-medium leading-relaxed">
                        {finding.text}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          
          {allFindings.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <Eye className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>No structured findings available</p>
            </div>
          )}
        </div>

        {/* Source Text with Highlighting */}
        {showSourceText && (
          <div className="space-y-3">
            <h5 className="font-semibold text-gray-900">Source Text</h5>
            <div className="bg-gray-50 p-4 rounded-lg border max-h-96 overflow-y-auto">
              {hoveredFinding ? (
                <div className="space-y-3">
                  <div className="bg-blue-100 p-2 rounded border-l-4 border-blue-500">
                    <p className="text-sm font-medium text-blue-900">
                      Highlighting: {getCategoryLabel(hoveredFinding.category)} - {hoveredFinding.significance}
                    </p>
                  </div>
                  <div className="text-sm leading-relaxed">
                    {highlightFindingInText(sourceText, hoveredFinding)}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-600 leading-relaxed">
                  <p className="italic mb-2">Hover over findings to see source text highlighting</p>
                  <div className="text-gray-800">
                    {sourceText}
                  </div>
                </div>
              )}
            </div>
          </div>
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