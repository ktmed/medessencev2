import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('Test ICD route called with:', body);
    
    // Return a simple test response
    return NextResponse.json({
      success: true,
      message: 'Test ICD route working',
      receivedData: body,
      codes: [
        {
          code: 'R07.4',
          description: 'Chest pain, unspecified',
          confidence: 0.95,
          radiologyRelevance: 0.9,
          priority: 'primary',
          category: 'Symptoms',
          reasoning: 'Test response'
        }
      ],
      summary: {
        totalCodes: 1,
        primaryDiagnoses: 1,
        secondaryConditions: 0
      },
      confidence: 0.95,
      provider: 'test',
      generatedAt: Date.now(),
      language: body.language || 'en'
    });
  } catch (error) {
    console.error('Test ICD route error:', error);
    return NextResponse.json(
      { error: 'Test route error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ status: 'Test ICD route is available' });
}