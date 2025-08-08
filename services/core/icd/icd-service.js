const crypto = require('crypto');

/**
 * ICD-10-GM Code Prediction Service
 * Specialized for German medical coding with radiology focus
 */
class ICDService {
  constructor(multiLLMService) {
    this.llmService = multiLLMService;
    
    // Cache for ICD predictions
    this.cache = new Map();
    this.CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours for ICD codes
    this.MAX_CACHE_SIZE = 200;
    
    console.log('ICDService initialized with Multi-LLM integration');
  }
  
  /**
   * Generate cache key for ICD predictions
   */
  generateCacheKey(findings, impression, agentType = 'general') {
    const hash = crypto.createHash('sha256');
    hash.update(`icd:${agentType}:${findings}:${impression}`);
    return hash.digest('hex');
  }
  
  /**
   * Get cached ICD predictions if available and not expired
   */
  getCachedPrediction(key) {
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    const now = Date.now();
    if (now - cached.timestamp > this.CACHE_TTL) {
      this.cache.delete(key);
      return null;
    }
    
    console.log(`ICD cache hit for key: ${key.substring(0, 8)}...`);
    return cached.data;
  }
  
  /**
   * Store ICD predictions in cache
   */
  setCachedPrediction(key, data) {
    // Implement LRU eviction if cache is full
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
      console.log(`ICD cache eviction: removed oldest entry`);
    }
    
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
    console.log(`Cached ICD prediction for key: ${key.substring(0, 8)}... (cache size: ${this.cache.size})`);
  }
  
  /**
   * Predict ICD-10-GM codes based on medical findings and impression
   */
  async predictICDCodes(findings, impression, agentType = 'general', language = 'de') {
    try {
      // Check cache first
      const cacheKey = this.generateCacheKey(findings, impression, agentType);
      const cachedResult = this.getCachedPrediction(cacheKey);
      if (cachedResult) {
        return {
          ...cachedResult,
          cached: true
        };
      }
      
      console.log(`Generating ICD-10-GM predictions for ${agentType} agent...`);
      
      const prompt = this.createICDPrompt(findings, impression, agentType, language);
      
      // Use the Multi-LLM service directly with specialized ICD context
      const response = await this.callLLMDirectly(prompt, language);
      
      let icdResult;
      if (typeof response === 'string') {
        icdResult = this.parseICDResponse(response);
      } else if (response.findings && typeof response.findings === 'object') {
        // If the LLM returns structured data, extract ICD codes
        icdResult = this.extractICDFromStructured(response);
      } else {
        icdResult = this.parseICDResponse(JSON.stringify(response));
      }
      
      // Add metadata
      const finalResult = {
        ...icdResult,
        agentType,
        language,
        provider: response.provider,
        timestamp: new Date().toISOString()
      };
      
      // Cache the result
      this.setCachedPrediction(cacheKey, finalResult);
      
      console.log(`Generated ${finalResult.codes?.length || 0} ICD-10-GM predictions with ${response.provider}`);
      return finalResult;
      
    } catch (error) {
      console.error('ICD prediction error:', error.message);
      
      // Return fallback predictions based on keywords
      return this.getFallbackICDCodes(findings, impression, agentType);
    }
  }
  
  /**
   * Call LLM directly for ICD predictions with proper JSON formatting
   */
  async callLLMDirectly(prompt, language) {
    // Check if we have any providers
    if (!this.llmService.providers || this.llmService.providers.length === 0) {
      throw new Error('No LLM providers available for ICD prediction');
    }
    
    // Try each provider in the multi-LLM service order
    for (const provider of this.llmService.providers) {
      try {
        console.log(`Attempting ICD prediction with ${provider.name}...`);
        
        if (provider.name === 'gemini') {
          return await this.callGeminiForICD(prompt);
        } else if (provider.name === 'claude') {
          return await this.callClaudeForICD(prompt);
        } else if (provider.name === 'openai') {
          return await this.callOpenAIForICD(prompt);
        }
        
      } catch (error) {
        console.error(`${provider.name} failed for ICD prediction:`, error.message);
        continue;
      }
    }
    
    throw new Error('All LLM providers failed for ICD prediction');
  }
  
  /**
   * Call Gemini specifically for ICD predictions
   */
  async callGeminiForICD(prompt) {
    const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GOOGLE_API_KEY}`, {
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
          temperature: 0.2,
          maxOutputTokens: 2000
        }
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${error}`);
    }
    
    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  }
  
  /**
   * Call Claude specifically for ICD predictions
   */
  async callClaudeForICD(prompt) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: process.env.CLAUDE_MODEL || 'claude-3-opus-20240229',
        max_tokens: 2000,
        temperature: 0.2,
        messages: [{
          role: 'user',
          content: prompt
        }]
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Claude API error: ${response.status} - ${error}`);
    }
    
    const data = await response.json();
    return data.content[0].text;
  }
  
  /**
   * Call OpenAI specifically for ICD predictions
   */
  async callOpenAIForICD(prompt) {
    const OpenAI = require('openai');
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 30 * 1000
    });
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "Sie sind ein medizinischer Kodierspezialist für ICD-10-GM. Antworten Sie NUR mit gültigem JSON."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.2,
      max_tokens: 2000,
      response_format: { type: "json_object" }
    });
    
    return completion.choices[0].message.content;
  }
  
  /**
   * Create specialized prompt for ICD-10-GM code prediction
   */
  createICDPrompt(findings, impression, agentType, language) {
    const agentSpecializations = {
      cardiac: 'Kardiologie und Herz-Kreislauf-Erkrankungen',
      oncology: 'Onkologie und Tumorerkrankungen',
      mammography: 'Mammographie und Brusterkrankungen',
      'ct-scan': 'CT-Diagnostik und Schnittbildgebung',
      'spine-mri': 'Wirbelsäulen-MRT und Orthopädie',
      ultrasound: 'Sonographie und Ultraschalldiagnostik',
      pathology: 'Pathologie und Gewebeuntersuchungen',
      general: 'Allgemeine Radiologie'
    };
    
    const specialization = agentSpecializations[agentType] || agentSpecializations.general;
    
    return `Sie sind ein medizinischer Kodierspezialist für ICD-10-GM mit Schwerpunkt ${specialization}.

