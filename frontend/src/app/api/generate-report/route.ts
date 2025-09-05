import { NextRequest, NextResponse } from 'next/server';
import { 
  GenerateReportRequestSchema,
  MedicalReportSchema,
  normalizeTimestamp,
  validateApiResponse
} from '@/lib/validation';
import { 
  withRequestValidation,
  withResponseValidation,
  withErrorHandling,
  createApiResponse,
  createErrorResponse,
  logApiMetrics
} from '@/lib/api-middleware';

const validateRequest = withRequestValidation(GenerateReportRequestSchema);
const validateResponse = withResponseValidation(MedicalReportSchema, 'Medical Report');

class SimpleMultiLLMService {
  private providers: Array<{name: string, handler: (prompt: string) => Promise<string>}> = [];

  constructor() {
    this.initializeProviders();
  }

  private async classifyWithOntology(text: string): Promise<{ type: string; agent: string; specialty: string; confidence: number } | null> {
    try {
      const ontologyUrl = process.env.ONTOLOGY_SERVICE_URL || 'http://localhost:8002';
      const extractUrl = `${ontologyUrl}/extract`;
      
      console.log('🧬 Attempting ontology-based classification...');
      console.log(`  Using ontology service at: ${ontologyUrl}`);
      
      // Use the extract endpoint to get medical entities
      const response = await fetch(extractUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Accept': 'application/json; charset=utf-8',
        },
        body: JSON.stringify({
          text: text.substring(0, 1500), // Send first 1500 chars for classification
          extract_relationships: false,
          extract_measurements: false
        }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Ontology service response:', JSON.stringify(result, null, 2));
        
        // Extract entities from the response
        const entities = result.entities || [];
        let detectedModality = 'general';
        let detectedType = 'General Radiology';
        let confidence = 0.7;
        
        // Build a text representation from extracted entities for classification
        const entityTexts = entities.map((e: any) => e.text?.toLowerCase() || '').join(' ');
        const entityCategories = entities.map((e: any) => e.category?.toLowerCase() || '').join(' ');
        const lowerText = (text.substring(0, 1500) + ' ' + entityTexts + ' ' + entityCategories).toLowerCase();
        
        console.log(`  📊 Found ${entities.length} medical entities`);
        if (entities.length > 0) {
          const categories = Array.from(new Set(entities.map((e: any) => e.category)));
          console.log(`  Entity categories: ${categories.join(', ')}`);
        }
        
        // Enhanced modality detection patterns based on medical terminology
        const modalityPatterns: Record<string, { keywords: string[], excludeKeywords?: string[], type: string, agent: string, priority?: number }> = {
          'pathology': {
            keywords: ['pathologie', 'pathology', 'histologie', 'histology', 'zytologie', 'cytology', 'biopsie', 'biopsy', 'histopatholog', 'immunhistochem', 'mikroskop', 'microscop', 'gewebsprobe', 'tissue', 'zellprobe', 'cell', 'färbung', 'staining'],
            excludeKeywords: ['tumor', 'karzinom', 'carcinoma', 'metastase', 'malign', 'lymphom', 'sarkom'],
            type: 'Pathology',
            agent: 'pathology_specialist',
            priority: 10
          },
          'oncology': {
            keywords: ['tumor', 'tumour', 'metastase', 'metastasis', 'karzinom', 'carcinoma', 'malign', 'neoplasm', 'lymphom', 'sarkom', 'chemotherap', 'radiotherap', 'pet-ct', 'pet/ct', 'staging', 'onkolog'],
            type: 'Oncology',
            agent: 'oncology_specialist',
            priority: 8
          },
          'mammography': {
            keywords: ['mammograph', 'mammografie', 'birads', 'bi-rads', 'breast screening', 'mamma-screening', 'mikrokalk', 'architectural distortion', 'mamma', 'breast', 'brust', 'axilla', 'lymphknoten axillär', 'mastopathie', 'fibroadenom'],
            type: 'Mammography',
            agent: 'mammography_specialist',
            priority: 9
          },
          'ultrasound': {
            keywords: ['ultraschall', 'sonograph', 'doppler', 'echo', 'schallkopf', 'transducer', 'b-mode', 'color flow'],
            type: 'Ultrasound',
            agent: 'ultrasound_specialist',
            priority: 6
          },
          'ct_chest': {
            keywords: ['chest ct', 'thorax ct', 'hrct', 'pulmonary ct', 'lung ct', 'mediastinum', 'pleura', 'bronchi'],
            type: 'Chest CT',
            agent: 'chest_ct_specialist',
            priority: 7
          },
          'ct_abdomen': {
            keywords: ['abdomen ct', 'abdominal ct', 'pelvis ct', 'liver ct', 'pancreas ct', 'kidney ct', 'intestin'],
            type: 'Abdominal CT',
            agent: 'abdominal_specialist',
            priority: 7
          },
          'mri_spine': {
            keywords: ['spine mri', 'wirbelsäule mrt', 'lumbar mri', 'cervical mri', 'thoracic mri', 'vertebra', 'disc', 'spinal'],
            type: 'Spine MRI',
            agent: 'spine_mri_specialist',
            priority: 7
          },
          'mri_brain': {
            keywords: ['brain mri', 'cerebral mri', 'kopf mrt', 'schädel mrt', 'neuroimaging', 'cranial', 'cerebr'],
            type: 'Brain MRI',
            agent: 'neuro_specialist',
            priority: 7
          },
          'cardiac': {
            keywords: ['cardiac', 'herz', 'coronary', 'myocardi', 'ventricle', 'atrium', 'ecg', 'angiograph'],
            type: 'Cardiac',
            agent: 'cardiac_specialist',
            priority: 7
          },
          'vascular': {
            keywords: ['vascular', 'vessel', 'artery', 'vein', 'angiograph', 'stenosis', 'aneurysm', 'thromb'],
            type: 'Vascular',
            agent: 'vascular_specialist',
            priority: 6
          },
          'musculoskeletal': {
            keywords: ['musculoskeletal', 'joint', 'bone', 'ligament', 'tendon', 'fracture', 'arthro', 'osteo'],
            type: 'Musculoskeletal',
            agent: 'musculoskeletal_specialist',
            priority: 6
          }
        };
        
        // Check if entity categories indicate specific specialties
        const hasPathologyCategory = entities.some((e: any) => 
          e.category?.toLowerCase().includes('pathology') || 
          e.category?.toLowerCase().includes('histology')
        );
        
        const hasMammographyCategory = entities.some((e: any) => 
          e.category?.toLowerCase().includes('mammography') || 
          e.category?.toLowerCase().includes('breast') ||
          e.category?.toLowerCase().includes('mamma')
        );
        
        // Score each modality based on keyword matches
        let bestMatch = { modality: 'general', type: 'General Radiology', agent: 'general_radiology_specialist', score: 0 };
        
        for (const [modality, config] of Object.entries(modalityPatterns)) {
          let score = 0;
          const matchedKeywords: string[] = [];
          
          // Check for exclusion keywords first (for pathology)
          if (config.excludeKeywords) {
            const hasExcludedTerms = config.excludeKeywords.some(keyword => lowerText.includes(keyword));
            if (hasExcludedTerms) {
              console.log(`  ❌ Skipping ${modality} due to exclusion keywords`);
              continue; // Skip this modality if exclusion keywords are found
            }
          }
          
          for (const keyword of config.keywords) {
            if (lowerText.includes(keyword)) {
              score += keyword.length > 10 ? 3 : keyword.length > 6 ? 2 : 1;
              matchedKeywords.push(keyword);
            }
          }
          
          // Apply priority boost if defined and keywords were matched
          if (config.priority && matchedKeywords.length > 0) {
            score += config.priority * 2; // Add priority as a boost, not a multiplier
          }
          
          // Boost pathology score if entity category indicates pathology
          if (modality === 'pathology' && hasPathologyCategory) {
            score += 10;
            console.log(`  🔬 Boosting pathology score due to entity category`);
          }
          
          // Boost mammography score if entity category indicates mammography
          if (modality === 'mammography' && hasMammographyCategory) {
            score += 10;
            console.log(`  🔬 Boosting mammography score due to entity category`);
          }
          
          if (score > bestMatch.score) {
            bestMatch = {
              modality,
              type: config.type,
              agent: config.agent,
              score
            };
            confidence = Math.min(0.95, 0.6 + (score * 0.05)); // Calculate confidence based on score
          }
          
          if (matchedKeywords.length > 0 || (modality === 'pathology' && hasPathologyCategory)) {
            console.log(`  📊 ${modality}: score=${score}, priority=${config.priority || 0}, matches=[${matchedKeywords.join(', ')}]`);
          }
        }
        
        console.log(`  🎯 Best match: ${bestMatch.type} (agent: ${bestMatch.agent}, confidence: ${Math.round(confidence * 100)}%)`);
        
        return {
          type: bestMatch.type,
          agent: bestMatch.agent,
          specialty: bestMatch.modality,
          confidence: confidence
        };
      }
    } catch (error) {
      console.warn('⚠️ Ontology classification failed, falling back to rule-based:', error);
    }
    
    return null;
  }
  
