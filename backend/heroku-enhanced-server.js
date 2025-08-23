// Enhanced Heroku server with PostgreSQL ontology integration and full medical cases
const express = require('express');
const cors = require('cors');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { PrismaClient } = require('@prisma/client');
const AdvancedICDMatcher = require('./services/advanced-icd-matcher');

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3000;

// Initialize Prisma client
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

// Initialize Advanced ICD Matcher
let advancedMatcher = null;

// CORS configuration for production
const corsOptions = {
  origin: [
    'https://medessencev3.vercel.app',
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

// Health check with database status
app.get('/api/health', async (req, res) => {
  try {
    // Check database connection
    const icdCount = await prisma.iCDCode.count();
    const medicalCasesCount = await prisma.medicalCase.count();
    
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '2.0.0',
      environment: process.env.NODE_ENV || 'production',
      database: {
        status: 'connected',
        icdCodes: icdCount,
        medicalCases: medicalCasesCount
      },
      aiProviders: {
        openai: process.env.OPENAI_API_KEY ? 'configured' : 'missing',
        claude: process.env.ANTHROPIC_API_KEY ? 'configured' : 'missing', 
        gemini: process.env.GOOGLE_API_KEY ? 'configured' : 'missing'
      }
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(500).json({
      status: 'error',
      error: 'Database connection failed',
      timestamp: new Date().toISOString()
    });
  }
});

// Statistics endpoint for ontology service compatibility
app.get('/api/statistics', async (req, res) => {
  try {
    const icdCount = await prisma.iCDCode.count();
    const medicalCasesCount = await prisma.medicalCase.count();
    const casesWithIcd = await prisma.medicalCase.count({
      where: {
        icdCode: {
          not: null
        }
      }
    });
    
    res.json({
      success: true,
      data: {
        icd_codes_count: icdCount,
        medical_cases_count: medicalCasesCount,
        cases_with_icd: casesWithIcd,
        database_type: 'postgresql',
        service_status: 'operational'
      }
    });
  } catch (error) {
    console.error('Statistics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve statistics'
    });
  }
});

// Advanced ICD Search endpoint
app.post('/api/search-icd', async (req, res) => {
  try {
    const { query, options = {} } = req.body;
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        error: 'Invalid query',
        message: 'Query must be a non-empty string'
      });
    }

    // Initialize matcher if not already done
    if (!advancedMatcher) {
      console.log('🔄 Initializing Advanced ICD Matcher...');
      advancedMatcher = new AdvancedICDMatcher();
      await advancedMatcher.initialize();
    }

    // Perform advanced search
    const results = await advancedMatcher.search(query, options);

    res.json({
      success: true,
      query: query,
      results: results,
      count: results.length,
      searchMethod: 'advanced_multilingual',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Advanced ICD search error:', error);
    res.status(500).json({
      error: 'Search failed',
      message: error.message
    });
  }
});

// Enhanced transcription endpoint with medical ontology
app.post('/api/enhance-transcription', async (req, res) => {
  try {
    const { 
      transcription_text, 
      modality = 'unspecified', 
      real_time_mode = false, 
      language = 'de' 
    } = req.body;
    
    if (!transcription_text) {
      return res.status(400).json({ 
        success: false, 
        error: 'Transcription text is required' 
      });
    }

    console.log(`🔍 Enhancing transcription: ${transcription_text.length} chars`);
    console.log(`📋 Modality: ${modality}, Real-time: ${real_time_mode}`);

    // Find relevant ICD codes based on text content
    const relevantICDs = await findRelevantICDs(transcription_text, modality);
    
    // Find similar medical cases
    const similarCases = await findSimilarCases(transcription_text, modality, 5);
    
    // Extract medical findings
    const findings = await extractMedicalFindings(transcription_text, relevantICDs);
    
    // Calculate confidence score
    const confidence = calculateConfidenceScore(findings, relevantICDs);
    
    const response = {
      success: true,
      data: {
        enhanced_transcription: transcription_text, // Keep original for now
        extracted_findings: findings,
        predicted_icd_codes: relevantICDs,
        similar_cases: similarCases,
        confidence: confidence,
        quality_score: confidence,
        modality: modality,
        language: language,
        processing_mode: real_time_mode ? 'real_time' : 'batch',
        timestamp: new Date().toISOString()
      }
    };

    console.log(`✅ Enhancement complete: ${relevantICDs.length} ICD codes, ${findings.length} findings`);
    res.json(response);

  } catch (error) {
    console.error('Transcription enhancement error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to enhance transcription',
      details: error.message
    });
  }
});

