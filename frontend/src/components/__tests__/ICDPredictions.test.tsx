import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ICDPredictions from '../ICDPredictions'

// Mock the API service
jest.mock('../../services/apiService', () => ({
  APIService: jest.fn().mockImplementation(() => ({
    generateICDCodes: jest.fn()
  }))
}))

describe('ICDPredictions', () => {
  const mockReport = {
    id: 'report-123',
    reportText: 'Mammographie-Screening zeigt unauffällige Befunde',
    findings: 'Normal mammography findings',
    diagnosis: 'No malignancy detected'
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders without crashing', () => {
    render(<ICDPredictions report={mockReport} language="de" />)
    
    expect(screen.getByText(/ICD.*Predictions/i)).toBeInTheDocument()
  })

  it('displays loading state when generating ICD codes', async () => {
    const { APIService } = require('../../services/apiService')
    const mockGenerateICDCodes = jest.fn(() => 
      new Promise(resolve => setTimeout(() => resolve({
        codes: [],
        confidence: 0.95
      }), 100))
    )
    
    APIService.mockImplementation(() => ({
      generateICDCodes: mockGenerateICDCodes
    }))

    render(<ICDPredictions report={mockReport} language="de" />)
    
    const generateButton = screen.getByRole('button', { name: /generate.*ICD/i })
    await userEvent.click(generateButton)
    
    expect(screen.getByText(/generating/i)).toBeInTheDocument()
  })

  it('displays ICD codes when generated', async () => {
    const { APIService } = require('../../services/apiService')
    const mockICDCodes = {
      codes: [
        {
          code: 'Z12.31',
          description: 'Mammographie-Screening',
          confidence: 0.95,
          category: 'Screening'
        },
        {
          code: 'R92.8',
          description: 'Sonstige abnorme Befunde bei der bildgebenden Diagnostik der Mamma',
          confidence: 0.85,
          category: 'Findings'
        }
      ],
      summary: {
        primaryDiagnoses: 1,
        secondaryDiagnoses: 1,
        totalCodes: 2
      }
    }
    
    APIService.mockImplementation(() => ({
      generateICDCodes: jest.fn().mockResolvedValue(mockICDCodes)
    }))

    render(<ICDPredictions report={mockReport} language="de" />)
    
    const generateButton = screen.getByRole('button', { name: /generate.*ICD/i })
    await userEvent.click(generateButton)
    
    await waitFor(() => {
      expect(screen.getByText('Z12.31')).toBeInTheDocument()
      expect(screen.getByText(/Mammographie-Screening/)).toBeInTheDocument()
      expect(screen.getByText('R92.8')).toBeInTheDocument()
    })
  })

  it('displays confidence scores for each ICD code', async () => {
    const { APIService } = require('../../services/apiService')
    const mockICDCodes = {
      codes: [
        {
          code: 'Z12.31',
          description: 'Test description',
          confidence: 0.88
        }
      ]
    }
    
    APIService.mockImplementation(() => ({
      generateICDCodes: jest.fn().mockResolvedValue(mockICDCodes)
    }))

    render(<ICDPredictions report={mockReport} language="de" />)
    
    const generateButton = screen.getByRole('button', { name: /generate.*ICD/i })
    await userEvent.click(generateButton)
    
    await waitFor(() => {
      expect(screen.getByText(/88%/)).toBeInTheDocument()
    })
  })

  it('handles error when generation fails', async () => {
    const { APIService } = require('../../services/apiService')
    
    APIService.mockImplementation(() => ({
      generateICDCodes: jest.fn().mockRejectedValue(new Error('ICD generation failed'))
    }))

    render(<ICDPredictions report={mockReport} language="de" />)
    
    const generateButton = screen.getByRole('button', { name: /generate.*ICD/i })
    await userEvent.click(generateButton)
    
    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument()
      expect(screen.getByText(/ICD generation failed/)).toBeInTheDocument()
    })
  })

  it('displays code categories when available', async () => {
    const { APIService } = require('../../services/apiService')
    const mockICDCodes = {
      codes: [
        {
          code: 'Z12.31',
          description: 'Screening',
          category: 'Preventive Care',
          confidence: 0.95
        },
        {
          code: 'C50.9',
          description: 'Malignant neoplasm',
          category: 'Oncology',
          confidence: 0.75
        }
      ]
    }
    
    APIService.mockImplementation(() => ({
      generateICDCodes: jest.fn().mockResolvedValue(mockICDCodes)
    }))

    render(<ICDPredictions report={mockReport} language="de" />)
    
    const generateButton = screen.getByRole('button', { name: /generate.*ICD/i })
    await userEvent.click(generateButton)
    
    await waitFor(() => {
      expect(screen.getByText(/Preventive Care/)).toBeInTheDocument()
      expect(screen.getByText(/Oncology/)).toBeInTheDocument()
    })
  })

  it('allows selecting specific ICD codes', async () => {
    const { APIService } = require('../../services/apiService')
    const mockICDCodes = {
      codes: [
        {
          code: 'Z12.31',
          description: 'Mammographie-Screening',
          confidence: 0.95
        },
        {
          code: 'R92.8',
          description: 'Other findings',
          confidence: 0.85
        }
      ]
    }
    
    APIService.mockImplementation(() => ({
      generateICDCodes: jest.fn().mockResolvedValue(mockICDCodes)
    }))

    render(<ICDPredictions report={mockReport} language="de" />)
    
    const generateButton = screen.getByRole('button', { name: /generate.*ICD/i })
    await userEvent.click(generateButton)
    
    await waitFor(() => {
      const checkboxes = screen.getAllByRole('checkbox')
      expect(checkboxes).toHaveLength(2)
    })
    
    const firstCheckbox = screen.getAllByRole('checkbox')[0]
    await userEvent.click(firstCheckbox)
    
    expect(firstCheckbox).toBeChecked()
  })

  it('displays ICD-10-GM codes for German language', async () => {
    const { APIService } = require('../../services/apiService')
    const mockICDCodes = {
      codes: [
        {
          code: 'Z12.31',
          description: 'Mammographie zur Früherkennung',
          system: 'ICD-10-GM',
          confidence: 0.95
        }
      ],
      codeSystem: 'ICD-10-GM'
    }
    
    APIService.mockImplementation(() => ({
      generateICDCodes: jest.fn().mockResolvedValue(mockICDCodes)
    }))

    render(<ICDPredictions report={mockReport} language="de" />)
    
    const generateButton = screen.getByRole('button', { name: /generate.*ICD/i })
    await userEvent.click(generateButton)
    
    await waitFor(() => {
      expect(screen.getByText(/ICD-10-GM/)).toBeInTheDocument()
      expect(screen.getByText(/Mammographie zur Früherkennung/)).toBeInTheDocument()
    })
  })

  it('allows copying selected ICD codes', async () => {
    const { APIService } = require('../../services/apiService')
    const mockICDCodes = {
      codes: [
        {
          code: 'Z12.31',
          description: 'Test code',
          confidence: 0.95
        }
      ]
    }
    
    APIService.mockImplementation(() => ({
      generateICDCodes: jest.fn().mockResolvedValue(mockICDCodes)
    }))

    // Mock clipboard API
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn().mockResolvedValue(undefined)
      }
    })

    render(<ICDPredictions report={mockReport} language="de" />)
    
    const generateButton = screen.getByRole('button', { name: /generate.*ICD/i })
    await userEvent.click(generateButton)
    
    await waitFor(() => {
      const checkbox = screen.getByRole('checkbox')
      expect(checkbox).toBeInTheDocument()
    })
    
    // Select the code
    const checkbox = screen.getByRole('checkbox')
    await userEvent.click(checkbox)
    
    // Copy selected codes
    const copyButton = screen.getByRole('button', { name: /copy.*selected/i })
    await userEvent.click(copyButton)
    
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('Z12.31')
    )
  })

  it('shows summary statistics when available', async () => {
    const { APIService } = require('../../services/apiService')
    const mockICDCodes = {
      codes: [
        { code: 'Z12.31', description: 'Code 1', confidence: 0.95 },
        { code: 'R92.8', description: 'Code 2', confidence: 0.85 },
        { code: 'N63', description: 'Code 3', confidence: 0.75 }
      ],
      summary: {
        primaryDiagnoses: 1,
        secondaryDiagnoses: 2,
        totalCodes: 3,
        averageConfidence: 0.85
      }
    }
    
    APIService.mockImplementation(() => ({
      generateICDCodes: jest.fn().mockResolvedValue(mockICDCodes)
    }))

    render(<ICDPredictions report={mockReport} language="de" />)
    
    const generateButton = screen.getByRole('button', { name: /generate.*ICD/i })
    await userEvent.click(generateButton)
    
    await waitFor(() => {
      expect(screen.getByText(/Total.*3/i)).toBeInTheDocument()
      expect(screen.getByText(/Primary.*1/i)).toBeInTheDocument()
      expect(screen.getByText(/Secondary.*2/i)).toBeInTheDocument()
    })
  })

  it('filters ICD codes by search term', async () => {
    const { APIService } = require('../../services/apiService')
    const mockICDCodes = {
      codes: [
        {
          code: 'Z12.31',
          description: 'Mammographie-Screening',
          confidence: 0.95
        },
        {
          code: 'C50.9',
          description: 'Mammakarzinom',
          confidence: 0.85
        },
        {
          code: 'N63',
          description: 'Knoten in der Brust',
          confidence: 0.75
        }
      ]
    }
    
    APIService.mockImplementation(() => ({
      generateICDCodes: jest.fn().mockResolvedValue(mockICDCodes)
    }))

    render(<ICDPredictions report={mockReport} language="de" />)
    
    const generateButton = screen.getByRole('button', { name: /generate.*ICD/i })
    await userEvent.click(generateButton)
    
    await waitFor(() => {
      expect(screen.getByText('Z12.31')).toBeInTheDocument()
      expect(screen.getByText('C50.9')).toBeInTheDocument()
      expect(screen.getByText('N63')).toBeInTheDocument()
    })
    
    // Search for "Mamma"
    const searchInput = screen.getByPlaceholderText(/search/i)
    await userEvent.type(searchInput, 'Mamma')
    
    // Should show only codes with "Mamma" in description
    expect(screen.getByText('Z12.31')).toBeInTheDocument()
    expect(screen.getByText('C50.9')).toBeInTheDocument()
    expect(screen.queryByText('N63')).not.toBeInTheDocument()
  })

  it('disables generate button when report is empty', () => {
    const emptyReport = {
      ...mockReport,
      reportText: '',
      findings: '',
      diagnosis: ''
    }
    
    render(<ICDPredictions report={emptyReport} language="de" />)
    
    const generateButton = screen.getByRole('button', { name: /generate.*ICD/i })
    expect(generateButton).toBeDisabled()
  })

  it('handles different code systems based on language', () => {
    const { rerender } = render(
      <ICDPredictions report={mockReport} language="de" />
    )
    
    expect(screen.getByText(/ICD-10-GM/i)).toBeInTheDocument()
    
    rerender(<ICDPredictions report={mockReport} language="en" />)
    
    expect(screen.getByText(/ICD-10/i)).toBeInTheDocument()
    expect(screen.queryByText(/ICD-10-GM/i)).not.toBeInTheDocument()
  })
})