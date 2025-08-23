/**
 * Simple server for development - skips database initialization
 */

const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const logger = require('./config/logger');
const config = require('./config');

// Import services
const multiLLMService = require('./services/llm/multi-llm-service');
const medicalAgentOrchestrator = require('./services/llm/medical-agent-orchestrator');
const ollamaService = require('./services/llm/ollama-service');

// Import routes
const healthRoutes = require('./routes/health');
const transcriptionRoutes = require('./routes/transcriptions');
const reportRoutes = require('./routes/reports');
const summaryRoutes = require('./routes/summaries');
const authRoutes = require('./routes/auth');

class SimpleRadiologyServer {
  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    this.io = new Server(this.server, {
      cors: {
        origin: ['http://localhost:3000', 'http://localhost:3010', 'http://localhost:3001', 'https://medessencev3-test.vercel.app'],
        methods: ['GET', 'POST'],
        credentials: true
      }
    });
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
  }

  setupMiddleware() {
    // CORS
    this.app.use(cors({
      origin: ['http://localhost:3000', 'http://localhost:3010', 'http://localhost:3001', 'https://medessencev3-test.vercel.app'],
      credentials: true
    }));

    // Body parsing
    this.app.use(express.json({ limit: '50mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '50mb' }));

    // Request logging
    this.app.use((req, res, next) => {
      console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
      next();
    });
  }

  setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          database: 'skipped',
          redis: 'skipped',
          multiLLM: multiLLMService.getStatus()
        }
      });
    });

    // API routes
    this.app.use('/api/health', healthRoutes);
    this.app.use('/api/transcriptions', transcriptionRoutes);
    this.app.use('/api/reports', reportRoutes);
    this.app.use('/api/summaries', summaryRoutes);
    this.app.use('/api/auth', authRoutes);

    // LLM test endpoint
    this.app.post('/api/test-llm', async (req, res) => {
      try {
        const { prompt, provider } = req.body;
        const result = await multiLLMService.generateReport(
          prompt || 'Test prompt',
          'de',
          provider
        );
        res.json({ success: true, result });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({ error: 'Not found' });
    });

    // Error handler
    this.app.use((err, req, res, next) => {
      logger.error('Unhandled error:', err);
      res.status(500).json({ error: 'Internal server error' });
    });
  }

  setupWebSocket() {
    this.io.on('connection', (socket) => {
      console.log('New WebSocket connection:', socket.id);

      socket.on('transcription:start', async (data) => {
        console.log('Transcription started:', data);
        socket.emit('transcription:started', {
          id: Date.now().toString(),
          status: 'started'
        });
      });

      socket.on('transcription:audio', async (data) => {
        console.log('Audio received, processing...');
        // Simple echo for testing
        socket.emit('transcription:result', {
          text: 'Test transcription response',
          confidence: 0.95,
          timestamp: new Date().toISOString()
        });
      });

      socket.on('report:generate', async (data) => {
        console.log('Report generation requested:', data);
        try {
          const result = await multiLLMService.generateReport(
            data.transcriptionText || 'Test transcription',
            data.language || 'de',
            data.provider
          );
          socket.emit('report:generated', {
            success: true,
            report: result
          });
        } catch (error) {
          socket.emit('report:error', {
            error: error.message
          });
        }
      });

      socket.on('disconnect', () => {
        console.log('WebSocket disconnected:', socket.id);
      });
    });
  }

  async start() {
    try {
      const port = process.env.PORT || 3002;
      
      this.server.listen(port, () => {
        console.log(`
========================================
Simple Radiology Server Started
========================================
Port: ${port}
Environment: ${process.env.NODE_ENV || 'development'}
Database: SKIPPED (development mode)
Redis: SKIPPED (development mode)
----------------------------------------
Frontend URLs:
  - http://localhost:3000
  - http://localhost:3010
  - https://medessencev3-test.vercel.app
----------------------------------------
Available endpoints:
  - GET  /health
  - POST /api/test-llm
  - WebSocket on same port
========================================
        `);
      });
    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  }
}

// Start server
const server = new SimpleRadiologyServer();
server.start();