import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EnhancedFindings from '../EnhancedFindings'

// Mock the API service
jest.mock('../../services/apiService', () => ({
  APIService: jest.fn().mockImplementation(() => ({
    generateEnhancedFindings: jest.fn()
  }))
}))

describe('EnhancedFindings', () => {
  const mockReport = {
    id: 'report-123',
    reportText: 'Mammographie-Screening zeigt unauffällige Befunde beidseits',
    findings: 'No pathological changes detected',
    timestamp: new Date().toISOString()
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders without crashing', () => {
    render(<EnhancedFindings report={mockReport} language="de" />)
    
    expect(screen.getByText(/Enhanced Findings/i)).toBeInTheDocument()
  })

  it('displays loading state when generating findings', async () => {
    const { APIService } = require('../../services/apiService')
    const mockGenerateFindings = jest.fn(() => 
      new Promise(resolve => setTimeout(() => resolve({
        findings: [],
        confidence: 0.95
      }), 100))
    )
    
    APIService.mockImplementation(() => ({
      generateEnhancedFindings: mockGenerateFindings
    }))

    render(<EnhancedFindings report={mockReport} language="de" />)
    
    const generateButton = screen.getByRole('button', { name: /generate/i })
    await userEvent.click(generateButton)
    
    expect(screen.getByText(/generating/i)).toBeInTheDocument()
  })

  it('displays enhanced findings when generated', async () => {
    const { APIService } = require('../../services/apiService')
    const mockFindings = {
      findings: [
        {
          type: 'primary',
          description: 'Keine pathologischen Veränderungen',
          confidence: 0.95,
          anatomicalLocation: 'Bilateral mammae'
        },
        {
          type: 'secondary',
          description: 'Normale Gewebsstruktur',
          confidence: 0.90,
          anatomicalLocation: 'Breast tissue'
        }
      ],
      overallConfidence: 0.92,
      suggestedActions: ['Routine follow-up in 24 months'],
      semanticLinks: ['mammography', 'screening', 'normal']
    }
    
    APIService.mockImplementation(() => ({
      generateEnhancedFindings: jest.fn().mockResolvedValue(mockFindings)
    }))

    render(<EnhancedFindings report={mockReport} language="de" />)
    
    const generateButton = screen.getByRole('button', { name: /generate/i })
    await userEvent.click(generateButton)
    
    await waitFor(() => {
      expect(screen.getByText(/Keine pathologischen Veränderungen/)).toBeInTheDocument()
      expect(screen.getByText(/Normale Gewebsstruktur/)).toBeInTheDocument()
    })
  })

  it('displays confidence scores for findings', async () => {
    const { APIService } = require('../../services/apiService')
    const mockFindings = {
      findings: [
        {
          type: 'primary',
          description: 'Test finding',
          confidence: 0.88
        }
      ],
      overallConfidence: 0.88
    }
    
    APIService.mockImplementation(() => ({
      generateEnhancedFindings: jest.fn().mockResolvedValue(mockFindings)
    }))

    render(<EnhancedFindings report={mockReport} language="de" />)
    
    const generateButton = screen.getByRole('button', { name: /generate/i })
    await userEvent.click(generateButton)
    
    await waitFor(() => {
      expect(screen.getByText(/88%/)).toBeInTheDocument()
    })
  })

  it('handles error when generation fails', async () => {
    const { APIService } = require('../../services/apiService')
    
    APIService.mockImplementation(() => ({
      generateEnhancedFindings: jest.fn().mockRejectedValue(new Error('API Error'))
    }))

    render(<EnhancedFindings report={mockReport} language="de" />)
    
    const generateButton = screen.getByRole('button', { name: /generate/i })
    await userEvent.click(generateButton)
    
    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument()
    })
  })

  it('shows suggested actions when available', async () => {
    const { APIService } = require('../../services/apiService')
    const mockFindings = {
      findings: [{
        type: 'primary',
        description: 'Normal findings'
      }],
      suggestedActions: [
        'Routine follow-up in 24 months',
        'No immediate action required'
      ]
    }
    
    APIService.mockImplementation(() => ({
      generateEnhancedFindings: jest.fn().mockResolvedValue(mockFindings)
    }))

    render(<EnhancedFindings report={mockReport} language="de" />)
    
    const generateButton = screen.getByRole('button', { name: /generate/i })
    await userEvent.click(generateButton)
    
    await waitFor(() => {
      expect(screen.getByText(/Routine follow-up in 24 months/)).toBeInTheDocument()
      expect(screen.getByText(/No immediate action required/)).toBeInTheDocument()
    })
  })

  it('displays anatomical locations for findings', async () => {
    const { APIService } = require('../../services/apiService')
    const mockFindings = {
      findings: [
        {
          type: 'primary',
          description: 'Finding description',
          anatomicalLocation: 'Right upper quadrant'
        }
      ]
    }
    
    APIService.mockImplementation(() => ({
      generateEnhancedFindings: jest.fn().mockResolvedValue(mockFindings)
    }))

    render(<EnhancedFindings report={mockReport} language="de" />)
    
    const generateButton = screen.getByRole('button', { name: /generate/i })
    await userEvent.click(generateButton)
    
    await waitFor(() => {
      expect(screen.getByText(/Right upper quadrant/)).toBeInTheDocument()
    })
  })

  it('handles different language settings', () => {
    const { rerender } = render(
      <EnhancedFindings report={mockReport} language="de" />
    )
    
    expect(screen.getByText(/Enhanced Findings/i)).toBeInTheDocument()
    
    rerender(<EnhancedFindings report={mockReport} language="en" />)
    
    // Component should adapt to English
    expect(screen.getByText(/Enhanced Findings/i)).toBeInTheDocument()
  })

  it('disables generate button when report is empty', () => {
    const emptyReport = {
      ...mockReport,
      reportText: '',
      findings: ''
    }
    
    render(<EnhancedFindings report={emptyReport} language="de" />)
    
    const generateButton = screen.getByRole('button', { name: /generate/i })
    expect(generateButton).toBeDisabled()
  })

  it('shows semantic links when available', async () => {
    const { APIService } = require('../../services/apiService')
    const mockFindings = {
      findings: [{
        type: 'primary',
        description: 'Test finding'
      }],
      semanticLinks: ['mammography', 'breast', 'screening', 'bilateral']
    }
    
    APIService.mockImplementation(() => ({
      generateEnhancedFindings: jest.fn().mockResolvedValue(mockFindings)
    }))

    render(<EnhancedFindings report={mockReport} language="de" />)
    
    const generateButton = screen.getByRole('button', { name: /generate/i })
    await userEvent.click(generateButton)
    
    await waitFor(() => {
      expect(screen.getByText(/mammography/i)).toBeInTheDocument()
      expect(screen.getByText(/breast/i)).toBeInTheDocument()
      expect(screen.getByText(/screening/i)).toBeInTheDocument()
    })
  })

  it('allows copying findings to clipboard', async () => {
    const { APIService } = require('../../services/apiService')
    const mockFindings = {
      findings: [{
        type: 'primary',
        description: 'Test finding for copy'
      }]
    }
    
    APIService.mockImplementation(() => ({
      generateEnhancedFindings: jest.fn().mockResolvedValue(mockFindings)
    }))

    // Mock clipboard API
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn().mockResolvedValue(undefined)
      }
    })

    render(<EnhancedFindings report={mockReport} language="de" />)
    
    const generateButton = screen.getByRole('button', { name: /generate/i })
    await userEvent.click(generateButton)
    
    await waitFor(() => {
      const copyButton = screen.getByRole('button', { name: /copy/i })
      expect(copyButton).toBeInTheDocument()
    })
    
    const copyButton = screen.getByRole('button', { name: /copy/i })
    await userEvent.click(copyButton)
    
    expect(navigator.clipboard.writeText).toHaveBeenCalled()
  })

  it('categorizes findings by type', async () => {
    const { APIService } = require('../../services/apiService')
    const mockFindings = {
      findings: [
        {
          type: 'primary',
          description: 'Primary finding',
          confidence: 0.95
        },
        {
          type: 'secondary',
          description: 'Secondary finding',
          confidence: 0.85
        },
        {
          type: 'incidental',
          description: 'Incidental finding',
          confidence: 0.75
        }
      ]
    }
    
    APIService.mockImplementation(() => ({
      generateEnhancedFindings: jest.fn().mockResolvedValue(mockFindings)
    }))

    render(<EnhancedFindings report={mockReport} language="de" />)
    
    const generateButton = screen.getByRole('button', { name: /generate/i })
    await userEvent.click(generateButton)
    
    await waitFor(() => {
      expect(screen.getByText(/Primary finding/)).toBeInTheDocument()
      expect(screen.getByText(/Secondary finding/)).toBeInTheDocument()
      expect(screen.getByText(/Incidental finding/)).toBeInTheDocument()
    })
  })
})