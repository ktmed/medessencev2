import { NextRequest, NextResponse } from 'next/server';
import { PatientSummary, Language } from '@/types';

interface SummaryRequest {
  reportId: string;
  reportContent: string;
  language: Language;
  complexity?: 'simple' | 'detailed' | 'technical';
  processingMode?: 'cloud' | 'local';
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
        
        return this.parseSummaryResponse(aiResponse, language, provider.name, complexity, reportContent);
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

        technical: `Erstelle eine umfassende technische Fachzusammenfassung des folgenden medizinischen Berichts für Ärzte und Fachpersonal:

ANFORDERUNGEN:
- Verwende präzise medizinische Terminologie und ICD-10-Klassifikationen
- Füge quantitative Messwerte, technische Parameter und spezifische anatomische Referenzen ein
- Biete detaillierte Analyse für Fachkollegen und Spezialisten
- Minimum 3-4 Sätze pro Abschnitt für gründliche Abdeckung

Format:
- TECHNISCHE BEFUNDE: [Detaillierte Messwerte, anatomische Lokalisationen, Bildgebungsparameter, Laborwerte, pathologische Beobachtungen]
- DIFFERENTIALDIAGNOSEN: [Primäre und sekundäre diagnostische Überlegungen mit Belegen und Ausschlusskriterien]
- KLINISCHE KORRELATION: [Zusammenhang zwischen Befunden, Progressionsmuster, Risikostratifizierung]
- FACHÄRZTLICHE EMPFEHLUNGEN: [Evidenzbasierte Behandlungsprotokolle, Überweisungsindikationen, Überwachungsparameter]
- VERLAUFSPROTOKOLL: [Spezifische Zeitrahmen, Bildgebungsintervalle, Laborüberwachung, klinische Reevaluationskriterien]

Bericht: ${reportContent}

Erstelle eine detaillierte technische Analyse mit medizinischer Fachterminologie, Messwerten und professioneller klinischer Sprache:`
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