MEDIZINISCHE BEFUNDE:
${findings}

BEURTEILUNG:
${impression}

AUFGABE:
Analysieren Sie die medizinischen Befunde und Beurteilung und schlagen Sie die passendsten ICD-10-GM Codes vor.

WICHTIGE ANFORDERUNGEN:
- Verwenden Sie NUR offizielle deutsche ICD-10-GM Codes (aktuelle Version)
- Berücksichtigen Sie die Spezialisierung: ${specialization}
- Priorisieren Sie radiologisch relevante Diagnosen
- Geben Sie realistische Konfidenzwerte an (0.0-1.0)
- Bewerten Sie die radiologische Relevanz (0.0-1.0)
- Sortieren Sie nach klinischer Priorität (Hauptdiagnosen zuerst)

AUSGABEFORMAT:
Antworten Sie NUR mit folgendem JSON-Format:

{
  "codes": [
    {
      "code": "ICD-10-GM Code (z.B. C78.0)",
      "description": "Deutsche Beschreibung der Diagnose",
      "confidence": 0.95,
      "radiologyRelevance": 0.9,
      "priority": "primary|secondary|differential",
      "category": "Kategoriename (z.B. Neoplasien, Herz-Kreislauf, etc.)",
      "reasoning": "Kurze Begründung für diese Kodierung"
    }
  ],
  "summary": {
    "totalCodes": 3,
    "primaryDiagnoses": 1,
    "secondaryDiagnoses": 2,
    "averageConfidence": 0.87
  }
}

BEISPIEL-KATEGORIEN:
- Neoplasien (C00-D48)
- Herz-Kreislauf-System (I00-I99)  
- Atmungssystem (J00-J99)
- Muskel-Skelett-System (M00-M99)
- Urogenitalsystem (N00-N99)
- Nervensystem (G00-G99)

WICHTIG: 
- Maximal 5 Codes vorschlagen
- Nur Codes verwenden, die durch die Befunde gestützt sind
- Bei Unsicherheit niedrigere Konfidenzwerte angeben
- Keine spekulativen Diagnosen

