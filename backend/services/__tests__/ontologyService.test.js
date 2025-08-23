/**
 * Ontology Service Integration Tests
 */

const axios = require('axios');
const { OntologyService } = require('../ontologyService');

// Mock axios
jest.mock('axios');

describe('OntologyService', () => {
  let service;
  let mockAxiosInstance;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Create mock axios instance
    mockAxiosInstance = {
      get: jest.fn(),
      post: jest.fn(),
      interceptors: {
        response: {
          use: jest.fn()
        }
      }
    };
    
    // Mock axios.create to return our mock instance
    axios.create = jest.fn(() => mockAxiosInstance);
    
    // Create service instance
    service = new OntologyService();
  });

  describe('Service Initialization', () => {
    it('creates axios client with correct configuration', () => {
      expect(axios.create).toHaveBeenCalledWith({
        baseURL: 'http://localhost:8001',
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    });

    it('sets up response interceptor', () => {
      expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalled();
    });

    it('checks availability on initialization', () => {
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/');
    });
  });

  describe('checkAvailability', () => {
    it('returns true when service is operational', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { status: 'operational' }
      });

      const available = await service.checkAvailability();

      expect(available).toBe(true);
      expect(service.isAvailable).toBe(true);
    });

    it('returns false when service is not available', async () => {
      mockAxiosInstance.get.mockRejectedValueOnce(new Error('Connection refused'));

      const available = await service.checkAvailability();

      expect(available).toBe(false);
      expect(service.isAvailable).toBe(false);
    });

    it('handles non-operational status', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { status: 'maintenance' }
      });

      const available = await service.checkAvailability();

      expect(available).toBe(false);
      expect(service.isAvailable).toBe(false);
    });
  });

  describe('enhanceTranscription', () => {
    it('enhances transcription when service is available', async () => {
      // Mock service as available
      service.isAvailable = true;
      
      const mockResponse = {
        data: {
          success: true,
          data: {
            original_text: 'Mammographie zeigt unauffällige Befunde',
            enhanced_text: 'Mammographie zeigt unauffällige Befunde beidseits',
            suggested_icd_codes: [
              { code: 'Z12.31', description: 'Mammographie-Screening', confidence: 0.95 }
            ],
            extracted_findings: [
              'Unauffällige Mammographie',
              'Keine pathologischen Veränderungen'
            ],
            confidence: 0.92,
            semantic_context: {
              modality: 'mammographie',
              body_part: 'breast',
              laterality: 'bilateral'
            }
          }
        }
      };

      mockAxiosInstance.post.mockResolvedValueOnce(mockResponse);

      const result = await service.enhanceTranscription(
        'Mammographie zeigt unauffällige Befunde',
        'mammographie',
        'patient-123'
      );

      expect(result).toEqual(mockResponse.data.data);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/enhance-transcription', {
        transcription_text: 'Mammographie zeigt unauffällige Befunde',
        modality: 'mammographie',
        patient_id: 'patient-123',
        language: 'de'
      });
    });

    it('returns fallback when service is unavailable', async () => {
      // Mock service as unavailable
      service.isAvailable = false;
      mockAxiosInstance.get.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await service.enhanceTranscription(
        'Test transcription',
        'xray'
      );

      expect(result).toEqual({
        original_text: 'Test transcription',
        enhanced: false,
        suggested_icd_codes: [],
        extracted_findings: [],
        confidence: 0
      });
    });

    it('handles enhancement failure gracefully', async () => {
      service.isAvailable = true;
      
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: {
          success: false,
          message: 'Enhancement failed'
        }
      });

      const result = await service.enhanceTranscription(
        'Test transcription',
        'ct'
      );

      expect(result).toHaveProperty('error');
      expect(result.enhanced).toBe(false);
    });

    it('handles network errors gracefully', async () => {
      service.isAvailable = true;
      
      mockAxiosInstance.post.mockRejectedValueOnce(new Error('Network error'));

      const result = await service.enhanceTranscription(
        'Test transcription',
        'mri'
      );

      expect(result).toEqual({
        original_text: 'Test transcription',
        enhanced: false,
        error: 'Network error',
        suggested_icd_codes: [],
        extracted_findings: [],
        confidence: 0
      });
    });
  });

  describe('suggestICDCodes', () => {
    it('returns ICD-10-GM suggestions', async () => {
      service.isAvailable = true;
      
      const mockResponse = {
        data: {
          success: true,
          data: {
            codes: [
              { code: 'Z12.31', description: 'Mammographie-Screening', confidence: 0.95 },
              { code: 'N63', description: 'Knoten in der Brust', confidence: 0.85 }
            ],
            primary_diagnosis: 'Z12.31',
            confidence: 0.90
          }
        }
      };

      mockAxiosInstance.post.mockResolvedValueOnce(mockResponse);

      const result = await service.suggestICDCodes('Mammographie mit Knoten', 'mammographie', 5);

      expect(result).toEqual(mockResponse.data.data);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/suggest-icd-codes', {
        text: 'Mammographie mit Knoten',
        modality: 'mammographie',
        max_results: 5
      });
    });

    it('returns empty codes when service unavailable', async () => {
      service.isAvailable = false;
      mockAxiosInstance.get.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await service.suggestICDCodes('Test text');

      expect(result).toEqual({
        text_based_suggestions: [],
        modality_specific_suggestions: [],
        total_suggestions: 0
      });
    });
  });

  describe('analyzeReport', () => {
    it('analyzes medical report successfully', async () => {
      service.isAvailable = true;
      
      const reportText = 'Mammographie zeigt unauffällige Befunde. Keine pathologischen Veränderungen. Routine-Screening in 2 Jahren.';

      const mockResponse = {
        data: {
          success: true,
          data: {
            entities: [
              { type: 'PROCEDURE', text: 'Mammographie' },
              { type: 'FINDING', text: 'unauffällige Befunde' }
            ],
            relationships: [
              { from: 'Mammographie', to: 'unauffällige Befunde', type: 'shows' }
            ],
            summary: {
              urgency: 'routine',
              findings_count: 1,
              pathological: false
            }
          }
        }
      };

      mockAxiosInstance.post.mockResolvedValueOnce(mockResponse);

      const result = await service.analyzeReport(reportText, true, true);

      expect(result).toEqual(mockResponse.data.data);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/analyze-report', {
        report_text: reportText,
        report_type: 'radiology',
        extract_entities: true,
        generate_relationships: true
      });
    });

    it('handles report analysis errors', async () => {
      service.isAvailable = true;
      
      mockAxiosInstance.post.mockRejectedValueOnce(new Error('Analysis failed'));

      const result = await service.analyzeReport('Test report');

      expect(result).toHaveProperty('error', 'Analysis failed');
      expect(result.entities).toEqual([]);
    });
  });

  describe('getStatistics', () => {
    it('retrieves ontology statistics', async () => {
      service.isAvailable = true;
      
      const mockResponse = {
        data: {
          success: true,
          data: {
            total_entities: 1250,
            total_relationships: 3420,
            entity_types: {
              'ANATOMY': 350,
              'PROCEDURE': 280,
              'FINDING': 420,
              'MEDICATION': 200
            },
            last_updated: '2025-08-22T10:00:00Z'
          }
        }
      };

      mockAxiosInstance.get.mockResolvedValueOnce(mockResponse);

      const result = await service.getStatistics();

      expect(result).toEqual(mockResponse.data.data);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/ontology/statistics');
    });
  });

  describe('Error Handling', () => {
    it('handles ECONNREFUSED errors specially', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Create error interceptor handler
      const errorHandler = mockAxiosInstance.interceptors.response.use.mock.calls[0][1];
      
      const error = new Error('Connection refused');
      error.code = 'ECONNREFUSED';
      
      await expect(errorHandler(error)).rejects.toThrow('Connection refused');
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Ontology service is not running')
      );
      
      consoleErrorSpy.mockRestore();
    });

    it('handles generic errors', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const errorHandler = mockAxiosInstance.interceptors.response.use.mock.calls[0][1];
      
      const error = new Error('Generic error');
      
      await expect(errorHandler(error)).rejects.toThrow('Generic error');
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '❌ Ontology service error:',
        'Generic error'
      );
      
      consoleErrorSpy.mockRestore();
    });
  });

  describe('enhanceReportPrompt', () => {
    it('enhances report prompt with semantic context', async () => {
      service.isAvailable = true;
      
      // Mock the enhanceTranscription call that happens internally
      const mockEnhancementResponse = {
        data: {
          success: true,
          data: {
            original_text: 'Mammographie beidseits unauffällig',
            enhanced: true,
            suggested_icd_codes: [
              { code: 'Z12.31', description: 'Mammographie-Screening', confidence: 0.95 }
            ],
            extracted_findings: ['Unauffällige Mammographie'],
            semantic_annotations: {
              modality: 'mammographie',
              body_part: 'breast',
              laterality: 'bilateral'
            }
          }
        }
      };

      mockAxiosInstance.post.mockResolvedValueOnce(mockEnhancementResponse);

      const result = await service.enhanceReportPrompt(
        'Mammographie beidseits unauffällig',
        'mammographie',
        { patientId: 'patient-123', age: 50, gender: 'female' }
      );

      // The result should be an object with enhancedPrompt property
      expect(typeof result).toBe('object');
      expect(result).toHaveProperty('enhancedPrompt');
      expect(result).toHaveProperty('hasEnhancement', true);
      expect(result.enhancedPrompt).toContain('Mammographie beidseits unauffällig');
      expect(result.enhancedPrompt).toContain('Z12.31');
      
      // Check that enhanceTranscription was called
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/enhance-transcription', {
        transcription_text: 'Mammographie beidseits unauffällig',
        modality: 'mammographie',
        patient_id: 'patient-123',
        language: 'de'
      });
    });
  });

  describe('exportOntology', () => {
    it('exports ontology successfully', async () => {
      service.isAvailable = true;
      
      const mockResponse = {
        data: {
          success: true,
          data: {
            export_format: 'json',
            file_path: '/exports/ontology_export_2025_08_22.json',
            total_entities: 1250,
            total_relationships: 3420,
            export_timestamp: '2025-08-22T10:00:00Z'
          }
        }
      };

      mockAxiosInstance.get.mockResolvedValueOnce(mockResponse);

      const result = await service.exportOntology();

      expect(result).toEqual(mockResponse.data.data);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/ontology/export');
    });
  });
});