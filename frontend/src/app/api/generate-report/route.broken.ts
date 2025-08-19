import { NextRequest, NextResponse } from 'next/server';

// Types
interface ReportRequest {
  transcriptionId: string;
  language: string;
  transcriptionText: string;
  processingMode?: 'cloud' | 'local';
}

interface LLMProvider {
  name: string;
  handler: (prompt: string) => Promise<string>;
}

class ServerMultiLLMService {
  private providers: LLMProvider[] = [];

  constructor() {
    this.initializeProviders();
  }

  private classifyMedicalContent(text: string): { type: string; agent: string; specialty: string; confidence: number } {
    const lowerText = text.toLowerCase();
    
    // Define medical specialty patterns
    const specialtyPatterns = {
      'mammography': {
        keywords: ['mammo', 'breast', 'brust', 'mammographie', 'birads', 'microcalcification', 'architectural distortion', 'masse', 'density'],
        agent: 'mammography_specialist',
        type: 'Mammography'
      },
      'spine_mri': {
        keywords: ['wirbelsäule', 'spine', 'lumbar', 'cervical', 'thoracic', 'lws', 'hws', 'bws', 'bandscheibe', 'disc', 'spondylose', 'spinal', 'vertebral', 'facet'],
        agent: 'spine_mri_specialist', 
        type: 'Spine MRI'
      },
      'cardiac': {
        keywords: ['herz', 'heart', 'cardiac', 'coronary', 'aorta', 'ventricle', 'atrium', 'myocardium', 'pericardium', 'ecg', 'ekg', 'echo'],
        agent: 'cardiac_imaging_specialist',
        type: 'Cardiac Imaging'
      },
      'ct_scan': {
        keywords: ['computertomographie', 'ct scan', 'computed tomography', 'contrast', 'hounsfield', 'axial', 'coronal', 'sagittal'],
        agent: 'ct_scan_specialist',
        type: 'CT Scan'
      },
      'ultrasound': {
        keywords: ['ultraschall', 'ultrasound', 'sonography', 'doppler', 'echogenic', 'hypoechoic', 'hyperechoic', 'anechoic'],
        agent: 'ultrasound_specialist',
        type: 'Ultrasound'
      },
      'oncology': {
        keywords: ['tumor', 'cancer', 'neoplasm', 'malignant', 'metastasis', 'oncology', 'chemotherapy', 'radiation', 'staging'],
        agent: 'oncology_specialist',
        type: 'Oncology'
      },
      'pathology': {
        keywords: ['biopsy', 'histology', 'pathology', 'cytology', 'tissue', 'specimen', 'microscopic', 'cellular'],
        agent: 'pathology_specialist',
        type: 'Pathology'
      }
    };

    let bestMatch = {
      type: 'General Radiology',
      agent: 'general_radiology_specialist',
      specialty: 'general',
      confidence: 0
    };

    // Score each specialty based on keyword matches
    for (const [specialtyKey, data] of Object.entries(specialtyPatterns)) {
      let score = 0;
      let matchedKeywords: string[] = [];

      for (const keyword of data.keywords) {
        if (lowerText.includes(keyword)) {
          score += 1;
          matchedKeywords.push(keyword);
        }
      }

      const confidence = score / data.keywords.length;
      
      if (confidence > bestMatch.confidence) {
        bestMatch = {
          type: data.type,
          agent: data.agent,
          specialty: specialtyKey,
          confidence: confidence
        };
      }

      if (matchedKeywords.length > 0) {
        console.log(`🔍 ${specialtyKey} match: ${score}/${data.keywords.length} keywords (${Math.round(confidence * 100)}%) - ${matchedKeywords.join(', ')}`);
      }
    }

    console.log(`🎯 Best classification: ${bestMatch.type} (${Math.round(bestMatch.confidence * 100)}% confidence)`);
    return bestMatch;
  }

