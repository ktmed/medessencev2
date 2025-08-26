import { ontologyService, OntologyValidationRequest, OntologyValidationResponse } from '../ontologyService'

// Mock fetch globally
global.fetch = jest.fn()

describe('OntologyService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global.fetch as jest.Mock).mockClear()
    // Clear service cache between tests
    ontologyService.clearCache()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('isAvailable', () => {
    it('returns true when ontology service is available', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'healthy' })
      })

      const result = await ontologyService.isAvailable()
      
      expect(result).toBe(true)
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/statistics'),
        expect.objectContaining({
          method: 'GET',
          signal: expect.any(AbortSignal)
        })
      )
    })

    it('returns false when ontology service is unavailable', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 503
      })

      const result = await ontologyService.isAvailable()
      
      expect(result).toBe(false)
    })

    it('returns false on network errors', async () => {
      ;(global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('Network error')
      )

      const result = await ontologyService.isAvailable()
      
      expect(result).toBe(false)
    })

    it('handles timeout errors', async () => {
      jest.useFakeTimers()

      ;(global.fetch as jest.Mock).mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ ok: true }), 2000))
      )

      const promise = ontologyService.isAvailable()
      
      // Fast forward past timeout
      jest.advanceTimersByTime(1001)
      
      const result = await promise
      expect(result).toBe(false)

      jest.useRealTimers()
    })
  })

  describe('validateText', () => {
    const mockValidationRequest: OntologyValidationRequest = {
      text: 'Mammographie-Untersuchung zeigt unauffällige Befunde',
      language: 'de',
      real_time: false,
      context: 'final'
    }

    it('successfully validates medical text', async () => {
      const mockApiResponse = {
        success: true,
        data: {
          enhanced_transcription: 'Mammographie-Untersuchung zeigt unauffällige Befunde beidseits',
          confidence: 0.92,
          extracted_findings: [
            {
              text: 'Mammographie-Untersuchung',
              category: 'procedure',
              confidence: 0.95
            }
          ],
          quality_score: 0.92
        }
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockApiResponse
      })

      const result = await ontologyService.validateText(mockValidationRequest)

      expect(result.success).toBe(true)
      expect(result.data?.enhanced_text).toBe('Mammographie-Untersuchung zeigt unauffällige Befunde beidseits')
      expect(result.data?.medical_terms_detected).toHaveLength(1)
      expect(result.data?.quality_score).toBe(0.92)

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/enhance-transcription'),
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Accept': 'application/json; charset=utf-8'
          },
          body: expect.stringContaining('Mammographie-Untersuchung')
        })
      )
    })

    it('handles API errors gracefully', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500
      })

      await expect(
        ontologyService.validateText(mockValidationRequest)
      ).rejects.toThrow('Ontology service error: 500')
    })

    it('handles real-time validation failures gracefully', async () => {
      const realtimeRequest = {
        ...mockValidationRequest,
        real_time: true
      }

      ;(global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('Network timeout')
      )

      const result = await ontologyService.validateText(realtimeRequest)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Real-time validation temporarily unavailable')
    })

    it('respects caching for real-time requests', async () => {
      const realtimeRequest = {
        ...mockValidationRequest,
        real_time: true
      }

      const mockApiResponse = {
        success: true,
        data: {
          enhanced_transcription: 'Cached enhanced text',
          confidence: 0.85,
          extracted_findings: [],
          quality_score: 0.85
        }
      }

      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockApiResponse
      })

      // First call - should hit network
      const result1 = await ontologyService.validateText(realtimeRequest)
      expect(global.fetch).toHaveBeenCalledTimes(1)
      expect(result1.success).toBe(true)

      // Second call with same text - should use cache
      const result2 = await ontologyService.validateText(realtimeRequest)
      expect(global.fetch).toHaveBeenCalledTimes(1) // No additional call
      expect(result2.success).toBe(true)
    })

    it('does not cache non-real-time requests', async () => {
      const mockApiResponse = {
        success: true,
        data: {
          enhanced_transcription: 'Non-cached response',
          confidence: 0.8,
          extracted_findings: [],
          quality_score: 0.8
        }
      }

      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockApiResponse
      })

      // Multiple calls should all hit network
      await ontologyService.validateText(mockValidationRequest)
      await ontologyService.validateText(mockValidationRequest)
      await ontologyService.validateText(mockValidationRequest)

      expect(global.fetch).toHaveBeenCalledTimes(3)
    })

    it('deduplicates concurrent requests', async () => {
      const mockApiResponse = {
        success: true,
        data: {
          enhanced_transcription: 'Deduplicated response',
          confidence: 0.8,
          extracted_findings: [],
          quality_score: 0.8
        }
      }

      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockApiResponse
      })

      // Multiple concurrent calls with same content
      const promises = [
        ontologyService.validateText(mockValidationRequest),
        ontologyService.validateText(mockValidationRequest),
        ontologyService.validateText(mockValidationRequest)
      ]

      const results = await Promise.all(promises)

      // Should only make one network call due to deduplication
      expect(global.fetch).toHaveBeenCalledTimes(1)
      expect(results).toHaveLength(3)
      results.forEach(result => expect(result.success).toBe(true))
    })

    it('handles timeout for real-time requests', async () => {
      jest.useFakeTimers()

      const realtimeRequest = {
        ...mockValidationRequest,
        real_time: true
      }

      ;(global.fetch as jest.Mock).mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ ok: true }), 3000))
      )

      const promise = ontologyService.validateText(realtimeRequest)
      
      // Fast forward past real-time timeout (2 seconds)
      jest.advanceTimersByTime(2001)
      
      const result = await promise
      expect(result.success).toBe(false)
      expect(result.error).toBe('Real-time validation temporarily unavailable')

      jest.useRealTimers()
    })

    it('detects medical modality from text content', async () => {
      const mammographyRequest = {
        ...mockValidationRequest,
        text: 'Mammographie-Screening mit unauffälligen Befunden'
      }

      const mockApiResponse = {
        success: true,
        data: {
          enhanced_transcription: 'Enhanced mammography text',
          confidence: 0.9,
          extracted_findings: [],
          quality_score: 0.9
        }
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockApiResponse
      })

      await ontologyService.validateText(mammographyRequest)

      const callBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)
      expect(callBody.modality).toBe('mammographie')
      expect(callBody.transcription_text).toBe('Mammographie-Screening mit unauffälligen Befunden')
    })

    it('handles echocardiography modality detection', async () => {
      const echoRequest = {
        ...mockValidationRequest,
        text: 'Echokardiographie zeigt normotrophen linken Ventrikel'
      }

      const mockApiResponse = {
        success: true,
        data: {
          enhanced_transcription: 'Enhanced echo text',
          confidence: 0.85,
          extracted_findings: [],
          quality_score: 0.85
        }
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockApiResponse
      })

      await ontologyService.validateText(echoRequest)

      const callBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)
      expect(callBody.modality).toBe('echokardiographie')
    })

    it('transforms extracted findings correctly', async () => {
      const mockApiResponse = {
        success: true,
        data: {
          enhanced_transcription: 'Original text',
          confidence: 0.9,
          extracted_findings: [
            { text: 'Befund A', category: 'pathological', confidence: 0.95 },
            { text: 'Befund B', category: 'normal', confidence: 0.88 }
          ],
          quality_score: 0.91
        }
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockApiResponse
      })

      const result = await ontologyService.validateText(mockValidationRequest)

      expect(result.data?.medical_terms_detected).toHaveLength(2)
      expect(result.data?.medical_terms_detected[0]).toEqual({
        term: 'Befund A',
        category: 'pathological',
        confidence: 0.95,
        position: 0
      })
      expect(result.data?.medical_terms_detected[1]).toEqual({
        term: 'Befund B',
        category: 'normal',
        confidence: 0.88,
        position: 1
      })
    })

    it('identifies corrections when enhanced text differs', async () => {
      const originalText = 'Mammografie Untersuchung'
      const enhancedText = 'Mammographie-Untersuchung'
      
      const requestWithTypos = {
        ...mockValidationRequest,
        text: originalText
      }

      const mockApiResponse = {
        success: true,
        data: {
          enhanced_transcription: enhancedText,
          confidence: 0.92,
          extracted_findings: [],
          quality_score: 0.92
        }
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockApiResponse
      })

      const result = await ontologyService.validateText(requestWithTypos)

      expect(result.data?.corrections).toHaveLength(1)
      expect(result.data?.corrections[0]).toEqual({
        original: originalText,
        corrected: enhancedText,
        confidence: 0.92,
        type: 'semantic'
      })
    })
  })

  describe('getStatistics', () => {
    it('successfully retrieves service statistics', async () => {
      const mockStats = {
        total_requests: 12345,
        cache_hits: 8765,
        average_response_time: 150
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockStats
      })

      const result = await ontologyService.getStatistics()

      expect(result).toEqual(mockStats)
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/statistics')
      )
    })

    it('handles statistics retrieval errors', async () => {
      ;(global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('Service unavailable')
      )

      const result = await ontologyService.getStatistics()

      expect(result).toBe(null)
    })
  })

  describe('cache management', () => {
    it('cleans up expired cache entries', async () => {
      jest.useFakeTimers()

      const realtimeRequest = {
        ...mockValidationRequest,
        real_time: true
      }

      const mockApiResponse = {
        success: true,
        data: {
          enhanced_transcription: 'Cached text',
          confidence: 0.8,
          extracted_findings: [],
          quality_score: 0.8
        }
      }

      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockApiResponse
      })

      // First call - creates cache entry
      await ontologyService.validateText(realtimeRequest)
      expect(global.fetch).toHaveBeenCalledTimes(1)

      // Second call within cache timeout - uses cache
      await ontologyService.validateText(realtimeRequest)
      expect(global.fetch).toHaveBeenCalledTimes(1)

      // Fast forward past cache expiry (30 seconds)
      jest.advanceTimersByTime(31000)

      // Third call after cache expiry - makes new request and cleans up
      await ontologyService.validateText(realtimeRequest)
      expect(global.fetch).toHaveBeenCalledTimes(2)

      jest.useRealTimers()
    })

    it('clears cache manually', async () => {
      const realtimeRequest = {
        ...mockValidationRequest,
        real_time: true
      }

      const mockApiResponse = {
        success: true,
        data: {
          enhanced_transcription: 'Text to cache',
          confidence: 0.8,
          extracted_findings: [],
          quality_score: 0.8
        }
      }

      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockApiResponse
      })

      // Create cache entry
      await ontologyService.validateText(realtimeRequest)
      expect(global.fetch).toHaveBeenCalledTimes(1)

      // Clear cache
      ontologyService.clearCache()

      // Next call should hit network again
      await ontologyService.validateText(realtimeRequest)
      expect(global.fetch).toHaveBeenCalledTimes(2)
    })
  })
})