/**
 * Development server - minimal dependencies
 */

const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:3010', 'https://medessencev3-test.vercel.app'],
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3010', 'https://medessencev3-test.vercel.app'],
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    mode: 'development'
  });
});

// Test endpoint for LLM
app.post('/api/generate-report', async (req, res) => {
  console.log('Report generation requested:', req.body);
  
  // Mock response for testing
  res.json({
    id: `report-${Date.now()}`,
    transcriptionId: req.body.transcriptionId || 'test',
    language: req.body.language || 'de',
    findings: 'Mock findings for testing',
    impression: 'Mock impression for testing',
    recommendations: 'Mock recommendations for testing',
    timestamp: new Date().toISOString(),
    metadata: {
      provider: 'mock',
      model: 'test',
      processingTime: 100,
      confidence: 0.95
    }
  });
});

// Test endpoint for summary
app.post('/api/generate-summary', async (req, res) => {
  console.log('Summary generation requested:', req.body);
  
  res.json({
    id: `summary-${Date.now()}`,
    reportId: req.body.reportId || 'test',
    language: req.body.language || 'de',
    summary: 'Mock patient summary for testing',
    keyFindings: ['Finding 1', 'Finding 2'],
    recommendations: ['Recommendation 1'],
    timestamp: new Date().toISOString()
  });
});

// Test endpoint for ICD codes
app.post('/api/generate-icd', async (req, res) => {
  console.log('ICD generation requested:', req.body);
  
  res.json({
    codes: [
      { code: 'Z12.31', description: 'Mammographie-Screening', confidence: 0.95 }
    ],
    summary: {
      primaryDiagnoses: 1,
      totalCodes: 1
    },
    provider: 'mock',
    timestamp: new Date().toISOString()
  });
});

// WebSocket handling
io.on('connection', (socket) => {
  console.log('New WebSocket connection:', socket.id);

  socket.on('transcription:start', (data) => {
    console.log('Transcription started:', data);
    socket.emit('transcription:started', {
      id: Date.now().toString(),
      status: 'started'
    });
  });

  socket.on('transcription:audio', (data) => {
    console.log('Audio received');
    socket.emit('transcription:result', {
      text: 'Mock transcription text',
      confidence: 0.95,
      timestamp: new Date().toISOString()
    });
  });

  socket.on('report:generate', (data) => {
    console.log('Report generation via WebSocket:', data);
    socket.emit('report:generated', {
      success: true,
      report: {
        findings: 'Mock findings',
        impression: 'Mock impression',
        recommendations: 'Mock recommendations'
      }
    });
  });

  socket.on('disconnect', () => {
    console.log('WebSocket disconnected:', socket.id);
  });
});

// Start server
const PORT = process.env.PORT || 3002;
server.listen(PORT, () => {
  console.log(`
========================================
Development Server Started
========================================
Port: ${PORT}
Mode: Development (Mock responses)
========================================
Frontend can connect from:
  - http://localhost:3000
  - http://localhost:3010
  - https://medessencev3-test.vercel.app
========================================
Endpoints:
  - GET  /health
  - POST /api/generate-report
  - POST /api/generate-summary
  - POST /api/generate-icd
  - WebSocket on port ${PORT}
========================================
  `);
});