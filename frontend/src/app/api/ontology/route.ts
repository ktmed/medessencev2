import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandling, createApiResponse, logApiMetrics } from '@/lib/api-middleware';

// Ontology service URL - can be configured via environment variable
const ONTOLOGY_SERVICE_URL = process.env.ONTOLOGY_SERVICE_URL || 'http://localhost:8001';

interface OntologyRequest {
  action: 'enhance' | 'suggest-icd' | 'search-cases' | 'statistics';
  transcriptionText?: string;
  modality?: string;
  icdCode?: string;
  examType?: string;
  limit?: number;
}

interface EnhancedTranscription {
  original_text: string;
  language: string;
  modality: string;
  suggested_icd_codes: Array<{
    code: string;
    description: string;
    confidence: number;
    sources?: string[];
  }>;
  extracted_findings: Array<{
    text: string;
    type: string;
  }>;
  quality_score: number;
  confidence: number;
  enhanced: boolean;
}

async function handleOntologyRequest(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  
  try {
    const body = await request.json() as OntologyRequest;
    console.log('🧬 Ontology API Request:', body.action);
    
    let ontologyEndpoint = '';
    let ontologyBody: any = {};
    
    switch (body.action) {
      case 'enhance':
        ontologyEndpoint = '/api/enhance-transcription';
        ontologyBody = {
          transcription_text: body.transcriptionText || '',
          modality: body.modality || 'mammographie'
        };
        break;
        
      case 'suggest-icd':
        ontologyEndpoint = '/api/suggest-icd-codes';
        ontologyBody = {
          text: body.transcriptionText || '',
          modality: body.modality
        };
        break;
        
      case 'search-cases':
        ontologyEndpoint = '/api/search-cases';
        ontologyBody = {
          icd_code: body.icdCode,
          exam_type: body.examType,
          text: body.transcriptionText,
          limit: body.limit || 10
        };
        break;
        
      case 'statistics':
        ontologyEndpoint = '/api/statistics';
        break;
        
      default:
        return NextResponse.json(
          { error: 'Invalid action specified' },
          { status: 400 }
        );
    }
    
    console.log(`📡 Calling ontology service: ${ONTOLOGY_SERVICE_URL}${ontologyEndpoint}`);
    
    // Make request to ontology service
    const ontologyResponse = await fetch(`${ONTOLOGY_SERVICE_URL}${ontologyEndpoint}`, {
      method: body.action === 'statistics' ? 'GET' : 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Accept': 'application/json; charset=utf-8',
      },
      body: body.action === 'statistics' ? undefined : JSON.stringify(ontologyBody),
    });
    
    if (!ontologyResponse.ok) {
      console.error('❌ Ontology service error:', ontologyResponse.status);
      throw new Error(`Ontology service returned ${ontologyResponse.status}`);
    }
    
    const ontologyData = await ontologyResponse.json();
    console.log('✅ Ontology service response received');
    
    // Extract the actual data from the response
    const responseData = ontologyData.data || ontologyData;
    
    // Log specific details based on action
    if (body.action === 'enhance' && responseData.suggested_icd_codes) {
      console.log(`- ICD codes suggested: ${responseData.suggested_icd_codes.length}`);
      console.log(`- Findings extracted: ${responseData.extracted_findings?.length || 0}`);
      console.log(`- Quality score: ${responseData.quality_score}`);
    } else if (body.action === 'statistics') {
      console.log(`- ICD codes in DB: ${responseData.database_stats?.icd_count}`);
      console.log(`- Medical cases: ${responseData.database_stats?.total_cases}`);
    }
    
    logApiMetrics('/api/ontology', 'POST', Date.now() - startTime, 200);
    return createApiResponse(responseData);
    
  } catch (error) {
    console.error('❌ Ontology API error:', error);
    logApiMetrics('/api/ontology', 'POST', Date.now() - startTime, 500, 'Server error');
    
    return NextResponse.json(
      {
        error: 'Failed to process ontology request',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export const POST = withErrorHandling(handleOntologyRequest);
export const GET = withErrorHandling(async (request: NextRequest) => {
  // GET requests default to statistics
  return handleOntologyRequest(new NextRequest(request.url, {
    method: 'POST',
    body: JSON.stringify({ action: 'statistics' })
  }));
});