  private async classifyWithLLM(text: string): Promise<{ type: string; agent: string; specialty: string; confidence: number } | null> {
    if (this.providers.length === 0) {
      console.warn('⚠️ No AI providers available for LLM classification');
      return null;
    }

    const classificationPrompt = `Classify this medical report into ONE of these specialties. Respond with ONLY the specialty name.

IMPORTANT DISTINCTIONS:
- pathology: histology, biopsy, tissue samples, microscopy, staining, cytology (WITHOUT cancer/tumor focus)
- oncology: cancer, tumor, metastasis, carcinoma, malignancy, lymphoma, chemotherapy, radiation
- mammography: breast imaging, mammogram, BI-RADS, breast screening
- ultrasound: sonography, ultrasound, doppler imaging
- ct_chest: chest CT scan, thorax CT, lung CT
- ct_abdomen: abdominal CT, pelvis CT, liver/kidney/intestinal CT
- mri_spine: spine MRI, vertebral MRI, disc imaging
- mri_brain: brain MRI, head MRI, neuroimaging
- cardiac: heart, coronary, myocardial imaging
- vascular: blood vessel, artery, vein imaging
- musculoskeletal: bone, joint, muscle, ligament imaging
- general: general radiology or unclear specialty

Medical text: ${text.substring(0, 1500)}

Specialty:`;

    try {
      console.log('🤖 Attempting LLM-based classification...');
      
      // Try the first available provider for classification
      const provider = this.providers[0];
      const response = await provider.handler(classificationPrompt);
      
      // Parse the response to extract specialty
      const specialty = response.trim().toLowerCase();
      console.log(`📋 LLM raw response: "${response}"`);
      
      // Validate and map the response to known specialties
      const specialtyMappings: Record<string, { type: string; agent: string; specialty: string }> = {
        'pathology': { type: 'Pathology', agent: 'pathology_specialist', specialty: 'pathology' },
        'oncology': { type: 'Oncology', agent: 'oncology_specialist', specialty: 'oncology' },
        'mammography': { type: 'Mammography', agent: 'mammography_specialist', specialty: 'mammography' },
        'ultrasound': { type: 'Ultrasound', agent: 'ultrasound_specialist', specialty: 'ultrasound' },
        'ct_chest': { type: 'Chest CT', agent: 'chest_ct_specialist', specialty: 'ct_chest' },
        'ct_abdomen': { type: 'Abdominal CT', agent: 'abdominal_specialist', specialty: 'ct_abdomen' },
        'mri_spine': { type: 'Spine MRI', agent: 'spine_mri_specialist', specialty: 'mri_spine' },
        'mri_brain': { type: 'Brain MRI', agent: 'neuro_specialist', specialty: 'mri_brain' },
        'cardiac': { type: 'Cardiac', agent: 'cardiac_specialist', specialty: 'cardiac' },
        'vascular': { type: 'Vascular', agent: 'vascular_specialist', specialty: 'vascular' },
        'musculoskeletal': { type: 'Musculoskeletal', agent: 'musculoskeletal_specialist', specialty: 'musculoskeletal' },
        'general': { type: 'General Radiology', agent: 'general_radiology_specialist', specialty: 'general' }
      };
      
      // Find matching specialty (allow for partial matches)
      let matchedSpecialty = null;
      for (const [key, value] of Object.entries(specialtyMappings)) {
        if (specialty.includes(key) || key.includes(specialty)) {
          matchedSpecialty = value;
          break;
        }
      }
      
      if (matchedSpecialty) {
        console.log(`✅ LLM classification successful: ${matchedSpecialty.type} (confidence: 85%)`);
        return {
          type: matchedSpecialty.type,
          agent: matchedSpecialty.agent,
          specialty: matchedSpecialty.specialty,
          confidence: 0.85 // High confidence for successful LLM classification
        };
      } else {
        console.warn(`⚠️ LLM returned unrecognized specialty: "${specialty}", falling back to general`);
        return {
          type: 'General Radiology',
          agent: 'general_radiology_specialist',
          specialty: 'general',
          confidence: 0.5
        };
      }
    } catch (error) {
      console.warn('⚠️ LLM classification failed:', error instanceof Error ? error.message : 'Unknown error');
      return null;
    }
  }
  
