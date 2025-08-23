/**
 * Advanced ICD-10-GM Matcher with Semantic Search
 * Implements multiple search algorithms for better ICD code matching
 * Supports fuzzy matching, semantic similarity, and German medical terminology
 */

const Fuse = require('fuse.js');
const { PrismaClient } = require('@prisma/client');

class AdvancedICDMatcher {
  constructor() {
    this.prisma = new PrismaClient();
    this.fuseIndex = null;
    this.icdCache = new Map();
    this.semanticWeights = {
      exact: 1.0,
      fuzzy: 0.8,
      semantic: 0.6,
      chapter: 0.4,
      category: 0.3
    };
    
    // German medical terminology mappings
    this.germanMedicalTerms = {
      'krebs': ['neoplasm', 'tumor', 'cancer', 'karzinom'],
      'schmerz': ['pain', 'ache', 'dolor'],
      'entzündung': ['inflammation', 'infection', 'itis'],
      'blutung': ['bleeding', 'hemorrhage', 'hämorrhagie'],
      'bruch': ['fracture', 'break', 'fraktur'],
      'infektion': ['infection', 'sepsis', 'bakteriell'],
      'herz': ['cardiac', 'coronary', 'myokard'],
      'lunge': ['pulmonary', 'respiratory', 'bronchial'],
      'niere': ['renal', 'kidney', 'nephro'],
      'leber': ['hepatic', 'liver', 'hepato'],
      'gehirn': ['cerebral', 'brain', 'neural'],
      'knochen': ['bone', 'skeletal', 'osseous'],
      'muskel': ['muscle', 'muscular', 'myopathy'],
      'haut': ['skin', 'dermal', 'cutaneous'],
      'auge': ['ocular', 'ophthalmic', 'visual'],
      'ohr': ['auditory', 'otic', 'hearing']
    };
    
    // Medical context patterns
    this.contextPatterns = {
      temporal: ['akut', 'chronisch', 'subakut', 'rezidivierend'],
      anatomical: ['rechts', 'links', 'bilateral', 'zentral', 'peripher'],
      severity: ['leicht', 'schwer', 'moderat', 'kompliziert'],
      pathology: ['maligne', 'benigne', 'entzündlich', 'degenerativ']
    };
  }

  /**
   * Initialize the matcher with ICD database
   */
  async initialize() {
    try {
      console.log('🔄 Initializing Advanced ICD Matcher...');
      
      // Load all ICD codes from database
      const icdCodes = await this.prisma.iCDCode.findMany({
        select: {
          icdCode: true,
          label: true,
          chapterNr: true,
          level: true,
          terminal: true
        }
      });
      
      console.log(`📊 Loaded ${icdCodes.length} ICD codes for advanced matching`);
      
      // Build cache for quick lookup
      icdCodes.forEach(code => {
        this.icdCache.set(code.icdCode, code);
      });
      
      // Initialize Fuse.js for fuzzy search
      const fuseOptions = {
        keys: [
          { name: 'icdCode', weight: 0.4 },
          { name: 'label', weight: 0.6 }
        ],
        threshold: 0.6, // More lenient fuzzy matching
        includeScore: true,
        includeMatches: true,
        minMatchCharLength: 2,
        ignoreLocation: true
      };
      
      this.fuseIndex = new Fuse(icdCodes, fuseOptions);
      console.log('✅ Advanced ICD Matcher initialized successfully');
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Advanced ICD Matcher:', error);
      throw error;
    }
  }