  private initializeProviders() {
    const providerPriority = (process.env.AI_PROVIDER_PRIORITY || 'claude,gemini,openai')
      .split(',')
      .map(p => p.trim());
    
    console.log('🚀 SERVER API: Initializing AI providers');
    console.log('- Provider priority:', providerPriority);
    console.log('- Claude API Key:', process.env.ANTHROPIC_API_KEY ? 'SET' : 'NOT SET');
    console.log('- OpenAI API Key:', process.env.OPENAI_API_KEY ? 'SET' : 'NOT SET');
    console.log('- Google API Key:', process.env.GOOGLE_API_KEY ? 'SET' : 'NOT SET');

    const availableProviders: { [key: string]: () => LLMProvider | null } = {
      claude: () => {
        if (process.env.ANTHROPIC_API_KEY) {
          return {
            name: 'claude',
            handler: this.callClaude.bind(this)
          };
        }
        return null;
      },
      openai: () => {
        if (process.env.OPENAI_API_KEY) {
          return {
            name: 'openai',
            handler: this.callOpenAI.bind(this)
          };
        }
        return null;
      },
      gemini: () => {
        if (process.env.GOOGLE_API_KEY) {
          return {
            name: 'gemini',
            handler: this.callGemini.bind(this)
          };
        }
        return null;
      }
    };

    // Add providers in priority order
    for (const providerName of providerPriority) {
      const providerFactory = availableProviders[providerName];
      if (providerFactory) {
        const provider = providerFactory();
        if (provider) {
          this.providers.push(provider);
          console.log(`✅ Added ${providerName} provider`);
        } else {
          console.log(`❌ ${providerName} provider not available (missing API key)`);
        }
      }
    }

    console.log(`🎯 Initialized with ${this.providers.length} providers:`, this.providers.map(p => p.name));
  }

  async generateReport(transcriptionText: string, language: string): Promise<any> {
    console.log('📝 Generating medical report...');
    console.log('- Text length:', transcriptionText.length);
    console.log('- Language:', language);
    console.log('- Available providers:', this.providers.map(p => p.name));

    // Classify the medical specialty and report type based on content
    const classification = this.classifyMedicalContent(transcriptionText);
    console.log('🎯 Medical content classification:', classification);
    console.log('🎯 Classification agent will be:', classification.agent);
    console.log('🎯 Classification type will be:', classification.type);

    if (this.providers.length === 0) {
      console.error('❌ No AI providers available');
      return this.generateFallbackReport(transcriptionText, language, 'No AI providers initialized', classification);
    }

    const prompt = this.createMedicalReportPrompt(transcriptionText, language);
    console.log('📋 Created prompt, length:', prompt.length);
    
    // Try each provider
    for (const provider of this.providers) {
      try {
        console.log(`🤖 Trying ${provider.name}...`);
        console.log(`- About to call ${provider.name} handler`);
        
        const aiResponse = await provider.handler(prompt);
        console.log(`✅ ${provider.name} succeeded!`);
        console.log(`- Response length:`, aiResponse?.length || 0);
        console.log(`- Response preview:`, aiResponse?.substring(0, 100) + '...');
        
        const parsedReport = this.parseReportResponse(aiResponse, transcriptionText, language, provider.name, classification);
        console.log(`🎯 Successfully parsed report from ${provider.name}`);
        return parsedReport;
        
      } catch (error) {
        console.error(`❌ ${provider.name} failed with detailed error:`);
        console.error(`- Error type:`, error?.constructor?.name);
        console.error(`- Error message:`, error instanceof Error ? error.message : 'Unknown error');
        console.error(`- Full error:`, error);
        
        // Continue to next provider
        continue;
      }
    }

    console.error('❌ ALL AI PROVIDERS FAILED - falling back to rule-based');
    return this.generateFallbackReport(transcriptionText, language, 'All AI providers failed', classification);
  }