  private classifyMedicalContent(text: string): { type: string; agent: string; specialty: string; confidence: number } {
    const lowerText = text.toLowerCase();
    
    // Enhanced medical specialty patterns with ontology terms
    // Order matters: more specific patterns should come first
    const specialtyPatterns = {
      'pathology': {
        keywords: ['pathologie', 'pathology', 'histologie', 'histology', 'zytologie', 'cytology', 
                  'biopsie', 'biopsy', 'histopatholog', 'immunhistochem', 'mikroskop', 'microscop',
                  'gewebsprobe', 'tissue sample', 'zellprobe', 'cell sample', 'färbung', 'staining',
                  'pathologisch', 'pathological', 'befund pathologie', 'pathology report'],
        excludeKeywords: ['tumor', 'karzinom', 'carcinoma', 'metastase', 'malign', 'lymphom', 'sarkom'],
        agent: 'pathology_specialist',
        type: 'Pathology',
        priority: 9 // High priority for pathology-specific terms
      },
      'oncology': {
        keywords: ['tumor', 'tumour', 'metastase', 'metastasis', 'metastasen', 'karzinom', 'carcinoma', 
                  'malign', 'malignant', 'neoplasie', 'neoplasm', 'onkolog', 'oncolog', 'lymphom', 'lymphoma',
                  'leukämie', 'leukemia', 'sarkom', 'sarcoma', 'staging', 'chemotherapie', 'chemotherapy',
                  'radiotherapie', 'radiation', 'bestrahlung', 'remission', 'rezidiv', 'recurrence', 'pet-ct', 'pet/ct'],
        agent: 'oncology_specialist',
        type: 'Oncology',
        priority: 8 // Reduced priority - only if cancer-specific terms are found
      },
      'mammography': {
        keywords: ['mammo', 'mammographie', 'mammografie', 'breast', 'brust', 'brustdrüse', 'birads', 'bi-rads', 
                  'axilla', 'achselhöhle', 'lymphknoten axillär', 'mikrokalk', 'mikrokalifikation',
                  'mastopathie', 'fibroadenom', 'architectural distortion', 'mamma-screening', 'mammascreening'],
        excludeKeywords: ['ultraschall', 'sonographie', 'sono', 'mrt'], // Don't match if it's just breast ultrasound or MRI
        agent: 'mammography_specialist',
        type: 'Mammography',
        priority: 9 // High priority for specific mammography terms
      },
      'spine_mri': {
        keywords: ['wirbelsäule', 'columna vertebralis', 'spine', 'lumbar', 'cervical', 'thoracic', 
                  'lws', 'hws', 'bws', 'lendenwirbelsäule', 'halswirbelsäule', 'brustwirbelsäule',
                  'bandscheibe', 'diskus', 'disc', 'spinalkanal', 'neuroforamen', 'wirbelkörper', 'facettengelenk',
                  'spondylose', 'spondylolisthesis', 'protrusion', 'prolaps', 'sequester', 'vertebral', 'facet',
                  'mrt lws', 'mrt hws', 'mrt bws', 'wirbelsäulen-mrt'],
        agent: 'spine_mri_specialist',
        type: 'Spine MRI',
        priority: 7 // Specific MRI type
      },
      'chest_ct': {
        keywords: ['thorax', 'chest', 'lung', 'lunge', 'pulmonary', 'pulmonal', 'mediastinum', 'pleura',
                  'bronchien', 'bronchus', 'pneumonie', 'pneumothorax', 'hämatothorax', 'thoraxwand',
                  'rippenfraktur', 'lungenembolie', 'emphysem', 'atelektase', 'pneumo', 'bronch', 'rib', 'rippe',
                  'ct thorax', 'thorax-ct', 'lungen-ct', 'hrct'],
        agent: 'chest_ct_specialist',
        type: 'Chest CT',
        priority: 6 // Higher than general CT
      },
      'abdominal': {
        keywords: ['abdomen', 'bauch', 'bauchraum', 'liver', 'leber', 'hepatisch', 'kidney', 'niere', 'renal',
                  'pancreas', 'pankreas', 'spleen', 'milz', 'gallenblase', 'gallbladder', 'darm', 'intestinal',
                  'magen', 'gastric', 'colon', 'kolon', 'appendix', 'appendizitis', 'peritoneum'],
        agent: 'abdominal_specialist',
        type: 'Abdominal Imaging'
      },
      'cardiac': {
        keywords: ['cardiac', 'kardial', 'heart', 'herz', 'coronary', 'koronar', 'myocardial', 'myokard',
                  'perikard', 'pericardium', 'ventrikel', 'ventricle', 'atrium', 'vorhof', 'klappe', 'valve',
                  'aorta', 'echokardiographie', 'angiographie', 'koronarangiographie', 'ecg', 'ekg', 'echo'],
        agent: 'cardiac_specialist',
        type: 'Cardiac Imaging'
      },
      'neuro': {
        keywords: ['brain', 'gehirn', 'cerebral', 'zerebral', 'cranial', 'kranial', 'schädel', 'skull',
                  'neurological', 'neurologisch', 'zns', 'hirnnerv', 'liquor', 'ventrikelsystem',
                  'hypophyse', 'pituitary', 'meningeom', 'gliom', 'aneurysma', 'infarkt', 'schlaganfall', 'stroke'],
        agent: 'neuro_specialist',
        type: 'Neuroimaging'
      },
      'musculoskeletal': {
        keywords: ['joint', 'gelenk', 'bone', 'knochen', 'ossär', 'muscle', 'muskel', 'muskulatur',
                  'tendon', 'sehne', 'ligament', 'band', 'meniskus', 'meniscus', 'arthrose', 'arthritis',
                  'fraktur', 'fracture', 'luxation', 'ruptur', 'bursitis', 'synovitis', 'osteophyt'],
        agent: 'musculoskeletal_specialist',
        type: 'Musculoskeletal'
      },
      'vascular': {
        keywords: ['gefäß', 'vascular', 'arterie', 'artery', 'vene', 'vein', 'angiographie', 'angiography',
                  'stenose', 'stenosis', 'aneurysma', 'thrombose', 'embolie', 'doppler', 'farbdoppler',
                  'verschluss', 'occlusion', 'karotis', 'carotid'],
        agent: 'vascular_specialist',
        type: 'Vascular Imaging'
      },
      'ultrasound': {
        keywords: ['sonographie', 'sonografie', 'ultraschall', 'ultrasound', 'doppler', 'farbdoppler',
                  'schallkopf', 'echogenität', 'echoarm', 'echoreich', 'schallschatten', 'schallverstärkung',
                  'echogenic', 'hypoechoic', 'hyperechoic', 'anechoic', 'sono'],
        excludeKeywords: ['mammographie', 'mammografie', 'birads'], // Don't override mammography
        agent: 'ultrasound_specialist',
        type: 'Ultrasound',
        priority: 2 // Lower priority than specific modalities
      }
    };

    // Count weighted keyword matches
    let bestMatch = {
      type: 'General Radiology',
      agent: 'general_radiology_specialist',
      specialty: 'general',
      confidence: 0.5
    };
    let maxScore = 0;

    for (const [specialtyKey, data] of Object.entries(specialtyPatterns)) {
      let score = 0;
      let matchedKeywords: string[] = [];
      
      // Check for exclusion keywords first
      if ((data as any).excludeKeywords) {
        let hasExcludedTerm = false;
        for (const excludeKeyword of (data as any).excludeKeywords) {
          if (lowerText.includes(excludeKeyword)) {
            hasExcludedTerm = true;
            break;
          }
        }
        // Skip this specialty if it has excluded terms
        if (hasExcludedTerm) {
          console.log(`Skipping ${specialtyKey} due to exclusion keywords`);
          continue;
        }
      }

      for (const keyword of data.keywords) {
        if (lowerText.includes(keyword)) {
          // Weight scoring based on keyword specificity
          if (keyword.length > 10) {
            score += 4; // Very specific medical terms (increased weight)
          } else if (keyword.length > 6) {
            score += 2; // Moderately specific terms
          } else {
            score += 1; // Common abbreviations
          }
          matchedKeywords.push(keyword);
        }
      }

      // Apply priority multiplier if set
      const priority = (data as any).priority || 5;
      score = score * (priority / 5); // Normalize around priority 5
      
      // Bonus for multiple matches
      if (matchedKeywords.length > 2) {
        score *= 1.5;
      }
      
      // Log scoring for debugging
      if (score > 0) {
        console.log(`Specialty: ${specialtyKey}, Score: ${score}, Matched: [${matchedKeywords.join(', ')}]`);
      }

      if (score > maxScore) {
        maxScore = score;
        const confidence = Math.min((score / 15) + (matchedKeywords.length * 0.1), 1);
        bestMatch = {
          type: data.type,
          agent: data.agent,
          specialty: specialtyKey,
          confidence: confidence < 0.6 && score > 0 ? 0.6 : confidence
        };
      }

      if (matchedKeywords.length > 0) {
        console.log(`🔍 ${specialtyKey}: score=${score.toFixed(1)}, matches=[${matchedKeywords.join(', ')}]`);
      }
    }

    console.log(`🎯 Classification: ${bestMatch.type} (${Math.round(bestMatch.confidence * 100)}% confidence, score=${maxScore})`);
    return bestMatch;
  }