  /**
   * Advanced search with multiple algorithms
   */
  async search(query, options = {}) {
    const {
      maxResults = 10,
      includeMetadata = true,
      preferredChapters = [],
      minimumScore = 0.1
    } = options;

    if (!query || query.trim().length < 2) {
      return [];
    }

    const normalizedQuery = this.normalizeGermanText(query.trim());
    const results = new Map();

    try {
      // 1. Exact match search
      const exactMatches = await this.exactSearch(normalizedQuery);
      this.mergeResults(results, exactMatches, this.semanticWeights.exact);

      // 2. Fuzzy search using Fuse.js
      const fuzzyMatches = await this.fuzzySearch(normalizedQuery);
      this.mergeResults(results, fuzzyMatches, this.semanticWeights.fuzzy);

      // 3. Semantic search with German medical terms
      const semanticMatches = await this.semanticSearch(normalizedQuery);
      this.mergeResults(results, semanticMatches, this.semanticWeights.semantic);

      // 4. Chapter-based contextual search
      const chapterMatches = await this.chapterSearch(normalizedQuery, preferredChapters);
      this.mergeResults(results, chapterMatches, this.semanticWeights.chapter);

      // 5. Category-based search
      const categoryMatches = await this.categorySearch(normalizedQuery);
      this.mergeResults(results, categoryMatches, this.semanticWeights.category);

      // Convert to array and sort by combined score
      let finalResults = Array.from(results.values())
        .filter(result => result.combinedScore >= minimumScore)
        .sort((a, b) => b.combinedScore - a.combinedScore)
        .slice(0, maxResults);

      // Add metadata if requested
      if (includeMetadata) {
        finalResults = finalResults.map(result => ({
          ...result,
          metadata: this.generateMetadata(result, normalizedQuery)
        }));
      }

      return finalResults;

    } catch (error) {
      console.error('❌ Advanced search error:', error);
      return [];
    }
  }

  /**
   * Exact match search
   */
  async exactSearch(query) {
    const results = [];
    
    // Direct code match (e.g., "C50.1")
    if (this.icdCache.has(query.toUpperCase())) {
      const code = this.icdCache.get(query.toUpperCase());
      results.push({
        ...code,
        matchType: 'exact_code',
        score: 1.0
      });
    }

    // Exact description match
    try {
      const exactDescMatches = await this.prisma.iCDCode.findMany({
        where: {
          label: {
            equals: query,
            mode: 'insensitive'
          }
        },
        take: 5
      });

      exactDescMatches.forEach(code => {
        results.push({
          ...code,
          matchType: 'exact_description',
          score: 0.95
        });
      });
    } catch (error) {
      console.warn('Exact search query failed:', error.message);
    }

    return results;
  }

  /**
   * Fuzzy search using Fuse.js
   */
  async fuzzySearch(query) {
    if (!this.fuseIndex) return [];

    const fuseResults = this.fuseIndex.search(query);
    
    return fuseResults.map(result => ({
      ...result.item,
      matchType: 'fuzzy',
      score: 1 - result.score, // Invert Fuse.js score (lower is better)
      matches: result.matches
    }));
  }

  /**
   * Semantic search using German medical terminology
   */
  async semanticSearch(query) {
    const results = [];
    const queryLower = query.toLowerCase();

    // Expand query with German medical synonyms
    const expandedTerms = new Set([queryLower]);
    
    Object.entries(this.germanMedicalTerms).forEach(([german, synonyms]) => {
      if (queryLower.includes(german)) {
        synonyms.forEach(synonym => expandedTerms.add(synonym.toLowerCase()));
      }
    });

    // Search with expanded terms
    for (const term of expandedTerms) {
      try {
        const semanticMatches = await this.prisma.iCDCode.findMany({
          where: {
            OR: [
              {
                label: {
                  contains: term,
                  mode: 'insensitive'
                }
              },
              {
                icdCode: {
                  startsWith: term.toUpperCase()
                }
              }
            ]
          },
          take: 15
        });

        semanticMatches.forEach(code => {
          results.push({
            ...code,
            matchType: 'semantic',
            score: term === queryLower ? 0.9 : 0.7,
            matchedTerm: term
          });
        });
      } catch (error) {
        console.warn(`Semantic search failed for term "${term}":`, error.message);
      }
    }

    return results;
  }

  /**
   * Chapter-based contextual search
   */
  async chapterSearch(query, preferredChapters = []) {
    const results = [];
    const queryLower = query.toLowerCase();

    // Determine relevant chapters based on query content
    const relevantChapters = this.identifyRelevantChapters(queryLower);
    const chaptersToSearch = preferredChapters.length > 0 ? preferredChapters : relevantChapters;

    if (chaptersToSearch.length === 0) return results;

    try {
      const chapterMatches = await this.prisma.iCDCode.findMany({
        where: {
          AND: [
            {
              chapterNr: {
                in: chaptersToSearch
              }
            },
            {
              label: {
                contains: query,
                mode: 'insensitive'
              }
            }
          ]
        },
        take: 20
      });

      chapterMatches.forEach(code => {
        results.push({
          ...code,
          matchType: 'chapter_context',
          score: 0.6,
          relevantChapters: chaptersToSearch
        });
      });
    } catch (error) {
      console.warn('Chapter search failed:', error.message);
    }

    return results;
  }