// Find relevant ICD codes based on text content using Advanced Matcher
async function findRelevantICDs(text, modality) {
  try {
    // Initialize advanced matcher if not already done
    if (!advancedMatcher) {
      console.log('🔄 Initializing Advanced ICD Matcher for transcription...');
      advancedMatcher = new AdvancedICDMatcher();
      await advancedMatcher.initialize();
    }
    
    const searchTerms = extractSearchTerms(text, modality);
    
    if (searchTerms.length === 0) {
      // If no specific terms, use the full text for semantic matching
      const results = await advancedMatcher.search(text, {
        maxResults: 10,
        includeMetadata: true,
        minimumScore: 0.3
      });
      
      return results.map(result => ({
        code: result.icdCode,
        description: result.label,
        category: result.metadata?.inferredCategory || 'general',
        confidence: result.combinedScore,
        matchType: result.searchMethods[0]?.type || 'semantic',
        chapter: result.chapterNr
      }));
    }
    
    // Use advanced search for each search term and combine results
    const allResults = new Map();
    
    for (const term of searchTerms) {
      const results = await advancedMatcher.search(term, {
        maxResults: 15,
        includeMetadata: true,
        minimumScore: 0.2
      });
      
      results.forEach(result => {
        const key = result.icdCode;
        if (!allResults.has(key) || allResults.get(key).combinedScore < result.combinedScore) {
          allResults.set(key, result);
        }
      });
    }
    
    // Convert to array and format for response
    const finalResults = Array.from(allResults.values())
      .sort((a, b) => b.combinedScore - a.combinedScore)
      .slice(0, 10)
      .map(result => ({
        code: result.icdCode,
        description: result.label,
        category: result.metadata?.inferredCategory || 'general',
        confidence: result.combinedScore,
        matchType: result.searchMethods[0]?.type || 'advanced',
        chapter: result.chapterNr,
        chapterName: result.metadata?.chapterInfo?.germanName
      }));
    
    return finalResults;
    
  } catch (error) {
    console.error('Error finding relevant ICDs with advanced matcher:', error);
    // Fallback to basic search if advanced matcher fails
    return await findRelevantICDsBasic(text, modality);
  }
}

// Fallback basic ICD search
async function findRelevantICDsBasic(text, modality) {
  try {
    const searchTerms = extractSearchTerms(text, modality);
    
    if (searchTerms.length === 0) {
      return [];
    }
    
    // Search for ICD codes using text matching
    const icds = await prisma.iCDCode.findMany({
      where: {
        OR: searchTerms.map(term => ({
          OR: [
            { label: { contains: term, mode: 'insensitive' } },
            { icdCode: { contains: term, mode: 'insensitive' } }
          ]
        }))
      },
      take: 10,
      select: {
        icdCode: true,
        label: true,
        chapterNr: true
      }
    });
    
    return icds.map(icd => ({
      code: icd.icdCode,
      description: icd.label,
      category: 'general',
      confidence: 0.6,
      matchType: 'basic',
      chapter: icd.chapterNr
    }));
    
  } catch (error) {
    console.error('Error in basic ICD search:', error);
    return [];
  }
}