Antworten Sie NUR mit dem JSON-Objekt, keine zusätzlichen Erklärungen.`;
  }
  
  /**
   * Parse ICD response from LLM
   */
  parseICDResponse(responseText) {
    try {
      // Try to extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        // Validate structure
        if (parsed.codes && Array.isArray(parsed.codes)) {
          return {
            codes: parsed.codes.map(code => ({
              code: code.code || '',
              description: code.description || '',
              confidence: Math.min(Math.max(code.confidence || 0.5, 0.0), 1.0),
              radiologyRelevance: Math.min(Math.max(code.radiologyRelevance || 0.5, 0.0), 1.0),
              priority: code.priority || 'secondary',
              category: code.category || 'Sonstige',
              reasoning: code.reasoning || 'Basierend auf medizinischen Befunden'
            })),
            summary: parsed.summary || {
              totalCodes: parsed.codes.length,
              primaryDiagnoses: parsed.codes.filter(c => c.priority === 'primary').length,
              secondaryDiagnoses: parsed.codes.filter(c => c.priority === 'secondary').length,
              averageConfidence: parsed.codes.reduce((sum, c) => sum + (c.confidence || 0.5), 0) / parsed.codes.length
            }
          };
        }
      }
      
      // Fallback: try to extract codes from text
      return this.extractICDFromText(responseText);
      
    } catch (error) {
      console.error('Error parsing ICD response:', error.message);
      return this.extractICDFromText(responseText);
    }
  }
  
  /**
   * Extract ICD codes from structured response
   */
  extractICDFromStructured(response) {
    // If the multi-LLM service returned a structured response, try to find ICD codes
    const codes = [];
    
    // Look for ICD codes in various fields
    const searchFields = [
      response.technicalDetails,
      response.findings?.content || response.findings,
      response.impression,
      response.recommendations
    ];
    
    for (const field of searchFields) {
      if (field && typeof field === 'string') {
        const extractedCodes = this.extractICDCodesFromText(field);
        codes.push(...extractedCodes);
      }
    }
    
    return {
      codes: codes.slice(0, 5), // Limit to 5 codes
      summary: {
        totalCodes: codes.length,
        primaryDiagnoses: codes.filter(c => c.priority === 'primary').length,
        secondaryDiagnoses: codes.length - codes.filter(c => c.priority === 'primary').length,
        averageConfidence: codes.reduce((sum, c) => sum + c.confidence, 0) / Math.max(codes.length, 1)
      }
    };
  }
  
  /**
   * Extract ICD codes from plain text
   */
  extractICDFromText(text) {
    const codes = this.extractICDCodesFromText(text);
    
    return {
      codes: codes.slice(0, 5),
      summary: {
        totalCodes: codes.length,
        primaryDiagnoses: 0,
        secondaryDiagnoses: codes.length,
        averageConfidence: 0.6
      }
    };
  }
  
  /**
   * Extract ICD-10-GM codes from text using patterns
   */
  extractICDCodesFromText(text) {
    const codes = [];
    
    // ICD-10-GM pattern: Letter followed by 2-3 digits, optional dot and 1-2 more digits
    const icdPattern = /\b([A-Z]\d{2}(?:\.\d{1,2})?)\b/g;
    const matches = text.match(icdPattern) || [];
    
    for (const match of matches) {
      codes.push({
        code: match,
        description: `ICD-10-GM Code: ${match}`,
        confidence: 0.6,
        radiologyRelevance: 0.7,
        priority: 'secondary',
        category: this.getCategoryFromCode(match),
        reasoning: 'Aus Textanalyse extrahiert'
      });
    }
    
    return codes;
  }
  
  /**
   * Get category from ICD-10-GM code
   */
  getCategoryFromCode(code) {
    const firstChar = code.charAt(0);
    
    const categories = {
      'A': 'Infektionskrankheiten',
      'B': 'Infektionskrankheiten',
      'C': 'Neoplasien',
      'D': 'Neoplasien',
      'E': 'Endokrine Erkrankungen',
      'F': 'Psychische Erkrankungen',
      'G': 'Nervensystem',
      'H': 'Sinnesorgane',
      'I': 'Herz-Kreislauf-System',
      'J': 'Atmungssystem',
      'K': 'Verdauungssystem',
      'L': 'Haut',
      'M': 'Muskel-Skelett-System',
      'N': 'Urogenitalsystem',
      'O': 'Schwangerschaft',
      'P': 'Perinatale Erkrankungen',
      'Q': 'Angeborene Fehlbildungen',
      'R': 'Symptome und Befunde',
      'S': 'Verletzungen',
      'T': 'Verletzungen',
      'U': 'Spezielle Zwecke',
      'V': 'Äußere Ursachen',
      'W': 'Äußere Ursachen',
      'X': 'Äußere Ursachen',
      'Y': 'Äußere Ursachen',
      'Z': 'Faktoren für Gesundheitszustand'
    };
    
    return categories[firstChar] || 'Sonstige';
  }
  
  /**
   * Get fallback ICD codes based on keywords
   */
  getFallbackICDCodes(findings, impression, agentType) {
    console.log('Using fallback ICD code prediction based on keywords...');
    
    const text = `${findings} ${impression}`.toLowerCase();
    const fallbackCodes = [];
    
    // Common radiology-relevant ICD codes based on keywords
    const keywordMapping = {
      // Oncology
      'tumor': { code: 'C80.9', description: 'Bösartige Neubildung, nicht näher bezeichnet', category: 'Neoplasien' },
      'karzinom': { code: 'C80.1', description: 'Bösartige Neubildung, nicht näher bezeichnet', category: 'Neoplasien' },
      'metastasen': { code: 'C77.9', description: 'Sekundäre und nicht näher bezeichnete bösartige Neubildung der Lymphknoten', category: 'Neoplasien' },
      'lungenkarzinom': { code: 'C78.0', description: 'Sekundäre bösartige Neubildung der Lunge', category: 'Neoplasien' },
      
      // Cardiac
      'herzinsuffizienz': { code: 'I50.9', description: 'Herzinsuffizienz, nicht näher bezeichnet', category: 'Herz-Kreislauf-System' },
      'myokardinfarkt': { code: 'I21.9', description: 'Akuter Myokardinfarkt, nicht näher bezeichnet', category: 'Herz-Kreislauf-System' },
      'koronare': { code: 'I25.9', description: 'Chronische ischämische Herzkrankheit, nicht näher bezeichnet', category: 'Herz-Kreislauf-System' },
      
      // Pulmonary
      'pneumonie': { code: 'J18.9', description: 'Pneumonie, nicht näher bezeichnet', category: 'Atmungssystem' },
      'lungenembolie': { code: 'I26.9', description: 'Lungenembolie ohne Angabe eines akuten Cor pulmonale', category: 'Herz-Kreislauf-System' },
      'pleuraerguss': { code: 'J94.8', description: 'Sonstige näher bezeichnete Krankheiten der Pleura', category: 'Atmungssystem' },
      
      // Musculoskeletal
      'fraktur': { code: 'S72.9', description: 'Fraktur des Femurs, Teil nicht näher bezeichnet', category: 'Verletzungen' },
      'arthrose': { code: 'M19.9', description: 'Arthrose, nicht näher bezeichnet', category: 'Muskel-Skelett-System' },
      'bandscheibenvorfall': { code: 'M51.9', description: 'Sonstige näher bezeichnete Bandscheibenschäden', category: 'Muskel-Skelett-System' },
      
      // General findings
      'entzündung': { code: 'K92.9', description: 'Krankheit des Verdauungssystems, nicht näher bezeichnet', category: 'Verdauungssystem' },
      'zyste': { code: 'N28.1', description: 'Zyste der Niere, erworben', category: 'Urogenitalsystem' }
    };
    
    // Check for keywords and add corresponding codes
    for (const [keyword, codeInfo] of Object.entries(keywordMapping)) {
      if (text.includes(keyword)) {
        fallbackCodes.push({
          code: codeInfo.code,
          description: codeInfo.description,
          confidence: 0.4, // Lower confidence for fallback
          radiologyRelevance: 0.6,
          priority: 'secondary',
          category: codeInfo.category,
          reasoning: `Fallback-Kodierung basierend auf Keyword: ${keyword}`
        });
      }
    }
    
    // If no codes found, add a general radiology code
    if (fallbackCodes.length === 0) {
      fallbackCodes.push({
        code: 'R93.8',
        description: 'Abnorme Befunde bei der bildgebenden Diagnostik sonstiger näher bezeichneter Körperstrukturen',
        confidence: 0.3,
        radiologyRelevance: 0.8,
        priority: 'secondary',
        category: 'Symptome und Befunde',
        reasoning: 'Allgemeine radiologische Befund-Kodierung'
      });
    }
    
    return {
      codes: fallbackCodes.slice(0, 3),
      summary: {
        totalCodes: fallbackCodes.length,
        primaryDiagnoses: 0,
        secondaryDiagnoses: fallbackCodes.length,
        averageConfidence: 0.4
      },
      fallback: true
    };
  }
}

module.exports = ICDService;