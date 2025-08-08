'use client';

import React, { useState, useEffect, useRef } from 'react';
import { FileText, Download, Copy, Check, AlertCircle, List, Type, Trash2, Edit3, Save, X } from 'lucide-react';
import { TranscriptionData, Language } from '@/types';
import { getLanguageName, getLanguageFlag, getMedicalTerm } from '@/utils/languages';
import { formatTimestamp, getConfidenceColor, cn } from '@/utils';

interface TranscriptionDisplayProps {
  transcriptions: TranscriptionData[];
  currentLanguage: Language;
  isConnected: boolean;
  onExport?: (transcriptions: TranscriptionData[]) => void;
  onClear?: () => void;
  onGenerateReport?: () => void;
  onGenerateReportFromText?: (text: string) => void;
  className?: string;
}

export default function TranscriptionDisplay({
  transcriptions,
  currentLanguage,
  isConnected,
  onExport,
  onClear,
  onGenerateReport,
  onGenerateReportFromText,
  className,
}: TranscriptionDisplayProps) {
  const [copied, setCopied] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [displayMode, setDisplayMode] = useState<'segments' | 'flowing'>('flowing');
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState('');
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const endOfTranscriptRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new transcriptions arrive
  useEffect(() => {
    if (autoScroll && endOfTranscriptRef.current) {
      endOfTranscriptRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [transcriptions, autoScroll]);

  // Handle manual scroll to detect if user scrolled up
  const handleScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10;
      setAutoScroll(isAtBottom);
    }
  };

  const copyToClipboard = async () => {
    const text = transcriptions
      .filter(t => t.isFinal)
      .map(t => t.text)
      .join(' ');
    
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const exportTranscription = () => {
    if (onExport) {
      onExport(transcriptions);
    } else {
      // Default export as text file
      const text = transcriptions
        .filter(t => t.isFinal)
        .map(t => `[${formatTimestamp(t.timestamp)}] ${t.text}`)
        .join('\n');
      
      const blob = new Blob([text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `transcription-${Date.now()}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const finalTranscriptions = transcriptions.filter(t => t.isFinal);
  const currentTranscription = transcriptions.find(t => !t.isFinal);
  const totalWords = finalTranscriptions.reduce((acc, t) => acc + t.text.split(' ').length, 0);

  const startEdit = () => {
    const combinedText = finalTranscriptions.map(t => t.text).join(' ');
    setEditedText(combinedText);
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setEditedText('');
    setIsEditing(false);
  };

  const saveEdit = () => {
    if (onGenerateReportFromText && editedText.trim()) {
      onGenerateReportFromText(editedText);
    }
    setIsEditing(false);
    setEditedText('');
  };

  return (
    <div className={cn('medical-card', className)}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <FileText className="w-5 h-5 text-navy-600" />
          <h3 className="text-lg font-semibold med-text-navy">{getMedicalTerm('liveTranscription', currentLanguage)}</h3>
          <span className="text-sm text-gray-500">
            {getLanguageFlag(currentLanguage)} {getLanguageName(currentLanguage)}
          </span>
        </div>
        
        <div className="flex items-center space-x-2">
          {/* Connection Status */}
          <div className="flex items-center space-x-1">
            <div className={cn(
              'w-2 h-2 rounded-full',
              isConnected ? 'bg-success-500' : 'bg-error-500'
            )} />
            <span className="text-xs text-navy-500">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2">
            {/* Display Mode Toggle */}
            <div className="flex items-center bg-navy-100 rounded-lg p-1">
              <button
                onClick={() => setDisplayMode('flowing')}
                className={cn(
                  'p-1.5 rounded transition-colors',
                  displayMode === 'flowing' 
                    ? 'bg-white text-navy-600 shadow-sm' 
                    : 'text-navy-500 hover:text-navy-700'
                )}
                title="Flowing text"
              >
                <Type className="w-4 h-4" />
              </button>
              <button
                onClick={() => setDisplayMode('segments')}
                className={cn(
                  'p-1.5 rounded transition-colors',
                  displayMode === 'segments' 
                    ? 'bg-white text-navy-600 shadow-sm' 
                    : 'text-navy-500 hover:text-navy-700'
                )}
                title="Segments view"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
            
            <button
              onClick={copyToClipboard}
              disabled={finalTranscriptions.length === 0}
              className="p-2 text-navy-500 hover:text-navy-700 disabled:opacity-50"
              title="Copy transcription"
            >
              {copied ? (
                <Check className="w-4 h-4 text-success-600" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
            
            <button
              onClick={exportTranscription}
              disabled={finalTranscriptions.length === 0}
              className="p-2 text-navy-500 hover:text-navy-700 disabled:opacity-50"
              title="Export transcription"
            >
              <Download className="w-4 h-4" />
            </button>
            
            {onClear && (
              <button
                onClick={onClear}
                disabled={finalTranscriptions.length === 0}
                className="p-2 text-navy-500 hover:text-error-600 disabled:opacity-50"
                title="Clear transcription"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            {/* Edit/Save buttons - Show when we have transcriptions */}
            {finalTranscriptions.length > 0 && (
              <>
                {isEditing ? (
                  <>
                    <button
                      onClick={saveEdit}
                      disabled={!editedText.trim() || !isConnected}
                      className="p-2 text-success-600 hover:text-success-700 disabled:opacity-50"
                      title={currentLanguage === 'de' ? 'Speichern und Bericht generieren' : 'Save and generate report'}
                    >
                      <Save className="w-4 h-4" />
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="p-2 text-gray-500 hover:text-gray-700"
                      title={currentLanguage === 'de' ? 'Bearbeitung abbrechen' : 'Cancel editing'}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={startEdit}
                    disabled={finalTranscriptions.length === 0}
                    className="p-2 text-navy-600 hover:text-navy-700 disabled:opacity-50"
                    title={currentLanguage === 'de' ? 'Transkription bearbeiten' : 'Edit transcription'}
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                )}
              </>
            )}
            
            {/* Generate Report buttons */}
            {!isEditing && finalTranscriptions.length > 0 && (
              <>
                {onGenerateReportFromText && (
                  <button
                    onClick={onGenerateReport || (() => {})}
                    disabled={!isConnected}
                    className="px-3 py-1.5 bg-navy-600 text-white rounded-lg hover:bg-navy-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                    title={currentLanguage === 'de' ? 'Original-Bericht generieren' : 'Generate Original Report'}
                  >
                    {currentLanguage === 'de' ? 'Original' : 'Original'}
                  </button>
                )}
                {onGenerateReport && !onGenerateReportFromText && (
                  <button
                    onClick={onGenerateReport}
                    disabled={!isConnected}
                    className="px-3 py-1.5 bg-navy-600 text-white rounded-lg hover:bg-navy-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                    title={currentLanguage === 'de' ? 'Bericht generieren' : 'Generate Report'}
                  >
                    {currentLanguage === 'de' ? 'Bericht' : 'Report'}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-4 p-3 bg-navy-50 rounded-lg">
        <div className="text-center">
          <div className="text-lg font-semibold text-navy-900">
            {finalTranscriptions.length}
          </div>
          <div className="text-xs text-navy-500">Segments</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-semibold text-navy-900">
            {totalWords}
          </div>
          <div className="text-xs text-navy-500">Words</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-semibold text-orange-600">
            {finalTranscriptions.length > 0 
              ? Math.round(finalTranscriptions.reduce((acc, t) => acc + t.confidence, 0) / finalTranscriptions.length * 100)
              : 0}%
          </div>
          <div className="text-xs text-navy-500">Confidence</div>
        </div>
      </div>

      {/* Transcription Content */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="h-96 overflow-y-auto border border-navy-200 rounded-lg p-4 bg-white"
      >
        {isEditing ? (
          // Edit mode - show editable textarea
          <div className="h-full">
            <textarea
              value={editedText}
              onChange={(e) => setEditedText(e.target.value)}
              className="w-full h-full p-4 border border-navy-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder={currentLanguage === 'de' 
                ? 'Bearbeiten Sie die Transkription hier...' 
                : 'Edit the transcription here...'}
            />
          </div>
        ) : transcriptions.length === 0 ? (
          <div className="flex items-center justify-center h-full text-navy-500">
            <div className="text-center">
              <FileText className="w-12 h-12 mx-auto mb-4 text-navy-300" />
              <p className="text-sm">
                {isConnected 
                  ? 'Start recording to see live transcription...'
                  : 'Connecting to transcription service...'
                }
              </p>
            </div>
          </div>
        ) : displayMode === 'flowing' ? (
          // Flowing text mode
          <div className="p-4 bg-navy-50 rounded-lg">
            <p className="transcription-text text-navy-900 leading-relaxed">
              {finalTranscriptions.map(t => t.text).join(' ')}
              {currentTranscription && (
                <span className="text-orange-600 animate-pulse-soft">
                  {' ' + currentTranscription.text}
                </span>
              )}
            </p>
            <div ref={endOfTranscriptRef} />
          </div>
        ) : (
          // Segments mode
          <div className="space-y-4">
            {/* Final Transcriptions */}
            {finalTranscriptions.map((transcription) => (
              <div
                key={transcription.id}
                className="p-3 bg-navy-50 rounded-lg border-l-4 border-orange-500"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-navy-500">
                      {formatTimestamp(transcription.timestamp)}
                    </span>
                    <div className={cn(
                      'px-2 py-1 rounded text-xs font-medium',
                      getConfidenceColor(transcription.confidence),
                      'bg-white'
                    )}>
                      {Math.round(transcription.confidence * 100)}%
                    </div>
                  </div>
                </div>
                <p className="transcription-text text-navy-900">
                  {transcription.text}
                </p>
              </div>
            ))}

            {/* Current Live Transcription */}
            {currentTranscription && (
              <div className="p-3 bg-orange-50 rounded-lg border-l-4 border-orange-300 animate-pulse-soft">
                <div className="flex items-center space-x-2 mb-2">
                  <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
                    <span className="text-xs text-orange-600 font-medium">
                      Live
                    </span>
                  </div>
                  <div className={cn(
                    'px-2 py-1 rounded text-xs font-medium',
                    getConfidenceColor(currentTranscription.confidence),
                    'bg-white'
                  )}>
                    {Math.round(currentTranscription.confidence * 100)}%
                  </div>
                </div>
                <p className="transcription-text text-navy-800">
                  {currentTranscription.text}
                </p>
              </div>
            )}

            <div ref={endOfTranscriptRef} />
          </div>
        )}
      </div>

      {/* Auto-scroll Control */}
      {!autoScroll && (
        <div className="mt-2 flex items-center justify-center">
          <button
            onClick={() => {
              setAutoScroll(true);
              endOfTranscriptRef.current?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="text-xs text-navy-600 hover:text-orange-700 flex items-center space-x-1 px-2 py-1 rounded bg-orange-50"
          >
            <AlertCircle className="w-3 h-3" />
            <span>Click to resume auto-scroll</span>
          </button>
        </div>
      )}

      {/* Error State */}
      {!isConnected && (
        <div className="mt-4 p-3 bg-error-50 border border-error-200 rounded-md">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-error-600" />
            <p className="text-sm text-error-600">
              Connection to transcription service lost. Attempting to reconnect...
            </p>
          </div>
        </div>
      )}
    </div>
  );
}