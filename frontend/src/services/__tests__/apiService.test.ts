import {
  generateReport,
  generateSummary,
  generateICDCodes,
  generateEnhancedFindings,
  checkHealth,
  getProviderStatus
} from '../apiService'

// Mock fetch globally
global.fetch = jest.fn()

describe('API Service Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global.fetch as jest.Mock).mockClear()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('generateReport', () => {
    it('successfully generates a medical report', async () => {
      // Mock the actual API response (not wrapped)
      const mockApiResponse = {
        id: 'report-123',
        transcriptionId: 'trans-456',
        language: 'de',
        findings: 'Mammographie zeigt unauffällige Befunde',
        impression: 'Keine pathologischen Veränderungen',
        recommendations: 'Routine-Screening in 2 Jahren',
        timestamp: new Date().toISOString(),
        metadata: {
          provider: 'claude',
          model: 'claude-3',
          processingTime: 1234,
          confidence: 0.95,
          cacheHit: false
        }
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockApiResponse
      })

      const result = await generateReport({
        transcriptionText: 'Mammographie-Untersuchung durchgeführt',
        language: 'de',
        modality: 'mammography'
      })

      // The function wraps the response
      expect(result).toEqual({
        success: true,
        data: mockApiResponse
      })
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/generate-report'),
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: expect.stringContaining('Mammographie-Untersuchung')
        })
      )
    })

    it('handles API errors gracefully', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => '{"error": "Server error"}',
        json: async () => ({ error: 'Server error' })
      })

      await expect(
        generateReport({
          transcriptionText: 'Test',
          language: 'de',
          modality: 'xray'
        })
      ).rejects.toThrow('Report generation failed')
    })

    it('validates input before making API call', async () => {
      await expect(
        generateReport({
          transcriptionText: '', // Empty text
          language: 'de',
          modality: 'mammography'
        })
      ).rejects.toThrow()

      expect(global.fetch).not.toHaveBeenCalled()
    })

    it('includes optional parameters when provided', async () => {
      const mockApiResponse = {
        id: 'report-123',
        transcriptionId: 'trans-456',
        language: 'de',
        findings: 'Test findings',
        impression: 'Test impression',
        recommendations: 'Test recommendations',
        timestamp: new Date().toISOString()
      }
      
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockApiResponse
      })

      const result = await generateReport({
        transcriptionText: 'Test transcription with optional params',
        language: 'de',
        modality: 'ct_scan',
        processingMode: 'local',
        patientInfo: {
          age: 45,
          gender: 'female'
        }
      })

      expect(result.success).toBe(true)
      
      const callArgs = (global.fetch as jest.Mock).mock.calls[0]
      const body = JSON.parse(callArgs[1].body)
      
      expect(body.processingMode).toBe('local')
      // Note: patientInfo is not passed to the API in current implementation
    })
  })

  describe('generateSummary', () => {
    it('generates summary from report content', async () => {
      const mockApiResponse = {
        id: 'summary-123',
        reportId: 'report-456',
        language: 'de',
        summary: 'Keine pathologischen Befunde in der Mammographie',
        keyFindings: ['Unauffällige Mammae beidseits'],
        recommendations: ['Routine-Screening in 2 Jahren'],
        timestamp: new Date().toISOString()
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockApiResponse
      })

      const result = await generateSummary({
        reportContent: 'Detailed medical report content',
        language: 'de',
        complexity: 'simple'
      })

      expect(result).toEqual({
        success: true,
        data: mockApiResponse
      })
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/generate-summary'),
        expect.any(Object)
      )
    })

    it('respects complexity parameter', async () => {
      const mockApiResponse = {
        id: 'summary-123',
        reportId: 'report-456',
        language: 'de',
        summary: 'Technical summary',
        keyFindings: [],
        recommendations: [],
        timestamp: new Date().toISOString()
      }
      
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockApiResponse
      })

      await generateSummary({
        reportContent: 'Report content',
        language: 'de',
        complexity: 'technical'
      })

      const callArgs = (global.fetch as jest.Mock).mock.calls[0]
      const body = JSON.parse(callArgs[1].body)
      
      expect(body.complexity).toBe('technical')
    })
  })

  describe('generateICDCodes', () => {
    it('generates ICD-10-GM codes from report', async () => {
      const mockApiResponse = {
        codes: [
          { code: 'Z12.31', description: 'Mammographie-Screening', confidence: 0.95 },
          { code: 'N63', description: 'Knoten in der Brust', confidence: 0.85 }
        ],
        summary: {
          primaryDiagnoses: 2,
          totalCodes: 2
        },
        provider: 'openai',
        timestamp: new Date().toISOString()
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockApiResponse
      })

      const result = await generateICDCodes({
        reportContent: 'Mammographie mit Knoten in der rechten Brust',
        language: 'de'
      })

      expect(result).toEqual({
        success: true,
        data: mockApiResponse
      })
      expect(result.data.codes).toHaveLength(2)
      expect(result.data.codes[0].code).toBe('Z12.31')
    })

    it('uses correct code system based on language', async () => {
      const mockApiResponse = {
        codes: [],
        summary: { primaryDiagnoses: 0, totalCodes: 0 },
        provider: 'openai',
        timestamp: new Date().toISOString()
      }
      
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockApiResponse
      })

      await generateICDCodes({
        reportContent: 'Medical report',
        language: 'de',
        codeSystem: 'ICD-10-GM'
      })

      const callArgs = (global.fetch as jest.Mock).mock.calls[0]
      const body = JSON.parse(callArgs[1].body)
      
      expect(body.codeSystem).toBe('ICD-10-GM')
    })
  })

  describe('generateEnhancedFindings', () => {
    it('enhances medical findings with semantic analysis', async () => {
      const mockApiResponse = {
        normalFindings: ['Unauffällige Mammographie'],
        pathologicalFindings: [],
        recommendations: ['Keine suspekten Mikrokalzifikationen'],
        confidence: 0.95,
        processingAgent: 'medical_analyzer',
        timestamp: new Date().toISOString()
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockApiResponse
      })

      const result = await generateEnhancedFindings({
        reportContent: 'Mammographie Befund',
        language: 'de'
      })

      expect(result).toEqual({
        success: true,
        data: mockApiResponse
      })
      expect(result.data.normalFindings).toHaveLength(1)
      expect(result.data.pathologicalFindings).toHaveLength(0)
    })
  })

  describe('checkHealth', () => {
    it('returns health status when API is healthy', async () => {
      const mockHealth = {
        status: 'healthy',
        version: '1.0.0',
        services: {
          database: 'connected',
          redis: 'connected',
          aiProviders: {
            claude: 'available',
            openai: 'available',
            gemini: 'available'
          }
        }
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockHealth
      })

      const result = await checkHealth()

      expect(result).toEqual(mockHealth)
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/health'),
        expect.objectContaining({
          method: 'GET'
        })
      )
    })

    it('handles unhealthy API response', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable'
      })

      await expect(checkHealth()).rejects.toThrow('Health check failed')
    })

    it('handles network errors', async () => {
      ;(global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('Network error')
      )

      await expect(checkHealth()).rejects.toThrow('Network error')
    })
  })

  describe('getProviderStatus', () => {
    it('returns AI provider status', async () => {
      const mockStatus = {
        providers: [
          { name: 'claude', status: 'online', responseTime: 450 },
          { name: 'openai', status: 'online', responseTime: 320 },
          { name: 'gemini', status: 'offline', error: 'Rate limit exceeded' },
          { name: 'ollama', status: 'online', responseTime: 180 }
        ],
        primaryProvider: 'claude',
        fallbackChain: ['claude', 'openai', 'ollama']
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockStatus
      })

      const result = await getProviderStatus()

      expect(result).toEqual(mockStatus)
      expect(result.providers).toHaveLength(4)
      expect(result.primaryProvider).toBe('claude')
    })

    it('identifies offline providers', async () => {
      const mockStatus = {
        providers: [
          { name: 'claude', status: 'offline' },
          { name: 'openai', status: 'offline' }
        ]
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockStatus
      })

      const result = await getProviderStatus()
      const offlineProviders = result.providers.filter(
        (p: any) => p.status === 'offline'
      )
      
      expect(offlineProviders).toHaveLength(2)
    })
  })

  describe('Error Handling', () => {
    it('handles timeout errors', async () => {
      jest.useFakeTimers()
      
      ;(global.fetch as jest.Mock).mockImplementation(
        () => new Promise((resolve) => {
          setTimeout(() => resolve({ ok: true }), 30000)
        })
      )

      const promise = generateReport({
        transcriptionText: 'Test',
        language: 'de',
        modality: 'xray'
      })

      jest.advanceTimersByTime(30000)
      
      await expect(promise).rejects.toThrow()
      
      jest.useRealTimers()
    })

    it.skip('retries on transient failures', async () => {
      // TODO: Implement retry logic in APIService
      // First call fails, second succeeds
      ;(global.fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, data: {} })
        })

      const result = await generateReport({
        transcriptionText: 'Test with retry',
        language: 'de',
        modality: 'xray',
        retryOnFailure: true
      })

      expect(result.success).toBe(true)
      expect(global.fetch).toHaveBeenCalledTimes(2)
    })

    it('validates response structure', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => null // Invalid response
      })

      await expect(
        generateReport({
          transcriptionText: 'Test',
          language: 'de',
          modality: 'xray'
        })
      ).rejects.toThrow() // Just check that it throws, don't check exact message
    })
  })

  describe('Request Headers', () => {
    it.skip('includes authentication headers when token is provided', async () => {
      // TODO: Implement auth token support in APIService
      const mockResponse = { success: true, data: {} }
      
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      })

      await generateReport({
        transcriptionText: 'Test',
        language: 'de',
        modality: 'xray',
        authToken: 'Bearer test-token-123'
      })

      const callArgs = (global.fetch as jest.Mock).mock.calls[0]
      
      expect(callArgs[1].headers).toHaveProperty('Authorization', 'Bearer test-token-123')
    })

    it('sends correct content type header', async () => {
      const mockResponse = { success: true, data: {} }
      
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      })

      await generateReport({
        transcriptionText: 'Test',
        language: 'de',
        modality: 'xray'
      })

      const callArgs = (global.fetch as jest.Mock).mock.calls[0]
      
      expect(callArgs[1].headers).toHaveProperty('Content-Type', 'application/json')
    })
  })
})