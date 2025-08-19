#!/usr/bin/env node
/**
 * Simple test server for testing Ollama integration
 * Bypasses complex config and database requirements
 */

const express = require('express');
const cors = require('cors');
const path = require('path');

// Simple standalone Multi-LLM service without complex dependencies
const MultiLLMService = require('../services/core/llm/multi-llm-service');

class TestOllamaServer {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3001;
    this.multiLLMService = null;
    
    this.setupExpress();
    this.setupRoutes();
  }

  setupExpress() {
    // CORS configuration
    this.app.use(cors({
      origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization']
    }));

    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // Simple logging
    this.app.use((req, res, next) => {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
      next();
    });
  }

  setupRoutes() {
    // Health check
    this.app.get('/api/health', async (req, res) => {
      try {
        const isOllamaReady = this.multiLLMService && this.multiLLMService.isOllamaInitialized;
        
        res.json({
          status: isOllamaReady ? 'ready' : 'initializing',
          message: 'Test Ollama Server',
          ollama: isOllamaReady,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        res.status(500).json({
          status: 'error',
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    });

    // Generate report using local Ollama
    this.app.post('/api/generate-report', async (req, res) => {
      try {
        const { transcriptionText, language = 'de', processingMode = 'local' } = req.body;
        
        console.log('🏥 Generate Report Request');
        console.log('- Text length:', transcriptionText?.length || 0);
        console.log('- Language:', language);
        console.log('- Processing mode:', processingMode);

        if (!transcriptionText || !transcriptionText.trim()) {
          return res.status(400).json({
            error: 'No transcription text provided'
          });
        }

        if (!this.multiLLMService) {
          throw new Error('Multi-LLM service not initialized');
        }

        // Use local Ollama processing
        const result = await this.multiLLMService.generateReport(
          transcriptionText,
          language,
          {
            timestamp: Date.now(),
            source: 'test-server'
          },
          'local'
        );

        console.log('✅ Local report generated');
        console.log('- Provider:', result.provider);
        console.log('- Model:', result.model);

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
            agent: 'test_ollama_server',
            aiProvider: result.provider || 'ollama-local',
            aiGenerated: true,
            processingMode: 'local',
            originalTextLength: transcriptionText.length
          }
        };

        return res.json(report);

      } catch (error) {
        console.error('❌ Report generation failed:', error);
        
        return res.status(500).json({
          error: 'Failed to generate report',
          details: error.message,
          timestamp: new Date().toISOString()
        });
      }
    });

    // Root route
    this.app.get('/', (req, res) => {
      res.json({
        name: 'Test Ollama Server',
        status: 'running',
        timestamp: new Date().toISOString()
      });
    });
  }

  async initializeServices() {
    console.log('🚀 Initializing Multi-LLM service with Ollama...');

    try {
      this.multiLLMService = new MultiLLMService();
      console.log('✅ Multi-LLM service initialized');
      
      // Wait a moment for Ollama initialization
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      if (this.multiLLMService.isOllamaInitialized) {
        console.log('✅ Ollama service is ready');
      } else {
        console.warn('⚠️ Ollama service may not be fully initialized');
      }

    } catch (error) {
      console.error('❌ Service initialization failed:', error);
    }
  }

  async start() {
    try {
      // Initialize services first
      await this.initializeServices();

      // Start the server
      this.app.listen(this.port, '0.0.0.0', () => {
        console.log(`✅ Test Ollama Server started on port ${this.port}`);
        console.log('🌍 Server URL: http://localhost:' + this.port);
        console.log('🏠 Ready for local Ollama processing! 🤖');
      });

    } catch (error) {
      console.error('❌ Failed to start server:', error);
      process.exit(1);
    }
  }
}

// Start the test server
if (require.main === module) {
  const server = new TestOllamaServer();
  server.start();
}

module.exports = TestOllamaServer;