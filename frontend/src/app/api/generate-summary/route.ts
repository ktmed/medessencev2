import { NextRequest, NextResponse } from 'next/server';
import { PatientSummary, Language } from '@/types';

interface SummaryRequest {
  reportId: string;
  reportContent: string;
  language: Language;
  complexity?: 'simple' | 'detailed' | 'technical';
}

interface LLMProvider {
  name: string;
  handler: (prompt: string) => Promise<string>;
}

class ServerSummaryService {
  private providers: LLMProvider[] = [];

  constructor() {
    this.initializeProviders();
  }

  private initializeProviders() {
    const providerPriority = (process.env.AI_PROVIDER_PRIORITY || 'claude,gemini,openai')
      .split(',')
      .map(p => p.trim());
    
    console.log('🚀 SUMMARY API: Initializing AI providers');
    console.log('- Provider priority:', providerPriority);

    const availableProviders: { [key: string]: () => LLMProvider | null } = {
      claude: () => {
        if (process.env.ANTHROPIC_API_KEY) {
          return { name: 'claude', handler: this.callClaude.bind(this) };
        }
        return null;
      },
      openai: () => {
        if (process.env.OPENAI_API_KEY) {
          return { name: 'openai', handler: this.callOpenAI.bind(this) };
        }
        return null;
      },
      gemini: () => {
        if (process.env.GOOGLE_API_KEY) {
          return { name: 'gemini', handler: this.callGemini.bind(this) };
        }
        return null;
      }
    };

    for (const providerName of providerPriority) {
      const providerFactory = availableProviders[providerName];
      if (providerFactory) {
        const provider = providerFactory();
        if (provider) {
          this.providers.push(provider);
          console.log(`✅ Added ${providerName} provider for summaries`);
        }
      }
    }

    console.log(`🎯 Summary service initialized with ${this.providers.length} providers`);
  }

  async generateSummary(reportContent: string, language: Language, complexity: string = 'detailed'): Promise<PatientSummary> {
    console.log('📋 Generating patient summary...');
    console.log('- Report content length:', reportContent.length);
    console.log('- Language:', language);
    console.log('- Complexity:', complexity);
    console.log('- Available providers:', this.providers.map(p => p.name));

    if (this.providers.length === 0) {
      console.error('❌ No AI providers available for summary');
      return this.generateFallbackSummary(reportContent, language);
    }

    const prompt = this.createSummaryPrompt(reportContent, language, complexity);
    
    for (const provider of this.providers) {
      try {
        console.log(`🤖 Trying ${provider.name} for summary...`);
        const aiResponse = await provider.handler(prompt);
        console.log(`✅ ${provider.name} succeeded for summary!`);
        
        return this.parseSummaryResponse(aiResponse, language, provider.name, complexity);
      } catch (error) {
        console.error(`❌ ${provider.name} failed for summary:`, error instanceof Error ? error.message : 'Unknown error');
        continue;
      }
    }

    console.error('❌ All AI providers failed for summary - using fallback');
    return this.generateFallbackSummary(reportContent, language);
  }

