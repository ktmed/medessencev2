const express = require('express');
const MultiLLMService = require('../../../services/core/llm/multi-llm-service');

const router = express.Router();

// Initialize Multi-LLM Service
const multiLLMService = new MultiLLMService();

/**
 * Generate medical report using local Ollama models
 * POST /api/generate-report
 */
router.post('/generate-report', async (req, res) => {
  try {
    const { transcriptionText, language = 'de', processingMode = 'local' } = req.body;
    
    console.log('🏥 Backend: Generate Report Request');
    console.log('- Text length:', transcriptionText?.length || 0);
    console.log('- Language:', language);
    console.log('- Processing mode:', processingMode);

    if (!transcriptionText || !transcriptionText.trim()) {
      return res.status(400).json({
        error: 'No transcription text provided',
        details: 'transcriptionText is required and cannot be empty'
      });
    }

    // For local processing, use Ollama models
    if (processingMode === 'local') {
      console.log('🏠 Using local Ollama processing');
      
      try {
        const result = await multiLLMService.generateReport(
          transcriptionText,
          language,
          {
            timestamp: Date.now(),
            source: 'backend-api'
          },
          'local' // processingMode
        );

        console.log('✅ Local report generated successfully');
        console.log('- Provider:', result.provider);
        console.log('- Model:', result.model);

        // Format response to match expected structure
        const report = {
          id: `report-${Date.now()}`,
          transcriptionId: `transcription-${Date.now()}`,
          findings: result.findings || '',
          impression: result.impression || '',
          recommendations: result.recommendations || '',
          technicalDetails: result.technicalDetails || '',
          generatedAt: Date.now(),
          language: language,
          type: 'Local Medical Report',
          model: result.model || 'Ollama Model',
          provider: result.provider || 'ollama-local',
          metadata: {
            agent: 'backend_multi_llm_service',
            aiProvider: result.provider || 'ollama-local',
            aiGenerated: true,
            processingMode: 'local',
            originalTextLength: transcriptionText.length,
            ...result.metadata
          }
        };

        return res.json(report);

      } catch (error) {
        console.error('❌ Local report generation failed:', error);
        
        // Return fallback report
        const fallbackReport = {
          id: `report-${Date.now()}`,
          transcriptionId: `transcription-${Date.now()}`,
          findings: transcriptionText,
          impression: 'Local processing failed - see original text in findings.',
          recommendations: 'Please review manually or try cloud processing.',
          technicalDetails: `Local processing error: ${error.message}`,
          generatedAt: Date.now(),
          language: language,
          type: 'Fallback Report',
          model: 'Rule-based fallback',
          provider: 'local-fallback',
          metadata: {
            agent: 'backend_fallback',
            aiProvider: 'local-fallback',
            aiGenerated: false,
            processingMode: 'local',
            fallbackReason: error.message,
            originalTextLength: transcriptionText.length
          }
        };

        return res.json(fallbackReport);
      }
    }

    // For cloud processing, use cloud providers
    console.log('☁️ Using cloud processing');
    const result = await multiLLMService.generateReport(
      transcriptionText,
      language,
      {
        timestamp: Date.now(),
        source: 'backend-api'
      },
      'cloud' // processingMode
    );

    console.log('✅ Cloud report generated successfully');
    console.log('- Provider:', result.provider);

    // Format response to match expected structure
    const report = {
      id: `report-${Date.now()}`,
      transcriptionId: `transcription-${Date.now()}`,
      findings: result.findings || '',
      impression: result.impression || '',
      recommendations: result.recommendations || '',
      technicalDetails: result.technicalDetails || '',
      generatedAt: Date.now(),
      language: language,
      type: 'Cloud Medical Report',
      model: result.model || 'Cloud AI Model',
      provider: result.provider || 'cloud-ai',
      metadata: {
        agent: 'backend_multi_llm_service',
        aiProvider: result.provider || 'cloud-ai',
        aiGenerated: true,
        processingMode: 'cloud',
        originalTextLength: transcriptionText.length,
        ...result.metadata
      }
    };

    return res.json(report);

  } catch (error) {
    console.error('❌ Backend report generation error:', error);
    
    return res.status(500).json({
      error: 'Failed to generate report',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Generate patient summary using local Ollama models
 * POST /api/generate-summary
 */
router.post('/generate-summary', async (req, res) => {
  try {
    const { reportContent, language = 'de', complexity = 'detailed', processingMode = 'local' } = req.body;
    
    console.log('🏥 Backend: Generate Summary Request');
    console.log('- Content length:', reportContent?.length || 0);
    console.log('- Language:', language);
    console.log('- Complexity:', complexity);
    console.log('- Processing mode:', processingMode);

    if (!reportContent || !reportContent.trim()) {
      return res.status(400).json({
        error: 'No report content provided',
        details: 'reportContent is required and cannot be empty'
      });
    }

    // For local processing, use Ollama models
    if (processingMode === 'local') {
      console.log('🏠 Using local Ollama processing for summary');
      
      try {
        const result = await multiLLMService.generatePatientSummary(
          reportContent,
          language
        );

        console.log('✅ Local summary generated successfully');
        console.log('- Provider:', result.provider);

        // Format response to match expected PatientSummary structure
        const summary = {
          id: `summary-${Date.now()}`,
          reportId: `report-${Date.now()}`,
          summary: result.summary || result.meaning || reportContent.substring(0, 500),
          keyFindings: result.keyFindings || result.findings ? [result.findings] : ['See detailed summary'],
          recommendations: result.recommendations || result.nextSteps ? [result.nextSteps] : ['Further medical care recommended'],
          language: language,
          generatedAt: Date.now(),
          complexity: complexity,
          metadata: {
            aiProvider: result.provider || 'ollama-local',
            processingAgent: 'backend_multi_llm_service',
            confidence: 0.8,
            processingMode: 'local',
            originalContentLength: reportContent.length,
            ...result.metadata
          }
        };

        return res.json(summary);

      } catch (error) {
        console.error('❌ Local summary generation failed:', error);
        
        // Return fallback summary
        const fallbackSummary = {
          id: `summary-${Date.now()}`,
          reportId: `report-${Date.now()}`,
          summary: `Local processing failed - see original report:\n\n${reportContent.substring(0, 500)}...`,
          keyFindings: ['See original report'],
          recommendations: ['Please review manually or try cloud processing'],
          language: language,
          generatedAt: Date.now(),
          complexity: complexity,
          metadata: {
            aiProvider: 'local-fallback',
            processingAgent: 'backend_fallback',
            confidence: 0.3,
            processingMode: 'local',
            fallbackReason: error.message,
            originalContentLength: reportContent.length
          }
        };

        return res.json(fallbackSummary);
      }
    }

    // For cloud processing, use cloud providers (not implemented in multi-llm-service yet)
    console.log('☁️ Using cloud processing for summary - fallback to local');
    
    try {
      const result = await multiLLMService.generatePatientSummary(
        reportContent,
        language
      );

      console.log('✅ Cloud summary generated successfully');
      console.log('- Provider:', result.provider);

      // Format response to match expected PatientSummary structure
      const summary = {
        id: `summary-${Date.now()}`,
        reportId: `report-${Date.now()}`,
        summary: result.summary || result.meaning || reportContent.substring(0, 500),
        keyFindings: result.keyFindings || result.findings ? [result.findings] : ['See detailed summary'],
        recommendations: result.recommendations || result.nextSteps ? [result.nextSteps] : ['Further medical care recommended'],
        language: language,
        generatedAt: Date.now(),
        complexity: complexity,
        metadata: {
          aiProvider: result.provider || 'cloud-ai',
          processingAgent: 'backend_multi_llm_service',
          confidence: 0.9,
          processingMode: 'cloud',
          originalContentLength: reportContent.length,
          ...result.metadata
        }
      };

      return res.json(summary);

    } catch (error) {
      console.error('❌ Cloud summary generation failed:', error);
      
      return res.status(500).json({
        error: 'Failed to generate summary',
        details: error.message,
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error('❌ Backend summary generation error:', error);
    
    return res.status(500).json({
      error: 'Failed to generate summary',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Health check for report service
 * GET /api/reports/health
 */
router.get('/health', async (req, res) => {
  try {
    // Check if Multi-LLM service is working
    const hasProviders = multiLLMService.providers && multiLLMService.providers.length > 0;
    const isOllamaInitialized = multiLLMService.isOllamaInitialized;

    res.json({
      status: 'ok',
      service: 'reports',
      providers: hasProviders ? multiLLMService.providers.map(p => p.name) : [],
      ollamaInitialized: isOllamaInitialized,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Reports health check failed:', error);
    
    res.status(500).json({
      status: 'error',
      service: 'reports',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;