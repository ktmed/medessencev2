const express = require('express');
const MultiLLMService = require('../../../services/core/llm/multi-llm-service');

const router = express.Router();

// Initialize Multi-LLM Service once
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