  private initializeProviders() {
    const providerPriority = (process.env.AI_PROVIDER_PRIORITY || 'gemini,openai,claude')
      .split(',')
      .map(p => p.trim());
    
    console.log('🚀 Initializing AI providers');
    console.log('- Provider priority:', providerPriority);
    
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
    
    // Try LLM-based classification first (primary method)
    let classification = await this.classifyWithLLM(transcriptionText);
    
    // Fall back to ontology-based classification if LLM fails
    if (!classification) {
      console.log('📋 LLM classification failed, trying ontology-based classification...');
      classification = await this.classifyWithOntology(transcriptionText);
    }
    
    // Final fallback to rule-based classification
    if (!classification) {
      console.log('📋 Using rule-based classification fallback');
      classification = this.classifyMedicalContent(transcriptionText);
    }
    
    console.log(`📋 Report Type: ${classification.type} | Agent: ${classification.agent} | Confidence: ${classification.confidence}`);
    // Classification already handled above
    
    if (this.providers.length === 0) {
      console.error('❌ No AI providers available');
      return this.generateFallbackReport(transcriptionText, language, classification);
    }

    const prompt = this.createCleanPrompt(transcriptionText, language);
    
    // Try each provider
    for (const provider of this.providers) {
      try {
        console.log(`🤖 Trying ${provider.name}...`);
        
        const aiResponse = await provider.handler(prompt);
        console.log(`✅ ${provider.name} succeeded!`);
        
        const parsedReport = this.parseCleanResponse(aiResponse, transcriptionText, language, provider.name, classification);
        return parsedReport;
        
      } catch (error) {
        console.error(`❌ ${provider.name} failed:`, error instanceof Error ? error.message : 'Unknown error');
        continue;
      }
    }

    console.error('❌ All AI providers failed');
    return this.generateFallbackReport(transcriptionText, language, classification);
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

  private parseCleanResponse(aiResponse: string, originalText: string, language: string, provider: string, classification: { type: string; agent: string; specialty: string; confidence: number }) {
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
        agent: classification.agent,
        specialty: classification.specialty,
        confidence: classification.confidence,
        reportType: classification.type,
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
    
    // Ensure at least one finding exists (fallback to general observation)
    if (uniqueNormal.length === 0 && 
        uniquePathological.length === 0 && 
        uniqueSpecial.length === 0 && 
        uniqueMeasurements.length === 0 && 
        uniqueLocalizations.length === 0) {
      // Add a default finding based on the text content
      if (text.length > 20) {
        uniqueNormal.push(isGerman 
          ? 'Befund wurde erfasst und analysiert.'
          : 'Findings have been captured and analyzed.');
      } else {
        uniqueNormal.push(isGerman 
          ? 'Minimale Befundinformationen vorhanden.'
          : 'Minimal findings information available.');
      }
    }
    
    return {
      normalFindings: uniqueNormal,
      pathologicalFindings: uniquePathological,
      specialObservations: uniqueSpecial,
      measurements: uniqueMeasurements,
      localizations: uniqueLocalizations,
      confidence: Math.min(0.9, 0.6 + (uniqueNormal.length + uniquePathological.length) * 0.1),
      processingAgent: 'enhanced_ai_parser',
      provider: 'ai-enhanced',
      timestamp: Date.now()
    };
  }

  private generateBasicICD(text: string, isGerman: boolean) {
    const codes = [];
    
    if (text.toLowerCase().includes('mammograph')) {
      codes.push({
        code: 'Z12.31',
        description: isGerman ? 'Spezielle Vorsorgeuntersuchung auf Brustkrebs' : 'Screening mammography',
        confidence: 0.95,
        radiologyRelevance: 0.95,
        priority: 'primary' as const,
        category: isGerman ? 'Vorsorgeuntersuchung' : 'Screening',
        reasoning: isGerman 
          ? 'Mammographie-Untersuchung erkannt' 
          : 'Mammography examination detected'
      });
    }
    
    return {
      codes: codes,
      summary: {
        primaryDiagnoses: codes.filter(c => c.priority === 'primary').length,
        secondaryConditions: 0,
        totalCodes: codes.length
      },
      confidence: codes.length > 0 ? 0.95 : 0.5,
      provider: 'simplified',
      generatedAt: Date.now(),
      language: isGerman ? 'de' as const : 'en' as const
    };
  }

  private classifyReportType(text: string): 'transcription' | 'manual' | 'imported' {
    // Always return 'transcription' for AI-generated reports from text input
    return 'transcription';
  }

  private generateFallbackReport(text: string, language: string, classification?: { type: string; agent: string; specialty: string; confidence: number }) {
    const isGerman = language === 'de';
    
    // Generate minimal enhanced findings
    const enhancedFindings = this.generateEnhancedFindings(text, isGerman);
    
    // Generate basic ICD predictions
    const icdPredictions = this.generateBasicICD(text, isGerman);
    
    const fallbackClassification = classification || {
      type: 'General Radiology',
      agent: 'general_radiology_specialist',
      specialty: 'general',
      confidence: 0
    };
    
    return {
      id: `report-${Date.now()}`,
      transcriptionId: `transcription-${Date.now()}`,
      findings: text,
      impression: isGerman ? 'Weitere Beurteilung erforderlich.' : 'Further assessment required.',
      recommendations: isGerman ? 'Rücksprache mit behandelndem Arzt.' : 'Consult with treating physician.',
      technicalDetails: isGerman ? 'Regelbasierte Verarbeitung' : 'Rule-based processing',
      enhancedFindings: enhancedFindings,
      icdPredictions: icdPredictions,
      generatedAt: Date.now(),
      language: language,
      type: 'transcription' as const,
      metadata: {
        agent: fallbackClassification.agent,
        specialty: fallbackClassification.specialty,
        confidence: fallbackClassification.confidence,
        reportType: fallbackClassification.type,
        aiProvider: 'rule-based',
        aiGenerated: false
      }
    };
  }
}

async function handleGenerateReport(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  
  // Validate request
  const validation = await validateRequest(request);
  if (validation.error) {
    logApiMetrics('/api/generate-report', 'POST', Date.now() - startTime, 400, 'Validation error');
    return validation.error;
  }
  
  const { transcriptionId, language, transcriptionText, processingMode } = validation.data;
  
  console.log('🌐 Validated API Route: Generate Report Request');
  console.log('- Transcription ID:', transcriptionId);
  console.log('- Language:', language);
  console.log('- Text length:', transcriptionText.length);
  console.log('- Processing mode:', processingMode);

  const llmService = new SimpleMultiLLMService();
  const rawReport = await llmService.generateReport(transcriptionText, language);

  // Standardize timestamps and validate response
  const report = {
    ...rawReport,
    generatedAt: normalizeTimestamp(rawReport.generatedAt),
    enhancedFindings: rawReport.enhancedFindings ? {
      ...rawReport.enhancedFindings,
      timestamp: normalizeTimestamp(rawReport.enhancedFindings.timestamp || rawReport.enhancedFindings.generatedAt)
    } : undefined
  };

  // Validate the response before sending
  const validatedReport = validateResponse(report);
  
  console.log('✅ Validated report generated successfully');
  logApiMetrics('/api/generate-report', 'POST', Date.now() - startTime, 200);
  
  return createApiResponse(validatedReport);
}

// Export the handler wrapped with comprehensive error handling
export const POST = withErrorHandling(handleGenerateReport);