  /**
   * Category-based search for imaging types
   */
  async categorySearch(query) {
    const results = [];
    const queryLower = query.toLowerCase();

    // Determine imaging category based on query
    let searchCategory = 'general';
    if (queryLower.includes('mamma') || queryLower.includes('brust')) {
      searchCategory = 'mammography';
    } else if (queryLower.includes('lunge') || queryLower.includes('thorax')) {
      searchCategory = 'ct';
    } else if (queryLower.includes('gehirn') || queryLower.includes('kopf') || queryLower.includes('wirbel')) {
      searchCategory = 'mrt';
    }

    // This is a placeholder - in a real system, you'd have category metadata
    // For now, we'll use chapter-based approximation
    const categoryChapterMap = {
      'mammography': [2, 14], // Neoplasms, Genitourinary
      'ct': [2, 10, 11, 19], // Neoplasms, Respiratory, Digestive, Injury
      'mrt': [2, 6, 13], // Neoplasms, Nervous, Musculoskeletal
      'general': [18] // Symptoms
    };

    const chapters = categoryChapterMap[searchCategory] || [];
    
    if (chapters.length > 0) {
      try {
        const categoryMatches = await this.prisma.iCDCode.findMany({
          where: {
            chapterNr: {
              in: chapters
            }
          },
          take: 10
        });

        categoryMatches.forEach(code => {
          results.push({
            ...code,
            matchType: 'category',
            score: 0.4,
            inferredCategory: searchCategory
          });
        });
      } catch (error) {
        console.warn('Category search failed:', error.message);
      }
    }

    return results;
  }

  /**
   * Merge results from different search methods
   */
  mergeResults(resultsMap, newResults, weight) {
    newResults.forEach(result => {
      const key = result.icdCode;
      
      if (resultsMap.has(key)) {
        // Combine scores from different methods
        const existing = resultsMap.get(key);
        existing.combinedScore = Math.max(existing.combinedScore, result.score * weight);
        existing.searchMethods.push({
          type: result.matchType,
          score: result.score,
          weight: weight
        });
      } else {
        // Add new result
        resultsMap.set(key, {
          ...result,
          combinedScore: result.score * weight,
          searchMethods: [{
            type: result.matchType,
            score: result.score,
            weight: weight
          }]
        });
      }
    });
  }

  /**
   * Identify relevant chapters based on query content
   */
  identifyRelevantChapters(query) {
    const chapters = [];
    
    // Cancer/tumor terms
    if (query.includes('krebs') || query.includes('tumor') || query.includes('karzinom') || query.includes('neoplasm')) {
      chapters.push(2); // Neoplasms
    }
    
    // Heart/circulatory terms
    if (query.includes('herz') || query.includes('kardial') || query.includes('infarkt')) {
      chapters.push(9); // Circulatory
    }
    
    // Lung/respiratory terms
    if (query.includes('lunge') || query.includes('bronch') || query.includes('pneumo')) {
      chapters.push(10); // Respiratory
    }
    
    // Bone/joint terms
    if (query.includes('knochen') || query.includes('gelenk') || query.includes('wirbel')) {
      chapters.push(13); // Musculoskeletal
    }
    
    // Brain/nervous terms
    if (query.includes('gehirn') || query.includes('neural') || query.includes('zerebral')) {
      chapters.push(6); // Nervous system
    }
    
    // If no specific chapters identified, include common ones
    if (chapters.length === 0) {
      chapters.push(2, 18, 19); // Neoplasms, Symptoms, Injury
    }
    
    return chapters;
  }

  /**
   * Generate metadata for search results
   */
  generateMetadata(result, originalQuery) {
    return {
      originalQuery: originalQuery,
      searchAlgorithmsUsed: result.searchMethods.map(m => m.type),
      confidenceLevel: this.getConfidenceLevel(result.combinedScore),
      chapterInfo: this.getChapterInfo(result.chapterNr),
      recommendedFor: this.getRecommendations(result)
    };
  }

  /**
   * Get confidence level based on score
   */
  getConfidenceLevel(score) {
    if (score >= 0.8) return 'high';
    if (score >= 0.5) return 'medium';
    if (score >= 0.3) return 'low';
    return 'very_low';
  }

