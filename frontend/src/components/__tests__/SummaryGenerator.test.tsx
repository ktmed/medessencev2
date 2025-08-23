import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SummaryGenerator from '../SummaryGenerator'
import { PatientSummary, MedicalReport } from '@/types'

// Mock MarkdownRenderer component
jest.mock('../MarkdownRenderer', () => {
  return function MockMarkdownRenderer({ content }: { content: string }) {
    return <div data-testid="markdown-renderer">{content}</div>
  }
})

describe('SummaryGenerator', () => {
  const mockReport: MedicalReport = {
    id: 'report-123',
    transcriptionId: 'trans-456',
    language: 'de',
    findings: 'Test findings',
    impression: 'Test impression',
    recommendations: 'Test recommendations',
    timestamp: new Date().toISOString(),
    metadata: {
      provider: 'openai',
      model: 'gpt-4',
      processingTime: 2500,
      confidence: 0.95,
      cacheHit: false
    }
  }

  const mockSummary: PatientSummary = {
    id: 'summary-123',
    reportId: 'report-123',
    language: 'de',
    summary: 'Die Mammographie-Untersuchung zeigt normale Befunde ohne Auffälligkeiten.',
    keyFindings: [
      'Keine verdächtigen Läsionen',
      'Normale Brustdichte',
      'Keine Mikrokalzifikationen'
    ],
    actionItems: [
      'Routinekontrolle in 12 Monaten',
      'Keine weitere Abklärung erforderlich'
    ],
    patientFriendlyExplanation: 'Ihre Untersuchung hat keine besorgniserregenden Befunde gezeigt.',
    complexity: 'simple',
    timestamp: new Date().toISOString(),
    metadata: {
      provider: 'openai',
      model: 'gpt-4',
      processingTime: 1500
    }
  }

  const mockOnGenerate = jest.fn()
  const mockOnExport = jest.fn()
  const mockOnLanguageChange = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders without crashing', () => {
    render(
      <SummaryGenerator
        summary={mockSummary}
        report={mockReport}
        isGenerating={false}
        language="de"
        onGenerate={mockOnGenerate}
      />
    )
    
    expect(screen.getByText(/Patient.*Summary|Patientenzusammenfassung/i)).toBeInTheDocument()
  })

  it('displays summary content when available', () => {
    render(
      <SummaryGenerator
        summary={mockSummary}
        report={mockReport}
        isGenerating={false}
        language="de"
      />
    )
    
    expect(screen.getByText(mockSummary.summary)).toBeInTheDocument()
  })

  it('displays key findings', () => {
    render(
      <SummaryGenerator
        summary={mockSummary}
        report={mockReport}
        isGenerating={false}
        language="de"
      />
    )
    
    mockSummary.keyFindings.forEach(finding => {
      expect(screen.getByText(finding)).toBeInTheDocument()
    })
  })

  it('displays action items', () => {
    render(
      <SummaryGenerator
        summary={mockSummary}
        report={mockReport}
        isGenerating={false}
        language="de"
      />
    )
    
    mockSummary.actionItems.forEach(item => {
      expect(screen.getByText(item)).toBeInTheDocument()
    })
  })

  it('displays patient-friendly explanation', () => {
    render(
      <SummaryGenerator
        summary={mockSummary}
        report={mockReport}
        isGenerating={false}
        language="de"
      />
    )
    
    expect(screen.getByText(mockSummary.patientFriendlyExplanation!)).toBeInTheDocument()
  })

  it('shows loading state when generating', () => {
    render(
      <SummaryGenerator
        summary={null}
        report={mockReport}
        isGenerating={true}
        language="de"
      />
    )
    
    expect(screen.getByText(/Generating.*summary|Zusammenfassung wird erstellt/i)).toBeInTheDocument()
  })

  it('shows empty state when no summary', () => {
    render(
      <SummaryGenerator
        summary={null}
        report={mockReport}
        isGenerating={false}
        language="de"
      />
    )
    
    expect(screen.getByText(/No summary.*yet|Noch keine Zusammenfassung/i)).toBeInTheDocument()
  })

  it('calls onGenerate when generate button is clicked', async () => {
    render(
      <SummaryGenerator
        summary={null}
        report={mockReport}
        isGenerating={false}
        language="de"
        onGenerate={mockOnGenerate}
      />
    )
    
    const generateButton = screen.getByRole('button', { name: /generate|erstellen/i })
    await userEvent.click(generateButton)
    
    expect(mockOnGenerate).toHaveBeenCalledWith(
      mockReport.id,
      'de',
      'simple' // Always uses simple complexity
    )
  })

  it('disables generate button when no report', () => {
    render(
      <SummaryGenerator
        summary={null}
        report={null}
        isGenerating={false}
        language="de"
        onGenerate={mockOnGenerate}
      />
    )
    
    const generateButton = screen.getByRole('button', { name: /generate|erstellen/i })
    expect(generateButton).toBeDisabled()
  })

  it('disables generate button when generating', () => {
    render(
      <SummaryGenerator
        summary={null}
        report={mockReport}
        isGenerating={true}
        language="de"
        onGenerate={mockOnGenerate}
      />
    )
    
    const generateButton = screen.queryByRole('button', { name: /generate|erstellen/i })
    expect(generateButton).toBeDisabled()
  })

  it('allows language selection', async () => {
    render(
      <SummaryGenerator
        summary={mockSummary}
        report={mockReport}
        isGenerating={false}
        language="de"
        onLanguageChange={mockOnLanguageChange}
      />
    )
    
    // Look for language selector
    const languageSelector = screen.getByRole('combobox', { name: /language|sprache/i })
    await userEvent.selectOptions(languageSelector, 'en')
    
    expect(mockOnLanguageChange).toHaveBeenCalledWith('en')
  })

  it('allows regenerating summary with different language', async () => {
    render(
      <SummaryGenerator
        summary={mockSummary}
        report={mockReport}
        isGenerating={false}
        language="de"
        onGenerate={mockOnGenerate}
      />
    )
    
    const regenerateButton = screen.getByRole('button', { name: /regenerate|neu.*generieren/i })
    await userEvent.click(regenerateButton)
    
    expect(mockOnGenerate).toHaveBeenCalledWith(
      mockReport.id,
      'de',
      'simple'
    )
  })

  it('calls onExport when export button is clicked', async () => {
    render(
      <SummaryGenerator
        summary={mockSummary}
        report={mockReport}
        isGenerating={false}
        language="de"
        onExport={mockOnExport}
      />
    )
    
    const exportButton = screen.getByRole('button', { name: /export|download/i })
    await userEvent.click(exportButton)
    
    expect(mockOnExport).toHaveBeenCalledWith(mockSummary)
  })

  it('allows editing summary when edit button is clicked', async () => {
    render(
      <SummaryGenerator
        summary={mockSummary}
        report={mockReport}
        isGenerating={false}
        language="de"
      />
    )
    
    const editButton = screen.getByRole('button', { name: /edit|bearbeiten/i })
    await userEvent.click(editButton)
    
    // Should show textarea for editing
    expect(screen.getByRole('textbox', { name: /summary|zusammenfassung/i })).toBeInTheDocument()
  })

  it('saves edited summary', async () => {
    const mockOnSave = jest.fn()
    
    render(
      <SummaryGenerator
        summary={mockSummary}
        report={mockReport}
        isGenerating={false}
        language="de"
        onSave={mockOnSave}
      />
    )
    
    // Enter edit mode
    const editButton = screen.getByRole('button', { name: /edit|bearbeiten/i })
    await userEvent.click(editButton)
    
    // Edit summary
    const summaryTextarea = screen.getByRole('textbox', { name: /summary|zusammenfassung/i })
    await userEvent.clear(summaryTextarea)
    await userEvent.type(summaryTextarea, 'Updated summary text')
    
    // Save changes
    const saveButton = screen.getByRole('button', { name: /save|speichern/i })
    await userEvent.click(saveButton)
    
    expect(mockOnSave).toHaveBeenCalledWith(
      expect.objectContaining({
        ...mockSummary,
        summary: 'Updated summary text'
      })
    )
  })

  it('cancels editing when cancel button is clicked', async () => {
    render(
      <SummaryGenerator
        summary={mockSummary}
        report={mockReport}
        isGenerating={false}
        language="de"
      />
    )
    
    // Enter edit mode
    const editButton = screen.getByRole('button', { name: /edit|bearbeiten/i })
    await userEvent.click(editButton)
    
    // Edit summary
    const summaryTextarea = screen.getByRole('textbox', { name: /summary|zusammenfassung/i })
    await userEvent.clear(summaryTextarea)
    await userEvent.type(summaryTextarea, 'Changed text')
    
    // Cancel editing
    const cancelButton = screen.getByRole('button', { name: /cancel|abbrechen/i })
    await userEvent.click(cancelButton)
    
    // Should show original text
    expect(screen.getByText(mockSummary.summary)).toBeInTheDocument()
  })

  it('displays metadata information', () => {
    render(
      <SummaryGenerator
        summary={mockSummary}
        report={mockReport}
        isGenerating={false}
        language="de"
      />
    )
    
    expect(screen.getByText(/openai/i)).toBeInTheDocument()
    expect(screen.getByText(/gpt-4/i)).toBeInTheDocument()
    expect(screen.getByText(/1.5.*s|1500.*ms/i)).toBeInTheDocument()
  })

  it('shows appropriate icons for different sections', () => {
    const { container } = render(
      <SummaryGenerator
        summary={mockSummary}
        report={mockReport}
        isGenerating={false}
        language="de"
      />
    )
    
    // Check for section icons (may need to adjust based on actual implementation)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('handles summaries without optional fields', () => {
    const minimalSummary = {
      ...mockSummary,
      patientFriendlyExplanation: undefined,
      actionItems: []
    }
    
    render(
      <SummaryGenerator
        summary={minimalSummary}
        report={mockReport}
        isGenerating={false}
        language="de"
      />
    )
    
    // Should still render the basic summary
    expect(screen.getByText(minimalSummary.summary)).toBeInTheDocument()
  })

  it('syncs language with parent prop changes', () => {
    const { rerender } = render(
      <SummaryGenerator
        summary={mockSummary}
        report={mockReport}
        isGenerating={false}
        language="de"
        onGenerate={mockOnGenerate}
      />
    )
    
    // Change language prop
    rerender(
      <SummaryGenerator
        summary={mockSummary}
        report={mockReport}
        isGenerating={false}
        language="en"
        onGenerate={mockOnGenerate}
      />
    )
    
    // Should reflect new language
    expect(screen.getByText(/Patient Summary/i)).toBeInTheDocument()
  })
})