  private createMedicalReportPrompt(text: string, language: string): string {
    if (language === 'de') {
      return `Du bist ein erfahrener Radiologe. Analysiere den folgenden medizinischen Text und erstelle einen strukturierten Befundbericht.

Originaler Text:
${text}

Erstelle AUSSCHLIESSLICH einen strukturierten medizinischen Bericht mit diesen exakten Abschnitten:

BEFUND:
[Hier die detaillierten Hauptbefunde und Beobachtungen auflisten]

BEURTEILUNG:
[Hier die medizinische Einschätzung und klinische Relevanz angeben]

EMPFEHLUNG:
[Hier konkrete, spezifische weitere Maßnahmen und Empfehlungen nennen]

WICHTIG: 
- Verwende KEINE einleitenden Sätze wie "Hier ist der Bericht"
- Beginne direkt mit "BEFUND:"
- Halte dich streng an das Format
- Schreibe professionell und präzise
- Verwende medizinische Fachsprache`;
    }

    return `You are an experienced radiologist. Create a structured medical report from the following text.
Structure the report into these sections:

FINDINGS: [Detailed main findings and observations]
IMPRESSION: [Medical assessment, diagnosis and clinical relevance]
RECOMMENDATIONS: [Specific, clinically appropriate further measures and recommendations]
TECHNICAL_DETAILS: [Examination technique, parameters, contrast agents, sequences, technical quality]

IMPORTANT INSTRUCTIONS FOR RECOMMENDATIONS:
- Provide CONCRETE and SPECIFIC recommendations based on the findings
- For pathological findings: Recommend appropriate follow-up, further diagnostics or therapy
- For normal findings: Recommend routine follow-up or no further measures
- Consider clinical urgency - give strong recommendations for critical findings
- For unclear findings: Recommend specific further examinations for clarification
- Provide timeframes for recommendations (e.g. "within 24h", "in 3-6 months")

Text: ${text}

Create a professional, clinically relevant medical report:`;
  }

  private async callClaude(prompt: string): Promise<string> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('Claude API key not configured');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: process.env.CLAUDE_MODEL || 'claude-3-haiku-20240307',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.status}`);
    }

    const data = await response.json();
    return data.content[0].text;
  }

  private async callOpenAI(prompt: string): Promise<string> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OpenAI API key not configured');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a medical AI assistant creating structured medical reports.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  private async callGemini(prompt: string): Promise<string> {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) throw new Error('Gemini API key not configured');

    const model = process.env.GEMINI_MODEL || 'gemini-1.5-pro';
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 2000 },
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  }

  private parseReportResponse(aiResponse: string, originalText: string, language: string, provider: string, classification: { type: string; agent: string; specialty: string; confidence: number }) {
    console.log('🔍 Parsing AI response, length:', aiResponse.length);
    console.log('🔍 Response preview:', aiResponse.substring(0, 200) + '...');
    
    // Extract sections using more robust regex patterns
    let findings = '';
    let impression = '';
    let recommendations = '';
    let technicalDetails = '';
    
    // Try to match German or English section headers using compatible regex
    const findingsMatch = aiResponse.match(/(?:BEFUND|FINDINGS):\s*([\s\S]*?)(?=(?:BEURTEILUNG|IMPRESSION|EMPFEHLUNG|RECOMMENDATIONS|TECHNISCHE_DETAILS|TECHNICAL_DETAILS):|$)/i);
    const impressionMatch = aiResponse.match(/(?:BEURTEILUNG|IMPRESSION):\s*([\s\S]*?)(?=(?:EMPFEHLUNG|RECOMMENDATIONS|TECHNISCHE_DETAILS|TECHNICAL_DETAILS):|$)/i);
    const recommendationsMatch = aiResponse.match(/(?:EMPFEHLUNG|RECOMMENDATIONS):\s*([\s\S]*?)(?=(?:TECHNISCHE_DETAILS|TECHNICAL_DETAILS):|$)/i);
    const technicalMatch = aiResponse.match(/(?:TECHNISCHE_DETAILS|TECHNICAL_DETAILS):\s*([\s\S]*?)$/i);
    
    findings = findingsMatch?.[1]?.trim() || aiResponse;
    impression = impressionMatch?.[1]?.trim() || (language === 'de' ? 'Siehe Befund oben.' : 'See findings above.');
    recommendations = recommendationsMatch?.[1]?.trim() || (language === 'de' ? 'Weitere Abklärung nach klinischer Einschätzung.' : 'Further workup per clinical assessment.');
    technicalDetails = technicalMatch?.[1]?.trim() || '';
    
    // If no technical details were extracted, create them from metadata
    if (!technicalDetails) {
      const technicalInfo = language === 'de' 
        ? `Untersuchungstyp: ${classification.type}
Verarbeitungsagent: ${classification.agent}
KI-Anbieter: ${provider}
Klassifikationsvertrauen: ${Math.round(classification.confidence * 100)}%
Originaltext-Länge: ${originalText.length} Zeichen
Generierungszeitpunkt: ${new Date().toLocaleString('de-DE')}`
        : `Examination Type: ${classification.type}