  /**
   * Get chapter information
   */
  getChapterInfo(chapterNr) {
    const chapterNames = {
      1: 'Infectious and parasitic diseases',
      2: 'Neoplasms',
      3: 'Blood and blood-forming organs',
      4: 'Endocrine, nutritional and metabolic diseases',
      5: 'Mental and behavioural disorders',
      6: 'Nervous system',
      7: 'Eye and adnexa',
      8: 'Ear and mastoid process',
      9: 'Circulatory system',
      10: 'Respiratory system',
      11: 'Digestive system',
      12: 'Skin and subcutaneous tissue',
      13: 'Musculoskeletal system and connective tissue',
      14: 'Genitourinary system',
      15: 'Pregnancy, childbirth and the puerperium',
      16: 'Certain conditions originating in the perinatal period',
      17: 'Congenital malformations, deformations and chromosomal abnormalities',
      18: 'Symptoms, signs and abnormal clinical and laboratory findings',
      19: 'Injury, poisoning and certain other consequences of external causes',
      20: 'External causes of morbidity and mortality',
      21: 'Factors influencing health status and contact with health services',
      22: 'Codes for special purposes'
    };
    
    return {
      number: chapterNr,
      name: chapterNames[chapterNr] || 'Unknown',
      germanName: this.getGermanChapterName(chapterNr)
    };
  }

  /**
   * Get German chapter name
   */
  getGermanChapterName(chapterNr) {
    const germanNames = {
      1: 'Bestimmte infektiöse und parasitäre Krankheiten',
      2: 'Neubildungen',
      3: 'Krankheiten des Blutes und der blutbildenden Organe',
      4: 'Endokrine, Ernährungs- und Stoffwechselkrankheiten',
      5: 'Psychische und Verhaltensstörungen',
      6: 'Krankheiten des Nervensystems',
      7: 'Krankheiten des Auges und der Augenanhangsgebilde',
      8: 'Krankheiten des Ohres und des Warzenfortsatzes',
      9: 'Krankheiten des Kreislaufsystems',
      10: 'Krankheiten des Atmungssystems',
      11: 'Krankheiten des Verdauungssystems',
      12: 'Krankheiten der Haut und der Unterhaut',
      13: 'Krankheiten des Muskel-Skelett-Systems und des Bindegewebes',
      14: 'Krankheiten des Urogenitalsystems',
      15: 'Schwangerschaft, Geburt und Wochenbett',
      16: 'Bestimmte Zustände mit Ursprung in der Perinatalperiode',
      17: 'Angeborene Fehlbildungen, Deformitäten und Chromosomenanomalien',
      18: 'Symptome und abnorme klinische und Laborbefunde',
      19: 'Verletzungen, Vergiftungen und bestimmte andere Folgen äußerer Ursachen',
      20: 'Äußere Ursachen von Morbidität und Mortalität',
      21: 'Faktoren, die den Gesundheitszustand beeinflussen',
      22: 'Schlüsselnummern für besondere Zwecke'
    };
    
    return germanNames[chapterNr] || 'Unbekannt';
  }

  /**
   * Get recommendations based on result
   */
  getRecommendations(result) {
    const recommendations = [];
    
    if (result.chapterNr === 2) {
      recommendations.push('Consider imaging studies for staging');
      recommendations.push('Histological confirmation recommended');
    } else if (result.chapterNr === 13) {
      recommendations.push('MRI may be helpful for detailed assessment');
      recommendations.push('Consider functional imaging if indicated');
    } else if (result.chapterNr === 10) {
      recommendations.push('Chest CT recommended for pulmonary conditions');
      recommendations.push('Consider pulmonary function tests');
    }
    
    return recommendations;
  }

  /**
   * Normalize German text for better matching
   */
  normalizeGermanText(text) {
    return text
      .toLowerCase()
      .replace(/ä/g, 'ae')
      .replace(/ö/g, 'oe')
      .replace(/ü/g, 'ue')
      .replace(/ß/g, 'ss')
      .replace(/[^\w\s.-]/g, '') // Remove special characters except dots and hyphens
      .trim();
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    if (this.prisma) {
      await this.prisma.$disconnect();
    }
  }
}

module.exports = AdvancedICDMatcher;