// Find similar medical cases
async function findSimilarCases(text, modality, limit = 5) {
  try {
    const searchTerms = extractSearchTerms(text, modality);
    
    if (searchTerms.length === 0) {
      return [];
    }
    
    const cases = await prisma.medicalCase.findMany({
      where: {
        OR: searchTerms.map(term => ({
          OR: [
            { reportText: { contains: term, mode: 'insensitive' } },
            { examDescription: { contains: term, mode: 'insensitive' } }
          ]
        }))
      },
      take: limit,
      select: {
        id: true,
        examDescription: true,
        icdCode: true,
        patientSex: true,
        caseAgeClass: true,
        reportText: true
      },
      orderBy: {
        examDate: 'desc'
      }
    });
    
    return cases.map(case_ => ({
      case_id: case_.id,
      exam_description: case_.examDescription,
      icd_code: case_.icdCode,
      patient_demographics: {
        sex: case_.patientSex,
        age_class: case_.caseAgeClass
      },
      similarity_score: 0.75, // Placeholder similarity
      report_excerpt: case_.reportText?.substring(0, 200) + '...' || ''
    }));
    
  } catch (error) {
    console.error('Error finding similar cases:', error);
    return [];
  }
}

// Extract medical findings from text
async function extractMedicalFindings(text, relevantICDs) {
  const findings = [];
  
  // Simple medical term extraction (can be enhanced with NLP)
  const medicalTerms = [
    'befund', 'diagnose', 'pathologie', 'abnormalität', 'läsion',
    'finding', 'diagnosis', 'pathology', 'abnormality', 'lesion',
    'mammographie', 'sonographie', 'computertomographie', 'mrt',
    'röntgen', 'ultraschall', 'ct', 'mr'
  ];
  
  const words = text.toLowerCase().split(/\s+/);
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    
    for (const term of medicalTerms) {
      if (word.includes(term)) {
        const context = words.slice(Math.max(0, i-2), i+3).join(' ');
        findings.push({
          text: context,
          category: getMedicalTermCategory(term),
          confidence: 0.7,
          position: i,
          term: term
        });
        break;
      }
    }
  }
  
  return findings;
}

// Extract search terms from text based on modality
function extractSearchTerms(text, modality) {
  const words = text.toLowerCase()
    .replace(/[^\w\säöüß]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2);
  
  // Add modality-specific terms
  const modalityTerms = {
    'mammographie': ['mammographie', 'brust', 'mamma'],
    'sonographie': ['sonographie', 'ultraschall', 'echo'],
    'ct': ['computertomographie', 'ct', 'schichtaufnahme'],
    'mrt': ['magnetresonanz', 'mrt', 'mr'],
    'röntgen': ['röntgen', 'radiographie', 'aufnahme']
  };
  
  let searchTerms = [...words];
  
  if (modalityTerms[modality]) {
    searchTerms.push(...modalityTerms[modality]);
  }
  
  // Remove common words
  const stopWords = ['der', 'die', 'das', 'und', 'oder', 'mit', 'von', 'zu', 'im', 'am', 'ist', 'sind', 'the', 'and', 'or', 'with', 'of', 'to', 'in', 'at', 'is', 'are'];
  searchTerms = searchTerms.filter(term => !stopWords.includes(term));
  
  return [...new Set(searchTerms)]; // Remove duplicates
}

// Get medical term category
function getMedicalTermCategory(term) {
  const categories = {
    'befund': 'finding',
    'finding': 'finding', 
    'diagnose': 'diagnosis',
    'diagnosis': 'diagnosis',
    'pathologie': 'pathology',
    'pathology': 'pathology',
    'mammographie': 'imaging',
    'sonographie': 'imaging',
    'ct': 'imaging',
    'mrt': 'imaging',
    'röntgen': 'imaging'
  };
  
  return categories[term] || 'general';
}

