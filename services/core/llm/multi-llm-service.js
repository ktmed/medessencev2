const OpenAI = require('openai');
const crypto = require('crypto');
const OllamaModelService = require('./ollama-model-service');

/**
 * Multi-LLM Service with fallback support and caching
 * Tries OpenAI first, then Claude, then Gemini
 */
class MultiLLMService {
  constructor() {
    // Initialize cache
    this.cache = new Map();
    this.CACHE_TTL = 60 * 60 * 1000; // 1 hour in milliseconds
    this.MAX_CACHE_SIZE = 100; // Maximum number of cached entries
    
    // Initialize LLM clients if API keys are provided
    this.providers = [];
    
    // Initialize Ollama service for local processing
    this.ollamaService = new OllamaModelService();
    this.isOllamaInitialized = false;
    this.initializeOllama();
    
    // Get provider priority from environment variable
    const providerPriority = (process.env.AI_PROVIDER_PRIORITY || 'claude,gemini,openai').split(',').map(p => p.trim());
    console.log('Provider priority order:', providerPriority);
    
    // Initialize available providers
    const availableProviders = {
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
          this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
            timeout: 30 * 1000 // 30 seconds to match log timeout
          });
          return {
            name: 'openai',
            client: this.openai,
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
          console.log(`Added ${providerName} provider`);
        } else {
          console.log(`${providerName} provider not available (missing API key)`);
        }
      } else {
        console.log(`Unknown provider in priority list: ${providerName}`);
      }
    }
    
    console.log(`MultiLLMService initialized with providers: ${this.providers.map(p => p.name).join(', ')}`);
    
    // Start cache cleanup interval
    this.startCacheCleanup();
  }
  
  /**
   * Generate cache key from request parameters
   */
  generateCacheKey(text, language, type = 'report') {
    const hash = crypto.createHash('sha256');
    hash.update(`${type}:${language}:${text}`);
    return hash.digest('hex');
  }
  
  /**
   * Get cached response if available and not expired
   */
  getCachedResponse(key) {
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    const now = Date.now();
    if (now - cached.timestamp > this.CACHE_TTL) {
      this.cache.delete(key);
      return null;
    }
    
    console.log(`Cache hit for key: ${key.substring(0, 8)}...`);
    return cached.data;
  }
  
  /**
   * Store response in cache
   */
  setCachedResponse(key, data) {
    // Implement LRU eviction if cache is full
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
      console.log(`Cache eviction: removed oldest entry`);
    }
    
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
    console.log(`Cached response for key: ${key.substring(0, 8)}... (cache size: ${this.cache.size})`);
  }
  
  /**
   * Clean up expired cache entries periodically
   */
  startCacheCleanup() {
    setInterval(() => {
      const now = Date.now();
      let cleaned = 0;
      
      for (const [key, value] of this.cache.entries()) {
        if (now - value.timestamp > this.CACHE_TTL) {
          this.cache.delete(key);
          cleaned++;
        }
      }
      
      if (cleaned > 0) {
        console.log(`Cache cleanup: removed ${cleaned} expired entries`);
      }
    }, 30 * 60 * 1000); // Run every 30 minutes
  }
  
  /**
   * Initialize Ollama service for local processing
   */
  async initializeOllama() {
    try {
      console.log('Initializing Ollama service for local processing...');
      const initialized = await this.ollamaService.initialize();
      this.isOllamaInitialized = initialized;
      
      if (initialized) {
        console.log('Ollama service initialized successfully');
      } else {
        console.log('Ollama service initialization failed - local processing will not be available');
      }
    } catch (error) {
      console.error('Ollama initialization error:', error.message);
      this.isOllamaInitialized = false;
    }
  }
  
  /**
   * Generate a radiology report using available LLMs with fallback
   */
  async generateReport(transcriptionText, language = 'de', metadata = {}, processingMode = 'cloud') {
    // Check cache first
    const cacheKey = this.generateCacheKey(transcriptionText, language, 'report');
    const cachedResponse = this.getCachedResponse(cacheKey);
    if (cachedResponse) {
      return {
        ...cachedResponse,
        cached: true
      };
    }
    
    const prompt = this.createReportPrompt(transcriptionText, language, metadata);
    
    // For local processing, use Ollama models
    if (processingMode === 'local') {
      return await this.generateReportWithOllama(prompt, language, transcriptionText);
    }
    
    let lastError = null;
    
    // Try each provider in order for cloud processing
    for (const provider of this.providers) {
      try {
        console.log(`Attempting report generation with ${provider.name}...`);
        const result = await provider.handler(prompt, language);
        console.log(`Successfully generated report with ${provider.name}`);
        
        const response = {
          ...result,
          provider: provider.name,
          fallback: this.providers.indexOf(provider) > 0
        };
        
        // Cache the successful response
        this.setCachedResponse(cacheKey, response);
        
        return response;
        
      } catch (error) {
        console.error(`${provider.name} failed:`, error.message);
        lastError = error;
        
        // Continue to next provider
        continue;
      }
    }
    
    // All providers failed
    throw new Error(`All LLM providers failed. Last error: ${lastError?.message || 'Unknown error'}`);
  }
  
  /**
   * Create a prompt for radiology report generation
   */
  createReportPrompt(transcriptionText, language, metadata) {
    const languageInstructions = {
      de: 'Erstellen Sie einen VOLLSTÄNDIGEN strukturierten radiologischen Befund auf Deutsch. WICHTIG: Übernehmen Sie ALLE Informationen aus der Transkription, kürzen Sie NICHTS.',
      en: 'Create a COMPLETE structured radiology report in English. IMPORTANT: Include ALL information from the transcription, do NOT shorten anything.',
      tr: 'Türkçe EKSIKSIZ yapılandırılmış bir radyoloji raporu oluşturun. ÖNEMLİ: Transkripsiyondaki TÜM bilgileri dahil edin, hiçbir şeyi KISALTMAYIN.'
    };
    
    return `${languageInstructions[language] || languageInstructions.de}

Transkription:
${transcriptionText}

WICHTIGE ANWEISUNGEN:
- FOKUSSIEREN Sie sich NUR auf die medizinischen Inhalte
- IGNORIEREN Sie administrative Inhalte wie: Briefköpfe, Adressen, Grußformeln, Unterschriften, Absenderangaben
- EXTRAHIEREN Sie ALLE medizinischen Details: Diagnosen, Befunde, Therapien, Anamnese, Untersuchungsergebnisse
- Strukturieren Sie die medizinischen Informationen klar, aber KÜRZEN Sie sie NICHT

Bitte strukturieren Sie den Bericht mit folgenden klar getrennten Abschnitten:

1. Technische Details (falls vorhanden) → "technicalDetails"
2. Befund (OBJEKTIVE Fakten und Daten) → "findings"
3. Beurteilung (SUBJEKTIVE Interpretation und Zusammenfassung) → "impression"  
4. Empfehlung (weitere Maßnahmen) → "recommendations"

KRITISCH WICHTIG - Abschnitte NICHT wiederholen:

**"findings" Abschnitt** (NUR objektive medizinische Fakten):
- Hauptdiagnose und medizinische Diagnosen
- Anamnese/Klinische Angaben
- Histologie, Staging-Informationen
- Therapiedetails und Behandlungsverläufe (chronologisch)
- Messungen, Befunde, Laborwerte
- Nebenwirkungen und Komplikationen (faktisch)
- KEINE Interpretationen oder Zusammenfassungen hier!

**"impression" Abschnitt** (NUR Interpretation und Beurteilung):
- Zusammenfassung der wichtigsten Befunde
- Klinische Interpretation und Bewertung
- Prognose und Einschätzung
- KEINE Wiederholung der Detail-Fakten aus "findings"!

**"recommendations" Abschnitt** (NUR Empfehlungen):
- Weitere diagnostische Maßnahmen
- Nachsorge und Follow-up
- Behandlungsempfehlungen

Format: NUR JSON-Ausgabe mit folgender erweiterten Struktur:

{
  "technicalDetails": "string",
  "findings": {
    "content": "string - vollständiger Befund-Text",
    "structuredFindings": [
      {
        "text": "string - spezifischer Befund",
        "significance": "general|significant|critical",
        "sourceSpan": {"start": number, "end": number},
        "category": "string - Befundkategorie"
      }
    ]
  },
  "impression": "string",
  "recommendations": "string"
}

WICHTIG für "structuredFindings":
- Markieren Sie jede wichtige Aussage mit Signifikanz-Level:
  - "general": Normale/unauffällige Befunde
  - "significant": Auffällige/behandlungsbedürftige Befunde  
  - "critical": Dringende/kritische Befunde
- "sourceSpan" zeigt Position im Original-Text (start/end Zeichen-Index)
- "category" beschreibt die Art des Befunds (z.B. "Pathologie", "Messung", "Diagnose")

KRITISCH WICHTIG: 
- Jeder Abschnitt muss EINDEUTIG unterschiedliche Inhalte haben
- KEINE Wiederholung von Text zwischen "findings", "impression" und "recommendations"
- "findings" = objektive Fakten, "impression" = Interpretation, "recommendations" = Handlungsempfehlungen

WICHTIG: Antworten Sie NUR mit dem JSON-Objekt, KEINE zusätzlichen Erklärungen oder Text.`;
  }
  
  /**
   * Call OpenAI API
   */
  async callOpenAI(prompt, language) {
    try {
      // Add timeout wrapper
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('OpenAI API timeout after 30s')), 30000)
      );
      
      const completionPromise = this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "You are a medical radiology report assistant. Generate structured reports based on transcribed dictations."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 4000
      });
      
      const completion = await Promise.race([completionPromise, timeoutPromise]);
      
      const content = completion.choices[0].message.content;
      console.log('OpenAI raw response:', content.substring(0, 500) + '...');
      
      // Try to parse as JSON, fallback to text parsing
      try {
        const parsed = JSON.parse(content);
        console.log('OpenAI parsed JSON structure:', {
          hasTechnicalDetails: !!parsed.technicalDetails,
          hasFindings: !!parsed.findings,
          hasImpression: !!parsed.impression,
          hasRecommendations: !!parsed.recommendations,
          findingsLength: typeof parsed.findings === 'string' ? parsed.findings.length : parsed.findings?.content?.length || 0,
          impressionLength: parsed.impression?.length || 0,
          hasStructuredFindings: !!parsed.findings?.structuredFindings,
          structuredFindingsCount: parsed.findings?.structuredFindings?.length || 0
        });
        return parsed;
      } catch {
        console.log('OpenAI response not valid JSON, using text parsing');
        return this.parseTextResponse(content);
      }
      
    } catch (error) {
      if (error.status === 429) {
        throw new Error('OpenAI rate limit exceeded');
      } else if (error.status === 401) {
        throw new Error('OpenAI API key invalid');
      } else {
        throw new Error(`OpenAI API error: ${error.message}`);
      }
    }
  }
  
  /**
   * Call Claude API
   */
  async callClaude(prompt, language) {
    try {
      // Add timeout wrapper - increased timeout for complex medical reports
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Claude API timeout after 60s')), 60000)
      );
      
      const requestPromise = fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: process.env.CLAUDE_MODEL || 'claude-3-opus-20240229',
          max_tokens: 4000,
          temperature: 0.3,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ]
        })
      });
      
      const response = await Promise.race([requestPromise, timeoutPromise]);
      
      if (!response.ok) {
        const error = await response.text();
        console.error('Claude API error response:', error);
        throw new Error(`Claude API error: ${response.status} - ${error}`);
      }
      
      const data = await response.json();
      const content = data.content[0].text;
      
      console.log('Claude raw response:', content.substring(0, 500) + '...');
      
      // Try to parse as JSON, fallback to text parsing
      try {
        const parsed = JSON.parse(content);
        console.log('Claude parsed JSON structure:', {
          hasTechnicalDetails: !!parsed.technicalDetails,
          hasFindings: !!parsed.findings,
          hasImpression: !!parsed.impression,
          hasRecommendations: !!parsed.recommendations,
          findingsLength: typeof parsed.findings === 'string' ? parsed.findings.length : parsed.findings?.content?.length || 0,
          impressionLength: parsed.impression?.length || 0,
          hasStructuredFindings: !!parsed.findings?.structuredFindings,
          structuredFindingsCount: parsed.findings?.structuredFindings?.length || 0
        });
        return parsed;
      } catch {
        console.log('Claude response not valid JSON, using text parsing');
        return this.parseTextResponse(content);
      }
      
    } catch (error) {
      if (error.message.includes('429')) {
        throw new Error('Claude rate limit exceeded');
      } else if (error.message.includes('401') || error.message.includes('authentication')) {
        throw new Error('Claude API key invalid');
      } else {
        throw new Error(`Claude API error: ${error.message}`);
      }
    }
  }
  
  /**
   * Call Gemini API
   */
  async callGemini(prompt, language) {
    try {
      // Add timeout wrapper
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Gemini API timeout after 30s')), 30000)
      );
      
      const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
      const requestPromise = fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GOOGLE_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 4000
          }
        })
      });
      
      const response = await Promise.race([requestPromise, timeoutPromise]);
      
      if (!response.ok) {
        const error = await response.text();
        console.error('Gemini API error response:', error);
        throw new Error(`Gemini API error: ${response.status} - ${error}`);
      }
      
      const data = await response.json();
      const content = data.candidates[0].content.parts[0].text;
      
      console.log('Gemini raw response:', content.substring(0, 500) + '...');
      
      // Try to parse as JSON, fallback to text parsing
      try {
        const parsed = JSON.parse(content);
        console.log('Gemini parsed JSON structure:', {
          hasTechnicalDetails: !!parsed.technicalDetails,
          hasFindings: !!parsed.findings,
          hasImpression: !!parsed.impression,
          hasRecommendations: !!parsed.recommendations,
          findingsLength: typeof parsed.findings === 'string' ? parsed.findings.length : parsed.findings?.content?.length || 0,
          impressionLength: parsed.impression?.length || 0,
          hasStructuredFindings: !!parsed.findings?.structuredFindings,
          structuredFindingsCount: parsed.findings?.structuredFindings?.length || 0
        });
        return parsed;
      } catch {
        console.log('Gemini response not valid JSON, using text parsing');
        return this.parseTextResponse(content);
      }
      
    } catch (error) {
      if (error.message.includes('429')) {
        throw new Error('Gemini rate limit exceeded');
      } else if (error.message.includes('401') || error.message.includes('403')) {
        throw new Error('Gemini API key invalid');
      } else {
        throw new Error(`Gemini API error: ${error.message}`);
      }
    }
  }
  
  /**
   * Parse text response into structured format
   */
  parseTextResponse(text) {
    // First check if the text contains embedded JSON
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        // Try to parse the extracted JSON
        const parsed = JSON.parse(jsonMatch[0]);
        // Check if it has the expected structure
        if (parsed.findings !== undefined || parsed.impression !== undefined) {
          return parsed;
        }
      } catch (e) {
        console.log('Failed to parse embedded JSON, falling back to text parsing');
      }
    }
    
    const sections = {
      technicalDetails: '',
      findings: {
        content: '',
        structuredFindings: []
      },
      impression: '',
      recommendations: ''
    };
    
    // Extract sections using common patterns
    const patterns = {
      technicalDetails: /(?:Technik|Technical Details|Teknik)[:\s]+([\s\S]*?)(?=\n(?:Befund|Findings|Bulgular)|$)/i,
      findings: /(?:Befund|Findings|Bulgular)[:\s]+([\s\S]*?)(?=\n(?:Beurteilung|Impression|Değerlendirme)|$)/i,
      impression: /(?:Beurteilung|Impression|Değerlendirme)[:\s]+([\s\S]*?)(?=\n(?:Empfehlung|Recommendations|Öneriler)|$)/i,
      recommendations: /(?:Empfehlung|Recommendations|Öneriler)[:\s]+([\s\S]*?)$/i
    };
    
    for (const [key, pattern] of Object.entries(patterns)) {
      const match = text.match(pattern);
      if (match && match[1]) {
        if (key === 'findings') {
          sections.findings.content = match[1].trim();
          // Create basic structured findings for fallback
          sections.findings.structuredFindings = this.createBasicStructuredFindings(match[1].trim());
        } else {
          sections[key] = match[1].trim();
        }
      }
    }
    
    // If no sections found, put everything in findings
    if (!sections.findings.content && !sections.impression) {
      sections.findings.content = text.trim();
      sections.findings.structuredFindings = this.createBasicStructuredFindings(text.trim());
    }
    
    return sections;
  }
  
  /**
   * Create basic structured findings for fallback cases
   */
  createBasicStructuredFindings(text) {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
    const structuredFindings = [];
    
    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i].trim();
      if (sentence.length === 0) continue;
      
      // Determine significance based on keywords
      let significance = 'general';
      const criticalKeywords = ['kritisch', 'dringend', 'notfall', 'sofort', 'akut', 'schwer', 'malign', 'tumor', 'karzinom', 'metastasen'];
      const significantKeywords = ['auffällig', 'pathologisch', 'verdacht', 'stenose', 'vorfall', 'entzündung', 'infektion', 'läsion'];
      
      const lowerSentence = sentence.toLowerCase();
      if (criticalKeywords.some(keyword => lowerSentence.includes(keyword))) {
        significance = 'critical';
      } else if (significantKeywords.some(keyword => lowerSentence.includes(keyword))) {
        significance = 'significant';
      }
      
      // Determine category
      let category = 'Befund';
      if (lowerSentence.includes('messung') || lowerSentence.includes('größe') || lowerSentence.includes('durchmesser')) {
        category = 'Messung';
      } else if (lowerSentence.includes('diagnose') || lowerSentence.includes('verdacht')) {
        category = 'Diagnose';
      } else if (lowerSentence.includes('pathologie') || lowerSentence.includes('histologie')) {
        category = 'Pathologie';
      }
      
      // Calculate source span with improved accuracy
      let startIndex = -1;
      let endIndex = -1;
      
      // Improved text matching algorithm
      const lowerText = text.toLowerCase();
      // Note: lowerSentence already declared above
      
      // First try exact match (case-insensitive)
      startIndex = lowerText.indexOf(lowerSentence);
      
      // If exact match fails, try to find the sentence with fuzzy matching
      if (startIndex === -1) {
        // Extract key medical terms (longer than 4 characters)
        const medicalTerms = sentence.split(' ')
          .filter(w => w.length > 4)
          .sort((a, b) => b.length - a.length); // Sort by length, longest first
          
        // Try to find the longest medical term first
        for (const term of medicalTerms) {
          const termIndex = lowerText.indexOf(term.toLowerCase());
          if (termIndex !== -1) {
            // Found a key term, now try to expand to find the full sentence context
            const expandedStart = Math.max(0, termIndex - 50);
            const expandedEnd = Math.min(text.length, termIndex + term.length + 50);
            const contextText = text.substring(expandedStart, expandedEnd);
            
            // Check if the context contains most of our sentence words
            const sentenceWords = sentence.toLowerCase().split(' ').filter(w => w.length > 2);
            const matchedWords = sentenceWords.filter(word => 
              contextText.toLowerCase().includes(word)
            );
            
            // If we match most words in the context, use this location
            if (matchedWords.length >= Math.ceil(sentenceWords.length * 0.6)) {
              startIndex = termIndex;
              // Adjust to try to capture more of the sentence
              const beforeTerm = text.substring(Math.max(0, termIndex - 30), termIndex);
              const afterTerm = text.substring(termIndex, Math.min(text.length, termIndex + 100));
              
              // Look for sentence boundaries
              const sentenceStart = beforeTerm.lastIndexOf('.') + 1;
              if (sentenceStart > 0 && beforeTerm.length - sentenceStart < 30) {
                startIndex = termIndex - (beforeTerm.length - sentenceStart);
              }
              break;
            }
          }
        }
      }
      
      // Final fallback: use first significant word
      if (startIndex === -1) {
        const significantWords = sentence.split(' ').filter(w => w.length > 5);
        for (const word of significantWords) {
          const wordIndex = lowerText.indexOf(word.toLowerCase());
          if (wordIndex !== -1) {
            startIndex = wordIndex;
            break;
          }
        }
      }
      
      // Calculate end index
      if (startIndex !== -1) {
        endIndex = startIndex + sentence.length;
        // Ensure we don't exceed text bounds
        endIndex = Math.min(endIndex, text.length);
      } else {
        // Fallback: use approximate position based on sentence order
        const approxPosition = Math.floor((text.length / sentences.length) * i);
        startIndex = Math.max(0, approxPosition);
        endIndex = Math.min(startIndex + sentence.length, text.length);
      }
      
      // Debug logging for source span calculation
      console.log('🔍 Backend Source Span Debug:', {
        sentence: sentence.substring(0, 50) + '...',
        originalStartIndex: text.indexOf(sentence),
        calculatedStartIndex: startIndex,
        finalSpan: { 
          start: Math.max(0, startIndex), 
          end: Math.max(startIndex + 1, endIndex)
        },
        textAtSpan: text.substring(Math.max(0, startIndex), Math.max(startIndex + 1, endIndex)),
        textPreview: text.substring(Math.max(0, startIndex - 20), Math.max(startIndex + 50, endIndex + 20))
      });
      
      structuredFindings.push({
        text: sentence,
        significance: significance,
        sourceSpan: { 
          start: Math.max(0, startIndex), 
          end: Math.max(startIndex + 1, endIndex) // Ensure end > start
        },
        category: category
      });
    }
    
    return structuredFindings;
  }
  
  /**
   * Generate patient summary using available LLMs
   */
  async generatePatientSummary(reportText, language = 'de') {
    // Check cache first
    const cacheKey = this.generateCacheKey(reportText, language, 'summary');
    const cachedResponse = this.getCachedResponse(cacheKey);
    if (cachedResponse) {
      return {
        ...cachedResponse,
        cached: true
      };
    }
    
    const prompt = this.createSummaryPrompt(reportText, language);
    
    let lastError = null;
    
    // Try each provider in order
    for (const provider of this.providers) {
      try {
        console.log(`Attempting summary generation with ${provider.name}...`);
        const result = await provider.handler(prompt, language);
        console.log(`Successfully generated summary with ${provider.name}`);
        
        const response = {
          ...result,
          provider: provider.name
        };
        
        // Cache the successful response
        this.setCachedResponse(cacheKey, response);
        
        return response;
        
      } catch (error) {
        console.error(`${provider.name} failed for summary:`, error.message);
        lastError = error;
        continue;
      }
    }
    
    // All providers failed
    throw new Error(`All LLM providers failed for summary. Last error: ${lastError?.message || 'Unknown error'}`);
  }
  
  /**
   * Create a prompt for patient summary generation
   */
  createSummaryPrompt(reportText, language) {
    const prompts = {
      de: {
        instruction: 'Erstellen Sie eine patientenfreundliche Zusammenfassung des radiologischen Befunds.',
        sections: `Bitte erstellen Sie eine einfache, verständliche Zusammenfassung für Patienten mit:
1. Was wurde untersucht?
2. Was wurde gefunden? (in einfachen Worten)
3. Was bedeutet das für den Patienten?
4. Empfohlene nächste Schritte`,
        format: 'Format: JSON mit den Schlüsseln: examination, findings, meaning, nextSteps'
      },
      en: {
        instruction: 'Create a patient-friendly summary of the radiology report.',
        sections: `Please create a simple, understandable summary for patients with:
1. What was examined?
2. What was found? (in simple terms)
3. What does this mean for the patient?
4. Recommended next steps`,
        format: 'Format: JSON with keys: examination, findings, meaning, nextSteps'
      },
      tr: {
        instruction: 'Radyoloji raporunun hasta dostu bir özetini oluşturun.',
        sections: `Lütfen hastalar için basit, anlaşılır bir özet oluşturun:
1. Ne incelendi?
2. Ne bulundu? (basit terimlerle)
3. Bu hasta için ne anlama geliyor?
4. Önerilen sonraki adımlar`,
        format: 'Format: JSON anahtarlarıyla: examination, findings, meaning, nextSteps'
      },
      es: {
        instruction: 'Cree un resumen amigable para el paciente del informe radiológico.',
        sections: `Por favor, cree un resumen simple y comprensible para pacientes con:
1. ¿Qué se examinó?
2. ¿Qué se encontró? (en términos simples)
3. ¿Qué significa esto para el paciente?
4. Próximos pasos recomendados`,
        format: 'Formato: JSON con claves: examination, findings, meaning, nextSteps'
      },
      fr: {
        instruction: 'Créez un résumé adapté aux patients du rapport radiologique.',
        sections: `Veuillez créer un résumé simple et compréhensible pour les patients avec:
1. Qu'est-ce qui a été examiné?
2. Qu'est-ce qui a été trouvé? (en termes simples)
3. Qu'est-ce que cela signifie pour le patient?
4. Prochaines étapes recommandées`,
        format: 'Format: JSON avec les clés: examination, findings, meaning, nextSteps'
      },
      it: {
        instruction: 'Crea un riassunto adatto ai pazienti del rapporto radiologico.',
        sections: `Si prega di creare un riassunto semplice e comprensibile per i pazienti con:
1. Cosa è stato esaminato?
2. Cosa è stato trovato? (in termini semplici)
3. Cosa significa questo per il paziente?
4. Prossimi passi raccomandati`,
        format: 'Formato: JSON con chiavi: examination, findings, meaning, nextSteps'
      }
    };
    
    const selectedPrompt = prompts[language] || prompts.de;
    
    return `${selectedPrompt.instruction}

Report:
${reportText}

${selectedPrompt.sections}

${selectedPrompt.format}

IMPORTANT: Generate the response in ${language === 'de' ? 'German' : language === 'en' ? 'English' : language === 'tr' ? 'Turkish' : language === 'es' ? 'Spanish' : language === 'fr' ? 'French' : language === 'it' ? 'Italian' : 'the requested language'}.`;
  }
  
  /**
   * Generate report using local Ollama models
   */
  async generateReportWithOllama(prompt, language, transcriptionText) {
    if (!this.isOllamaInitialized) {
      throw new Error('Ollama service not initialized. Please ensure Ollama is running and models are installed.');
    }
    
    try {
      console.log('Attempting report generation with Ollama (local processing)...');
      
      const result = await this.ollamaService.generateReport(prompt, language);
      console.log(`Successfully generated report with Ollama (model: ${result.model})`);
      
      // Cache the successful response
      const cacheKey = this.generateCacheKey(transcriptionText, language, 'report');
      const response = {
        ...result,
        provider: 'ollama-local',
        fallback: false
      };
      
      this.setCachedResponse(cacheKey, response);
      return response;
      
    } catch (error) {
      console.error('Ollama report generation failed:', error.message);
      throw new Error(`Local model processing failed: ${error.message}. Please check Ollama setup and model availability.`);
    }
  }
}

module.exports = MultiLLMService;