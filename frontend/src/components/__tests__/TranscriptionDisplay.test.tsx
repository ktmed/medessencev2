import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TranscriptionDisplay from '../TranscriptionDisplay'

describe('TranscriptionDisplay', () => {
  const mockTranscriptionData = {
    id: 'trans-123',
    text: 'Mammographie-Untersuchung zeigt unauffällige Befunde beidseits.',
    language: 'de' as const,
    timestamp: new Date().toISOString(),
    confidence: 0.92,
    sessionId: 'session-456',
    isFinal: true
  }

  const mockOnExport = jest.fn()
  const mockOnClear = jest.fn()
  const mockOnGenerateReport = jest.fn()
  const mockOnGenerateReportFromText = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders without crashing', () => {
    render(
      <TranscriptionDisplay
        transcriptions={[mockTranscriptionData]}
        currentLanguage="de"
        onExport={mockOnExport}
        onClear={mockOnClear}
        onGenerateReport={mockOnGenerateReport}
        onGenerateReportFromText={mockOnGenerateReportFromText}
      />
    )
    
    expect(screen.getByText(/Mammographie-Untersuchung/)).toBeInTheDocument()
  })

  it('displays transcription text correctly', () => {
    render(
      <TranscriptionDisplay
        transcriptions={[mockTranscriptionData]}
        currentLanguage="de"
        onExport={mockOnExport}
        onClear={mockOnClear}
      />
    )
    
    const textElement = screen.getByText(/Mammographie-Untersuchung zeigt unauffällige Befunde beidseits/)
    expect(textElement).toBeInTheDocument()
  })

  it('shows confidence score when available', () => {
    render(
      <TranscriptionDisplay
        transcriptions={[mockTranscriptionData]}
        currentLanguage="de"
        onExport={mockOnExport}
        onClear={mockOnClear}
      />
    )
    
    expect(screen.getByText(/92%/)).toBeInTheDocument()
  })

  it('displays language indicator', () => {
    render(
      <TranscriptionDisplay
        transcriptions={[mockTranscriptionData]}
        currentLanguage="de"
        onExport={mockOnExport}
        onClear={mockOnClear}
      />
    )
    
    expect(screen.getByText(/German|Deutsch|🇩🇪/i)).toBeInTheDocument()
  })

  it('handles empty transcriptions array', () => {
    render(
      <TranscriptionDisplay
        transcriptions={[]}
        currentLanguage="de"
        onExport={mockOnExport}
        onClear={mockOnClear}
      />
    )
    
    expect(screen.getByText(/No transcriptions yet|Keine Transkriptionen/i)).toBeInTheDocument()
  })

  it('calls onClear when clear button is clicked', async () => {
    render(
      <TranscriptionDisplay
        transcriptions={[mockTranscriptionData]}
        currentLanguage="de"
        onExport={mockOnExport}
        onClear={mockOnClear}
      />
    )
    
    const clearButton = screen.getByRole('button', { name: /clear|löschen/i })
    await userEvent.click(clearButton)
    
    expect(mockOnClear).toHaveBeenCalled()
  })

  it('calls onGenerateReport when generate button is clicked', async () => {
    render(
      <TranscriptionDisplay
        transcriptions={[mockTranscriptionData]}
        currentLanguage="de"
        onExport={mockOnExport}
        onClear={mockOnClear}
        onGenerateReport={mockOnGenerateReport}
      />
    )
    
    const generateButton = screen.getByRole('button', { name: /generate|bericht/i })
    await userEvent.click(generateButton)
    
    expect(mockOnGenerateReport).toHaveBeenCalled()
  })

  it('displays multiple transcriptions', () => {
    const multipleTranscriptions = [
      mockTranscriptionData,
      {
        ...mockTranscriptionData,
        id: 'trans-124',
        text: 'Keine pathologischen Veränderungen erkennbar.',
      }
    ]
    
    render(
      <TranscriptionDisplay
        transcriptions={multipleTranscriptions}
        currentLanguage="de"
        onExport={mockOnExport}
        onClear={mockOnClear}
      />
    )
    
    expect(screen.getByText(/Mammographie-Untersuchung/)).toBeInTheDocument()
    expect(screen.getByText(/Keine pathologischen Veränderungen/)).toBeInTheDocument()
  })

  it('allows copying transcription to clipboard', async () => {
    // Mock clipboard API
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn().mockResolvedValue(undefined)
      }
    })

    render(
      <TranscriptionDisplay
        transcriptions={[mockTranscriptionData]}
        currentLanguage="de"
        onExport={mockOnExport}
        onClear={mockOnClear}
      />
    )
    
    const copyButton = screen.getByRole('button', { name: /copy|kopieren/i })
    await userEvent.click(copyButton)
    
    expect(navigator.clipboard.writeText).toHaveBeenCalled()
  })

  it('handles display mode toggle between segments and flowing', async () => {
    render(
      <TranscriptionDisplay
        transcriptions={[mockTranscriptionData]}
        currentLanguage="de"
        onExport={mockOnExport}
        onClear={mockOnClear}
      />
    )
    
    // Look for display mode toggle button
    const toggleButton = screen.getByRole('button', { name: /flowing|segments|anzeige/i })
    await userEvent.click(toggleButton)
    
    // Should switch display modes
    expect(screen.getByRole('button', { name: /flowing|segments|anzeige/i })).toBeInTheDocument()
  })

  it('shows transcription count', () => {
    const multipleTranscriptions = [
      mockTranscriptionData,
      { ...mockTranscriptionData, id: 'trans-124' },
      { ...mockTranscriptionData, id: 'trans-125' }
    ]
    
    render(
      <TranscriptionDisplay
        transcriptions={multipleTranscriptions}
        currentLanguage="de"
        onExport={mockOnExport}
        onClear={mockOnClear}
      />
    )
    
    // Should show count of transcriptions
    expect(screen.getByText(/3/)).toBeInTheDocument()
  })

  it('handles export functionality', async () => {
    render(
      <TranscriptionDisplay
        transcriptions={[mockTranscriptionData]}
        currentLanguage="de"
        onExport={mockOnExport}
        onClear={mockOnClear}
      />
    )
    
    const exportButton = screen.getByRole('button', { name: /export|download/i })
    await userEvent.click(exportButton)
    
    expect(mockOnExport).toHaveBeenCalledWith([mockTranscriptionData])
  })
})