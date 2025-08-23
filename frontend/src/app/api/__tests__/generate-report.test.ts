import { NextRequest } from 'next/server'
import { POST } from '../generate-report/route'

// Mock environment variables
process.env.OPENAI_API_KEY = 'test-openai-key'
process.env.ANTHROPIC_API_KEY = 'test-claude-key'
process.env.GOOGLE_GEMINI_API_KEY = 'test-gemini-key'

// Mock the LLM services
jest.mock('openai', () => ({
  OpenAI: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify({
                befund: 'Test findings',
                beurteilung: 'Test assessment',
                empfehlung: 'Test recommendation'
              })
            }
          }]
        })
      }
    }
  }))
}))

describe('POST /api/generate-report', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('successfully generates a medical report', async () => {
    const request = new NextRequest('http://localhost:3000/api/generate-report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        transcriptionId: 'test-123',
        transcriptionText: 'Mammographie-Untersuchung zeigt unauffällige Befunde',
        language: 'de',
        processingMode: 'cloud'
      })
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveProperty('id')
    expect(data).toHaveProperty('befund')
    expect(data).toHaveProperty('beurteilung')
    expect(data).toHaveProperty('empfehlung')
    expect(data.metadata).toHaveProperty('aiProvider')
  })

  it('validates required fields', async () => {
    const request = new NextRequest('http://localhost:3000/api/generate-report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        // Missing transcriptionText
        transcriptionId: 'test-123',
        language: 'de'
      })
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data).toHaveProperty('error')
    expect(data.error).toContain('required')
  })

  it('handles invalid language parameter', async () => {
    const request = new NextRequest('http://localhost:3000/api/generate-report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        transcriptionId: 'test-123',
        transcriptionText: 'Test text',
        language: 'invalid-lang',
        processingMode: 'cloud'
      })
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data).toHaveProperty('error')
  })

  it('uses appropriate agent based on medical content', async () => {
    const mammographyRequest = new NextRequest('http://localhost:3000/api/generate-report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        transcriptionId: 'test-123',
        transcriptionText: 'Mammographie-Screening durchgeführt',
        language: 'de',
        processingMode: 'cloud'
      })
    })

    const response = await POST(mammographyRequest)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.metadata.agent).toContain('mammography')
  })

  it('handles LLM API errors gracefully', async () => {
    // Mock API failure
    const OpenAI = require('openai').OpenAI
    OpenAI.mockImplementationOnce(() => ({
      chat: {
        completions: {
          create: jest.fn().mockRejectedValue(new Error('API rate limit exceeded'))
        }
      }
    }))

    const request = new NextRequest('http://localhost:3000/api/generate-report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        transcriptionId: 'test-123',
        transcriptionText: 'Test text',
        language: 'de',
        processingMode: 'cloud'
      })
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data).toHaveProperty('error')
    expect(data.error).toContain('generate report')
  })

  it('respects processing mode parameter', async () => {
    const localRequest = new NextRequest('http://localhost:3000/api/generate-report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        transcriptionId: 'test-123',
        transcriptionText: 'Test text',
        language: 'de',
        processingMode: 'local'
      })
    })

    const response = await POST(localRequest)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.metadata.processingMode).toBe('local')
  })

  it('includes proper German medical structure in response', async () => {
    const request = new NextRequest('http://localhost:3000/api/generate-report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        transcriptionId: 'test-123',
        transcriptionText: 'CT Thorax zeigt keine pathologischen Veränderungen',
        language: 'de',
        processingMode: 'cloud'
      })
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveProperty('befund')
    expect(data).toHaveProperty('beurteilung')
    expect(data).toHaveProperty('empfehlung')
    expect(typeof data.befund).toBe('string')
    expect(typeof data.beurteilung).toBe('string')
    expect(typeof data.empfehlung).toBe('string')
  })

  it('handles very long transcription text', async () => {
    const longText = 'Mammographie '.repeat(1000) // Very long text
    
    const request = new NextRequest('http://localhost:3000/api/generate-report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        transcriptionId: 'test-123',
        transcriptionText: longText,
        language: 'de',
        processingMode: 'cloud'
      })
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveProperty('id')
  })

  it('validates transcription text minimum length', async () => {
    const request = new NextRequest('http://localhost:3000/api/generate-report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        transcriptionId: 'test-123',
        transcriptionText: 'Hi', // Too short
        language: 'de',
        processingMode: 'cloud'
      })
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data).toHaveProperty('error')
    expect(data.error).toContain('at least')
  })

  it('sanitizes input to prevent XSS', async () => {
    const request = new NextRequest('http://localhost:3000/api/generate-report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        transcriptionId: 'test-123',
        transcriptionText: 'Test <script>alert("XSS")</script> text',
        language: 'de',
        processingMode: 'cloud'
      })
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(JSON.stringify(data)).not.toContain('<script>')
  })

  it('includes timestamp in response', async () => {
    const request = new NextRequest('http://localhost:3000/api/generate-report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        transcriptionId: 'test-123',
        transcriptionText: 'Mammographie-Untersuchung',
        language: 'de',
        processingMode: 'cloud'
      })
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveProperty('timestamp')
    expect(new Date(data.timestamp)).toBeInstanceOf(Date)
  })

  it('handles missing environment variables', async () => {
    // Temporarily remove API keys
    const originalKeys = {
      openai: process.env.OPENAI_API_KEY,
      claude: process.env.ANTHROPIC_API_KEY,
      gemini: process.env.GOOGLE_GEMINI_API_KEY
    }
    
    delete process.env.OPENAI_API_KEY
    delete process.env.ANTHROPIC_API_KEY
    delete process.env.GOOGLE_GEMINI_API_KEY

    const request = new NextRequest('http://localhost:3000/api/generate-report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        transcriptionId: 'test-123',
        transcriptionText: 'Test text',
        language: 'de',
        processingMode: 'cloud'
      })
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data).toHaveProperty('error')
    expect(data.error).toContain('configuration')

    // Restore API keys
    process.env.OPENAI_API_KEY = originalKeys.openai
    process.env.ANTHROPIC_API_KEY = originalKeys.claude
    process.env.GOOGLE_GEMINI_API_KEY = originalKeys.gemini
  })
})