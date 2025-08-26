import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import WebSpeechRecorder from '../WebSpeechRecorder'
import { useEnhancedSpeechToText } from '../../hooks/useEnhancedSpeechToText'

// Mock the hooks
jest.mock('../../hooks/useEnhancedSpeechToText')
jest.mock('../../utils/languages', () => ({
  getMedicalTerm: jest.fn((key, lang) => key)
}))
jest.mock('../../utils', () => ({
  generateId: jest.fn(() => 'test-id-123')
}))

describe('WebSpeechRecorder', () => {
  const mockOnTranscription = jest.fn()
  const mockOnProcessingModeChange = jest.fn()
  const mockStartListening = jest.fn()
  const mockStopListening = jest.fn()
  const mockResetFinalTranscript = jest.fn()
  const mockToggleValidation = jest.fn()
  const mockManualRetry = jest.fn()

  const defaultMockReturn = {
    isListening: false,
    transcript: { text: '', isFinal: false, confidence: 0 },
    finalTranscript: '',
    startListening: mockStartListening,
    stopListening: mockStopListening,
    resetFinalTranscript: mockResetFinalTranscript,
    hasRecognitionSupport: true,
    error: null,
    validationEnabled: true,
    toggleValidation: mockToggleValidation,
    quality: {
      overall: 'good',
      confidence: 0.95,
      medicalAccuracy: 0.98,
      grammarScore: 0.92
    },
    getQualityAssessment: jest.fn(() => ({ score: 95, issues: [] })),
    confidence: 0.95,
    connectionStatus: 'connected',
    manualRetry: mockManualRetry,
    retryCount: 0,
    diagnostics: {
      browserSupport: true,
      apiAvailable: true,
      permissionStatus: 'granted'
    },
    ontologyAvailable: true,
    ontologyEnhanced: false
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useEnhancedSpeechToText as jest.Mock).mockReturnValue(defaultMockReturn)
  })

  it('renders without crashing', () => {
    render(
      <WebSpeechRecorder
        language="de"
        onTranscription={mockOnTranscription}
        processingMode="cloud"
        onProcessingModeChange={mockOnProcessingModeChange}
      />
    )
    
    // Should have at least one button (mic button)
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThan(0)
  })

  it('displays correct initial state', () => {
    render(
      <WebSpeechRecorder
        language="de"
        onTranscription={mockOnTranscription}
      />
    )
    
    // Get the first button (mic button)
    const buttons = screen.getAllByRole('button')
    const micButton = buttons[0]
    expect(micButton).not.toBeDisabled()
  })

  it('toggles recording state when button is clicked', async () => {
    render(
      <WebSpeechRecorder
        language="de"
        onTranscription={mockOnTranscription}
      />
    )
    
    // Get the first button (mic button)
    const buttons = screen.getAllByRole('button')
    const micButton = buttons[0]
    await userEvent.click(micButton)
    
    expect(mockStartListening).toHaveBeenCalled()
  })

  it('displays transcript when available', () => {
    ;(useEnhancedSpeechToText as jest.Mock).mockReturnValue({
      ...defaultMockReturn,
      isListening: true,
      transcript: { 
        text: 'Mammographie-Untersuchung zeigt unauffällige Befunde',
        isFinal: false,
        confidence: 0.92
      },
      finalTranscript: 'Mammographie-Untersuchung zeigt unauffällige Befunde',
      confidence: 0.92
    })

    render(
      <WebSpeechRecorder
        language="de"
        onTranscription={mockOnTranscription}
      />
    )
    
    expect(screen.getByText(/Mammographie-Untersuchung/)).toBeInTheDocument()
  })

  it('displays error message when browser is not supported', () => {
    ;(useEnhancedSpeechToText as jest.Mock).mockReturnValue({
      ...defaultMockReturn,
      hasRecognitionSupport: false,
      diagnostics: {
        browserSupport: false,
        apiAvailable: false,
        permissionStatus: 'denied'
      }
    })

    render(
      <WebSpeechRecorder
        language="de"
        onTranscription={mockOnTranscription}
      />
    )
    
    expect(screen.getByText(/not supported/i)).toBeInTheDocument()
  })

  it('handles language change correctly', async () => {
    const { rerender } = render(
      <WebSpeechRecorder
        language="de"
        onTranscription={mockOnTranscription}
      />
    )
    
    const button = screen.getByRole('button')
    await userEvent.click(button)
    
    expect(mockStartListening).toHaveBeenCalled()
    
    // Change language and re-render
    rerender(
      <WebSpeechRecorder
        language="en"
        onTranscription={mockOnTranscription}
      />
    )
    
    // Hook should be called with updated language config
    expect(useEnhancedSpeechToText).toHaveBeenCalledWith(
      expect.objectContaining({
        lang: 'en-US'
      })
    )
  })

  it('displays confidence score when available', () => {
    ;(useEnhancedSpeechToText as jest.Mock).mockReturnValue({
      ...defaultMockReturn,
      isListening: true,
      transcript: { 
        text: 'Test transcript',
        isFinal: false,
        confidence: 0.88
      },
      confidence: 0.88
    })

    render(
      <WebSpeechRecorder
        language="de"
        onTranscription={mockOnTranscription}
      />
    )
    
    expect(screen.getByText(/88%/)).toBeInTheDocument()
  })

  it('calls onTranscription callback when transcript changes', () => {
    ;(useEnhancedSpeechToText as jest.Mock).mockReturnValue({
      ...defaultMockReturn,
      finalTranscript: 'Medical transcription text',
      transcript: {
        text: 'Medical transcription text',
        isFinal: true,
        confidence: 0.95
      }
    })

    render(
      <WebSpeechRecorder
        language="de"
        onTranscription={mockOnTranscription}
      />
    )
    
    expect(mockOnTranscription).toHaveBeenCalled()
  })

  it('resets transcript when reset button is clicked', async () => {
    ;(useEnhancedSpeechToText as jest.Mock).mockReturnValue({
      ...defaultMockReturn,
      finalTranscript: 'Some text to reset'
    })

    render(
      <WebSpeechRecorder
        language="de"
        onTranscription={mockOnTranscription}
      />
    )
    
    const resetButton = screen.getByLabelText(/reset/i)
    await userEvent.click(resetButton)
    
    expect(mockResetFinalTranscript).toHaveBeenCalled()
  })

  it('handles processing mode change', async () => {
    render(
      <WebSpeechRecorder
        language="de"
        onTranscription={mockOnTranscription}
        processingMode="cloud"
        onProcessingModeChange={mockOnProcessingModeChange}
      />
    )
    
    const modeToggle = screen.getByLabelText(/processing mode/i)
    await userEvent.click(modeToggle)
    
    expect(mockOnProcessingModeChange).toHaveBeenCalledWith('local')
  })

  it('shows diagnostics when toggle is clicked', async () => {
    render(
      <WebSpeechRecorder
        language="de"
        onTranscription={mockOnTranscription}
      />
    )
    
    const diagnosticsToggle = screen.getByLabelText(/diagnostics/i)
    await userEvent.click(diagnosticsToggle)
    
    expect(screen.getByText(/browser support/i)).toBeInTheDocument()
  })

  it('handles connection status changes', () => {
    ;(useEnhancedSpeechToText as jest.Mock).mockReturnValue({
      ...defaultMockReturn,
      connectionStatus: 'disconnected'
    })

    render(
      <WebSpeechRecorder
        language="de"
        onTranscription={mockOnTranscription}
      />
    )
    
    expect(screen.getByText(/disconnected/i)).toBeInTheDocument()
  })

  it('shows retry button on connection failure', () => {
    ;(useEnhancedSpeechToText as jest.Mock).mockReturnValue({
      ...defaultMockReturn,
      connectionStatus: 'error',
      retryCount: 3
    })

    render(
      <WebSpeechRecorder
        language="de"
        onTranscription={mockOnTranscription}
      />
    )
    
    const retryButton = screen.getByLabelText(/retry/i)
    expect(retryButton).toBeInTheDocument()
  })

  it('handles manual retry when connection fails', async () => {
    ;(useEnhancedSpeechToText as jest.Mock).mockReturnValue({
      ...defaultMockReturn,
      connectionStatus: 'error'
    })

    render(
      <WebSpeechRecorder
        language="de"
        onTranscription={mockOnTranscription}
      />
    )
    
    const retryButton = screen.getByLabelText(/retry/i)
    await userEvent.click(retryButton)
    
    expect(mockManualRetry).toHaveBeenCalled()
  })
})