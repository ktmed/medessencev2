'use client';

import React, { useState } from 'react';
import { ICDPredictions, ICDCode } from '../types';
import { 
  ClipboardList,
  Info,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
  HelpCircle
} from 'lucide-react';

interface ICDPredictionsProps {
  predictions: ICDPredictions;
  className?: string;
}

const ICDPredictionsComponent: React.FC<ICDPredictionsProps> = ({ 
  predictions, 
  className = '' 
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [selectedPriority, setSelectedPriority] = useState<string>('all');

  if (!predictions || !predictions.codes || predictions.codes.length === 0) {
    return null;
  }

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'primary':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'secondary':
        return <CheckCircle className="h-4 w-4 text-yellow-500" />;
      case 'differential':
        return <HelpCircle className="h-4 w-4 text-blue-500" />;
      default:
        return <Info className="h-4 w-4 text-gray-500" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'primary':
        return 'border-l-red-500 bg-red-50';
      case 'secondary':
        return 'border-l-yellow-500 bg-yellow-50';
      case 'differential':
        return 'border-l-blue-500 bg-blue-50';
      default:
        return 'border-l-gray-500 bg-gray-50';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence > 0.8) return 'text-orange-600 bg-orange-100';
    if (confidence > 0.6) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const filteredCodes = selectedPriority === 'all' 
    ? predictions.codes 
    : predictions.codes.filter(code => code.priority === selectedPriority);

  const priorityCounts = {
    primary: predictions.codes.filter(c => c.priority === 'primary').length,
    secondary: predictions.codes.filter(c => c.priority === 'secondary').length,
    differential: predictions.codes.filter(c => c.priority === 'differential').length
  };

  return (
    <div className={`medical-card ${className}`}>
      {/* Header */}
      <div 
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-navy-50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center space-x-3">
          <ClipboardList className="h-6 w-6 text-navy-600" />
          <div>
            <h3 className="text-lg font-semibold text-navy-900">
              ICD-10-GM Kodierung
            </h3>
            <p className="text-sm text-navy-600">
              {predictions.codes.length} Codes vorgeschlagen
              {predictions.provider && (
                <>
                  {' · '}
                  <span className="font-medium">{predictions.provider}</span>
                </>
              )}
              {predictions.cached && (
                <span className="ml-1 text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">
                  cached
                </span>
              )}
              {predictions.fallback && (
                <span className="ml-1 text-xs bg-orange-100 text-orange-800 px-1.5 py-0.5 rounded">
                  fallback
                </span>
              )}
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {/* Summary stats */}
          <div className="hidden sm:flex items-center space-x-3 text-sm text-navy-600">
            <span>Ø {(predictions.summary.averageConfidence * 100).toFixed(0)}%</span>
            <div className="flex space-x-1">
              {priorityCounts.primary > 0 && (
                <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs">
                  {priorityCounts.primary} Primär
                </span>
              )}
              {priorityCounts.secondary > 0 && (
                <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs">
                  {priorityCounts.secondary} Sekundär
                </span>
              )}
              {priorityCounts.differential > 0 && (
                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                  {priorityCounts.differential} Differentialdiagnose
                </span>
              )}
            </div>
          </div>
          
          {isExpanded ? (
            <ChevronDown className="h-5 w-5 text-navy-400" />
          ) : (
            <ChevronRight className="h-5 w-5 text-navy-400" />
          )}
        </div>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="px-4 pb-4">
          {/* Filter Controls */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-navy-700">Filter:</span>
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="text-sm border border-navy-300 rounded px-2 py-1 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            >
              <option value="all">Alle Prioritäten ({predictions.codes.length})</option>
              {priorityCounts.primary > 0 && (
                <option value="primary">Primärdiagnosen ({priorityCounts.primary})</option>
              )}
              {priorityCounts.secondary > 0 && (
                <option value="secondary">Sekundärdiagnosen ({priorityCounts.secondary})</option>
              )}
              {priorityCounts.differential > 0 && (
                <option value="differential">Differentialdiagnosen ({priorityCounts.differential})</option>
              )}
            </select>
          </div>

          {/* ICD Codes */}
          <div className="space-y-3">
            {filteredCodes.map((code, index) => (
              <ICDCodeCard key={`${code.code}-${index}`} code={code} />
            ))}
          </div>

          {/* Summary */}
          <div className="mt-4 pt-4 border-t border-navy-200">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div className="bg-navy-50 p-3 rounded">
                <div className="font-medium text-navy-900">Gesamt</div>
                <div className="text-navy-600">{predictions.summary.totalCodes} Codes</div>
              </div>
              <div className="bg-red-50 p-3 rounded">
                <div className="font-medium text-red-900">Primär</div>
                <div className="text-red-600">{predictions.summary.primaryDiagnoses}</div>
              </div>
              <div className="bg-yellow-50 p-3 rounded">
                <div className="font-medium text-yellow-900">Sekundär</div>
                <div className="text-yellow-600">{predictions.summary.secondaryDiagnoses}</div>
              </div>
              <div className="bg-orange-50 p-3 rounded">
                <div className="font-medium text-orange-900">Konfidenz</div>
                <div className="text-orange-600">
                  {(predictions.summary.averageConfidence * 100).toFixed(1)}%
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface ICDCodeCardProps {
  code: ICDCode;
}

const ICDCodeCard: React.FC<ICDCodeCardProps> = ({ code }) => {
  const [showReasoning, setShowReasoning] = useState(false);

  return (
    <div className={`border-l-4 p-4 rounded-r-lg ${getPriorityColor(code.priority)}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          {/* Code and Priority */}
          <div className="flex items-center space-x-3 mb-2">
            <div className="flex items-center space-x-1">
              {getPriorityIcon(code.priority)}
              <span className="font-mono text-lg font-bold text-navy-900">
                {code.code}
              </span>
            </div>
            <span className="text-xs uppercase font-medium text-navy-600 bg-white px-2 py-1 rounded-full">
              {code.priority}
            </span>
            <span className="text-xs bg-navy-200 text-navy-700 px-2 py-1 rounded">
              {code.category}
            </span>
          </div>

          {/* Description */}
          <p className="text-navy-900 font-medium mb-3">
            {code.description}
          </p>

          {/* Metrics */}
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <div className="flex items-center space-x-1">
              <span className="text-xs text-navy-600">Konfidenz:</span>
              <span className={`text-xs font-medium px-2 py-1 rounded ${getConfidenceColor(code.confidence)}`}>
                {(code.confidence * 100).toFixed(1)}%
              </span>
            </div>
            <div className="flex items-center space-x-1">
              <span className="text-xs text-navy-600">Radiologie-Relevanz:</span>
              <span className={`text-xs font-medium px-2 py-1 rounded ${getConfidenceColor(code.radiologyRelevance)}`}>
                {(code.radiologyRelevance * 100).toFixed(1)}%
              </span>
            </div>
          </div>

          {/* Reasoning Toggle */}
          {code.reasoning && (
            <button
              onClick={() => setShowReasoning(!showReasoning)}
              className="text-sm text-navy-600 hover:text-navy-800 font-medium flex items-center space-x-1"
            >
              <Info className="h-4 w-4" />
              <span>{showReasoning ? 'Begründung ausblenden' : 'Begründung anzeigen'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Reasoning */}
      {showReasoning && code.reasoning && (
        <div className="mt-3 pt-3 border-t border-navy-200">
          <p className="text-sm text-navy-700 italic">
            <strong>Begründung:</strong> {code.reasoning}
          </p>
        </div>
      )}
    </div>
  );
};

// Helper functions moved inside component scope for proper access to React hooks
function getPriorityColor(priority: string) {
  switch (priority) {
    case 'primary':
      return 'border-l-red-500 bg-red-50';
    case 'secondary':
      return 'border-l-yellow-500 bg-yellow-50';
    case 'differential':
      return 'border-l-blue-500 bg-blue-50';
    default:
      return 'border-l-gray-500 bg-gray-50';
  }
}

function getPriorityIcon(priority: string) {
  switch (priority) {
    case 'primary':
      return <AlertTriangle className="h-4 w-4 text-red-500" />;
    case 'secondary':
      return <CheckCircle className="h-4 w-4 text-yellow-500" />;
    case 'differential':
      return <HelpCircle className="h-4 w-4 text-blue-500" />;
    default:
      return <Info className="h-4 w-4 text-gray-500" />;
  }
}

function getConfidenceColor(confidence: number) {
  if (confidence > 0.8) return 'text-orange-600 bg-orange-100';
  if (confidence > 0.6) return 'text-yellow-600 bg-yellow-100';
  return 'text-red-600 bg-red-100';
}

export default ICDPredictionsComponent;