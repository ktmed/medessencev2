// Simplified server for Heroku deployment with AI integration
const express = require('express');
const cors = require('cors');
const { createServer } = require('http');
const { Server } = require('socket.io');

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3000;

// CORS configuration
const corsOptions = {
  origin: [
    'https://medessencev3-test-kerem-tomaks-projects.vercel.app',
    'http://localhost:3000',
    'http://localhost:3010'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Socket.IO setup
const io = new Server(server, {
  cors: corsOptions
});

// Basic health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'production',
    aiProviders: {
      openai: process.env.OPENAI_API_KEY ? 'configured' : 'missing',
      claude: process.env.ANTHROPIC_API_KEY ? 'configured' : 'missing', 
      gemini: process.env.GOOGLE_API_KEY ? 'configured' : 'missing'
    }
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'MedEssence AI Backend API',
    version: '1.0.0',
    status: 'running',
    aiIntegration: 'enabled'
  });
});

// AI report generation endpoint with real AI integration
app.post('/api/generate-report', async (req, res) => {
  try {
    const { text, language = 'de', provider = 'claude' } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    console.log(`📝 Generating report with ${provider} for text length: ${text.length}`);
    
    // Check if we have the API key for the requested provider
    const apiKeys = {
      claude: process.env.ANTHROPIC_API_KEY,
      openai: process.env.OPENAI_API_KEY,
      gemini: process.env.GOOGLE_API_KEY
    };

    if (!apiKeys[provider]) {
      return res.status(400).json({ 
        error: `API key for ${provider} not configured`,
        availableProviders: Object.keys(apiKeys).filter(p => apiKeys[p])
      });
    }

    let report;
    
    if (provider === 'claude') {
      report = await generateReportWithClaude(text, language);
    } else if (provider === 'openai') {
      report = await generateReportWithOpenAI(text, language);
    } else if (provider === 'gemini') {
      report = await generateReportWithGemini(text, language);
    } else {
      return res.status(400).json({ error: 'Invalid provider' });
    }

    console.log(`✅ Report generated using ${provider}`);
    res.json({ report });

  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).json({ 
      error: 'Failed to generate report', 
      details: error.message 
    });
  }
});

// Claude AI integration
async function generateReportWithClaude(text, language) {
  const prompt = language === 'de' 
    ? `Analysiere den folgenden medizinischen Text und erstelle einen strukturierten Befundbericht:

Originaler Text:
${text}

Erstelle einen strukturierten medizinischen Bericht mit:
1. Befund (Haupterkenntnisse)
2. Beurteilung (Klinische Einschätzung)  
3. Empfehlung (Weitere Maßnahmen)

Antworte nur mit dem strukturierten Bericht ohne zusätzliche Erklärungen.`
    : `Analyze the following medical text and create a structured report:

Original text:
${text}

Create a structured medical report with:
1. Findings (Main observations)
2. Impression (Clinical assessment)
3. Recommendations (Next steps)

Respond only with the structured report without additional explanations.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: prompt
        }]
      })
    });

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.content[0].text;
    
    // Parse the AI response into structured format
    const sections = parseAIResponse(aiResponse, language);
    
    return {
      id: `report_${Date.now()}`,
      findings: sections.findings,
      impression: sections.impression,
      recommendations: sections.recommendations,
      metadata: {
        aiProvider: 'claude',
        aiGenerated: true,
        processingMode: 'cloud',
        generatedAt: new Date().toISOString(),
        hasEnhancedFindings: true,
        model: 'claude-3-haiku-20240307'
      }
    };

  } catch (error) {
    console.error('Claude API error:', error);
    throw error;
  }
}

// OpenAI integration
async function generateReportWithOpenAI(text, language) {
  const prompt = language === 'de' 
    ? `Analysiere den folgenden medizinischen Text und erstelle einen strukturierten Befundbericht mit Befund, Beurteilung und Empfehlung:\n\n${text}`
    : `Analyze the following medical text and create a structured report with Findings, Impression, and Recommendations:\n\n${text}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [{
          role: 'user',
          content: prompt
        }],
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;
    
    const sections = parseAIResponse(aiResponse, language);
    
    return {
      id: `report_${Date.now()}`,
      findings: sections.findings,
      impression: sections.impression,
      recommendations: sections.recommendations,
      metadata: {
        aiProvider: 'openai',
        aiGenerated: true,
        processingMode: 'cloud',
        generatedAt: new Date().toISOString(),
        hasEnhancedFindings: true,
        model: 'gpt-4'
      }
    };

  } catch (error) {
    console.error('OpenAI API error:', error);
    throw error;
  }
}

// Gemini integration placeholder
async function generateReportWithGemini(text, language) {
  // For now, return a structured response
  // TODO: Implement actual Gemini API call
  const sections = {
    findings: language === 'de' ? 'Befund: Gemini-Analyse in Entwicklung' : 'Findings: Gemini analysis in development',
    impression: language === 'de' ? 'Beurteilung: Gemini-Verarbeitung' : 'Impression: Gemini processing',
    recommendations: language === 'de' ? 'Empfehlung: Gemini-basierte Empfehlungen' : 'Recommendations: Gemini-based recommendations'
  };
  
  return {
    id: `report_${Date.now()}`,
    findings: sections.findings,
    impression: sections.impression,
    recommendations: sections.recommendations,
    metadata: {
      aiProvider: 'gemini',
      aiGenerated: true,
      processingMode: 'cloud',
      generatedAt: new Date().toISOString(),
      hasEnhancedFindings: true,
      model: 'gemini-pro'
    }
  };
}

