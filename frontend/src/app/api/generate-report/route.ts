import { NextRequest, NextResponse } from 'next/server';

interface ReportRequest {
  transcriptionId: string;
  language: string;
  transcriptionText: string;
  processingMode?: 'cloud' | 'local';
}

class SimpleMultiLLMService {
  private providers: Array<{name: string, handler: (prompt: string) => Promise<string>}> = [];

  constructor() {
    this.initializeProviders();
  }

  private initializeProviders() {
    const providerPriority = ['claude', 'openai', 'gemini'];
    
    console.log('🚀 Initializing AI providers');
    
    for (const providerName of providerPriority) {
      if (providerName === 'claude' && process.env.ANTHROPIC_API_KEY) {
        this.providers.push({
          name: 'claude',
          handler: this.callClaude.bind(this)
        });
        console.log('✅ Added Claude provider');
      } else if (providerName === 'openai' && process.env.OPENAI_API_KEY) {
        this.providers.push({
          name: 'openai', 
          handler: this.callOpenAI.bind(this)
        });
        console.log('✅ Added OpenAI provider');
      } else if (providerName === 'gemini' && process.env.GOOGLE_API_KEY) {
        this.providers.push({
          name: 'gemini',
          handler: this.callGemini.bind(this)
        });
        console.log('✅ Added Gemini provider');
      }
    }

    console.log(`🎯 Initialized with ${this.providers.length} providers`);
  }

  async generateReport(transcriptionText: string, language: string): Promise<any> {
    console.log('📝 Generating medical report...');
    
    if (this.providers.length === 0) {
      console.error('❌ No AI providers available');
      return this.generateFallbackReport(transcriptionText, language);
    }

    const prompt = this.createCleanPrompt(transcriptionText, language);
    
    // Try each provider
    for (const provider of this.providers) {
      try {
        console.log(`🤖 Trying ${provider.name}...`);
        
        const aiResponse = await provider.handler(prompt);
        console.log(`✅ ${provider.name} succeeded!`);
        
        const parsedReport = this.parseCleanResponse(aiResponse, transcriptionText, language, provider.name);
        return parsedReport;
        
      } catch (error) {
        console.error(`❌ ${provider.name} failed:`, error instanceof Error ? error.message : 'Unknown error');
        continue;
      }
    }

    console.error('❌ All AI providers failed');
    return this.generateFallbackReport(transcriptionText, language);
  }

