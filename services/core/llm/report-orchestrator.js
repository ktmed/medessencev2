/**
 * Medical Report Orchestrator
 * Routes reports to specialized parsing agents based on report type
 */

// Import specialized agents - only load the ones that exist
const availableAgents = {};

try {
  availableAgents.mammography = require('../agents/mammography-agent');
} catch (e) {}

try {
  availableAgents.spine_mri = require('../agents/spine-mri-agent');
} catch (e) {}

try {
  availableAgents.oncology = require('../agents/oncology-agent');
  console.log('Loaded oncology agent:', typeof availableAgents.oncology);
} catch (e) {
  console.error('Failed to load oncology agent:', e.message);
}

try {
  availableAgents.ct_scan = require('../agents/ct-scan-agent');
} catch (e) {}

try {
  availableAgents.ultrasound = require('../agents/ultrasound-agent');
} catch (e) {}

try {
  availableAgents.cardiac = require('../agents/cardiac-agent');
} catch (e) {}

try {
  availableAgents.pathology = require('../agents/pathology-agent');
} catch (e) {}

try {
  availableAgents.general = require('../agents/general-agent');
} catch (e) {}

class ReportOrchestrator {
  constructor(multiLLMService = null) {
    this.agents = {};
    this.classifier = new ReportClassifier();
    this.confidence_threshold = 0.6;
    this.llmService = multiLLMService;
    
    // Initialize agents
    this.initializeAgents();
  }

  /**
   * Initialize all specialized agents
   */
  initializeAgents() {
    // Initialize available specialized agents
    for (const [type, AgentClass] of Object.entries(availableAgents)) {
      if (AgentClass) {
        this.agents[type] = new AgentClass(this.llmService);
        console.log(`Initialized ${type} agent with LLM support`);
      }
    }
    
    // For any missing agents, use the base SpecializedAgent
    const allTypes = [
      'mammography', 'spine_mri', 'oncology', 'cardiac', 
      'pathology', 'ct_scan', 'ultrasound', 'general'
    ];
    
    for (const type of allTypes) {
      if (!this.agents[type]) {
        this.agents[type] = new SpecializedAgent(type, this.llmService);
        console.log(`Using base agent for ${type} with LLM support`);
      }
    }
  }

  /**
   * Process a medical report
   */
  async processReport(reportText, language = 'de', metadata = {}) {
    try {
      // 1. Classify report type
      const classification = await this.classifier.classify(reportText);
      console.log('Report classification:', classification);
      console.log('DEBUG: Ultrasound keywords present?', {
        hochfrequenz: reportText.toLowerCase().includes('hochfrequenz'),
        sonographie: reportText.toLowerCase().includes('sonographie'),
        ultraschall: reportText.toLowerCase().includes('ultraschall'),
        sono: reportText.toLowerCase().includes('sono'),
        doppler: reportText.toLowerCase().includes('doppler'),
        textPreview: reportText.substring(0, 200) + '...'
      });
      
      // 2. Select appropriate agent(s)
      let result;
      
      if (classification.confidence >= this.confidence_threshold) {
        // High confidence - use single specialized agent
        console.log(`🔍 Orchestrator Debug: Using single agent (${classification.type}), confidence: ${classification.confidence}`);
        const agent = this.agents[classification.type];
        result = await agent.parseReport(reportText, language, metadata);
        console.log(`🔍 Orchestrator Debug: Agent result has icdPredictions: ${!!result.icdPredictions}`);
        if (result.icdPredictions) {
          console.log(`🔍 Orchestrator Debug: ICD codes count: ${result.icdPredictions.codes?.length || 0}`);
        }
        
        // Ensure metadata includes agent information
        if (!result.metadata) {
          result.metadata = {};
        }
        result.metadata.agent = classification.type;
        result.type = classification.type;
      } else {
        // Low confidence - use ensemble approach
        console.log(`🔍 Orchestrator Debug: Using ensemble parsing, confidence: ${classification.confidence}`);
        result = await this.ensembleParsing(reportText, language, classification, metadata);
      }
      
      // 3. Add metadata
      result.classification = classification;
      result.orchestratorVersion = '1.0.0';
      result.processingTime = new Date().toISOString();
      
      // Final debug check before returning
      console.log(`🔍 Orchestrator Final: Result keys before return:`, Object.keys(result));
      console.log(`🔍 Orchestrator Final: Result has icdPredictions: ${!!result.icdPredictions}`);
      if (result.icdPredictions) {
        console.log(`🔍 Orchestrator Final: ICD codes count: ${result.icdPredictions.codes?.length || 0}`);
      }
      
      return result;
      
    } catch (error) {
      console.error('Orchestrator error:', error);
      
      // Fallback to general agent
      const generalAgent = this.agents.general;
      return await generalAgent.parseReport(reportText, language, metadata);
    }
  }