  private createSummaryPrompt(reportContent: string, language: Language, complexity: string): string {
    const templates = {
      de: {
        simple: `Erstelle eine einfache, verständliche Zusammenfassung des folgenden medizinischen Berichts für Patienten:

Format:
- HAUPTBEFUNDE: [2-3 wichtigste Befunde in einfacher Sprache]
- BEDEUTUNG: [Was bedeutet das für den Patienten?]  
- NÄCHSTE SCHRITTE: [Empfohlene Maßnahmen]

Bericht: ${reportContent}

Verwende einfache, patientenfreundliche Sprache:`,

        detailed: `Erstelle eine detaillierte medizinische Zusammenfassung des folgenden Berichts:

Format:
- ZUSAMMENFASSUNG: [Detaillierte Übersicht der Befunde]
- SCHLÜSSELBEFUNDE: [Wichtigste pathologische und normale Befunde]
- KLINISCHE RELEVANZ: [Medizinische Bedeutung der Ergebnisse]
- EMPFEHLUNGEN: [Konkrete nächste Schritte und Verlaufskontrollen]
- BESONDERHEITEN: [Auffälligkeiten, die besondere Beachtung verdienen]

Bericht: ${reportContent}

Erstelle eine professionelle medizinische Zusammenfassung:`,

        technical: `Erstelle eine technische Fachzusammenfassung des folgenden medizinischen Berichts für Kollegen:

Format:
- BEFUNDÜBERSICHT: [Technische Details und Messwerte]
- DIFFERENTIALDIAGNOSEN: [Mögliche Diagnosen basierend auf Befunden]
- KORRELATION: [Zusammenhang zwischen verschiedenen Befunden]
- FACHEMPFEHLUNGEN: [Spezifische medizinische Empfehlungen]
- VERLAUFSKONTROLLE: [Empfohlene Follow-up-Untersuchungen]

Bericht: ${reportContent}

Verwende medizinische Fachterminologie und präzise Formulierungen:`
      },
      en: {
        simple: `Create a simple, understandable summary of the following medical report for patients:

Format:
- MAIN FINDINGS: [2-3 most important findings in simple language]
- MEANING: [What does this mean for the patient?]
- NEXT STEPS: [Recommended actions]

Report: ${reportContent}

Use simple, patient-friendly language:`,

        detailed: `Create a detailed medical summary of the following report:

Format:
- SUMMARY: [Detailed overview of findings]
- KEY FINDINGS: [Most important pathological and normal findings]  
- CLINICAL RELEVANCE: [Medical significance of results]
- RECOMMENDATIONS: [Concrete next steps and follow-up]
- SPECIAL NOTES: [Abnormalities requiring special attention]

Report: ${reportContent}

Create a professional medical summary:`,

        technical: `Create a technical professional summary of the following medical report for colleagues:

Format:
- FINDINGS OVERVIEW: [Technical details and measurements]
- DIFFERENTIAL DIAGNOSES: [Possible diagnoses based on findings]
- CORRELATION: [Relationship between different findings]
- PROFESSIONAL RECOMMENDATIONS: [Specific medical recommendations]
- FOLLOW-UP: [Recommended follow-up examinations]

Report: ${reportContent}

Use medical terminology and precise formulations:`
      }
    };

    const langTemplates = templates[language as keyof typeof templates] || templates.en;
    return langTemplates[complexity as keyof typeof langTemplates] || langTemplates.detailed;
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
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
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
          { role: 'system', content: 'You are a medical AI assistant creating patient summaries from medical reports.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
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

    const model = process.env.GEMINI_MODEL || 'gemini-1.5-pro';
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 1500 },
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  }