Processing Agent: ${classification.agent}
AI Provider: ${provider}
Classification Confidence: ${Math.round(classification.confidence * 100)}%
Original Text Length: ${originalText.length} characters
Generation Time: ${new Date().toLocaleString('en-US')}`;
      
      technicalDetails = technicalInfo;
    }
    
    // If no clear sections found, use the entire response as findings
    if (!findingsMatch && !impressionMatch && !recommendationsMatch && !technicalMatch) {
      console.log('⚠️ No clear sections found, using entire response as findings');
      findings = aiResponse;
    }
    
    console.log('✅ Parsed sections:');
    console.log('- Findings length:', findings.length);
    console.log('- Impression length:', impression.length);
    console.log('- Recommendations length:', recommendations.length);
    console.log('- Technical Details length:', technicalDetails.length);
    
    console.log('📊 Report metadata being set:');
    console.log('- Agent:', classification.agent);
    console.log('- Type:', classification.type);
    console.log('- Specialty:', classification.specialty);
    console.log('- Confidence:', classification.confidence);
    
    return {
      id: `report-${Date.now()}`,
      transcriptionId: `transcription-${Date.now()}`,
      findings: findings,
      impression: impression,
      recommendations: recommendations,
      technicalDetails: technicalDetails,
      generatedAt: Date.now(),
      language: language,
      type: classification.type,
      metadata: {
        agent: classification.agent,
        specialty: classification.specialty,
        confidence: classification.confidence,
        aiProvider: provider,
        aiGenerated: true,
        originalTextLength: originalText.length
      }
    };
  }

  private generateFallbackReport(text: string, language: string, reason: string = 'Unknown', classification?: { type: string; agent: string; specialty: string; confidence: number }) {
    console.log('📋 Generating rule-based fallback report');
    console.log('- Fallback reason:', reason);
    
    // Use classification if available, otherwise default to general
    const reportType = classification?.type || 'General Medical Report';
    const agent = classification?.agent || 'rule_based_processor';
    const specialty = classification?.specialty || 'general';
    
    return {
      id: `report-${Date.now()}`,
      transcriptionId: `transcription-${Date.now()}`,
      findings: text,
      impression: language === 'de' ? 'Siehe Befund.' : 'See findings above.',
      recommendations: language === 'de' ? 'Weitere Abklärung nach klinischer Einschätzung.' : 'Further workup per clinical assessment.',
      technicalDetails: language === 'de' 
        ? `Untersuchungstyp: ${reportType}
Verarbeitungsagent: ${agent}
Verarbeitungsmodus: Regelbasiert
Fallback-Grund: ${reason}
Klassifikationsvertrauen: ${Math.round((classification?.confidence || 0.5) * 100)}%
Originaltext-Länge: ${text.length} Zeichen
Generierungszeitpunkt: ${new Date().toLocaleString('de-DE')}`
        : `Examination Type: ${reportType}