  /**
   * Ensemble parsing using multiple agents
   */
  async ensembleParsing(reportText, language, classification, metadata = {}) {
    console.log('Using ensemble parsing due to low confidence');
    
    // Get top 3 most likely report types
    const topTypes = classification.scores
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(item => item.type);
    
    // Run all relevant agents with metadata (including processing mode)
    const results = await Promise.all(
      topTypes.map(type => 
        this.agents[type].parseReport(reportText, language, metadata)
          .catch(err => ({ error: err.message, type }))
      )
    );
    
    // Merge results intelligently
    return this.mergeResults(results, classification);
  }

  /**
   * Merge results from multiple agents
   */
  mergeResults(results, classification) {
    const merged = {
      type: 'ensemble',
      confidence: classification.confidence,
      findings: '',
      impression: '',
      recommendations: '',
      technicalDetails: '',
      sections: {},
      agents_used: [],
      enhancedFindings: null,
      icdPredictions: null, // Add ICD predictions field
      metadata: {
        agent: classification.type, // Use the primary classification type as the agent
        agentsUsed: [],
        aiGenerated: false,
        aiProvider: null
      }
    };
    
    // Combine findings from all successful agents
    for (const result of results) {
      if (!result.error) {
        merged.agents_used.push(result.type);
        merged.metadata.agentsUsed.push(result.type);
        
        // Check if any result was AI-generated
        if (result.metadata?.aiGenerated) {
          merged.metadata.aiGenerated = true;
          merged.metadata.aiProvider = result.metadata.aiProvider;
        }
        
        // Merge sections - handle both string and object findings
        if (result.findings) {
          let findingsText = '';
          if (typeof result.findings === 'object' && result.findings.content) {
            // New structured findings format
            findingsText = result.findings.content;
          } else if (typeof result.findings === 'string') {
            findingsText = result.findings;
          } else if (typeof result.findings === 'object') {
            // Try to extract meaningful content from object
            findingsText = JSON.stringify(result.findings, null, 2);
          }
          
          if (findingsText) {
            merged.findings += (merged.findings ? '\n\n' : '') + findingsText;
          }
        }
        if (result.impression) merged.impression = result.impression; // Take the last one
        if (result.recommendations) merged.recommendations = result.recommendations;
        
        // Merge Enhanced Findings (take the first valid one)
        if (result.enhancedFindings && !merged.enhancedFindings) {
          merged.enhancedFindings = result.enhancedFindings;
        }
        
        // Merge ICD predictions (take the first valid one)
        if (result.icdPredictions && !merged.icdPredictions) {
          merged.icdPredictions = result.icdPredictions;
        }
        
        // Merge custom sections
        Object.assign(merged.sections, result.sections || {});
      }
    }
    
    return merged;
  }
}

/**
 * Report Type Classifier
 */