  private parseSummaryResponse(aiResponse: string, language: Language, provider: string, complexity: string = 'detailed'): PatientSummary {
    console.log('🔍 Parsing summary response from', provider);
    console.log('📝 AI Response length:', aiResponse.length);
    console.log('📝 Response preview:', aiResponse.substring(0, 200) + '...');
    
    // Parse the AI response to extract structured summary data
    const lines = aiResponse.split('\n');
    
    // Extract key findings and recommendations with more sophisticated parsing
    const keyFindings: string[] = [];
    const recommendations: string[] = [];
    
    let currentSection = '';
    let summaryText = '';
    
    // Section headers to look for (German and English)
    const findingHeaders = [
      'HAUPTBEFUNDE', 'KEY FINDINGS', 'SCHLÜSSELBEFUNDE', 'BEFUNDÜBERSICHT', 
      'FINDINGS OVERVIEW', 'WICHTIGE BEFUNDE', 'IMPORTANT FINDINGS'
    ];
    const recommendationHeaders = [
      'EMPFEHLUNG', 'RECOMMENDATION', 'NÄCHSTE SCHRITTE', 'NEXT STEPS',
      'FACHEMPFEHLUNGEN', 'PROFESSIONAL RECOMMENDATIONS', 'VERLAUFSKONTROLLE',
      'FOLLOW-UP', 'WEITERE MASSNAHMEN'
    ];
    const summaryHeaders = [
      'ZUSAMMENFASSUNG', 'SUMMARY', 'BEDEUTUNG', 'MEANING', 'ÜBERSICHT', 'OVERVIEW'
    ];

    for (const line of lines) {
      const trimmed = line.trim();
      const upperTrimmed = trimmed.toUpperCase();
      
      // Check for section headers
      if (findingHeaders.some(header => upperTrimmed.includes(header))) {
        currentSection = 'findings';
        continue;
      } else if (recommendationHeaders.some(header => upperTrimmed.includes(header))) {
        currentSection = 'recommendations';
        continue;
      } else if (summaryHeaders.some(header => upperTrimmed.includes(header))) {
        currentSection = 'summary';
        continue;
      }
      
      // Extract content based on current section
      if (trimmed.startsWith('-') || trimmed.startsWith('•') || trimmed.startsWith('*')) {
        const item = trimmed.substring(1).trim();
        if (item && currentSection === 'findings') {
          keyFindings.push(item);
        } else if (item && currentSection === 'recommendations') {
          recommendations.push(item);
        }
      } else if (trimmed.match(/^\d+\./)) {
        // Handle numbered lists
        const item = trimmed.replace(/^\d+\.\s*/, '').trim();
        if (item && currentSection === 'findings') {
          keyFindings.push(item);
        } else if (item && currentSection === 'recommendations') {
          recommendations.push(item);
        }
      } else if (currentSection === 'summary' && trimmed.length > 10) {
        // Collect summary text
        summaryText += (summaryText ? ' ' : '') + trimmed;
      }
    }

    // If no structured summary was found, try to extract the first meaningful paragraph
    if (!summaryText) {
      const meaningfulLines = lines.filter(line => 
        line.trim().length > 50 && 
        !line.trim().toUpperCase().includes('BEFUND') && 
        !line.trim().toUpperCase().includes('FINDING') &&
        !line.trim().toUpperCase().includes('EMPFEHLUNG') &&
        !line.trim().toUpperCase().includes('RECOMMENDATION')
      );
      if (meaningfulLines.length > 0) {
        summaryText = meaningfulLines[0].trim();
      }
    }

    // Fallback to full response if nothing structured was found
    const finalSummary = summaryText || aiResponse;

    console.log('✅ Summary parsing results:');
    console.log('- Key findings extracted:', keyFindings.length);
    console.log('- Recommendations extracted:', recommendations.length);
    console.log('- Summary text length:', finalSummary.length);

    return {
      id: `summary-${Date.now()}`,
      reportId: `report-${Date.now()}`,
      summary: finalSummary,
      keyFindings: keyFindings.length > 0 ? keyFindings : [
        language === 'de' ? 'Siehe detaillierte Zusammenfassung' : 'See detailed summary'
      ],
      recommendations: recommendations.length > 0 ? recommendations : [
        language === 'de' ? 'Weitere ärztliche Betreuung empfohlen' : 'Further medical care recommended'
      ],
      language,
      generatedAt: Date.now(),
      complexity: complexity as 'simple' | 'detailed' | 'technical',
      metadata: {
        aiProvider: provider,
        processingAgent: `summary-${provider}`,
        confidence: keyFindings.length > 0 && recommendations.length > 0 ? 0.9 : 0.7
      }
    };
  }

  private generateFallbackSummary(reportContent: string, language: Language): PatientSummary {
    console.log('📋 Generating fallback summary');
    
    return {
      id: `summary-${Date.now()}`,
      reportId: `report-${Date.now()}`, 
      summary: language === 'de' 
        ? `Automatische Zusammenfassung des Berichts:\n\n${reportContent.substring(0, 500)}...`
        : `Automatic summary of report:\n\n${reportContent.substring(0, 500)}...`,
      keyFindings: [
        language === 'de' ? 'Siehe ursprünglichen Bericht' : 'See original report'
      ],
      recommendations: [
        language === 'de' ? 'Rücksprache mit behandelndem Arzt empfohlen' : 'Consultation with attending physician recommended'
      ],
      language,
      generatedAt: Date.now(),
      complexity: 'detailed',
      metadata: {
        aiProvider: 'fallback',
        processingAgent: 'rule-based-summary',
        confidence: 0.5
      }
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: SummaryRequest = await request.json();
    
    console.log('🌐 API Route: Generate Summary Request');
    console.log('- Report ID:', body.reportId);
    console.log('- Language:', body.language);
    console.log('- Content length:', body.reportContent?.length || 0);
    console.log('- Complexity:', body.complexity || 'detailed');

    if (!body.reportContent) {
      return NextResponse.json(
        { error: 'No report content provided' },
        { status: 400 }
      );
    }

    const summaryService = new ServerSummaryService();
    const summary = await summaryService.generateSummary(
      body.reportContent,
      body.language || 'de',
      body.complexity || 'detailed'
    );

    console.log('✅ Summary generated successfully');
    console.log('- Summary ID:', summary.id);
    console.log('- Key findings count:', summary.keyFindings.length);

    return NextResponse.json(summary);

  } catch (error) {
    console.error('❌ Summary API Route Error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to generate summary',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}