Processing Agent: ${agent}
Processing Mode: Rule-based
Fallback Reason: ${reason}
Classification Confidence: ${Math.round((classification?.confidence || 0.5) * 100)}%
Original Text Length: ${text.length} characters
Generation Time: ${new Date().toLocaleString('en-US')}`,
      generatedAt: Date.now(),
      language: language,
      type: reportType,
      metadata: {
        agent: agent,
        specialty: specialty,
        confidence: classification?.confidence || 0.5,
        aiProvider: 'rule-based',
        aiGenerated: false,
        fallbackReason: reason
      }
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: ReportRequest = await request.json();
    
    console.log('🌐 API Route: Generate Report Request');
    console.log('- Transcription ID:', body.transcriptionId);
    console.log('- Language:', body.language);
    console.log('- Text length:', body.transcriptionText?.length || 0);
    console.log('- Processing mode:', body.processingMode);

    if (!body.transcriptionText) {
      return NextResponse.json(
        { error: 'No transcription text provided' },
        { status: 400 }
      );
    }

    // For local processing mode, use backend Multi-LLM service
    if (body.processingMode === 'local') {
      console.log('🏠 Using local processing with backend service');
      
      try {
        // Call the backend Multi-LLM service endpoint
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL || 'https://medessence-backend-0441523a6c55.herokuapp.com';
        const response = await fetch(`${backendUrl}/api/generate-report`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            transcriptionText: body.transcriptionText,
            language: body.language || 'de',
            processingMode: 'local'
          })
        });

        if (!response.ok) {
          throw new Error(`Backend service error: ${response.status} - ${response.statusText}`);
        }

        const backendReport = await response.json();
        console.log('✅ Local report generated via backend service');
        console.log('- Provider:', backendReport.provider);
        console.log('- Model:', backendReport.model);

        return NextResponse.json(backendReport);

      } catch (backendError) {
        console.error('❌ Backend service failed, falling back to frontend processing:', backendError instanceof Error ? backendError.message : 'Unknown error');
        
        // Fallback to frontend Ollama processing
        return await generateLocalReport(body);
      }
    }

    // Cloud processing using frontend service
    console.log('☁️ Using cloud processing');
    const llmService = new ServerMultiLLMService();
    const report = await llmService.generateReport(
      body.transcriptionText,
      body.language || 'de'
    );

    console.log('✅ Report generated successfully');
    console.log('- Report ID:', report.id);
    console.log('- AI Provider:', report.metadata?.aiProvider);

    return NextResponse.json(report);

  } catch (error) {
    console.error('❌ API Route Error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to generate report',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Local report generation using rule-based processing (Ollama models are broken)
async function generateLocalReport(body: ReportRequest) {
  console.log('🏠 Generating local report via rule-based processing (Ollama models disabled due to repetition issues)...');
  
  // Skip Ollama entirely and use rule-based processing
  console.log('⚠️ Ollama models are currently broken with infinite repetition. Using rule-based fallback.');
  
  // Generate a rule-based medical report
  const ruleBasedReport = generateRuleBasedReport(body.transcriptionText, body.language || 'de', body.transcriptionId);
  
  return NextResponse.json(ruleBasedReport);
}

// Rule-based medical report generator
function generateRuleBasedReport(text: string, language: string, transcriptionId: string) {
  console.log('🔧 Generating rule-based medical report...');
  
  const isGerman = language === 'de';
  
  // Clean and prepare text
  const cleanText = text.replace(/\s+/g, ' ').trim();
  
  // Extract structured sections using medical keywords
  const sections = extractMedicalSections(cleanText, isGerman);
  
  // Generate enhanced findings for proper UI display
  const enhancedFindings = generateEnhancedFindingsFromStructuredText(sections.findings, sections.impression, sections.recommendations, isGerman);
  
  // Generate basic ICD suggestions based on keywords
  const icdPredictions = generateBasicICDPredictions(cleanText, isGerman);
  
  const report = {
    id: `report-${Date.now()}`,
    transcriptionId: transcriptionId,
    findings: sections.findings,
    impression: sections.impression,
    recommendations: sections.recommendations,
    technicalDetails: isGerman 
      ? `Regelbasierte lokale Verarbeitung\nVerarbeitungsagent: rule_based_local_processor\nGenerierungszeitpunkt: ${new Date().toLocaleString('de-DE')}\nOriginaltext-Länge: ${text.length} Zeichen\nVerarbeitungsmodus: Lokale Regelverarbeitung`
      : `Rule-based local processing\nProcessing Agent: rule_based_local_processor\nGeneration Time: ${new Date().toLocaleString('en-US')}\nOriginal Text Length: ${text.length} characters\nProcessing Mode: Local Rule Processing`,
    enhancedFindings: enhancedFindings, // Critical: Include enhanced findings for UI
    icdPredictions: icdPredictions, // Include basic ICD predictions
    generatedAt: Date.now(),
    language: language,
    type: 'Rule-based Medical Report',
    metadata: {
      agent: 'rule_based_local_processor',
      aiProvider: 'rule-based',
      aiGenerated: true, // Set to true so ICD/summary generation works
      processingMode: 'local',
      hasEnhancedFindings: true, // Critical flag for UI
      model: 'rule-based-v1'
    }
  };
  
  console.log('✅ Rule-based report generated with enhanced findings');
  console.log('- Enhanced findings categories:', Object.keys(enhancedFindings));
  console.log('- ICD predictions:', icdPredictions.codes.length, 'codes');
  
  return report;
}

// Extract medical sections from text using keyword patterns
function extractMedicalSections(text: string, isGerman: boolean) {
  const textLower = text.toLowerCase();
  
  // Define section markers for both languages
  const sectionMarkers = isGerman ? {
    findings: ['befund', 'untersuchung', 'darstellung', 'sichtbar', 'erkennbar'],
    impression: ['beurteilung', 'diagnose', 'einschätzung', 'bewertung'],
    recommendations: ['empfehlung', 'maßnahmen', 'kontrolle', 'therapie', 'nachsorge']
  } : {
    findings: ['finding', 'examination', 'visible', 'shows', 'demonstrates'],
    impression: ['impression', 'diagnosis', 'assessment', 'evaluation'],
    recommendations: ['recommendation', 'follow-up', 'therapy', 'treatment', 'management']
  };
  
  // Split text into sentences
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
  
  const sections = {
    findings: '',
    impression: '',
    recommendations: ''
  };
  
  // Categorize sentences based on medical keywords
  const categorizedSentences: {
    findings: string[];
    impression: string[];
    recommendations: string[];
    uncategorized: string[];
  } = {
    findings: [],
    impression: [],
    recommendations: [],
    uncategorized: []
  };
  
  sentences.forEach(sentence => {
    const sentenceLower = sentence.toLowerCase();
    let categorized = false;
    
    // Check for impression/diagnosis keywords first (most specific)
    if (sectionMarkers.impression.some(keyword => sentenceLower.includes(keyword))) {
      categorizedSentences.impression.push(sentence.trim());
      categorized = true;
    }
    // Check for recommendation keywords
    else if (sectionMarkers.recommendations.some(keyword => sentenceLower.includes(keyword))) {
      categorizedSentences.recommendations.push(sentence.trim());
      categorized = true;
    }
    // Check for findings keywords
    else if (sectionMarkers.findings.some(keyword => sentenceLower.includes(keyword))) {
      categorizedSentences.findings.push(sentence.trim());
      categorized = true;
    }
    
    if (!categorized) {
      categorizedSentences.uncategorized.push(sentence.trim());
    }
  });
  
  // Build sections with fallbacks
  sections.findings = categorizedSentences.findings.length > 0 
    ? categorizedSentences.findings.join('. ')
    : (categorizedSentences.uncategorized.slice(0, 3).join('. ') || text.substring(0, 200));
    
  sections.impression = categorizedSentences.impression.length > 0
    ? categorizedSentences.impression.join('. ')
    : (isGerman ? 'Weitere medizinische Beurteilung erforderlich.' : 'Further medical assessment required.');
    
  sections.recommendations = categorizedSentences.recommendations.length > 0
    ? categorizedSentences.recommendations.join('. ')
    : (isGerman ? 'Kontrolle nach klinischer Einschätzung empfohlen.' : 'Follow-up recommended per clinical assessment.');
  
  return sections;
}

// Generate enhanced findings from structured text for UI display
function generateEnhancedFindingsFromStructuredText(findings: string, impression: string, recommendations: string, isGerman: boolean) {
  console.log('🔍 Generating enhanced findings from structured text...');
  
  const allText = `${findings} ${impression} ${recommendations}`.toLowerCase();
  
  // Enhanced categorization with more medical keywords
  const normalFindings: string[] = [];
  const pathologicalFindings: string[] = [];
  const specialObservations: string[] = [];
  const measurements: string[] = [];
  const localizations: string[] = [];
  
  // Split into meaningful segments for processing
  const sentences = findings.split(/[.!?]+/).filter(s => s.trim().length > 15);
  
  sentences.forEach(sentence => {
    const sentenceLower = sentence.trim().toLowerCase();
    if (!sentenceLower) return;
    
    // More comprehensive pattern matching
    if (sentenceLower.match(/\d+[,.]?\d*\s*(mm|cm|m|ml|l|grad|°|prozent|%|kg|g)/i)) {
      measurements.push(sentence.trim());
    }
    else if (sentenceLower.match(/(links|rechts|beidseits|bilateral|mittig|zentral|lateral|medial|anterior|posterior|cranial|caudal|proximal|distal|dorsal|ventral|superior|inferior)/i)) {
      localizations.push(sentence.trim());
    }
    else if (sentenceLower.match(/(auffällig|pathologisch|abnorm|verdächtig|tumor|läsion|entzündung|schwellung|blutung|nekrose|stenose|dilatation|hypertrophie|atrophie|zyste|knoten|raumforderung)/i)) {
      pathologicalFindings.push(sentence.trim());
    }
    else if (sentenceLower.match(/(unauffällig|normal|regelrecht|physiologisch|keine.*auffälligkeiten|ohne.*befund|kein.*nachweis|regelrechte|normale)/i)) {
      normalFindings.push(sentence.trim());
    }
    else if (sentenceLower.length > 25) {
      specialObservations.push(sentence.trim());
    }
  });
  
  // Ensure we have at least some findings
  if (normalFindings.length === 0 && pathologicalFindings.length === 0 && specialObservations.length === 0) {
    const fallbackSentences = findings.split(/[.!?]+/).slice(0, 3).filter(s => s.trim().length > 15);
    fallbackSentences.forEach(sentence => {
      if (sentence.trim()) {
        specialObservations.push(sentence.trim());
      }
    });
  }
  
  return {
    normalFindings: normalFindings.slice(0, 5),
    pathologicalFindings: pathologicalFindings.slice(0, 5),
    specialObservations: specialObservations.slice(0, 5),
    measurements: measurements.slice(0, 3),
    localizations: localizations.slice(0, 3),
    confidence: 0.75, // Rule-based confidence
    processingAgent: 'rule_based_enhanced',
    timestamp: Date.now()
  };
}

// Generate basic ICD predictions based on keyword analysis
function generateBasicICDPredictions(text: string, isGerman: boolean) {
  const textLower = text.toLowerCase();
  
  // Basic ICD code suggestions based on common medical patterns
  const basicCodes = [];
  
  // Common patterns and their ICD codes
  const icdPatterns = [
    { keywords: ['mammographie', 'mammography', 'brust', 'breast'], code: 'Z12.31', description: 'Screening mammography', category: 'Screening' },
    { keywords: ['wirbelsäule', 'spine', 'rücken', 'back', 'bandscheibe'], code: 'M54.9', description: 'Dorsalgia, unspecified', category: 'Musculoskeletal' },
    { keywords: ['herz', 'heart', 'cardiac', 'koronar'], code: 'I25.9', description: 'Chronic ischemic heart disease', category: 'Cardiovascular' },
    { keywords: ['lunge', 'lung', 'pulmonary', 'respiratory'], code: 'J44.1', description: 'Chronic obstructive pulmonary disease', category: 'Respiratory' },
    { keywords: ['kopf', 'head', 'schädel', 'skull'], code: 'S06.9', description: 'Intracranial injury', category: 'Injury' },
  ];
  
  icdPatterns.forEach((pattern, index) => {
    const matches = pattern.keywords.filter(keyword => textLower.includes(keyword));
    if (matches.length > 0) {
      basicCodes.push({
        code: pattern.code,
        description: isGerman ? pattern.description : pattern.description,
        confidence: Math.min(0.8, 0.4 + (matches.length * 0.2)),
        priority: index < 2 ? 'primary' : 'secondary',
        radiologyRelevance: 0.7,
        category: pattern.category,
        reasoning: `Matched keywords: ${matches.join(', ')}`
      });
    }
  });
  
  // If no specific patterns matched, add a general code
  if (basicCodes.length === 0) {
    basicCodes.push({
      code: 'Z01.89',
      description: isGerman ? 'Sonstige näher bezeichnete spezielle Untersuchungen' : 'Other specified special examinations',
      confidence: 0.5,
      priority: 'differential',
      radiologyRelevance: 0.6,
      category: 'Examination',
      reasoning: 'General medical examination based on content analysis'
    });
  }
  
  return {
    codes: basicCodes,
    summary: {
      totalCodes: basicCodes.length,
      primaryDiagnoses: basicCodes.filter(c => c.priority === 'primary').length,
      secondaryDiagnoses: basicCodes.filter(c => c.priority === 'secondary').length,
      differentialDiagnoses: basicCodes.filter(c => c.priority === 'differential').length,
      averageConfidence: basicCodes.reduce((sum, c) => sum + c.confidence, 0) / basicCodes.length
    },
    provider: 'rule-based-local',
    timestamp: Date.now()
  };
}

