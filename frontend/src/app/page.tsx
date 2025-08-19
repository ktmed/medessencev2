'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Activity, AlertCircle, Wifi, WifiOff } from 'lucide-react';
import WebSpeechRecorder from '@/components/WebSpeechRecorder';
import TranscriptionDisplay from '@/components/TranscriptionDisplay';
import ReportViewer from '@/components/ReportViewer';
import SummaryGenerator from '@/components/SummaryGenerator';
import LanguageSelector, { CompactLanguageSelector } from '@/components/LanguageSelector';
import { WebSocketClient } from '@/utils/websocket';
import { apiService } from '@/services/apiService';
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
  const [reportProcessingMode, setReportProcessingMode] = useState<'cloud' | 'local'>('cloud');
  
  // Debug logging for processing mode changes
  useEffect(() => {
    console.log('Report processing mode changed to:', reportProcessingMode);
  }, [reportProcessingMode]);
  const [uiState, setUIState] = useState<UIState>({
    loading: false,
    error: null,
    success: null,
  });
  
  // WebSocket connection for reports and summaries
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

  // Handle transcription from Web Speech API
  const handleTranscription = useCallback((transcription: TranscriptionData) => {
    console.log('New transcription received:', transcription);
    
    // Send transcription to websocket if it's final
    if (transcription.isFinal && transcription.text.trim() && wsClient && isConnected) {
      console.log('Sending final transcription to backend:', transcription.text.substring(0, 100) + '...');
      // Send transcription to backend for history tracking
      wsClient.socket?.emit('transcription_data', transcription);
    }
    
    setTranscriptions(prev => {
      // Replace or add the transcription
      const existingIndex = prev.findIndex(t => t.id === transcription.id);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = transcription;
        return updated;
      } else {
        return [...prev, transcription];
      }
    });
  }, [wsClient, isConnected]);



  // Generate medical report using API service
  const handleGenerateReport = useCallback(async () => {
    const finalTranscriptions = transcriptions.filter(t => t.isFinal);
    
    if (finalTranscriptions.length === 0) {
      setUIState(prev => ({ 
        ...prev, 
        error: 'No transcription available to generate report' 
      }));
      return;
    }

    try {
      // Clear any existing report and summary first
      setCurrentReport(null);
      setCurrentSummary(null);
      
      setIsGeneratingReport(true);
      setUIState(prev => ({ ...prev, error: null }));
      
      // Use original transcription
      const textToUse = finalTranscriptions.length > 0 ? finalTranscriptions[0].text : '';
      const transcriptionId = finalTranscriptions.length > 0 ? finalTranscriptions[0].id : `transcription-${Date.now()}`;
      
      console.log('🚀 Generating report via API service');
      console.log('- Processing mode:', reportProcessingMode);
      console.log('- Text length:', textToUse.length);
      
      const report = await apiService.generateReport(
        transcriptionId,
        language,
        textToUse,
        reportProcessingMode
      );
      
      setCurrentReport(report);
      setIsGeneratingReport(false);
      setUIState(prev => ({ 
        ...prev, 
        success: `Medical report generated successfully using ${report.metadata?.aiProvider || 'AI'}` 
      }));
      
      // Auto-generate ICD codes if AI was used successfully
      console.log('🔍 Report metadata check:');
      console.log('- aiGenerated:', report.metadata?.aiGenerated);
      console.log('- findings length:', report.findings?.length || 0);
      console.log('- findings content:', report.findings?.substring(0, 100) + '...');
      
      if (report.metadata?.aiGenerated && report.findings && report.findings.trim().length > 0) {
        console.log('🏥 Auto-generating ICD codes for AI report...');
        const reportContent = `${report.findings}\n\n${report.impression}\n\n${report.recommendations}`;
        console.log('📋 ICD generation content length:', reportContent.length);
        
        try {
          
          const icdCodes = await apiService.generateICDCodes(
            report.id,
            reportContent,
            language,
            'ICD-10-GM',
            reportProcessingMode
          );
          
          // Update the report with ICD codes
          setCurrentReport(prev => prev ? {
            ...prev,
            icdPredictions: icdCodes
          } : prev);
          
          console.log('✅ ICD codes added to report');
        } catch (error) {
          console.warn('⚠️ ICD code generation failed:', error);
        }

        // Auto-generate Enhanced Findings only if not already provided by the API
        const hasValidEnhancedFindings = report.enhancedFindings && (
          (report.enhancedFindings.normalFindings && report.enhancedFindings.normalFindings.length > 0) ||
          (report.enhancedFindings.pathologicalFindings && report.enhancedFindings.pathologicalFindings.length > 0) ||
          (report.enhancedFindings.specialObservations && report.enhancedFindings.specialObservations.length > 0)
        );

        if (hasValidEnhancedFindings) {
          console.log('✅ Enhanced findings already provided by report API - skipping secondary call');
          console.log('- Normal findings:', report.enhancedFindings?.normalFindings?.length || 0);
          console.log('- Pathological findings:', report.enhancedFindings?.pathologicalFindings?.length || 0);
          console.log('- Confidence:', report.enhancedFindings?.confidence);
        } else {
          try {
            console.log('🔍 Auto-generating enhanced findings for AI report (not provided by API)...');
            const enhancedFindings = await apiService.generateEnhancedFindings(
              report.id,
              reportContent,
              language
            );
            
            // Update the report with enhanced findings
            setCurrentReport(prev => prev ? {
              ...prev,
              enhancedFindings: enhancedFindings
            } : prev);
            
            console.log('✅ Enhanced findings added to report via secondary API call');
          } catch (error) {
            console.warn('⚠️ Enhanced findings generation failed:', error);
          }
        }
      } else {
        console.log('❌ Skipping ICD generation - conditions not met');
        console.log('- AI Generated:', !!report.metadata?.aiGenerated);
        console.log('- Has findings:', !!report.findings);
        console.log('- Findings not empty:', report.findings ? report.findings.trim().length > 0 : false);
      }
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setUIState(prev => ({ ...prev, success: null }));
      }, 3000);
      
    } catch (error) {
      console.error('❌ Report generation failed:', error);
      setIsGeneratingReport(false);
      setUIState(prev => ({ 
        ...prev, 
        error: `Failed to generate report: ${error instanceof Error ? error.message : 'Unknown error'}` 
      }));
    }
  }, [transcriptions, language, reportProcessingMode]);


  // Generate report from pasted text using API service
  const handleGenerateReportFromText = useCallback(async () => {
    if (!pastedText.trim()) {
      setUIState(prev => ({ 
        ...prev, 
        error: 'Please paste some text to generate a report' 
      }));
      return;
    }

    try {
      // Clear any existing report and summary first
      setCurrentReport(null);
      setCurrentSummary(null);
      
      // Create a transcription record for display
      const pastedTranscription: TranscriptionData = {
        id: `pasted-${Date.now()}`,
        text: pastedText,
        isFinal: true,
        confidence: 1.0,
        language: language,
        timestamp: Date.now()
      };
      
      // Add to transcriptions for display
      setTranscriptions(prev => [...prev, pastedTranscription]);
      
      setIsGeneratingReport(true);
      setUIState(prev => ({ ...prev, error: null }));
      
      console.log('🚀 Generating report from pasted text via API service');
      console.log('- Processing mode:', reportProcessingMode);
      console.log('- Text length:', pastedText.length);
      
      const report = await apiService.generateReport(
        pastedTranscription.id,
        language,
        pastedText,
        reportProcessingMode
      );
      
      setCurrentReport(report);
      setIsGeneratingReport(false);
      setUIState(prev => ({ 
        ...prev, 
        success: `Medical report generated successfully using ${report.metadata?.aiProvider || 'AI'}` 
      }));
      
      // Auto-generate ICD codes if AI was used successfully
      console.log('🔍 Pasted text report metadata check:');
      console.log('- aiGenerated:', report.metadata?.aiGenerated);
      console.log('- findings length:', report.findings?.length || 0);
      
      if (report.metadata?.aiGenerated && report.findings && report.findings.trim().length > 0) {
        console.log('🏥 Auto-generating ICD codes for pasted text report...');
        const reportContent = `${report.findings}\n\n${report.impression}\n\n${report.recommendations}`;
        console.log('📋 Pasted text ICD generation content length:', reportContent.length);
        
        try {
          
          const icdCodes = await apiService.generateICDCodes(
            report.id,
            reportContent,
            language,
            'ICD-10-GM',
            reportProcessingMode
          );
          
          // Update the report with ICD codes
          setCurrentReport(prev => prev ? {
            ...prev,
            icdPredictions: icdCodes
          } : prev);
          
          console.log('✅ ICD codes added to pasted text report');
        } catch (error) {
          console.warn('⚠️ ICD code generation failed for pasted text:', error);
        }

        // Auto-generate Enhanced Findings for pasted text only if not already provided by the API
        const hasValidEnhancedFindings = report.enhancedFindings && (
          (report.enhancedFindings.normalFindings && report.enhancedFindings.normalFindings.length > 0) ||
          (report.enhancedFindings.pathologicalFindings && report.enhancedFindings.pathologicalFindings.length > 0) ||
          (report.enhancedFindings.specialObservations && report.enhancedFindings.specialObservations.length > 0)
        );

        if (hasValidEnhancedFindings) {
          console.log('✅ Enhanced findings already provided by pasted text report API - skipping secondary call');
          console.log('- Normal findings:', report.enhancedFindings?.normalFindings?.length || 0);
          console.log('- Pathological findings:', report.enhancedFindings?.pathologicalFindings?.length || 0);
          console.log('- Confidence:', report.enhancedFindings?.confidence);
        } else {
          try {
            console.log('🔍 Auto-generating enhanced findings for pasted text report (not provided by API)...');
            const enhancedFindings = await apiService.generateEnhancedFindings(
              report.id,
              reportContent,
              language
            );
            
            // Update the report with enhanced findings
            setCurrentReport(prev => prev ? {
              ...prev,
              enhancedFindings: enhancedFindings
            } : prev);
            
            console.log('✅ Enhanced findings added to pasted text report via secondary API call');
          } catch (error) {
            console.warn('⚠️ Enhanced findings generation failed for pasted text:', error);
          }
        }
      } else {
        console.log('❌ Skipping pasted text ICD generation - conditions not met');
      }
      
      // Clear the paste input
      setPastedText('');
      setShowPasteInput(false);
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setUIState(prev => ({ ...prev, success: null }));
      }, 3000);
      
    } catch (error) {
      console.error('❌ Report generation from pasted text failed:', error);
      setIsGeneratingReport(false);
      setUIState(prev => ({ 
        ...prev, 
        error: `Failed to generate report: ${error instanceof Error ? error.message : 'Unknown error'}` 
      }));
    }
  }, [pastedText, language, reportProcessingMode]);

  // Generate patient summary using API service
  const handleGenerateSummary = useCallback(async (reportId: string, summaryLanguage: Language, complexity: 'simple' | 'detailed' | 'technical' = 'detailed') => {
    if (!currentReport) {
      setUIState(prev => ({ 
        ...prev, 
        error: 'No report available for summary generation' 
      }));
      return;
    }

    try {
      setIsGeneratingSummary(true);
      setUIState(prev => ({ ...prev, error: null }));
      
      console.log('📋 Generating summary via API service');
      console.log('- Report ID:', reportId);
      console.log('- Language:', summaryLanguage);
      console.log('- Complexity:', complexity);
      
      const reportContent = `${currentReport.findings}\n\n${currentReport.impression}\n\n${currentReport.recommendations}`;
      
      const summary = await apiService.generateSummary(
        reportId,
        reportContent,
        summaryLanguage,
        complexity,
        reportProcessingMode
      );
      
      setCurrentSummary(summary);
      setIsGeneratingSummary(false);
      setUIState(prev => ({ 
        ...prev, 
        success: `Patient summary generated successfully in ${summaryLanguage}` 
      }));
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setUIState(prev => ({ ...prev, success: null }));
      }, 3000);
      
    } catch (error) {
      console.error('❌ Summary generation failed:', error);
      setIsGeneratingSummary(false);
      setUIState(prev => ({ 
        ...prev, 
        error: `Failed to generate summary: ${error instanceof Error ? error.message : 'Unknown error'}` 
      }));
    }
  }, [currentReport]);

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
            
            {/* API Status */}
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-green-100 to-green-200 rounded-xl shadow-sm border border-green-300">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <Wifi className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-green-700">AI Ready</span>
              </div>
            </div>
          </div>

          {/* Language Selector */}
          <CompactLanguageSelector
            selectedLanguage={language}
            onLanguageChange={handleLanguageChange}
            disabled={false}
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
        </div>
      </div>

      {/* Main Content Grid - Three Column Layout */}
      <div className="dashboard-grid grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {/* Left Column - Input & Transcription */}
        <div className="dashboard-input space-y-6">
          {/* Web Speech Recorder */}
          <WebSpeechRecorder
            language={language}
            onTranscription={handleTranscription}
            processingMode={reportProcessingMode}
            onProcessingModeChange={setReportProcessingMode}
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
                wsClient.requestReport(editedTranscription.id, language, text, reportProcessingMode);
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
                    disabled={isGeneratingReport || !pastedText.trim()}
                    className="medical-button-primary flex-1"
                  >
                    {isGeneratingReport 
                      ? (language === 'de' ? 'Generiere...' : 'Generating...') 
                      : (language === 'de' ? 'Bericht generieren' : 'Generate Report')
                    }
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

        {/* Center Column - Medical Reports */}
        <div className="dashboard-reports space-y-6">
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
                  disabled={isGeneratingReport}
                  className="medical-button-primary"
                >
                  {isGeneratingReport ? 'Generating...' : 'Generate Report'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Patient Summaries */}
        <div className="dashboard-summaries space-y-6">
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