// Calculate confidence score
function calculateConfidenceScore(findings, icds) {
  let score = 0.5; // Base score
  
  // Increase confidence based on findings
  score += Math.min(findings.length * 0.1, 0.3);
  
  // Increase confidence based on ICD matches
  score += Math.min(icds.length * 0.05, 0.2);
  
  return Math.min(score, 1.0);
}

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'MedEssence AI Backend with PostgreSQL Ontology',
    version: '2.0.0',
    status: 'running',
    features: [
      'AI Integration (Claude, OpenAI, Gemini)',
      'PostgreSQL Ontology Service', 
      'Full Medical Cases Database',
      'Real-time Transcription Enhancement',
      'ICD Code Prediction',
      'Medical Case Similarity Search'
    ]
  });
});

// AI report generation (keeping existing functionality)
app.post('/api/generate-report', async (req, res) => {
  try {
    const { text, language = 'de', provider = 'claude' } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    console.log(`📝 Generating report with ${provider} for text length: ${text.length}`);
    
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

// AI Provider functions (keeping existing implementations)
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

async function generateReportWithGemini(text, language) {
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

function parseAIResponse(aiResponse, language) {
  const isGerman = language === 'de';
  const sections = {
    findings: '',
    impression: '',
    recommendations: ''
  };

  const lines = aiResponse.split('\n').filter(line => line.trim());
  
  let currentSection = null;
  let sectionContent = [];

  for (const line of lines) {
    const trimmedLine = line.trim();
    
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

  if (currentSection && sectionContent.length > 0) {
    sections[currentSection] = sectionContent.join(' ').trim();
  }

  if (!sections.findings && !sections.impression && !sections.recommendations) {
    sections.findings = aiResponse;
    sections.impression = isGerman ? 'Weitere Analyse erforderlich' : 'Further analysis required';
    sections.recommendations = isGerman ? 'Rücksprache mit behandelndem Arzt' : 'Consult with treating physician';
  }

  return sections;
}

// WebSocket connection
io.on('connection', (socket) => {
  console.log(`🔌 Frontend connected via Socket.IO: ${socket.id}`);
  
  socket.emit('connection-status', { 
    status: 'connected', 
    message: 'Connected to MedEssence AI Backend with PostgreSQL Ontology',
    timestamp: new Date().toISOString(),
    features: ['Ontology Service', 'Full Medical Database', 'AI Integration']
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Frontend disconnected: ${socket.id}`);
  });

  socket.on('test-ontology', async (data) => {
    console.log('🧠 Ontology test request received:', data);
    try {
      const stats = await prisma.iCDCode.count();
      socket.emit('ontology-response', {
        message: 'Ontology service operational',
        icdCodes: stats,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      socket.emit('ontology-response', {
        error: 'Ontology service error',
        details: error.message
      });
    }
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
    availableEndpoints: [
      '/api/health', 
      '/api/statistics',
      '/api/enhance-transcription',
      '/api/generate-report'
    ]
  });
});

// Graceful shutdown
async function gracefulShutdown() {
  console.log('🛑 Shutting down gracefully...');
  
  // Cleanup advanced matcher
  if (advancedMatcher) {
    await advancedMatcher.cleanup();
    console.log('🧠 Advanced ICD Matcher cleaned up');
  }
  
  await prisma.$disconnect();
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start server
server.listen(PORT, () => {
  console.log(`✅ MedEssence AI Backend with PostgreSQL Ontology running on port ${PORT}`);
  console.log(`🌐 Health check: http://localhost:${PORT}/api/health`);
  console.log(`📊 Statistics: http://localhost:${PORT}/api/statistics`);
  console.log(`🧠 AI Providers configured:`, {
    openai: process.env.OPENAI_API_KEY ? '✅' : '❌',
    claude: process.env.ANTHROPIC_API_KEY ? '✅' : '❌',
    gemini: process.env.GOOGLE_API_KEY ? '✅' : '❌'
  });
  console.log(`🗄️ PostgreSQL Database: ${process.env.DATABASE_URL ? '✅' : '❌'}`);
  console.log(`🔌 WebSocket server ready`);
});