  private createCleanPrompt(text: string, language: string): string {
    if (language === 'de') {
      return `Erstelle einen medizinischen Befundbericht aus folgendem Text. Verwende KEINE Formatierungen (**, *, #, etc.), nur einfachen Text.

Text: ${text}

Erstelle den Bericht mit diesen Abschnitten:

BEFUND:
[Detaillierte medizinische Befunde in einfachem deutschen Text]

BEURTEILUNG:
[Medizinische Einschätzung und Diagnose]

EMPFEHLUNG:
[Konkrete Empfehlungen und weitere Maßnahmen]

Schreibe professionell aber ohne Markdown-Formatierung.`;
    }

    return `Create a medical report from the following text. Use NO formatting (**, *, #, etc.), only plain text.

Text: ${text}

Create the report with these sections:

FINDINGS:
[Detailed medical findings in plain text]

IMPRESSION:
[Medical assessment and diagnosis]

RECOMMENDATIONS:
[Specific recommendations and next steps]

Write professionally but without markdown formatting.`;
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
        model: 'claude-3-haiku-20240307',
        max_tokens: 1500,
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
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a medical AI assistant creating structured medical reports.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2,
        max_tokens: 1500,
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

    const model = 'gemini-1.5-pro';
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 1500 },
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  }

  private parseCleanResponse(aiResponse: string, originalText: string, language: string, provider: string) {
    console.log('🔍 Parsing clean AI response');
    
    // Clean up any markdown artifacts
    let cleanResponse = aiResponse
      .replace(/\*\*/g, '')  // Remove **bold**
      .replace(/\*/g, '')    // Remove *italic*
      .replace(/#{1,6}\s/g, '')  // Remove # headers
      .replace(/`{1,3}/g, '') // Remove code blocks
      .trim();
    
    const isGerman = language === 'de';
    let findings = '';
    let impression = '';
    let recommendations = '';
    
    // Parse sections with more flexible patterns
    if (isGerman) {
      const befundMatch = cleanResponse.match(/BEFUND:\s*([^]*?)(?=BEURTEILUNG:|EMPFEHLUNG:|$)/i);
      const beurteilungMatch = cleanResponse.match(/BEURTEILUNG:\s*([^]*?)(?=EMPFEHLUNG:|$)/i);
      const empfehlungMatch = cleanResponse.match(/EMPFEHLUNG:\s*([^]*?)$/i);
      
      findings = befundMatch?.[1]?.trim() || cleanResponse;
      impression = beurteilungMatch?.[1]?.trim() || (isGerman ? 'Weitere Beurteilung erforderlich.' : 'Further assessment required.');
      recommendations = empfehlungMatch?.[1]?.trim() || (isGerman ? 'Rücksprache mit behandelndem Arzt empfohlen.' : 'Consultation with treating physician recommended.');
    } else {
      const findingsMatch = cleanResponse.match(/FINDINGS:\s*([^]*?)(?=IMPRESSION:|RECOMMENDATIONS:|$)/i);
      const impressionMatch = cleanResponse.match(/IMPRESSION:\s*([^]*?)(?=RECOMMENDATIONS:|$)/i);
      const recommendationsMatch = cleanResponse.match(/RECOMMENDATIONS:\s*([^]*?)$/i);
      
      findings = findingsMatch?.[1]?.trim() || cleanResponse;
      impression = impressionMatch?.[1]?.trim() || 'Further assessment required.';
      recommendations = recommendationsMatch?.[1]?.trim() || 'Consultation with treating physician recommended.';
    }
    
    // Generate enhanced findings
    const enhancedFindings = this.generateEnhancedFindings(findings + ' ' + impression, isGerman);
    
    // Generate basic ICD predictions
    const icdPredictions = this.generateBasicICD(originalText, isGerman);
    
    return {
      id: `report-${Date.now()}`,
      transcriptionId: `transcription-${Date.now()}`,
      findings: findings,
      impression: impression,
      recommendations: recommendations,
      technicalDetails: isGerman 
        ? `KI-Anbieter: ${provider}\nGenerierungszeitpunkt: ${new Date().toLocaleString('de-DE')}`
        : `AI Provider: ${provider}\nGeneration Time: ${new Date().toLocaleString('en-US')}`,
      enhancedFindings: enhancedFindings,
      icdPredictions: icdPredictions,
      generatedAt: Date.now(),
      language: language,
      type: this.classifyReportType(originalText),
      metadata: {
        agent: 'mammography_specialist',
        specialty: 'mammography',
        confidence: 0.44,
        aiProvider: provider,
        aiGenerated: true,
        originalTextLength: originalText.length
      }
    };
  }

  private generateEnhancedFindings(text: string, isGerman: boolean) {
    const textLower = text.toLowerCase();
    
    const normalFindings: string[] = [];
    const pathologicalFindings: string[] = [];
    const specialObservations: string[] = [];
    const measurements: string[] = [];
    const localizations: string[] = [];
    
    // Split text into sentences for better parsing
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
    
    sentences.forEach(sentence => {
      const sentenceLower = sentence.trim().toLowerCase();
      if (!sentenceLower) return;
      
      // Extract normal findings - more comprehensive patterns
      if (isGerman) {
        if (sentenceLower.match(/(unauffällig|regelrecht|normal|keine.*auffällig|ohne.*befund|kein.*nachweis|unverändert)/)) {
          normalFindings.push(sentence.trim().substring(0, 80) + (sentence.length > 80 ? '...' : ''));
        }
        // Extract pathological/suspicious findings
        else if (sentenceLower.match(/(verdächtig|suspekt|auffällig|pathologisch|tumor|läsion|herd|raumforderung|architekturstörung|mikroverkalk)/)) {
          pathologicalFindings.push(sentence.trim().substring(0, 80) + (sentence.length > 80 ? '...' : ''));
        }
        // Extract special observations - technical details
        else if (sentenceLower.match(/(digitale.*mammographie|vollfeld|kompression|sonographie|ultraschall|ebene|projektion)/)) {
          specialObservations.push(sentence.trim().substring(0, 80) + (sentence.length > 80 ? '...' : ''));
        }
      } else {
        if (sentenceLower.match(/(normal|unremarkable|no.*abnormal|within.*normal|unchanged)/)) {
          normalFindings.push(sentence.trim().substring(0, 80) + (sentence.length > 80 ? '...' : ''));
        }
        else if (sentenceLower.match(/(suspicious|pathological|abnormal|lesion|mass|distortion)/)) {
          pathologicalFindings.push(sentence.trim().substring(0, 80) + (sentence.length > 80 ? '...' : ''));
        }
        else if (sentenceLower.match(/(mammography|ultrasound|compression|technique)/)) {
          specialObservations.push(sentence.trim().substring(0, 80) + (sentence.length > 80 ? '...' : ''));
        }
      }
    });
    
    // Extract measurements and classifications
    const measurementMatches = text.match(/(?:ACR|BIRADS?|BI-RADS|Kategorie|Brustdichte)\s*[A-C0-9]+/gi) || [];
    measurements.push(...measurementMatches);
    
    // Extract anatomical localizations
    const locationPatterns = isGerman
      ? ['mammae?', 'brust', 'brustdrüse', 'mamma', 'axilla', 'links', 'rechts', 'beidseits', 'dorsal', 'medial', 'lateral']
      : ['breast', 'mammary', 'axilla', 'left', 'right', 'bilateral', 'medial', 'lateral'];
      
    locationPatterns.forEach(pattern => {
      const regex = new RegExp(`\\b${pattern}\\b`, 'gi');
      const matches = text.match(regex);
      if (matches) {
        localizations.push(...matches.slice(0, 3)); // Limit to avoid duplicates
      }
    });
    
    // Remove duplicates and limit arrays
    const uniqueNormal = Array.from(new Set(normalFindings)).slice(0, 5);
    const uniquePathological = Array.from(new Set(pathologicalFindings)).slice(0, 5);
    const uniqueSpecial = Array.from(new Set(specialObservations)).slice(0, 3);
    const uniqueMeasurements = Array.from(new Set(measurements)).slice(0, 5);
    const uniqueLocalizations = Array.from(new Set(localizations)).slice(0, 8);
    
    return {
      normalFindings: uniqueNormal,
      pathologicalFindings: uniquePathological,
      specialObservations: uniqueSpecial,
      measurements: uniqueMeasurements,
      localizations: uniqueLocalizations,
      confidence: Math.min(0.9, 0.6 + (uniqueNormal.length + uniquePathological.length) * 0.1),
      processingAgent: 'enhanced_ai_parser',
      provider: 'ai-enhanced',
      generatedAt: Date.now()
    };
  }

  private generateBasicICD(text: string, isGerman: boolean) {
    const codes = [];
    
    if (text.toLowerCase().includes('mammograph')) {
      codes.push({
        code: 'Z12.31',
        description: isGerman ? 'Spezielle Vorsorgeuntersuchung auf Brustkrebs' : 'Screening mammography',
        priority: 'primary',
        confidence: 0.95
      });
    }
    
    return {
      codes: codes,
      summary: {
        primaryDiagnoses: codes.filter(c => c.priority === 'primary').length,
        secondaryDiagnoses: 0,
        totalCodes: codes.length
      },
      provider: 'simplified',
      generatedAt: Date.now()
    };
  }

  private classifyReportType(text: string): string {
    const textLower = text.toLowerCase();
    if (textLower.includes('mammogr')) return 'Mammography';
    if (textLower.includes('mri') || textLower.includes('wirbel')) return 'MRI';
    if (textLower.includes('ct') || textLower.includes('computer')) return 'CT';
    return 'General Medical Report';
  }

  private generateFallbackReport(text: string, language: string) {
    const isGerman = language === 'de';
    
    return {
      id: `report-${Date.now()}`,
      transcriptionId: `transcription-${Date.now()}`,
      findings: text,
      impression: isGerman ? 'Weitere Beurteilung erforderlich.' : 'Further assessment required.',
      recommendations: isGerman ? 'Rücksprache mit behandelndem Arzt.' : 'Consult with treating physician.',
      technicalDetails: isGerman ? 'Regelbasierte Verarbeitung' : 'Rule-based processing',
      generatedAt: Date.now(),
      language: language,
      type: 'Fallback Report',
      metadata: {
        agent: 'fallback_processor',
        aiProvider: 'rule-based',
        aiGenerated: false
      }
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: ReportRequest = await request.json();
    
    console.log('🌐 Simple API Route: Generate Report Request');
    console.log('- Text length:', body.transcriptionText?.length || 0);
    console.log('- Language:', body.language);

    if (!body.transcriptionText) {
      return NextResponse.json(
        { error: 'No transcription text provided' },
        { status: 400 }
      );
    }

    const llmService = new SimpleMultiLLMService();
    const report = await llmService.generateReport(
      body.transcriptionText,
      body.language || 'de'
    );

    console.log('✅ Simple report generated successfully');
    
    return NextResponse.json(report);

  } catch (error) {
    console.error('❌ Simple API Route Error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to generate report',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}