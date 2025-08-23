/**
 * Ontology Service Client
 * Interfaces with the Python FastAPI ontology service for semantic enhancement
 */

const axios = require('axios');

class OntologyService {
  constructor() {
    this.baseURL = process.env.ONTOLOGY_SERVICE_URL || 'http://localhost:8001';
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      response => response,
      error => {
        console.error('❌ Ontology service error:', error.message);
        if (error.code === 'ECONNREFUSED') {
          console.error('⚠️ Ontology service is not running. Start it with: python services/semantic/api_server.py');
        }
        return Promise.reject(error);
      }
    );

    this.isAvailable = false;
    this.checkAvailability();
  }

  /**
   * Check if ontology service is available
   */
  async checkAvailability() {
    try {
      const response = await this.client.get('/');
      this.isAvailable = response.data.status === 'operational';
      if (this.isAvailable) {
        console.log('✅ Ontology service connected:', this.baseURL);
      }
      return this.isAvailable;
    } catch (error) {
      this.isAvailable = false;
      console.warn('⚠️ Ontology service not available. Some features will be limited.');
      return false;
    }
  }

  /**
   * Enhance transcription with semantic annotations
   */
  async enhanceTranscription(transcriptionText, modality = 'mammographie', patientId = null) {
    try {
      if (!this.isAvailable) {
        await this.checkAvailability();
        if (!this.isAvailable) {
          console.warn('Ontology service unavailable, returning unenhanced transcription');
          return {
            original_text: transcriptionText,
            enhanced: false,
            suggested_icd_codes: [],
            extracted_findings: [],
            confidence: 0
          };
        }
      }

      const response = await this.client.post('/api/enhance-transcription', {
        transcription_text: transcriptionText,
        modality: modality,
        patient_id: patientId,
        language: 'de'
      });

      if (response.data.success) {
        console.log(`✅ Transcription enhanced: ${response.data.data.suggested_icd_codes.length} ICD codes suggested`);
        return response.data.data;
      }

      throw new Error('Enhancement failed: ' + response.data.message);
    } catch (error) {
      console.error('Error enhancing transcription:', error.message);
      // Return fallback response
      return {
        original_text: transcriptionText,
        enhanced: false,
        error: error.message,
        suggested_icd_codes: [],
        extracted_findings: [],
        confidence: 0
      };
    }
  }

  /**
   * Get ICD-10-GM code suggestions
   */
  async suggestICDCodes(text, modality = null, maxResults = 10) {
    try {
      if (!this.isAvailable) {
        await this.checkAvailability();
        if (!this.isAvailable) {
          return {
            text_based_suggestions: [],
            modality_specific_suggestions: [],
            total_suggestions: 0
          };
        }
      }

      const response = await this.client.post('/api/suggest-icd-codes', {
        text: text,
        modality: modality,
        max_results: maxResults
      });

      if (response.data.success) {
        return response.data.data;
      }

      throw new Error('ICD suggestion failed: ' + response.data.message);
    } catch (error) {
      console.error('Error suggesting ICD codes:', error.message);
      return {
        text_based_suggestions: [],
        modality_specific_suggestions: [],
        total_suggestions: 0,
        error: error.message
      };
    }
  }

  /**
   * Analyze medical report and extract entities
   */
  async analyzeReport(reportText, extractEntities = true, generateRelationships = true) {
    try {
      if (!this.isAvailable) {
        await this.checkAvailability();
        if (!this.isAvailable) {
          return {
            entities: [],
            relationships: [],
            findings: [],
            icd_suggestions: []
          };
        }
      }

      const response = await this.client.post('/api/analyze-report', {
        report_text: reportText,
        report_type: 'radiology',
        extract_entities: extractEntities,
        generate_relationships: generateRelationships
      });

      if (response.data.success) {
        console.log(`✅ Report analyzed: ${response.data.data.entities.length} entities, ${response.data.data.relationships.length} relationships`);
        return response.data.data;
      }

      throw new Error('Report analysis failed: ' + response.data.message);
    } catch (error) {
      console.error('Error analyzing report:', error.message);
      return {
        entities: [],
        relationships: [],
        findings: [],
        icd_suggestions: [],
        error: error.message
      };
    }
  }

  /**
   * Create or update patient in ontology
   */
  async createPatientEntity(patientId, age = null, gender = null) {
    try {
      if (!this.isAvailable) {
        await this.checkAvailability();
        if (!this.isAvailable) {
          return null;
        }
      }

      const response = await this.client.post('/api/ontology/patient', {
        patient_id: patientId,
        patient_age: age,
        patient_gender: gender
      });

      if (response.data.success) {
        console.log(`✅ Patient entity ${response.data.data.action}: ${patientId}`);
        return response.data.data;
      }

      throw new Error('Patient creation failed: ' + response.data.message);
    } catch (error) {
      console.error('Error creating patient entity:', error.message);
      return null;
    }
  }

  /**
   * Get ontology statistics
   */
  async getStatistics() {
    try {
      if (!this.isAvailable) {
        await this.checkAvailability();
        if (!this.isAvailable) {
          return null;
        }
      }

      const response = await this.client.get('/api/ontology/statistics');

      if (response.data.success) {
        return response.data.data;
      }

      return null;
    } catch (error) {
      console.error('Error getting ontology statistics:', error.message);
      return null;
    }
  }

  /**
   * Export ontology for visualization
   */
  async exportOntology() {
    try {
      if (!this.isAvailable) {
        await this.checkAvailability();
        if (!this.isAvailable) {
          return null;
        }
      }

      const response = await this.client.get('/api/ontology/export');

      if (response.data.success) {
        return response.data.data;
      }

      return null;
    } catch (error) {
      console.error('Error exporting ontology:', error.message);
      return null;
    }
  }

  /**
   * Enhance report generation with ontology context
   */
  async enhanceReportPrompt(transcriptionText, modality, patientInfo = {}) {
    try {
      // First enhance the transcription
      const enhancement = await this.enhanceTranscription(
        transcriptionText, 
        modality,
        patientInfo.patientId
      );

      // Build enhanced prompt with ontology context
      let enhancedPrompt = transcriptionText;

      if (enhancement.enhanced !== false && enhancement.suggested_icd_codes?.length > 0) {
        enhancedPrompt += '\n\n## Ontology-Enhanced Context:\n';
        
        // Add suggested ICD codes
        if (enhancement.suggested_icd_codes.length > 0) {
          enhancedPrompt += '\n### Suggested ICD-10-GM Codes:\n';
          enhancement.suggested_icd_codes.forEach(code => {
            enhancedPrompt += `- ${code.code}: ${code.description} (Confidence: ${(code.confidence * 100).toFixed(0)}%)\n`;
          });
        }

        // Add extracted findings
        if (enhancement.extracted_findings?.length > 0) {
          enhancedPrompt += '\n### Extracted Medical Findings:\n';
          enhancement.extracted_findings.forEach(finding => {
            enhancedPrompt += `- ${finding}\n`;
          });
        }

        // Add quality metrics
        if (enhancement.quality_score) {
          enhancedPrompt += `\n### Quality Assessment:\n`;
          enhancedPrompt += `- Transcription Quality: ${(enhancement.quality_score * 100).toFixed(0)}%\n`;
          enhancedPrompt += `- Confidence Level: ${(enhancement.confidence * 100).toFixed(0)}%\n`;
        }
      }

      return {
        enhancedPrompt,
        ontologyData: enhancement,
        hasEnhancement: enhancement.enhanced !== false
      };
    } catch (error) {
      console.error('Error enhancing report prompt:', error.message);
      return {
        enhancedPrompt: transcriptionText,
        ontologyData: null,
        hasEnhancement: false,
        error: error.message
      };
    }
  }
}

// Create singleton instance
let ontologyServiceInstance = null;

function getOntologyService() {
  if (!ontologyServiceInstance) {
    ontologyServiceInstance = new OntologyService();
  }
  return ontologyServiceInstance;
}

module.exports = {
  OntologyService,
  getOntologyService
};