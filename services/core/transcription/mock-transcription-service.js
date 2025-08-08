const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'mock-transcription',
    timestamp: new Date().toISOString()
  });
});

// Languages endpoint
app.get('/languages', (req, res) => {
  res.json({
    supported_languages: [
      { code: 'de', name: 'Deutsch', native_name: 'Deutsch' },
      { code: 'en', name: 'English', native_name: 'English' },
      { code: 'fr', name: 'French', native_name: 'Français' },
      { code: 'es', name: 'Spanish', native_name: 'Español' },
      { code: 'it', name: 'Italian', native_name: 'Italiano' },
      { code: 'tr', name: 'Turkish', native_name: 'Türkçe' }
    ]
  });
});

// Mock transcription endpoint
app.post('/transcribe', (req, res) => {
  res.json({
    transcription: "Dies ist eine Mock-Transkription für deutsche medizinische Aufnahmen.",
    confidence: 0.95,
    language: "de",
    segments: [
      {
        text: "Dies ist eine Mock-Transkription",
        start: 0.0,
        end: 3.5,
        confidence: 0.96
      },
      {
        text: "für deutsche medizinische Aufnahmen.",
        start: 3.5,
        end: 7.0,
        confidence: 0.94
      }
    ]
  });
});

// WebSocket connection for real-time transcription
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  // Send connection success
  socket.emit('transcription_status', {
    status: 'connected',
    message: 'Mock transcription service connected'
  });

  // Handle transcription start
  socket.on('start_transcription', (data) => {
    console.log('Starting transcription:', data);
    
    // Mock real-time transcription
    let counter = 0;
    const interval = setInterval(() => {
      counter++;
      
      if (counter <= 5) {
        socket.emit('transcription_update', {
          text: `Mock German medical transcription ${counter}...`,
          confidence: 0.9 + (Math.random() * 0.1),
          is_final: false,
          language: data.language || 'de'
        });
      } else {
        socket.emit('transcription_complete', {
          final_text: "Complete mock German medical transcription for radiology report.",
          confidence: 0.95,
          language: data.language || 'de',
          duration: counter,
          word_count: 8
        });
        clearInterval(interval);
      }
    }, 1000);

    // Store interval to clear on disconnect
    socket.transcriptionInterval = interval;
  });

  // Handle stop transcription
  socket.on('stop_transcription', () => {
    if (socket.transcriptionInterval) {
      clearInterval(socket.transcriptionInterval);
      socket.transcriptionInterval = null;
    }
    socket.emit('transcription_stopped', { message: 'Transcription stopped' });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    if (socket.transcriptionInterval) {
      clearInterval(socket.transcriptionInterval);
    }
  });
});

const PORT = 8081;
server.listen(PORT, () => {
  console.log(`Mock Transcription Service running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`WebSocket endpoint: ws://localhost:${PORT}`);
});