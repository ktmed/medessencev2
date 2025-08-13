import { NextRequest, NextResponse } from 'next/server';
import { EnhancedFindings, Language } from '@/types';

interface EnhancedFindingsRequest {
  reportId: string;
  reportContent: string;
  language: Language;
}

interface LLMProvider {
  name: string;
  handler: (prompt: string) => Promise<string>;
}

class ServerEnhancedFindingsService {
  private providers: LLMProvider[] = [];

  constructor() {
    this.initializeProviders();
  }

  private initializeProviders() {
    const providerPriority = (process.env.AI_PROVIDER_PRIORITY || 'claude,gemini,openai')
      .split(',')
      .map(p => p.trim());
    
    console.log('🚀 ENHANCED FINDINGS API: Initializing AI providers');
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
          console.log(`✅ Added ${providerName} provider for enhanced findings`);
        }
      }
    }

    console.log(`🎯 Enhanced findings service initialized with ${this.providers.length} providers`);
  }

  async generateEnhancedFindings(reportContent: string, language: Language): Promise<EnhancedFindings> {
    console.log('🔍 Generating enhanced findings...');
    console.log('- Report content length:', reportContent.length);
    console.log('- Language:', language);
    console.log('- Available providers:', this.providers.map(p => p.name));

    if (this.providers.length === 0) {
      console.error('❌ No AI providers available for enhanced findings');
      return this.generateFallbackEnhancedFindings(reportContent, language);
    }

    const prompt = this.createEnhancedFindingsPrompt(reportContent, language);
    
    for (const provider of this.providers) {
      try {
        console.log(`🤖 Trying ${provider.name} for enhanced findings...`);
        const aiResponse = await provider.handler(prompt);
        console.log(`✅ ${provider.name} succeeded for enhanced findings!`);
        
        return this.parseEnhancedFindingsResponse(aiResponse, language, provider.name);
      } catch (error) {
        console.error(`❌ ${provider.name} failed for enhanced findings:`, error instanceof Error ? error.message : 'Unknown error');
        continue;
      }
    }

    console.error('❌ All AI providers failed for enhanced findings - using fallback');
    return this.generateFallbackEnhancedFindings(reportContent, language);
  }

  private createEnhancedFindingsPrompt(reportContent: string, language: Language): string {
    const templates = {
      de: `Analysiere den folgenden medizinischen Befund und erstelle strukturierte, erweiterte Befunde:

AUFGABE:
Extrahiere und strukturiere die medizinischen Befunde in folgende Kategorien:

FORMAT:
NORMALBEFUNDE: [Liste der normalen/unauffälligen Befunde]
PATHOLOGISCHE_BEFUNDE: [Liste der auffälligen/pathologischen Befunde]  
BESONDERHEITEN: [Besondere Beobachtungen oder technische Details]
MESSUNGEN: [Numerische Werte, Größenangaben, Dichten]
LOKALISATIONEN: [Anatomische Bereiche und Positionen]

Bericht:
${reportContent}

Erstelle eine strukturierte Analyse der Befunde:`,

      en: `Analyze the following medical report and create structured, enhanced findings:

TASK:
Extract and structure the medical findings into the following categories:

FORMAT:
NORMAL_FINDINGS: [List of normal/unremarkable findings]
PATHOLOGICAL_FINDINGS: [List of abnormal/pathological findings]
SPECIAL_OBSERVATIONS: [Special observations or technical details]
MEASUREMENTS: [Numerical values, size measurements, densities]
LOCALIZATIONS: [Anatomical regions and positions]

Report:
${reportContent}

Create a structured analysis of the findings:`
    };

    return templates[language as keyof typeof templates] || templates.en;
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
        temperature: 0.2,
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
          { role: 'system', content: 'You are a medical AI assistant creating structured enhanced findings from medical reports.' },
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

    const model = process.env.GEMINI_MODEL || 'gemini-1.5-pro';
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

  private parseEnhancedFindingsResponse(aiResponse: string, language: Language, provider: string): EnhancedFindings {
    const normalFindings: string[] = [];
    const pathologicalFindings: string[] = [];
    const specialObservations: string[] = [];
    const measurements: string[] = [];
    const localizations: string[] = [];
    
    const lines = aiResponse.split('\n');
    let currentCategory = '';
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      if (trimmed.includes('NORMALBEFUNDE') || trimmed.includes('NORMAL_FINDINGS')) {
        currentCategory = 'normal';
      } else if (trimmed.includes('PATHOLOGISCHE_BEFUNDE') || trimmed.includes('PATHOLOGICAL_FINDINGS')) {
        currentCategory = 'pathological';
      } else if (trimmed.includes('BESONDERHEITEN') || trimmed.includes('SPECIAL_OBSERVATIONS')) {
        currentCategory = 'special';
      } else if (trimmed.includes('MESSUNGEN') || trimmed.includes('MEASUREMENTS')) {
        currentCategory = 'measurements';
      } else if (trimmed.includes('LOKALISATIONEN') || trimmed.includes('LOCALIZATIONS')) {
        currentCategory = 'localizations';
      } else if (trimmed.startsWith('-') || trimmed.startsWith('•')) {
        const item = trimmed.substring(1).trim();
        if (item) {
          switch (currentCategory) {
            case 'normal':
              normalFindings.push(item);
              break;
            case 'pathological':
              pathologicalFindings.push(item);
              break;
            case 'special':
              specialObservations.push(item);
              break;
            case 'measurements':
              measurements.push(item);
              break;
            case 'localizations':
              localizations.push(item);
              break;
          }
        }
      }
    }

    return {
      normalFindings: normalFindings.length > 0 ? normalFindings : [
        language === 'de' ? 'Siehe Originalbefund' : 'See original findings'
      ],
      pathologicalFindings: pathologicalFindings.length > 0 ? pathologicalFindings : [],
      specialObservations: specialObservations.length > 0 ? specialObservations : [],
      measurements: measurements.length > 0 ? measurements : [],
      localizations: localizations.length > 0 ? localizations : [],
      confidence: 0.85,
      processingAgent: `enhanced-findings-${provider}`,
      timestamp: Date.now()
    };
  }

  private generateFallbackEnhancedFindings(reportContent: string, language: Language): EnhancedFindings {
    console.log('📋 Generating fallback enhanced findings');
    
    return {
      normalFindings: [
        language === 'de' ? 'Strukturierte Befunde nicht verfügbar' : 'Structured findings not available'
      ],
      pathologicalFindings: [],
      specialObservations: [
        language === 'de' ? 'Siehe Originalbefund für Details' : 'See original report for details'
      ],
      measurements: [],
      localizations: [],
      confidence: 0.5,
      processingAgent: 'fallback',
      timestamp: Date.now()
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: EnhancedFindingsRequest = await request.json();
    
    console.log('🌐 API Route: Generate Enhanced Findings Request');
    console.log('- Report ID:', body.reportId);
    console.log('- Language:', body.language);
    console.log('- Content length:', body.reportContent?.length || 0);

    if (!body.reportContent) {
      return NextResponse.json(
        { error: 'No report content provided' },
        { status: 400 }
      );
    }

    const enhancedFindingsService = new ServerEnhancedFindingsService();
    const enhancedFindings = await enhancedFindingsService.generateEnhancedFindings(
      body.reportContent,
      body.language || 'de'
    );

    console.log('✅ Enhanced findings generated successfully');
    console.log('- Normal findings count:', enhancedFindings.normalFindings.length);
    console.log('- Pathological findings count:', enhancedFindings.pathologicalFindings.length);

    return NextResponse.json(enhancedFindings);

  } catch (error) {
    console.error('❌ Enhanced Findings API Route Error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to generate enhanced findings',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}