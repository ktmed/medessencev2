const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000", "file://"],
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

app.use(cors());
app.use(express.json());

// Mock backend API endpoints
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    services: {
      transcription: 'healthy',
      report_generation: 'healthy',
      summary_generation: 'healthy'
    }
  });
});

app.get('/api/v1/health', (req, res) => {
  res.json({ status: 'healthy', service: 'backend-api' });
});

// Mock report generation endpoint
app.post('/api/reports/generate', async (req, res) => {
  const { transcription, language = 'de' } = req.body;
  
  // Mock German medical report generation
  res.json({
    id: 'report-' + Date.now(),
    status: 'completed',
    report: {
      header: 'Radiologische Allianz Hamburg',
      patient: 'XXXXX XXXXXXX, geb. am XXXXXXXXXX',
      examination: 'MRT der Lendenwirbelsäule',
      clinical_indication: 'Lumbago mit Ausstrahlung ins rechte Bein',
      technical_parameters: '1,5 Tesla, T1 und T2 gewichtete Sequenzen, 3mm Schichtdicke',
      findings: `Befund: ${transcription || 'Regelrechte Darstellung der Lendenwirbelsäule ohne Nachweis von Bandscheibenvorfällen oder Stenosen.'}`,
      assessment: 'Beurteilung: Kein pathologischer Befund.',
      physician: 'Dr. med. Max Mustermann'
    }
  });
});

// Mock patient summary endpoint
app.post('/api/summaries/generate', async (req, res) => {
  const { report, language = 'de' } = req.body;
  
  const summaries = {
    de: {
      title: 'Ihre Untersuchungsergebnisse',
      summary: 'Die MRT-Untersuchung Ihrer Lendenwirbelsäule zeigt normale Verhältnisse. Es wurden keine Bandscheibenvorfälle oder Verengungen festgestellt. Ihre Rückenschmerzen haben keine strukturelle Ursache in der Wirbelsäule.',
      recommendations: 'Besprechen Sie mit Ihrem Arzt physiotherapeutische Übungen zur Stärkung der Rückenmuskulatur.',
      disclaimer: 'Diese Zusammenfassung ersetzt nicht das Arztgespräch.'
    },
    en: {
      title: 'Your Examination Results',
      summary: 'The MRI scan of your lumbar spine shows normal findings. No disc herniations or stenosis were found. Your back pain has no structural cause in the spine.',
      recommendations: 'Discuss physiotherapy exercises with your doctor to strengthen your back muscles.',
      disclaimer: 'This summary does not replace a doctor consultation.'
    }
  };
  
  res.json({
    id: 'summary-' + Date.now(),
    status: 'completed',
    summary: summaries[language] || summaries.de
  });
});

// WebSocket connection handler
io.on('connection', (socket) => {
  console.log('WebSocket client connected:', socket.id);
  
  // Emit connection event immediately
  socket.emit('connection', { status: 'connected' });
  
  socket.on('start_transcription', (data) => {
    console.log('Starting mock transcription:', data);
    
    // Mock real-time transcription
    const mockPhrases = [
      'Untersuchung der Lendenwirbelsäule',
      'Keine Auffälligkeiten in den Bandscheiben',
      'Normale Darstellung der Wirbelkörper',
      'Kein Nachweis einer Spinalkanalstenose',
      'Regelrechte Darstellung der Nervenwurzeln'
    ];
    
    let index = 0;
    const interval = setInterval(() => {
      if (index < mockPhrases.length) {
        socket.emit('transcription_update', {
          text: mockPhrases[index],
          is_final: index === mockPhrases.length - 1,
          confidence: 0.95,
          language: data.language || 'de'
        });
        index++;
      } else {
        clearInterval(interval);
        socket.emit('transcription_complete', {
          final_text: mockPhrases.join('. '),
          duration: 10,
          word_count: 20
        });
      }
    }, 2000);
    
    socket.on('stop_transcription', () => {
      clearInterval(interval);
      socket.emit('transcription_stopped');
    });
  });
  
  socket.on('disconnect', () => {
    console.log('WebSocket client disconnected:', socket.id);
  });
});

// Start server
server.listen(8080, () => {
  console.log('Backend API and WebSocket running on http://localhost:8080');
});

console.log('Simple backend services started!');
console.log('- API: http://localhost:8080');
console.log('- WebSocket: ws://localhost:8085');
console.log('- Health check: http://localhost:8080/health');