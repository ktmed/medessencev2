import { NextRequest, NextResponse } from 'next/server';
import { ICDPredictions, Language } from '@/types';

interface ICDRequest {
  reportId: string;
  reportContent: string;
  language: Language;
  codeSystem?: 'ICD-10-GM' | 'ICD-10' | 'ICD-11';
}

interface LLMProvider {
  name: string;
  handler: (prompt: string) => Promise<string>;
}

class ServerICDService {
  private providers: LLMProvider[] = [];

  constructor() {
    this.initializeProviders();
  }

  private initializeProviders() {
    const providerPriority = (process.env.AI_PROVIDER_PRIORITY || 'claude,gemini,openai')
      .split(',')
      .map(p => p.trim());
    
    console.log('🚀 ICD API: Initializing AI providers');
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
          console.log(`✅ Added ${providerName} provider for ICD coding`);
        }
      }
    }

    console.log(`🎯 ICD service initialized with ${this.providers.length} providers`);
  }

  async generateICDCodes(reportContent: string, language: Language, codeSystem: string = 'ICD-10-GM'): Promise<ICDPredictions> {
    console.log('🏥 Generating ICD codes...');
    console.log('- Report content length:', reportContent.length);
    console.log('- Language:', language);
    console.log('- Code system:', codeSystem);
    console.log('- Available providers:', this.providers.map(p => p.name));

    if (this.providers.length === 0) {
      console.error('❌ No AI providers available for ICD coding');
      return this.generateFallbackICD(reportContent, language);
    }

    const prompt = this.createICDPrompt(reportContent, language, codeSystem);
    
    for (const provider of this.providers) {
      try {
        console.log(`🤖 Trying ${provider.name} for ICD coding...`);
        const aiResponse = await provider.handler(prompt);
        console.log(`✅ ${provider.name} succeeded for ICD coding!`);
        
        return this.parseICDResponse(aiResponse, language, provider.name);
      } catch (error) {
        console.error(`❌ ${provider.name} failed for ICD coding:`, error instanceof Error ? error.message : 'Unknown error');
        continue;
      }
    }

    console.error('❌ All AI providers failed for ICD coding - using fallback');
    return this.generateFallbackICD(reportContent, language);
  }

  private createICDPrompt(reportContent: string, language: Language, codeSystem: string): string {
    const templates = {
      de: `Analysiere den folgenden medizinischen Bericht und erstelle ${codeSystem}-Kodierungen:

AUFGABE:
1. Identifiziere alle medizinischen Diagnosen und Befunde
2. Ordne die entsprechenden ${codeSystem}-Codes zu
3. Bewerte die Wahrscheinlichkeit und Relevanz
4. Klassifiziere als Haupt-, Neben- oder Differentialdiagnose

FORMAT der Antwort:
ICD_CODE: [Code] | BESCHREIBUNG: [Deutsche Beschreibung] | KONFIDENZ: [0.0-1.0] | RELEVANZ: [0.0-1.0] | PRIORITÄT: [primary|secondary|differential] | KATEGORIE: [Organsystem/Bereich] | BEGRÜNDUNG: [Warum dieser Code passt]

BEISPIEL:
ICD_CODE: M79.3 | BESCHREIBUNG: Panniculitis, nicht näher bezeichnet | KONFIDENZ: 0.85 | RELEVANZ: 0.90 | PRIORITÄT: primary | KATEGORIE: Muskuloskeletal | BEGRÜNDUNG: Entzündliche Veränderungen im Unterhautfettgewebe entsprechen der klinischen Beschreibung

Bericht:
${reportContent}

Analysiere systematisch und gebe nur die wahrscheinlichsten und relevantesten ${codeSystem}-Codes zurück:`,

      en: `Analyze the following medical report and create ${codeSystem} codings:

TASK:
1. Identify all medical diagnoses and findings
2. Assign corresponding ${codeSystem} codes  
3. Assess probability and relevance
4. Classify as primary, secondary, or differential diagnosis

RESPONSE FORMAT:
ICD_CODE: [Code] | DESCRIPTION: [English description] | CONFIDENCE: [0.0-1.0] | RELEVANCE: [0.0-1.0] | PRIORITY: [primary|secondary|differential] | CATEGORY: [Organ system/area] | REASONING: [Why this code fits]

EXAMPLE:
ICD_CODE: M79.3 | DESCRIPTION: Panniculitis, unspecified | CONFIDENCE: 0.85 | RELEVANCE: 0.90 | PRIORITY: primary | CATEGORY: Musculoskeletal | REASONING: Inflammatory changes in subcutaneous tissue match clinical description

Report:
${reportContent}

Analyze systematically and return only the most probable and relevant ${codeSystem} codes:`
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
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1, // Low temperature for accurate medical coding
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
          { 
            role: 'system', 
            content: 'You are a medical coding specialist with expertise in ICD classification systems. Provide accurate and specific medical codes based on clinical documentation.' 
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1,
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

    const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp';
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { 
          temperature: 0.1, // Low temperature for accurate coding
          maxOutputTokens: 2000 
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  }

  private parseICDResponse(aiResponse: string, language: Language, provider: string): ICDPredictions {
    const codes = [];
    const lines = aiResponse.split('\n');
    
    console.log('📊 Parsing ICD response from', provider);
    console.log('- Response lines:', lines.length);
    
    for (const line of lines) {
      if (line.includes('ICD_CODE:')) {
        try {
          const parts = line.split('|').map(p => p.trim());
          const codeMatch = parts[0]?.match(/ICD_CODE:\s*([A-Z]\d+\.?\d*)/);
          const descMatch = parts[1]?.match(/(?:BESCHREIBUNG|DESCRIPTION):\s*(.+)/);
          const confMatch = parts[2]?.match(/(?:KONFIDENZ|CONFIDENCE):\s*([0-9.]+)/);
          const relMatch = parts[3]?.match(/(?:RELEVANZ|RELEVANCE):\s*([0-9.]+)/);
          const prioMatch = parts[4]?.match(/(?:PRIORITÄT|PRIORITY):\s*(\w+)/);
          const catMatch = parts[5]?.match(/(?:KATEGORIE|CATEGORY):\s*(.+)/);
          const reasonMatch = parts[6]?.match(/(?:BEGRÜNDUNG|REASONING):\s*(.+)/);
          
          if (codeMatch && descMatch) {
            codes.push({
              code: codeMatch[1],
              description: descMatch[1],
              confidence: parseFloat(confMatch?.[1] || '0.8'),
              radiologyRelevance: parseFloat(relMatch?.[1] || '0.8'),
              priority: (prioMatch?.[1] as 'primary' | 'secondary' | 'differential') || 'secondary',
              category: catMatch?.[1] || 'Unspecified',
              reasoning: reasonMatch?.[1] || 'Based on clinical documentation'
            });
          }
        } catch (error) {
          console.warn('⚠️ Could not parse ICD line:', line);
        }
      }
    }

    console.log(`✅ Parsed ${codes.length} ICD codes`);

    // Calculate summary statistics
    const primaryCodes = codes.filter(c => c.priority === 'primary').length;
    const secondaryCodes = codes.filter(c => c.priority === 'secondary').length;
    const avgConfidence = codes.length > 0 
      ? codes.reduce((sum, c) => sum + c.confidence, 0) / codes.length 
      : 0;

    return {
      codes: codes.slice(0, 10), // Limit to top 10 codes
      summary: {
        totalCodes: codes.length,
        primaryDiagnoses: primaryCodes,
        secondaryDiagnoses: secondaryCodes,
        averageConfidence: Math.round(avgConfidence * 100) / 100
      },
      agentType: 'icd-coding',
      language: language,
      provider: provider,
      timestamp: new Date().toISOString(),
      cached: false,
      fallback: false
    };
  }

  private generateFallbackICD(reportContent: string, language: Language): ICDPredictions {
    console.log('📋 Generating fallback ICD codes');
    
    // Basic pattern matching for common conditions
    const fallbackCodes = [];
    
    const patterns = {
      de: [
        { pattern: /schmerz|schmerzend/i, code: 'R52', description: 'Schmerz, anderenorts nicht klassifiziert' },
        { pattern: /entzündung|inflamm/i, code: 'K92.9', description: 'Krankheit des Verdauungssystems, nicht näher bezeichnet' },
        { pattern: /tumor|neoplasma/i, code: 'D49.9', description: 'Neoplasma unsicheren Verhaltens, nicht näher bezeichnet' },
        { pattern: /fraktur|bruch/i, code: 'S02.9', description: 'Fraktur des Schädels und der Gesichtsschädelknochen, Teil nicht näher bezeichnet' },
      ],
      en: [
        { pattern: /pain|ache/i, code: 'R52', description: 'Pain, unspecified' },
        { pattern: /inflammation|inflammatory/i, code: 'K92.9', description: 'Disease of digestive system, unspecified' },
        { pattern: /tumor|neoplasm/i, code: 'D49.9', description: 'Neoplasm of unspecified behavior, unspecified site' },
        { pattern: /fracture|break/i, code: 'S02.9', description: 'Fracture of skull and facial bones, part unspecified' },
      ]
    };

    const langPatterns = patterns[language as keyof typeof patterns] || patterns.en;
    
    for (const { pattern, code, description } of langPatterns) {
      if (pattern.test(reportContent)) {
        fallbackCodes.push({
          code,
          description,
          confidence: 0.6,
          radiologyRelevance: 0.7,
          priority: 'secondary' as const,
          category: 'Rule-based matching',
          reasoning: language === 'de' 
            ? 'Automatische Erkennung basierend auf Textmustern'
            : 'Automatic detection based on text patterns'
        });
      }
    }

    // Add a general code if no patterns match
    if (fallbackCodes.length === 0) {
      fallbackCodes.push({
        code: 'Z51.9',
        description: language === 'de' 
          ? 'Medizinische Betreuung, nicht näher bezeichnet'
          : 'Medical care, unspecified',
        confidence: 0.5,
        radiologyRelevance: 0.5,
        priority: 'secondary' as const,
        category: 'General',
        reasoning: language === 'de' 
          ? 'Allgemeine medizinische Versorgung'
          : 'General medical care'
      });
    }

    return {
      codes: fallbackCodes,
      summary: {
        totalCodes: fallbackCodes.length,
        primaryDiagnoses: 0,
        secondaryDiagnoses: fallbackCodes.length,
        averageConfidence: 0.6
      },
      agentType: 'rule-based-icd',
      language: language,
      provider: 'rule-based',
      timestamp: new Date().toISOString(),
      cached: false,
      fallback: true
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: ICDRequest = await request.json();
    
    console.log('🌐 API Route: Generate ICD Codes Request');
    console.log('- Report ID:', body.reportId);
    console.log('- Language:', body.language);
    console.log('- Content length:', body.reportContent?.length || 0);
    console.log('- Code system:', body.codeSystem || 'ICD-10-GM');

    if (!body.reportContent) {
      return NextResponse.json(
        { error: 'No report content provided' },
        { status: 400 }
      );
    }

    const icdService = new ServerICDService();
    const icdCodes = await icdService.generateICDCodes(
      body.reportContent,
      body.language || 'de',
      body.codeSystem || 'ICD-10-GM'
    );

    console.log('✅ ICD codes generated successfully');
    console.log('- Total codes:', icdCodes.codes.length);
    console.log('- Primary diagnoses:', icdCodes.summary.primaryDiagnoses);
    console.log('- Provider:', icdCodes.provider);

    return NextResponse.json(icdCodes);

  } catch (error) {
    console.error('❌ ICD API Route Error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to generate ICD codes',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}