class ReportClassifier {
  constructor() {
    // Enhanced patterns based on 189k report dataset analysis
    // Weights adjusted to reflect actual prevalence: Ultrasound (49.3%), Mammography (46.4%), MRI (32.3%), CT (20.4%)
    this.patterns = {
      // Most common modalities get higher base weights
      ultrasound: {
        keywords: ['sonographie', 'ultraschall', 'doppler', 'echogen', 'hochfrequenz'],
        patterns: [/\d+\s*mhz/i, /flow|doppler/i, /hochfrequenzsonographie/i, /sonographisch/i, /sonographischen/i],
        weight: 2.0, // Highest weight - most common in dataset
        medicalTerms: ['zyste', 'zysten', 'lymphknoten', 'parenchymdichte'] // Common in ultrasound reports
      },
      mammography: {
        keywords: ['mammographie', 'birads', 'bi-rads', 'brustdichte', 'mamille', 'mamma', 'vollfeld'],
        patterns: [/kategorie\s*(rechts|links|beidseits)\s*\d+/i, /brustdichte\s*[a-d]/i, /mammakarzinom/i],
        weight: 1.9, // Second most common
        medicalTerms: ['mammakarzinom', 'verkalkung', 'mikroverkalkung', 'lymphknoten']
      },
      spine_mri: {
        keywords: ['lwk', 'bwk', 'hwk', 'bandscheibe', 'spinalkanal', 'wirbelkörper', 'mrt', 'magnetresonanz'],
        patterns: [/[lbh]wk\s*\d+\/?\d*/i, /segment\s*[lbh]\d+/i, /spondylchondrose/i, /neuroforamenstenose/i],
        weight: 1.6, // Third most common (MRI subcategory)
        medicalTerms: ['spondylchondrose', 'neuroforamenstenose', 'spinalkanalstenose', 'bandscheibenvorfall']
      },
      ct_scan: {
        keywords: ['computertomographie', ' ct ', 'kontrastmittel', 'hounsfield', 'multislice', 'spiral'],
        patterns: [/\d+\s*hu/i, /nativ|km|kontrastmittel/i, /multislice.?spiral/i],
        weight: 1.3, // Fourth most common
        medicalTerms: ['bronchialkarzinom', 'adenokarzinom', 'metastasen', 'lymphknoten']
      },
      oncology: {
        keywords: ['strahlentherapie', 'chemotherapie', 'radiotherapie', 'gy', 'gray', 'karzinom', 'metastase'],
        patterns: [/\d+\s*gy/i, /stadium\s*[ivx]+/i, /(mamma|bronchial|prostata)karzinom/i],
        weight: 1.5, // High clinical importance
        medicalTerms: ['mammakarzinom', 'bronchialkarzinom', 'adenokarzinom', 'prostatakarzinom', 'zweitkarzinom', 'metastasen']
      },
      cardiac: {
        keywords: ['herzecho', 'ekg', 'koronar', 'myokard', 'ejektionsfraktion', 'klappen', 'kardial'],
        patterns: [/ef\s*\d+%/i, /lvef/i, /cardiac/i],
        weight: 1.2,
        medicalTerms: ['kardial', 'myokard', 'koronar']
      },
      pathology: {
        keywords: ['histologie', 'zytologie', 'immunhistochemie', 'biopsie', 'malignität', 'grading', 'pathologie', 'makroskopie', 'mikroskopie', 'stanzbiopsie', 'gewebezylinder'],
        patterns: [/ki-?\d+/i, /grad\s*[g]\d/i, /gleason/i, /institut.*pathologie/i, /her2.*neu/i, /östrogen.*rezeptor/i, /progesteronrezeptor/i, /tubuläre.*ausbildung/i, /mitosenzahl/i],
        weight: 2.2, // Higher weight for pathology reports - they are highly specific
        medicalTerms: ['adenokarzinom', 'plattenepithelkarzinom', 'lymphadenopathie', 'invasives', 'karzinom', 'differenzierung', 'lymphgefäßinvasion', 'veneninvasion', 'tumorzellen', 'nicht-speziellen', 'elston', 'ellis']
      },
      // Add general category for miscellaneous reports
      general: {
        keywords: ['befund', 'beurteilung', 'diagnose', 'untersuchung'],
        patterns: [/diagnose/i, /erstdiagnose/i],
        weight: 0.8, // Lowest weight - catch-all category
        medicalTerms: ['diagnose', 'erstdiagnose', 'befund', 'beurteilung']
      }
    };
  }

