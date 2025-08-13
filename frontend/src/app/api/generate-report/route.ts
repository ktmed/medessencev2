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
      return `Erstelle einen strukturierten medizinischen Befundbericht aus dem folgenden Text. 
Strukturiere den Bericht in folgende Abschnitte:

BEFUND: [Hauptbefunde und Beobachtungen]
BEURTEILUNG: [Medizinische Einschätzung und Diagnose]  
EMPFEHLUNG: [Weitere Maßnahmen und Empfehlungen]
TECHNISCHE_DETAILS: [Untersuchungstechnik, Parameter, Kontrastmittel, Sequenzen, technische Qualität]

Text: ${text}

Erstelle einen professionellen, präzisen medizinischen Bericht mit allen technischen Aspekten:`;
    }

    return `Create a structured medical report from the following text.
Structure the report into these sections:

FINDINGS: [Main findings and observations]
IMPRESSION: [Medical assessment and diagnosis]
RECOMMENDATIONS: [Further measures and recommendations]
TECHNICAL_DETAILS: [Examination technique, parameters, contrast agents, sequences, technical quality]

Text: ${text}

Create a professional, precise medical report with all technical aspects:`;
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