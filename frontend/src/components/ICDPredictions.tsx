'use client';

import React, { useState, useEffect } from 'react';
import { ICDPredictions, ICDCode } from '../types';
import { 
  ClipboardList,
  Info,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  Check,
  X,
  Database,
  Brain,
  Save
} from 'lucide-react';

interface ICDPredictionsProps {
  predictions: ICDPredictions;
  className?: string;
  onCodesSelected?: (codes: ICDCode[]) => void;
}

const ICDPredictionsComponent: React.FC<ICDPredictionsProps> = ({ 
  predictions, 
  className = '',
  onCodesSelected
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());
  const [showOnlySelected, setShowOnlySelected] = useState(false);

  // Initialize selected codes when predictions change
  useEffect(() => {
    if (predictions?.codes) {
      // Pre-select primary diagnoses by default
      const primaryCodes = predictions.codes
        .filter(code => code.priority === 'primary')
        .map(code => code.code);
      setSelectedCodes(new Set(primaryCodes));
    }
  }, [predictions]);

  // Instead of returning null, show a placeholder when no predictions are available
  if (!predictions || !predictions.codes || predictions.codes.length === 0) {
    return (
      <div className={`bg-white rounded-lg shadow-md border border-gray-200 p-6 ${className}`}>
        <div className="flex items-center gap-2 mb-4">
          <ClipboardList className="h-5 w-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-800">ICD-10-GM Kodierungen</h3>
        </div>
        <div className="text-center py-8">
          <HelpCircle className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">
            ICD-Codes werden generiert...
          </p>
          <p className="text-gray-400 text-xs mt-1">
            Bitte warten Sie, während die Codes verarbeitet werden.
          </p>
        </div>
      </div>
    );
  }

  const handleCodeToggle = (code: string) => {
    const newSelected = new Set(selectedCodes);
    if (newSelected.has(code)) {
      newSelected.delete(code);
    } else {
      newSelected.add(code);
    }
    setSelectedCodes(newSelected);
  };

  const handleSelectAll = () => {
    const allCodes = new Set(predictions.codes.map(c => c.code));
    setSelectedCodes(allCodes);
  };

  const handleDeselectAll = () => {
    setSelectedCodes(new Set());
  };

  const handleSaveSelection = () => {
    const selected = predictions.codes.filter(code => selectedCodes.has(code.code));
    if (onCodesSelected) {
      onCodesSelected(selected);
    }
    console.log('Selected ICD codes for report:', selected);
  };

  const getProviderIcon = (provider?: string) => {
    if (!provider) return null;
    if (provider.toLowerCase().includes('ontology')) {
      return <Database className="h-4 w-4 text-blue-600" />;
    }
    return <Brain className="h-4 w-4 text-purple-600" />;
  };

  const getProviderBadge = (provider?: string) => {
    if (!provider) return null;
    const isOntology = provider.toLowerCase().includes('ontology');
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
        isOntology ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
      }`}>
        {getProviderIcon(provider)}
        {isOntology ? 'Ontologie' : provider}
      </span>
    );
  };

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
    if (confidence > 0.95) return 'text-green-600 bg-green-100';
    if (confidence > 0.9) return 'text-orange-600 bg-orange-100';
    if (confidence > 0.8) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  // Filter codes based on selection
  let filteredCodes = selectedPriority === 'all' 
    ? predictions.codes 
    : predictions.codes.filter(code => code.priority === selectedPriority);

  if (showOnlySelected) {
    filteredCodes = filteredCodes.filter(code => selectedCodes.has(code.code));
  }

  const priorityCounts = {
    primary: predictions.codes.filter(c => c.priority === 'primary').length,
    secondary: predictions.codes.filter(c => c.priority === 'secondary').length,
    differential: predictions.codes.filter(c => c.priority === 'differential').length
  };

  // Group codes by provider
  const ontologyCodes = predictions.codes.filter(c => c.provider?.toLowerCase().includes('ontology'));
  const aiCodes = predictions.codes.filter(c => c.provider && !c.provider.toLowerCase().includes('ontology'));

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
              {predictions.codes.length} hochkonfidente Codes (&gt;90%)
              {predictions.dualProvider && (
                <>
                  {' · '}
                  <span className="font-medium">Dual-Provider Modus</span>
                </>
              )}
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {/* Provider badges */}
          {predictions.dualProvider && (
            <div className="flex gap-2 mr-3">
              {ontologyCodes.length > 0 && (
                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs flex items-center gap-1">
                  <Database className="h-3 w-3" />
                  {ontologyCodes.length} Ontologie
                </span>
              )}
              {aiCodes.length > 0 && (
                <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs flex items-center gap-1">
                  <Brain className="h-3 w-3" />
                  {aiCodes.length} KI
                </span>
              )}
            </div>
          )}
          
          {/* Summary stats */}
          <div className="hidden sm:flex items-center space-x-3 text-sm text-navy-600">
            <span>Ø {(predictions.confidence * 100).toFixed(0)}%</span>
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
          {/* Selection Controls */}
          <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-navy-700">
                  {selectedCodes.size} von {predictions.codes.length} ausgewählt
                </span>
                <button
                  onClick={handleSelectAll}
                  className="text-xs px-2 py-1 border border-navy-300 rounded hover:bg-navy-50"
                >
                  Alle auswählen
                </button>
                <button
                  onClick={handleDeselectAll}
                  className="text-xs px-2 py-1 border border-navy-300 rounded hover:bg-navy-50"
                >
                  Keine auswählen
                </button>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={showOnlySelected}
                    onChange={(e) => setShowOnlySelected(e.target.checked)}
                    className="rounded"
                  />
                  Nur ausgewählte anzeigen
                </label>
              </div>
              
              <button
                onClick={handleSaveSelection}
                disabled={selectedCodes.size === 0}
                className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="h-4 w-4" />
                Auswahl für Bericht übernehmen
              </button>
            </div>
          </div>

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
              <ICDCodeCard 
                key={`${code.code}-${index}`} 
                code={code}
                isSelected={selectedCodes.has(code.code)}
                onToggle={() => handleCodeToggle(code.code)}
              />
            ))}
          </div>

          {/* Summary */}
          <div className="mt-4 pt-4 border-t border-navy-200">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div className="bg-navy-50 p-3 rounded">
                <div className="font-medium text-navy-900">Gesamt</div>
                <div className="text-navy-600">{predictions.summary.totalCodes} Codes</div>
              </div>
              <div className="bg-green-50 p-3 rounded">
                <div className="font-medium text-green-900">Ausgewählt</div>
                <div className="text-green-600">{selectedCodes.size} Codes</div>
              </div>
              <div className="bg-orange-50 p-3 rounded">
                <div className="font-medium text-orange-900">Konfidenz</div>
                <div className="text-orange-600">
                  &gt;90% (gefiltert)
                </div>
              </div>
              <div className="bg-blue-50 p-3 rounded">
                <div className="font-medium text-blue-900">Quellen</div>
                <div className="text-blue-600">
                  {predictions.dualProvider ? 'Dual' : predictions.provider}
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
  isSelected: boolean;
  onToggle: () => void;
}

const ICDCodeCard: React.FC<ICDCodeCardProps> = ({ code, isSelected, onToggle }) => {
  const [showReasoning, setShowReasoning] = useState(false);

  const getProviderIcon = (provider?: string) => {
    if (!provider) return null;
    if (provider.toLowerCase().includes('ontology')) {
      return <Database className="h-4 w-4 text-blue-600" />;
    }
    return <Brain className="h-4 w-4 text-purple-600" />;
  };

  return (
    <div className={`border-l-4 p-4 rounded-r-lg ${getPriorityColor(code.priority)} ${
      isSelected ? 'ring-2 ring-orange-400' : ''
    }`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          {/* Selection Checkbox */}
          <div className="pt-1">
            <button
              onClick={onToggle}
              className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                isSelected 
                  ? 'bg-orange-600 border-orange-600' 
                  : 'bg-white border-gray-300 hover:border-orange-400'
              }`}
            >
              {isSelected && <Check className="h-3 w-3 text-white" />}
            </button>
          </div>
          
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
              {/* Provider badge */}
              {code.provider && (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                  code.provider.toLowerCase().includes('ontology') 
                    ? 'bg-blue-100 text-blue-800' 
                    : 'bg-purple-100 text-purple-800'
                }`}>
                  {getProviderIcon(code.provider)}
                  {code.provider.toLowerCase().includes('ontology') ? 'DB' : code.provider}
                </span>
              )}
            </div>

            {/* Description */}
            <p className="text-navy-900 font-medium mb-3 break-words">
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
  if (confidence > 0.95) return 'text-green-600 bg-green-100';
  if (confidence > 0.9) return 'text-orange-600 bg-orange-100';
  if (confidence > 0.8) return 'text-yellow-600 bg-yellow-100';
  return 'text-red-600 bg-red-100';
}

export default ICDPredictionsComponent;