  /**
   * Enhanced classification using dataset insights
   */
  async classify(reportText) {
    const textLower = reportText.toLowerCase();
    const scores = [];
    
    // Calculate scores for each report type
    for (const [type, config] of Object.entries(this.patterns)) {
      let score = 0;
      
      // 1. Check keywords (base scoring)
      const keywordMatches = config.keywords.filter(kw => textLower.includes(kw)).length;
      score += keywordMatches * config.weight;
      
      // 2. Check patterns (more specific, higher weight)
      const patternMatches = config.patterns.filter(pattern => pattern.test(reportText)).length;
      score += patternMatches * config.weight * 1.8;
      
      // 3. NEW: Check medical terms from dataset analysis
      if (config.medicalTerms) {
        const medicalTermMatches = config.medicalTerms.filter(term => textLower.includes(term)).length;
        score += medicalTermMatches * config.weight * 1.3; // Medical terms are highly indicative
      }
      
      // 4. NEW: Apply frequency boost based on dataset prevalence
      const frequencyBoosts = {
        'ultrasound': 1.2,    // 49.3% in dataset
        'mammography': 1.15,  // 46.4% in dataset  
        'spine_mri': 1.1,     // 32.3% (MRI subcategory)
        'ct_scan': 1.05,      // 20.4% in dataset
        'oncology': 1.0,      // Clinical importance override
        'cardiac': 0.95,
        'pathology': 0.95,
        'general': 0.9        // Lowest priority
      };
      
      score *= (frequencyBoosts[type] || 1.0);
      
      scores.push({ type, score });
    }
    
    // POST-PROCESSING: Handle combination reports (e.g., mammography + ultrasound)
    const mammographyScore = scores.find(s => s.type === 'mammography')?.score || 0;
    const ultrasoundScore = scores.find(s => s.type === 'ultrasound')?.score || 0;
    
    // If both mammography and ultrasound have significant scores, prioritize the one with stronger patterns
    if (mammographyScore > 5 && ultrasoundScore > 5) {
      const hasStrongUltrasound = /hochfrequenzsonographie|sonographisch|parenchymdichte/i.test(reportText);
      const hasStrongMammography = /bi-rads|birads|mammakarzinom|brustdichte/i.test(reportText);
      
      if (hasStrongUltrasound && !hasStrongMammography) {
        // Boost ultrasound score for combination reports with strong ultrasound indicators
        const ultrasoundIndex = scores.findIndex(s => s.type === 'ultrasound');
        if (ultrasoundIndex >= 0) {
          scores[ultrasoundIndex].score *= 1.5;
          console.log('DEBUG: Boosted ultrasound score for combination report');
        }
      }
    }
    
    // Sort by score
    scores.sort((a, b) => b.score - a.score);
    
    // Enhanced confidence calculation
    const topScore = scores[0].score;
    const secondScore = scores[1]?.score || 0;
    
    // If top score is significantly higher, increase confidence
    let confidence = 0;
    if (topScore > 0) {
      const scoreRatio = topScore / (topScore + secondScore);
      const scoreDifference = topScore - secondScore;
      
      // Boost confidence if there's a clear winner
      if (scoreDifference > 2.0) {
        confidence = Math.min(scoreRatio * 1.2, 1.0);
      } else {
        confidence = scoreRatio;
      }
    }
    
    return {
      type: scores[0].type || 'general',
      confidence: Math.min(confidence, 1.0),
      scores: scores.slice(0, 5) // Top 5 candidates
    };
  }
}

// Import base agent class
const SpecializedAgent = require('../agents/base-agent');

// Export classes individually to avoid circular dependencies
module.exports.ReportOrchestrator = ReportOrchestrator;
module.exports.ReportClassifier = ReportClassifier;
module.exports.SpecializedAgent = SpecializedAgent;