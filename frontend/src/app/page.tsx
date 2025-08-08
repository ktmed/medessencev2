'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Activity, AlertCircle, Wifi, WifiOff } from 'lucide-react';
import AudioRecorder from '@/components/AudioRecorder';
import TranscriptionDisplay from '@/components/TranscriptionDisplay';
import ReportViewer from '@/components/ReportViewer';
import SummaryGenerator from '@/components/SummaryGenerator';
import LanguageSelector, { CompactLanguageSelector } from '@/components/LanguageSelector';
import { WebSocketClient } from '@/utils/websocket';
import { AudioRecorder as AudioRecorderUtil } from '@/utils/audio';
import { 
  Language, 
  TranscriptionData, 
  MedicalReport, 
  PatientSummary, 
  AudioRecordingState,
  RecordingError,
  UIState
} from '@/types';
import { generateId, cn } from '@/utils';
import { getMedicalTerm } from '@/utils/languages';

export default function Dashboard() {
  // State management
  const [language, setLanguage] = useState<Language>('de');
  const [transcriptions, setTranscriptions] = useState<TranscriptionData[]>([]);
  const [currentReport, setCurrentReport] = useState<MedicalReport | null>(null);
  const [currentSummary, setCurrentSummary] = useState<PatientSummary | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const transcriptionStartedRef = useRef(false);
  const [recordingState, setRecordingState] = useState<AudioRecordingState>({
    isRecording: false,
    isPaused: false,
    duration: 0,
    audioLevel: 0,
  });
  const [uiState, setUIState] = useState<UIState>({
    loading: false,
    error: null,
    success: null,
  });
  
  // WebSocket connection
  const [wsClient, setWsClient] = useState<WebSocketClient | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const [pastedText, setPastedText] = useState('');
  const [showPasteInput, setShowPasteInput] = useState(false);

  // Initialize WebSocket connection
  useEffect(() => {
    if (wsClient) {
      console.log('WebSocket already initialized, skipping');
      return;
    }
    
    const initializeWebSocket = async () => {
      try {
        setUIState(prev => ({ ...prev, loading: true, error: null }));
        
        const client = new WebSocketClient();
        await client.connect();
        
        // Set the client immediately
        setWsClient(client);
        
        // Check connection status after a short delay to ensure socket.io has fully connected
        setTimeout(() => {
          const connected = client.isConnected();
          console.log('Connection status check after delay:', connected);
          setIsConnected(connected);
        }, 500);
        
        setConnectionAttempts(0);
        
        // Also listen for connection events to update status
        if (client.socket) {
          client.socket.on('connect', () => {
            console.log('Socket.io connect event received');
            setIsConnected(true);
          });
          
          client.socket.on('disconnect', () => {
            console.log('Socket.io disconnect event received');
            setIsConnected(false);
          });
        }
        
        // Set up event listeners
        client.onTranscription((data: TranscriptionData) => {
          setTranscriptions(prev => {
            // If this is a final transcription, mark it as final and add it
            if (data.text && data.text.trim() !== '') {
              const newTranscription = { ...data, isFinal: true };
              return [...prev, newTranscription];
            }
            return prev;
          });
        });
        
        // Listen for partial transcriptions
        if (client.socket) {
          client.socket.on('partial_transcription', (data: any) => {
            console.log('Partial transcription:', data.text);
            setTranscriptions(prev => {
              // Update the last transcription if it's not final
              if (prev.length > 0 && !prev[prev.length - 1].isFinal) {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  ...updated[updated.length - 1],
                  text: data.text,
                  timestamp: Date.now()
                };
                return updated;
              } else {
                // Add a new partial transcription
                return [...prev, {
                  id: `partial-${Date.now()}`,
                  text: data.text,
                  isFinal: false,
                  confidence: 0,
                  language: data.language || language,
                  timestamp: Date.now()
                }];
              }
            });
          });
        }

        client.onReport((data: MedicalReport) => {
          console.log('Report received in frontend:', data);
          console.log('🔍 ICD Debug - Raw data has icdPredictions:', !!data.icdPredictions);
          if (data.icdPredictions) {
            console.log('🔍 ICD Debug - ICD codes count:', data.icdPredictions.codes?.length || 0);
            console.log('🔍 ICD Debug - ICD structure:', data.icdPredictions);
          } else {
            console.log('🔍 ICD Debug - Available keys in data:', Object.keys(data));
          }
          setCurrentReport(data);
          setIsGeneratingReport(false);
          setUIState(prev => ({ 
            ...prev, 
            success: 'Medical report generated successfully' 
          }));
          
          // Clear success message after 3 seconds
          setTimeout(() => {
            setUIState(prev => ({ ...prev, success: null }));
          }, 3000);
        });

        client.onSummary((data: PatientSummary) => {
          setCurrentSummary(data);
          setIsGeneratingSummary(false);
          setUIState(prev => ({ 
            ...prev, 
            success: 'Patient summary generated successfully' 
          }));
          
          // Clear success message after 3 seconds
          setTimeout(() => {
            setUIState(prev => ({ ...prev, success: null }));
          }, 3000);
        });

        client.onError((error: any) => {
          console.error('WebSocket error:', error);
          setUIState(prev => ({ 
            ...prev, 
            error: `Connection error: ${error.message || 'Unknown error'}` 
          }));
        });

        setUIState(prev => ({ ...prev, loading: false }));
        
      } catch (error) {
        console.error('Failed to initialize WebSocket:', error);
        setIsConnected(false);
        setConnectionAttempts(prev => prev + 1);
        setUIState(prev => ({ 
          ...prev, 
          loading: false,
          error: 'Failed to connect to transcription service. Retrying...' 
        }));
        
        // Retry connection after delay
        if (connectionAttempts < 5) {
          setTimeout(() => {
            initializeWebSocket();
          }, 2000 * Math.pow(2, connectionAttempts)); // Exponential backoff
        }
      }
    };

    initializeWebSocket();

    // Cleanup on unmount
    return () => {
      // Capture the current client to avoid closure issues
      const currentClient = wsClient;
      if (currentClient) {
        // @ts-ignore - TypeScript inference issue with removeAllListeners
        currentClient.removeAllListeners();
        // @ts-ignore - TypeScript inference issue with disconnect
        currentClient.disconnect();
      }
    };
  }, []);

  // Handle audio data from recorder
  const handleAudioData = useCallback((audioData: ArrayBuffer) => {
    console.log('handleAudioData called, wsClient:', !!wsClient, 'isConnected:', isConnected);
    
    // Double-check connection status
    const actuallyConnected = wsClient?.isConnected() || false;
    console.log('Actual connection status:', actuallyConnected);
    
    if (wsClient && actuallyConnected) {
      console.log('Sending audio data chunk, size:', audioData.byteLength);
      
      // Start transcription session only once at the beginning
      if (!transcriptionStartedRef.current && wsClient.socket) {
        console.log('Starting transcription session');
        wsClient.socket.emit('start_transcription', { language });
        transcriptionStartedRef.current = true;
        setIsTranscribing(true);
      }
      
      // Send audio data chunk
      wsClient.sendAudioData(audioData, language);
    } else {
      console.error('Cannot send audio - not connected. wsClient:', !!wsClient, 'connected:', actuallyConnected);
      setUIState(prev => ({ 
        ...prev, 
        error: 'Not connected to transcription service' 
      }));
    }
  }, [wsClient, language, isTranscribing]);

  // Handle recording errors
  const handleRecordingError = useCallback((error: RecordingError) => {
    setUIState(prev => ({ 
      ...prev, 
      error: `Recording error: ${error.message}` 
    }));
  }, []);

  // Generate medical report
  const handleGenerateReport = useCallback(() => {
    const finalTranscriptions = transcriptions.filter(t => t.isFinal);
    
    if (finalTranscriptions.length === 0) {
      setUIState(prev => ({ 
        ...prev, 
        error: 'No transcription available to generate report' 
      }));
      return;
    }

    if (wsClient && isConnected) {
      // Clear any existing report and summary first
      setCurrentReport(null);
      setCurrentSummary(null);
      
      setIsGeneratingReport(true);
      setUIState(prev => ({ ...prev, error: null }));
      
      // Use the first transcription ID as reference
      wsClient.requestReport(finalTranscriptions[0].id, language);
    } else {
      setUIState(prev => ({ 
        ...prev, 
        error: 'Not connected to report generation service' 
      }));
    }
  }, [transcriptions, wsClient, isConnected, language]);

  // Generate report from pasted text
  const handleGenerateReportFromText = useCallback(() => {
    if (!pastedText.trim()) {
      setUIState(prev => ({ 
        ...prev, 
        error: 'Please paste some text to generate a report' 
      }));
      return;
    }

    if (wsClient && isConnected) {
      // Clear any existing report and summary first
      setCurrentReport(null);
      setCurrentSummary(null);
      
      // Create a fake transcription with the pasted text
      const fakeTranscription: TranscriptionData = {
        id: `pasted-${Date.now()}`,
        text: pastedText,
        isFinal: true,
        confidence: 1.0,
        language: language,
        timestamp: Date.now()
      };
      
      // Add to transcriptions so report generation can use it
      setTranscriptions(prev => [...prev, fakeTranscription]);
      
      setIsGeneratingReport(true);
      setUIState(prev => ({ ...prev, error: null }));
      
      // Request report generation with the actual text
      wsClient.requestReport(fakeTranscription.id, language, pastedText);
      
      // Clear the paste input
      setPastedText('');
      setShowPasteInput(false);
    } else {
      setUIState(prev => ({ 
        ...prev, 
        error: 'Not connected to report generation service' 
      }));
    }
  }, [pastedText, wsClient, isConnected, language]);

  // Generate patient summary
  const handleGenerateSummary = useCallback((reportId: string, summaryLanguage: Language) => {
    if (wsClient && isConnected) {
      setIsGeneratingSummary(true);
      setUIState(prev => ({ ...prev, error: null }));
      wsClient.requestSummary(reportId, summaryLanguage);
    } else {
      setUIState(prev => ({ 
        ...prev, 
        error: 'Not connected to summary generation service' 
      }));
    }
  }, [wsClient, isConnected]);

  // Handle language change
  const handleLanguageChange = useCallback((newLanguage: Language) => {
    setLanguage(newLanguage);
    
    // Clear current data when language changes
    setTranscriptions([]);
    setCurrentReport(null);
    setCurrentSummary(null);
    
    setUIState(prev => ({ 
      ...prev, 
      success: `Language changed to ${newLanguage.toUpperCase()}` 
    }));
    
    setTimeout(() => {
      setUIState(prev => ({ ...prev, success: null }));
    }, 2000);
  }, []);

  // Removed auto-generation - now requires manual button click

  // Clear error messages after 5 seconds
  useEffect(() => {
    if (uiState.error) {
      const timeout = setTimeout(() => {
        setUIState(prev => ({ ...prev, error: null }));
      }, 5000);
      
      return () => clearTimeout(timeout);
    }
  }, [uiState.error]);

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="medical-card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 med-navy-gradient rounded-xl flex items-center justify-center shadow-md">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold med-text-navy">
                  {getMedicalTerm('dashboard', language)}
                </h2>
                <p className="text-sm text-navy-600 -mt-1">Real-time Medical Analysis</p>
              </div>
            </div>
            
            {/* Connection Status */}
            <div className="flex items-center space-x-2">
              {isConnected ? (
                <div className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-orange-100 to-orange-200 rounded-xl shadow-sm border border-orange-300">
                  <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                  <Wifi className="w-4 h-4 text-orange-600" />
                  <span className="text-sm font-medium text-orange-700">Connected</span>
                </div>
              ) : (
                <div className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-error-100 to-error-200 rounded-xl shadow-sm border border-error-300">
                  <div className="w-2 h-2 bg-error-500 rounded-full animate-pulse"></div>
                  <WifiOff className="w-4 h-4 text-error-600" />
                  <span className="text-sm font-medium text-error-700">
                    {connectionAttempts > 0 ? `Reconnecting... (${connectionAttempts}/5)` : 'Disconnected'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Language Selector */}
          <CompactLanguageSelector
            selectedLanguage={language}
            onLanguageChange={handleLanguageChange}
            disabled={recordingState.isRecording}
          />
        </div>

        {/* System Status Messages */}
        {uiState.error && (
          <div className="mb-4 p-3 bg-error-50 border border-error-200 rounded-md">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-error-600" />
              <p className="text-sm text-error-600">{uiState.error}</p>
            </div>
          </div>
        )}

        {uiState.success && (
          <div className="mb-4 p-3 bg-success-50 border border-success-200 rounded-md">
            <div className="flex items-center space-x-2">
              <Activity className="w-4 h-4 text-success-600" />
              <p className="text-sm text-success-600">{uiState.success}</p>
            </div>
          </div>
        )}

        {/* Session Statistics */}
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center p-3 bg-navy-50 rounded-lg border border-navy-200">
            <div className="text-2xl font-bold med-text-navy">
              {transcriptions.filter(t => t.isFinal).length}
            </div>
            <div className="text-sm text-navy-600">Transcriptions</div>
          </div>
          <div className="text-center p-3 bg-navy-50 rounded-lg border border-navy-200">
            <div className="text-2xl font-bold med-text-navy">
              {currentReport ? 1 : 0}
            </div>
            <div className="text-sm text-navy-600">Reports</div>
          </div>
          <div className="text-center p-3 bg-navy-50 rounded-lg border border-navy-200">
            <div className="text-2xl font-bold med-text-navy">
              {currentSummary ? 1 : 0}
            </div>
            <div className="text-sm text-navy-600">Summaries</div>
          </div>
          <div className="text-center p-3 bg-orange-50 rounded-lg border border-orange-200">
            <div className="text-2xl font-bold text-orange-700">
              {Math.round(recordingState.duration)}s
            </div>
            <div className="text-sm text-orange-600">Recording Time</div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Audio Recorder */}
          <AudioRecorder
            language={language}
            onAudioData={handleAudioData}
            onRecordingStateChange={(state) => {
              setRecordingState(state);
              // Reset transcribing flag when recording stops
              if (!state.isRecording) {
                setIsTranscribing(false);
                transcriptionStartedRef.current = false;
                // Emit stop transcription event
                if (wsClient?.socket) {
                  wsClient.socket.emit('stop_transcription');
                }
              }
            }}
            onError={handleRecordingError}
          />

          {/* Transcription Display */}
          <TranscriptionDisplay
            transcriptions={transcriptions}
            currentLanguage={language}
            isConnected={isConnected}
            onClear={() => setTranscriptions([])}
            onGenerateReport={handleGenerateReport}
            onGenerateReportFromText={(text) => {
              // Generate report from edited transcription text
              if (wsClient && isConnected) {
                // Clear any existing report and summary first
                setCurrentReport(null);
                setCurrentSummary(null);
                
                // Create a fake transcription with the edited text
                const editedTranscription: TranscriptionData = {
                  id: `edited-${Date.now()}`,
                  text: text,
                  isFinal: true,
                  confidence: 1.0,
                  language: language,
                  timestamp: Date.now()
                };
                
                // Add to transcriptions so report generation can use it
                setTranscriptions(prev => [...prev, editedTranscription]);
                
                setIsGeneratingReport(true);
                setUIState(prev => ({ ...prev, error: null }));
                
                // Request report generation with the edited text
                wsClient.requestReport(editedTranscription.id, language, text);
              } else {
                setUIState(prev => ({
                  ...prev,
                  error: 'Not connected to report generation service'
                }));
              }
            }}
          />

          {/* Paste Text Input */}
          <div className="medical-card">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {showPasteInput ? 'Edit Medical Text' : 'Alternative Input Method'}
              </h3>
              <button
                onClick={() => setShowPasteInput(!showPasteInput)}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                {showPasteInput ? 'Hide' : 'Paste & Edit Text'}
              </button>
            </div>
            
            {showPasteInput && (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  {language === 'de' 
                    ? 'Fügen Sie einen medizinischen Text ein und bearbeiten Sie ihn vor der Berichtserstellung'
                    : 'Paste a medical text and edit it before generating the structured report'}
                </p>
                <div className="relative">
                  <textarea
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                    placeholder={language === 'de' 
                      ? "Fügen Sie hier Ihren medizinischen Text ein und bearbeiten Sie ihn bei Bedarf..." 
                      : "Paste your medical text here and edit as needed..."}
                    className="w-full h-40 px-4 py-3 border border-gray-300 rounded-lg resize-vertical focus:outline-none focus:ring-2 focus:ring-medical-500 focus:border-transparent"
                  />
                  <div className="absolute bottom-2 right-2 text-xs text-gray-400">
                    {pastedText.length} characters
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleGenerateReportFromText}
                    disabled={!isConnected || !pastedText.trim()}
                    className="medical-button-primary flex-1"
                  >
                    {language === 'de' ? 'Bericht generieren' : 'Generate Report'}
                  </button>
                  <button
                    onClick={() => setPastedText('')}
                    disabled={!pastedText.trim()}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {language === 'de' ? 'Löschen' : 'Clear'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Report Viewer */}
          <ReportViewer
            report={currentReport}
            isGenerating={isGeneratingReport}
            language={language}
          />

          {/* Manual Report Generation */}
          {transcriptions.filter(t => t.isFinal).length > 0 && !currentReport && !isGeneratingReport && (
            <div className="medical-card">
              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Generate Medical Report
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Create a structured medical report from your transcription
                </p>
                <button
                  onClick={handleGenerateReport}
                  disabled={!isConnected}
                  className="medical-button-primary"
                >
                  Generate Report
                </button>
              </div>
            </div>
          )}

          {/* Summary Generator */}
          <SummaryGenerator
            summary={currentSummary}
            report={currentReport}
            isGenerating={isGeneratingSummary}
            language={language}
            onGenerate={handleGenerateSummary}
          />
        </div>
      </div>

      {/* Loading Overlay */}
      {uiState.loading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-navy-200 border-t-navy-600 rounded-full mx-auto mb-4" />
            <p className="text-gray-600">Initializing system...</p>
          </div>
        </div>
      )}
    </div>
  );
}