        technical: `Create a comprehensive technical summary of the following medical report for medical professionals:

REQUIREMENTS:
- Use precise medical terminology and ICD-10 classifications where applicable
- Include quantitative measurements, technical parameters, and specific anatomical references
- Provide detailed analysis suitable for specialist consultation
- Minimum 3-4 sentences per section for thorough coverage

Format:
- TECHNICAL FINDINGS: [Detailed measurements, anatomical locations, imaging parameters, laboratory values, pathological observations]
- DIFFERENTIAL DIAGNOSES: [Primary and secondary diagnostic considerations with supporting evidence and exclusion criteria]
- CLINICAL CORRELATION: [Relationship between findings, progression patterns, risk stratification]
- SPECIALIST RECOMMENDATIONS: [Evidence-based treatment protocols, referral indications, monitoring parameters]
- FOLLOW-UP PROTOCOL: [Specific timeframes, imaging intervals, laboratory monitoring, clinical reassessment criteria]

Report: ${reportContent}

Create a detailed technical analysis using medical terminology, measurements, and professional clinical language:`
      },
      ar: {
        simple: `قم بإنشاء ملخص بسيط ومفهوم للتقرير الطبي التالي للمرضى:

التنسيق:
- النتائج الرئيسية: [2-3 أهم النتائج بلغة بسيطة]
- المعنى: [ماذا يعني هذا للمريض؟]
- الخطوات التالية: [الإجراءات الموصى بها]

التقرير: ${reportContent}

استخدم لغة بسيطة وودية للمرضى:`,

        detailed: `قم بإنشاء ملخص طبي مفصل للتقرير التالي:

التنسيق:
- الملخص: [نظرة عامة مفصلة على النتائج]
- النتائج الرئيسية: [أهم النتائج المرضية والطبيعية]
- الأهمية السريرية: [الأهمية الطبية للنتائج]
- التوصيات: [الخطوات التالية المحددة والمتابعة]
- ملاحظات خاصة: [الشذوذات التي تتطلب اهتماماً خاصاً]

التقرير: ${reportContent}

قم بإنشاء ملخص طبي مهني:`,

        technical: `قم بإنشاء ملخص فني مهني للتقرير الطبي التالي للزملاء:

التنسيق:
- نظرة عامة على النتائج: [التفاصيل الفنية والقياسات]
- التشخيص التفريقي: [التشخيصات المحتملة بناءً على النتائج]
- الارتباط: [العلاقة بين النتائج المختلفة]
- التوصيات المهنية: [توصيات طبية محددة]
- المتابعة: [الفحوصات الموصى بها للمتابعة]

التقرير: ${reportContent}

استخدم المصطلحات الطبية والصياغات الدقيقة:`
      },
      uk: {
        simple: `Створіть простий, зрозумілий резюме наступного медичного звіту для пацієнтів:

Формат:
- ОСНОВНІ РЕЗУЛЬТАТИ: [2-3 найважливіших результати простою мовою]
- ЗНАЧЕННЯ: [Що це означає для пацієнта?]
- НАСТУПНІ КРОКИ: [Рекомендовані дії]

Звіт: ${reportContent}

Використовуйте просту, доброзичливу до пацієнта мову:`,

        detailed: `Створіть детальне медичне резюме наступного звіту:

Формат:
- РЕЗЮМЕ: [Детальний огляд результатів]
- КЛЮЧОВІ РЕЗУЛЬТАТИ: [Найважливіші патологічні та нормальні результати]
- КЛІНІЧНА ЗНАЧУЩІСТЬ: [Медичне значення результатів]
- РЕКОМЕНДАЦІЇ: [Конкретні наступні кроки та подальше спостереження]
- ОСОБЛИВІ ПРИМІТКИ: [Відхилення, що потребують особливої уваги]

Звіт: ${reportContent}

Створіть професійне медичне резюме:`,

        technical: `Створіть технічне професійне резюме наступного медичного звіту для колег:

Формат:
- ОГЛЯД РЕЗУЛЬТАТІВ: [Технічні деталі та вимірювання]
- ДИФЕРЕНЦІЙНІ ДІАГНОЗИ: [Можливі діагнози на основі результатів]
- КОРЕЛЯЦІЯ: [Зв'язок між різними результатами]
- ПРОФЕСІЙНІ РЕКОМЕНДАЦІЇ: [Специфічні медичні рекомендації]
- ПОДАЛЬШЕ СПОСТЕРЕЖЕННЯ: [Рекомендовані подальші обстеження]

Звіт: ${reportContent}

Використовуйте медичну термінологію та точні формулювання:`
      },
      fr: {
        simple: `Créez un résumé simple et compréhensible du rapport médical suivant pour les patients:

Format:
- PRINCIPALES CONSTATATIONS: [2-3 constatations les plus importantes en langage simple]
- SIGNIFICATION: [Que signifie cela pour le patient?]
- ÉTAPES SUIVANTES: [Actions recommandées]

Rapport: ${reportContent}

Utilisez un langage simple et convivial pour les patients:`,

        detailed: `Créez un résumé médical détaillé du rapport suivant:

Format:
- RÉSUMÉ: [Aperçu détaillé des constatations]
- CONSTATATIONS CLÉS: [Constatations pathologiques et normales les plus importantes]
- PERTINENCE CLINIQUE: [Signification médicale des résultats]
- RECOMMANDATIONS: [Étapes suivantes concrètes et suivi]
- NOTES SPÉCIALES: [Anomalies nécessitant une attention particulière]

Rapport: ${reportContent}

Créez un résumé médical professionnel:`,

        technical: `Créez un résumé technique professionnel du rapport médical suivant pour les collègues:

Format:
- APERÇU DES CONSTATATIONS: [Détails techniques et mesures]
- DIAGNOSTICS DIFFÉRENTIELS: [Diagnostics possibles basés sur les constatations]
- CORRÉLATION: [Relation entre différentes constatations]
- RECOMMANDATIONS PROFESSIONNELLES: [Recommandations médicales spécifiques]
- SUIVI: [Examens de suivi recommandés]

Rapport: ${reportContent}

Utilisez la terminologie médicale et des formulations précises:`
      },
      es: {
        simple: `Crea un resumen simple y comprensible del siguiente informe médico para pacientes:

Formato:
- HALLAZGOS PRINCIPALES: [2-3 hallazgos más importantes en lenguaje simple]
- SIGNIFICADO: [¿Qué significa esto para el paciente?]
- PRÓXIMOS PASOS: [Acciones recomendadas]

Informe: ${reportContent}

Usa lenguaje simple y amigable para el paciente:`,

        detailed: `Crea un resumen médico detallado del siguiente informe:

Formato:
- RESUMEN: [Visión general detallada de los hallazgos]
- HALLAZGOS CLAVE: [Hallazgos patológicos y normales más importantes]
- RELEVANCIA CLÍNICA: [Significado médico de los resultados]
- RECOMENDACIONES: [Próximos pasos concretos y seguimiento]
- NOTAS ESPECIALES: [Anormalidades que requieren atención especial]

Informe: ${reportContent}

Crea un resumen médico profesional:`,

        technical: `Crea un resumen técnico profesional del siguiente informe médico para colegas:

Formato:
- VISIÓN GENERAL DE HALLAZGOS: [Detalles técnicos y mediciones]
- DIAGNÓSTICOS DIFERENCIALES: [Posibles diagnósticos basados en hallazgos]
- CORRELACIÓN: [Relación entre diferentes hallazgos]
- RECOMENDACIONES PROFESIONALES: [Recomendaciones médicas específicas]
- SEGUIMIENTO: [Exámenes de seguimiento recomendados]

Informe: ${reportContent}

Usa terminología médica y formulaciones precisas:`
      },
      it: {
        simple: `Crea un riassunto semplice e comprensibile del seguente rapporto medico per i pazienti:

Formato:
- PRINCIPALI RISULTATI: [2-3 risultati più importanti in linguaggio semplice]
- SIGNIFICATO: [Cosa significa questo per il paziente?]
- PROSSIMI PASSI: [Azioni raccomandate]

Rapporto: ${reportContent}

Usa un linguaggio semplice e amichevole per i pazienti:`,

        detailed: `Crea un riassunto medico dettagliato del seguente rapporto:

Formato:
- RIASSUNTO: [Panoramica dettagliata dei risultati]
- RISULTATI CHIAVE: [Risultati patologici e normali più importanti]
- RILEVANZA CLINICA: [Significato medico dei risultati]
- RACCOMANDAZIONI: [Prossimi passi concreti e follow-up]
- NOTE SPECIALI: [Anomalie che richiedono attenzione speciale]

Rapporto: ${reportContent}

Crea un riassunto medico professionale:`,

        technical: `Crea un riassunto tecnico professionale del seguente rapporto medico per i colleghi:

Formato:
- PANORAMICA DEI RISULTATI: [Dettagli tecnici e misurazioni]
- DIAGNOSI DIFFERENZIALI: [Possibili diagnosi basate sui risultati]
- CORRELAZIONE: [Relazione tra diversi risultati]
- RACCOMANDAZIONI PROFESSIONALI: [Raccomandazioni mediche specifiche]
- FOLLOW-UP: [Esami di follow-up raccomandati]

Rapporto: ${reportContent}

Usa terminologia medica e formulazioni precise:`
      },
      tr: {
        simple: `Aşağıdaki tıbbi raporun hastalar için basit ve anlaşılır bir özetini oluşturun:

Format:
- TEMEL BULGULAR: [Basit dilde 2-3 en önemli bulgu]
- ANLAMИ: [Bu hasta için ne anlama geliyor?]
- SONRAKİ ADIMLAR: [Önerilen eylemler]

Rapor: ${reportContent}

Basit, hasta dostu dil kullanın:`,

        detailed: `Aşağıdaki raporun detaylı tıbbi özetini oluşturun:

Format:
- ÖZET: [Bulguların detaylı genel bakışı]
- ANAHTAR BULGULAR: [En önemli patolojik ve normal bulgular]
- KLİNİK ÖNEM: [Sonuçların tıbbi önemi]
- ÖNERİLER: [Somut sonraki adımlar ve takip]
- ÖZEL NOTLAR: [Özel dikkat gerektiren anormallikler]

Rapor: ${reportContent}

Profesyonel tıbbi özet oluşturun:`,

        technical: `Aşağıdaki tıbbi raporun meslektaşlar için teknik profesyonel özetini oluşturun:

Format:
- BULGULAR GEREKSİNİMİ: [Teknik detaylar ve ölçümler]
- DİFERANSİYEL TANILAR: [Bulgulara dayalı olası tanılar]
- KORELASYON: [Farklı bulgular arasındaki ilişki]
- PROFESYONEL ÖNERİLER: [Spesifik tıbbi öneriler]
- TAKİP: [Önerilen takip incelemeleri]

Rapor: ${reportContent}

Tıbbi terminoloji ve kesin formülasyonlar kullanın:`
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

  private parseSummaryResponse(aiResponse: string, language: Language, provider: string, complexity: string = 'detailed', originalReportContent?: string): PatientSummary {
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
    
    // Section headers to look for (multilingual support)
    const findingHeaders = [
      // German
      'HAUPTBEFUNDE', 'SCHLÜSSELBEFUNDE', 'BEFUNDÜBERSICHT', 'WICHTIGE BEFUNDE', 'TECHNISCHE BEFUNDE',
      // English  
      'KEY FINDINGS', 'FINDINGS OVERVIEW', 'IMPORTANT FINDINGS', 'MAIN FINDINGS', 'TECHNICAL FINDINGS',
      // Arabic
      'النتائج الرئيسية', 'نظرة عامة على النتائج',
      // Ukrainian
      'ОСНОВНІ РЕЗУЛЬТАТИ', 'КЛЮЧОВІ РЕЗУЛЬТАТИ', 'ОГЛЯД РЕЗУЛЬТАТІВ',
      // French
      'PRINCIPALES CONSTATATIONS', 'CONSTATATIONS CLÉS', 'APERÇU DES CONSTATATIONS',
      // Spanish
      'HALLAZGOS PRINCIPALES', 'HALLAZGOS CLAVE', 'VISIÓN GENERAL DE HALLAZGOS',
      // Italian
      'PRINCIPALI RISULTATI', 'RISULTATI CHIAVE', 'PANORAMICA DEI RISULTATI',
      // Turkish
      'TEMEL BULGULAR', 'ANAHTAR BULGULAR', 'BULGULAR GEREKSİNİMİ'
    ];
    const recommendationHeaders = [
      // German
      'EMPFEHLUNG', 'EMPFEHLUNGEN', 'NÄCHSTE SCHRITTE', 'FACHEMPFEHLUNGEN', 'FACHÄRZTLICHE EMPFEHLUNGEN', 'VERLAUFSKONTROLLE', 'VERLAUFSPROTOKOLL', 'WEITERE MASSNAHMEN',
      // English
      'RECOMMENDATION', 'RECOMMENDATIONS', 'NEXT STEPS', 'PROFESSIONAL RECOMMENDATIONS', 'SPECIALIST RECOMMENDATIONS', 'FOLLOW-UP', 'FOLLOW-UP PROTOCOL',
      // Arabic
      'التوصيات', 'الخطوات التالية', 'التوصيات المهنية', 'المتابعة',
      // Ukrainian  
      'РЕКОМЕНДАЦІЇ', 'НАСТУПНІ КРОКИ', 'ПРОФЕСІЙНІ РЕКОМЕНДАЦІЇ', 'ПОДАЛЬШЕ СПОСТЕРЕЖЕННЯ',
      // French
      'RECOMMANDATIONS', 'ÉTAPES SUIVANTES', 'RECOMMANDATIONS PROFESSIONNELLES', 'SUIVI',
      // Spanish
      'RECOMENDACIONES', 'PRÓXIMOS PASOS', 'RECOMENDACIONES PROFESIONALES', 'SEGUIMIENTO',
      // Italian
      'RACCOMANDAZIONI', 'PROSSIMI PASSI', 'RACCOMANDAZIONI PROFESSIONALI', 'FOLLOW-UP',
      // Turkish
      'ÖNERİLER', 'SONRAKİ ADIMLAR', 'PROFESYONEL ÖNERİLER', 'TAKİP'
    ];
    const summaryHeaders = [
      // German
      'ZUSAMMENFASSUNG', 'BEDEUTUNG', 'ÜBERSICHT',
      // English
      'SUMMARY', 'MEANING', 'OVERVIEW',
      // Arabic
      'الملخص', 'المعنى',
      // Ukrainian
      'РЕЗЮМЕ', 'ЗНАЧЕННЯ',
      // French
      'RÉSUMÉ', 'SIGNIFICATION',
      // Spanish
      'RESUMEN', 'SIGNIFICADO',
      // Italian
      'RIASSUNTO', 'SIGNIFICATO',
      // Turkish
      'ÖZET', 'ANLAMИ'
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

    // If no structured findings found, try to extract from original report content
    let finalKeyFindings = keyFindings;
    let finalRecommendations = recommendations;
    
    if (keyFindings.length === 0 && originalReportContent) {
      console.log('🔄 No key findings found in AI response, extracting from original report...');
      finalKeyFindings = this.extractKeyFindingsFromReport(originalReportContent, language);
    }
    
    if (recommendations.length === 0 && originalReportContent) {
      console.log('🔄 No recommendations found in AI response, extracting from original report...');
      finalRecommendations = this.extractRecommendationsFromReport(originalReportContent, language);
    }

    return {
      id: `summary-${Date.now()}`,
      reportId: `report-${Date.now()}`,
      summary: finalSummary,
      keyFindings: finalKeyFindings.length > 0 ? finalKeyFindings : [
        language === 'de' ? 'Siehe detaillierte Zusammenfassung' : 'See detailed summary'
      ],
      recommendations: finalRecommendations.length > 0 ? finalRecommendations : [
        language === 'de' ? 'Weitere ärztliche Betreuung empfohlen' : 'Further medical care recommended'
      ],
      language,
      generatedAt: Date.now(),
      complexity: complexity as 'simple' | 'detailed' | 'technical',
      metadata: {
        aiProvider: provider,
        processingAgent: `summary-${provider}`,
        confidence: finalKeyFindings.length > 0 && finalRecommendations.length > 0 ? 0.9 : 0.7
      }
    };
  }

  private extractKeyFindingsFromReport(reportContent: string, language: Language): string[] {
    const findings: string[] = [];
    
    // Split report into sentences and look for meaningful medical content
    const sentences = reportContent.split(/[.!?]+/).filter(s => s.trim().length > 20);
    
    // Look for sentences that contain medical findings keywords
    const findingKeywords = language === 'de' 
      ? ['befund', 'zeigt', 'erkennbar', 'sichtbar', 'feststellbar', 'auffällig', 'normal', 'pathologisch', 'messwert', 'größe', 'durchmesser']
      : ['finding', 'shows', 'visible', 'evident', 'notable', 'normal', 'abnormal', 'measurement', 'size', 'diameter', 'reveals'];
    
    for (const sentence of sentences.slice(0, 5)) { // Take first 5 meaningful sentences
      const lowerSentence = sentence.toLowerCase().trim();
      if (findingKeywords.some(keyword => lowerSentence.includes(keyword)) && lowerSentence.length > 30) {
        findings.push(sentence.trim());
        if (findings.length >= 3) break; // Limit to 3 findings
      }
    }
    
    return findings;
  }

  private extractRecommendationsFromReport(reportContent: string, language: Language): string[] {
    const recommendations: string[] = [];
    
    // Split report into sentences and look for recommendation content
    const sentences = reportContent.split(/[.!?]+/).filter(s => s.trim().length > 15);
    
    // Look for sentences that contain recommendation keywords
    const recommendationKeywords = language === 'de'
      ? ['empfehlung', 'empfohlen', 'sollte', 'ratsam', 'kontrolle', 'nachkontrolle', 'verlauf', 'follow-up', 'weiter']
      : ['recommend', 'suggested', 'should', 'advisable', 'follow-up', 'monitor', 'continue', 'further', 'next'];
    
    for (const sentence of sentences) {
      const lowerSentence = sentence.toLowerCase().trim();
      if (recommendationKeywords.some(keyword => lowerSentence.includes(keyword)) && lowerSentence.length > 20) {
        recommendations.push(sentence.trim());
        if (recommendations.length >= 2) break; // Limit to 2 recommendations
      }
    }
    
    // If no specific recommendations found, provide generic ones
    if (recommendations.length === 0) {
      recommendations.push(
        language === 'de' 
          ? 'Weitere ärztliche Betreuung nach klinischer Einschätzung'
          : 'Further medical care per clinical assessment'
      );
    }
    
    return recommendations;
  }

  private generateFallbackSummary(reportContent: string, language: Language): PatientSummary {
    console.log('📋 Generating fallback summary');
    
    const fallbackTexts = {
      de: {
        summary: `Automatische Zusammenfassung des Berichts:\n\n${reportContent.substring(0, 500)}...`,
        findings: 'Siehe ursprünglichen Bericht',
        recommendations: 'Rücksprache mit behandelndem Arzt empfohlen'
      },
      en: {
        summary: `Automatic summary of report:\n\n${reportContent.substring(0, 500)}...`,
        findings: 'See original report',
        recommendations: 'Consultation with attending physician recommended'
      },
      ar: {
        summary: `ملخص تلقائي للتقرير:\n\n${reportContent.substring(0, 500)}...`,
        findings: 'انظر التقرير الأصلي',
        recommendations: 'يُنصح بالتشاور مع الطبيب المعالج'
      },
      uk: {
        summary: `Автоматичне резюме звіту:\n\n${reportContent.substring(0, 500)}...`,
        findings: 'Дивіться оригінальний звіт',
        recommendations: 'Рекомендована консультація з лікарем'
      },
      fr: {
        summary: `Résumé automatique du rapport:\n\n${reportContent.substring(0, 500)}...`,
        findings: 'Voir le rapport original',
        recommendations: 'Consultation avec le médecin traitant recommandée'
      },
      es: {
        summary: `Resumen automático del informe:\n\n${reportContent.substring(0, 500)}...`,
        findings: 'Ver informe original',
        recommendations: 'Se recomienda consulta con el médico tratante'
      },
      it: {
        summary: `Riassunto automatico del rapporto:\n\n${reportContent.substring(0, 500)}...`,
        findings: 'Vedere rapporto originale',
        recommendations: 'Consultazione con il medico curante raccomandata'
      },
      tr: {
        summary: `Raporun otomatik özeti:\n\n${reportContent.substring(0, 500)}...`,
        findings: 'Orijinal rapora bakınız',
        recommendations: 'Tedavi eden doktor ile konsültasyon önerilir'
      }
    };

    const texts = fallbackTexts[language as keyof typeof fallbackTexts] || fallbackTexts.en;
    
    return {
      id: `summary-${Date.now()}`,
      reportId: `report-${Date.now()}`, 
      summary: texts.summary,
      keyFindings: [texts.findings],
      recommendations: [texts.recommendations],
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
    console.log('- Processing mode:', body.processingMode || 'cloud');

    if (!body.reportContent) {
      return NextResponse.json(
        { error: 'No report content provided' },
        { status: 400 }
      );
    }

    // For local processing mode, use backend service
    if (body.processingMode === 'local') {
      console.log('🏠 Using local processing for summary generation');
      
      try {
        // Call the backend Multi-LLM service endpoint for summary
        const backendUrl = process.env.BACKEND_URL || 'http://localhost:3002';
        const response = await fetch(`${backendUrl}/api/generate-summary`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            reportContent: body.reportContent,
            language: body.language || 'de',
            complexity: body.complexity || 'detailed',
            processingMode: 'local'
          })
        });

        if (!response.ok) {
          throw new Error(`Backend service error: ${response.status} - ${response.statusText}`);
        }

        const backendSummary = await response.json();
        console.log('✅ Local summary generated via backend service');
        console.log('- Provider:', backendSummary.metadata?.aiProvider);

        return NextResponse.json(backendSummary);

      } catch (backendError) {
        console.error('❌ Backend summary service failed, falling back to frontend processing:', backendError instanceof Error ? backendError.message : 'Unknown error');
        
        // Fallback to local Ollama processing
        return await generateLocalSummary(body);
      }
    }

    // Cloud processing using frontend service
    console.log('☁️ Using cloud processing for summary generation');
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

// Local summary generation using frontend Ollama (fallback)
async function generateLocalSummary(body: SummaryRequest) {
  console.log('🏠 Generating local summary via frontend Ollama...');
  
  try {
    // Try Ollama models directly
    const models = ['gemma3-medical-fp16:latest', 'gemma3-medical-q8:latest', 'gemma3-medical-q5:latest', 'gpt-oss:latest'];
    const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    
    let lastError: Error | null = null;
    
    for (const model of models) {
      try {
        console.log(`Attempting local summary generation with ${model}...`);
        
        const complexityMap = {
          simple: 'einfache, patientenfreundliche',
          detailed: 'detaillierte medizinische', 
          technical: 'umfassende technische'
        };
        
        const complexity = body.complexity || 'detailed';
        const complexityDesc = complexityMap[complexity] || complexityMap.detailed;
        
        const summaryPrompt = `Erstelle eine ${complexityDesc} Zusammenfassung des folgenden medizinischen Berichts auf Deutsch:

${body.reportContent}

Strukturiere die Zusammenfassung mit folgenden Abschnitten:
- HAUPTBEFUNDE: [2-3 wichtigste medizinische Befunde]
- KLINISCHE BEDEUTUNG: [Was bedeuten die Befunde für den Patienten?]
- EMPFEHLUNGEN: [Konkrete nächste Schritte und Maßnahmen]

Verwende ${complexity === 'simple' ? 'einfache, verständliche Sprache für Patienten' : complexity === 'technical' ? 'präzise medizinische Fachterminologie' : 'klare medizinische Sprache'}.

Antworte NUR mit der strukturierten Zusammenfassung auf Deutsch.`;

        const response = await fetch(`${ollamaBaseUrl}/api/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: model,
            prompt: summaryPrompt,
            stream: false,
            options: {
              temperature: 0.2,
              top_p: 0.9,
              repeat_penalty: 1.1
            }
          })
        });

        if (!response.ok) {
          throw new Error(`Ollama API error: ${response.status} - ${response.statusText}`);
        }

        const data = await response.json();
        console.log(`Successfully generated summary with local ${model}`);
        
        // Parse the response into structured format
        const parsedSummary = parseOllamaSummaryResponse(data.response || '', body, model);
        
        return NextResponse.json(parsedSummary);
        
      } catch (error) {
        console.error(`Local model ${model} failed:`, error instanceof Error ? error.message : 'Unknown error');
        lastError = error instanceof Error ? error : new Error('Unknown error');
        continue;
      }
    }
    
    throw new Error(`All local models failed. Last error: ${lastError?.message || 'Unknown error'}`);
    
  } catch (error) {
    console.error('❌ Local summary generation failed completely:', error);
    
    // Return a fallback summary
    return NextResponse.json({
      id: `summary-${Date.now()}`,
      reportId: body.reportId,
      summary: `Lokale Verarbeitung fehlgeschlagen - siehe ursprünglicher Bericht:\n\n${body.reportContent.substring(0, 500)}...`,
      keyFindings: ['Siehe ursprünglicher Bericht'],
      recommendations: ['Rücksprache mit behandelndem Arzt empfohlen'],
      language: body.language || 'de',
      generatedAt: Date.now(),
      complexity: body.complexity || 'detailed',
      metadata: {
        aiProvider: 'local-failed',
        processingAgent: 'local_fallback',
        confidence: 0.3
      }
    });
  }
}

// Parse Ollama summary response to structured format
function parseOllamaSummaryResponse(responseText: string, body: SummaryRequest, model: string) {
  console.log('Parsing Ollama summary response to structured format...');
  
  const keyFindings: string[] = [];
  const recommendations: string[] = [];
  let summaryText = responseText;
  
  // Extract structured sections using German patterns
  const hauptbefundeMatch = responseText.match(/(?:HAUPTBEFUNDE|Hauptbefunde)[:\s]*([\s\S]*?)(?=(?:KLINISCHE BEDEUTUNG|Klinische Bedeutung|EMPFEHLUNGEN|Empfehlungen):|$)/i);
  const empfehlungenMatch = responseText.match(/(?:EMPFEHLUNGEN|Empfehlungen)[:\s]*([\s\S]*?)$/i);
  const bedeutungMatch = responseText.match(/(?:KLINISCHE BEDEUTUNG|Klinische Bedeutung)[:\s]*([\s\S]*?)(?=(?:EMPFEHLUNGEN|Empfehlungen):|$)/i);
  
  if (hauptbefundeMatch?.[1]) {
    const findingsText = hauptbefundeMatch[1].trim();
    // Split by lines and extract bullet points or numbered items
    const findingLines = findingsText.split('\n').filter(line => 
      line.trim() && (line.includes('-') || line.includes('•') || /^\d+\./.test(line.trim()))
    );
    findingLines.forEach(line => {
      const cleaned = line.replace(/^[-•\d.\s]+/, '').trim();
      if (cleaned) keyFindings.push(cleaned);
    });
  }
  
  if (empfehlungenMatch?.[1]) {
    const recText = empfehlungenMatch[1].trim();
    const recLines = recText.split('\n').filter(line => 
      line.trim() && (line.includes('-') || line.includes('•') || /^\d+\./.test(line.trim()))
    );
    recLines.forEach(line => {
      const cleaned = line.replace(/^[-•\d.\s]+/, '').trim();
      if (cleaned) recommendations.push(cleaned);
    });
  }
  
  // Use clinical significance section as main summary if available
  if (bedeutungMatch?.[1]) {
    summaryText = bedeutungMatch[1].trim();
  }
  
  return {
    id: `summary-${Date.now()}`,
    reportId: body.reportId,
    summary: summaryText,
    keyFindings: keyFindings.length > 0 ? keyFindings : ['Siehe detaillierte Zusammenfassung'],
    recommendations: recommendations.length > 0 ? recommendations : ['Weitere ärztliche Betreuung empfohlen'],
    language: body.language || 'de',
    generatedAt: Date.now(),
    complexity: body.complexity || 'detailed',
    metadata: {
      aiProvider: 'ollama-local',
      processingAgent: 'local_ollama_summary',
      confidence: 0.8,
      model: model,
      processingMode: 'local'
    }
  };
}