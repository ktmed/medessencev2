import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ReportViewer from '../ReportViewer'
import { MedicalReport } from '@/types'

// Mock child components
jest.mock('../MarkdownRenderer', () => {
  return function MockMarkdownRenderer({ content }: { content: string }) {
    return <div data-testid="markdown-renderer">{content}</div>
  }
})

jest.mock('../EnhancedFindingsNew', () => {
  return function MockEnhancedFindings({ findings }: any) {
    return <div data-testid="enhanced-findings">Enhanced Findings Component</div>
  }
})

jest.mock('../ICDPredictions', () => {
  return function MockICDPredictions({ report }: any) {
    return <div data-testid="icd-predictions">ICD Predictions Component</div>
  }
})

jest.mock('../ErrorBoundary', () => ({
  EnhancedFindingsErrorBoundary: ({ children }: { children: React.ReactNode }) => children
}))

describe('ReportViewer', () => {
  const mockReport: MedicalReport = {
    id: 'report-123',
    transcriptionId: 'trans-456',
    language: 'de',
    findings: 'Mammographie-Untersuchung zeigt unauffällige Befunde beidseits.',
    impression: 'Keine pathologischen Veränderungen.',
    recommendations: 'Routinemäßige Kontrolle in 12 Monaten.',
    timestamp: new Date().toISOString(),
    metadata: {
      provider: 'openai',
      model: 'gpt-4',
      processingTime: 2500,
      confidence: 0.95,
      cacheHit: false
    },
    enhancedFindings: {
      normalFindings: ['Unauffällige Darstellung der Brustdrüse'],
      pathologicalFindings: [],
      recommendations: ['Jährliche Kontrolle'],
      confidence: 0.92,
      processingAgent: 'medical_analyzer',
      timestamp: new Date().toISOString()
    },
    icdCodes: [
      {
        code: 'Z12.31',
        description: 'Mammographie-Screening',
        confidence: 0.95
      }
    ]
  }

  const mockOnExport = jest.fn()
  const mockOnSave = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders without crashing', () => {
    render(
      <ReportViewer
        report={mockReport}
        isGenerating={false}
        language="de"
        onExport={mockOnExport}
        onSave={mockOnSave}
      />
    )
    
    expect(screen.getByText(/Befund/i)).toBeInTheDocument()
  })

  it('displays report content correctly', () => {
    render(
      <ReportViewer
        report={mockReport}
        isGenerating={false}
        language="de"
      />
    )
    
    expect(screen.getByText(mockReport.findings)).toBeInTheDocument()
    expect(screen.getByText(mockReport.impression)).toBeInTheDocument()
    expect(screen.getByText(mockReport.recommendations)).toBeInTheDocument()
  })

  it('shows loading state when generating', () => {
    render(
      <ReportViewer
        report={null}
        isGenerating={true}
        language="de"
      />
    )
    
    expect(screen.getByText(/Generating report|Bericht wird erstellt/i)).toBeInTheDocument()
  })

  it('shows empty state when no report', () => {
    render(
      <ReportViewer
        report={null}
        isGenerating={false}
        language="de"
      />
    )
    
    expect(screen.getByText(/No report generated yet|Noch kein Bericht/i)).toBeInTheDocument()
  })

  it('displays metadata information', () => {
    render(
      <ReportViewer
        report={mockReport}
        isGenerating={false}
        language="de"
      />
    )
    
    expect(screen.getByText(/openai/i)).toBeInTheDocument()
    expect(screen.getByText(/gpt-4/i)).toBeInTheDocument()
    expect(screen.getByText(/2.5.*s|2500.*ms/i)).toBeInTheDocument()
  })

  it('renders enhanced findings component when available', () => {
    render(
      <ReportViewer
        report={mockReport}
        isGenerating={false}
        language="de"
      />
    )
    
    expect(screen.getByTestId('enhanced-findings')).toBeInTheDocument()
  })

  it('renders ICD predictions component', () => {
    render(
      <ReportViewer
        report={mockReport}
        isGenerating={false}
        language="de"
      />
    )
    
    expect(screen.getByTestId('icd-predictions')).toBeInTheDocument()
  })

  it('allows editing when edit button is clicked', async () => {
    render(
      <ReportViewer
        report={mockReport}
        isGenerating={false}
        language="de"
        onSave={mockOnSave}
      />
    )
    
    const editButton = screen.getByRole('button', { name: /edit|bearbeiten/i })
    await userEvent.click(editButton)
    
    // Should show text areas for editing
    expect(screen.getByRole('textbox', { name: /findings|befund/i })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /impression|beurteilung/i })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /recommendations|empfehlung/i })).toBeInTheDocument()
  })

  it('saves edited report when save button is clicked', async () => {
    render(
      <ReportViewer
        report={mockReport}
        isGenerating={false}
        language="de"
        onSave={mockOnSave}
      />
    )
    
    // Enter edit mode
    const editButton = screen.getByRole('button', { name: /edit|bearbeiten/i })
    await userEvent.click(editButton)
    
    // Edit findings
    const findingsTextarea = screen.getByRole('textbox', { name: /findings|befund/i })
    await userEvent.clear(findingsTextarea)
    await userEvent.type(findingsTextarea, 'Updated findings text')
    
    // Save changes
    const saveButton = screen.getByRole('button', { name: /save|speichern/i })
    await userEvent.click(saveButton)
    
    expect(mockOnSave).toHaveBeenCalledWith(
      expect.objectContaining({
        ...mockReport,
        findings: 'Updated findings text'
      })
    )
  })

  it('cancels editing when cancel button is clicked', async () => {
    render(
      <ReportViewer
        report={mockReport}
        isGenerating={false}
        language="de"
        onSave={mockOnSave}
      />
    )
    
    // Enter edit mode
    const editButton = screen.getByRole('button', { name: /edit|bearbeiten/i })
    await userEvent.click(editButton)
    
    // Edit findings
    const findingsTextarea = screen.getByRole('textbox', { name: /findings|befund/i })
    await userEvent.clear(findingsTextarea)
    await userEvent.type(findingsTextarea, 'Changed text')
    
    // Cancel editing
    const cancelButton = screen.getByRole('button', { name: /cancel|abbrechen/i })
    await userEvent.click(cancelButton)
    
    // Should not call onSave
    expect(mockOnSave).not.toHaveBeenCalled()
    
    // Should show original text
    expect(screen.getByText(mockReport.findings)).toBeInTheDocument()
  })

  it('calls onExport when export button is clicked', async () => {
    render(
      <ReportViewer
        report={mockReport}
        isGenerating={false}
        language="de"
        onExport={mockOnExport}
      />
    )
    
    const exportButton = screen.getByRole('button', { name: /export|download/i })
    await userEvent.click(exportButton)
    
    expect(mockOnExport).toHaveBeenCalledWith(mockReport)
  })

  it('displays confidence indicators', () => {
    render(
      <ReportViewer
        report={mockReport}
        isGenerating={false}
        language="de"
      />
    )
    
    expect(screen.getByText(/95%/)).toBeInTheDocument()
  })

  it('shows provider-specific styling', () => {
    const claudeReport = {
      ...mockReport,
      metadata: {
        ...mockReport.metadata,
        provider: 'claude' as const
      }
    }
    
    const { container } = render(
      <ReportViewer
        report={claudeReport}
        isGenerating={false}
        language="de"
      />
    )
    
    // Should have provider-specific classes or styling
    expect(container.querySelector('.provider-claude')).toBeInTheDocument()
  })

  it('handles reports without enhanced findings', () => {
    const basicReport = {
      ...mockReport,
      enhancedFindings: undefined
    }
    
    render(
      <ReportViewer
        report={basicReport}
        isGenerating={false}
        language="de"
      />
    )
    
    // Should still render the basic report
    expect(screen.getByText(basicReport.findings)).toBeInTheDocument()
    
    // Enhanced findings component should not be rendered
    expect(screen.queryByTestId('enhanced-findings')).not.toBeInTheDocument()
  })

  it('handles reports without ICD codes', () => {
    const reportWithoutICD = {
      ...mockReport,
      icdCodes: undefined
    }
    
    render(
      <ReportViewer
        report={reportWithoutICD}
        isGenerating={false}
        language="de"
      />
    )
    
    // Should still render the report
    expect(screen.getByText(reportWithoutICD.findings)).toBeInTheDocument()
  })

  it('displays processing time correctly', () => {
    render(
      <ReportViewer
        report={mockReport}
        isGenerating={false}
        language="de"
      />
    )
    
    // Check for processing time display
    expect(screen.getByText(/2.5.*s|2500.*ms|Processing time/i)).toBeInTheDocument()
  })

  it('shows cache hit indicator when applicable', () => {
    const cachedReport = {
      ...mockReport,
      metadata: {
        ...mockReport.metadata,
        cacheHit: true
      }
    }
    
    render(
      <ReportViewer
        report={cachedReport}
        isGenerating={false}
        language="de"
      />
    )
    
    expect(screen.getByText(/cached|cache/i)).toBeInTheDocument()
  })
})