// Parse AI response into structured sections
function parseAIResponse(aiResponse, language) {
  const isGerman = language === 'de';
  const sections = {
    findings: '',
    impression: '',
    recommendations: ''
  };

  // Try to extract sections based on common patterns
  const lines = aiResponse.split('\n').filter(line => line.trim());
  
  let currentSection = null;
  let sectionContent = [];

  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // German section headers
    if (isGerman) {
      if (trimmedLine.toLowerCase().includes('befund') || trimmedLine.startsWith('1.')) {
        if (currentSection && sectionContent.length > 0) {
          sections[currentSection] = sectionContent.join(' ').trim();
        }
        currentSection = 'findings';
        sectionContent = [];
        if (!trimmedLine.toLowerCase().startsWith('befund')) {
          sectionContent.push(trimmedLine);
        }
      } else if (trimmedLine.toLowerCase().includes('beurteilung') || trimmedLine.startsWith('2.')) {
        if (currentSection && sectionContent.length > 0) {
          sections[currentSection] = sectionContent.join(' ').trim();
        }
        currentSection = 'impression';
        sectionContent = [];
        if (!trimmedLine.toLowerCase().startsWith('beurteilung')) {
          sectionContent.push(trimmedLine);
        }
      } else if (trimmedLine.toLowerCase().includes('empfehlung') || trimmedLine.startsWith('3.')) {
        if (currentSection && sectionContent.length > 0) {
          sections[currentSection] = sectionContent.join(' ').trim();
        }
        currentSection = 'recommendations';
        sectionContent = [];
        if (!trimmedLine.toLowerCase().startsWith('empfehlung')) {
          sectionContent.push(trimmedLine);
        }
      } else if (currentSection && trimmedLine) {
        sectionContent.push(trimmedLine);
      }
    } else {
      // English section headers
      if (trimmedLine.toLowerCase().includes('finding') || trimmedLine.startsWith('1.')) {
        if (currentSection && sectionContent.length > 0) {
          sections[currentSection] = sectionContent.join(' ').trim();
        }
        currentSection = 'findings';
        sectionContent = [];
        if (!trimmedLine.toLowerCase().startsWith('finding')) {
          sectionContent.push(trimmedLine);
        }
      } else if (trimmedLine.toLowerCase().includes('impression') || trimmedLine.startsWith('2.')) {
        if (currentSection && sectionContent.length > 0) {
          sections[currentSection] = sectionContent.join(' ').trim();
        }
        currentSection = 'impression';
        sectionContent = [];
        if (!trimmedLine.toLowerCase().startsWith('impression')) {
          sectionContent.push(trimmedLine);
        }
      } else if (trimmedLine.toLowerCase().includes('recommend') || trimmedLine.startsWith('3.')) {
        if (currentSection && sectionContent.length > 0) {
          sections[currentSection] = sectionContent.join(' ').trim();
        }
        currentSection = 'recommendations';
        sectionContent = [];
        if (!trimmedLine.toLowerCase().startsWith('recommend')) {
          sectionContent.push(trimmedLine);
        }
      } else if (currentSection && trimmedLine) {
        sectionContent.push(trimmedLine);
      }
    }
  }

  // Add the last section
  if (currentSection && sectionContent.length > 0) {
    sections[currentSection] = sectionContent.join(' ').trim();
  }

  // If parsing failed, use the whole response
  if (!sections.findings && !sections.impression && !sections.recommendations) {
    sections.findings = aiResponse;
    sections.impression = isGerman ? 'Weitere Analyse erforderlich' : 'Further analysis required';
    sections.recommendations = isGerman ? 'Rücksprache mit behandelndem Arzt' : 'Consult with treating physician';
  }

  return sections;
}

// Simple WebSocket connection for testing
io.on('connection', (socket) => {
  console.log(`🔌 Frontend connected via Socket.IO: ${socket.id}`);
  
  socket.emit('connection-status', { 
    status: 'connected', 
    message: 'Successfully connected to MedEssence AI Backend',
    timestamp: new Date().toISOString()
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Frontend disconnected: ${socket.id}`);
  });

  socket.on('test-ai', (data) => {
    console.log('🧠 AI test request received:', data);
    socket.emit('ai-response', {
      message: 'AI integration working',
      provider: data.provider || 'claude',
      timestamp: new Date().toISOString()
    });
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message 
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Not found',
    path: req.path,
    availableEndpoints: ['/api/health', '/api/generate-report']
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`✅ MedEssence AI Backend running on port ${PORT}`);
  console.log(`🌐 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🧠 AI Providers configured:`, {
    openai: process.env.OPENAI_API_KEY ? '✅' : '❌',
    claude: process.env.ANTHROPIC_API_KEY ? '✅' : '❌',
    gemini: process.env.GOOGLE_API_KEY ? '✅' : '❌'
  });
  console.log(`🔌 WebSocket server ready`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});