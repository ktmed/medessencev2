import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const healthData = {
      status: 'healthy',
      service: 'medessence-frontend',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      vercel: {
        env: process.env.VERCEL_ENV,
        region: process.env.VERCEL_REGION,
        url: process.env.VERCEL_URL
      },
      aiProviders: {
        hasClaudeKey: !!process.env.ANTHROPIC_API_KEY,
        hasOpenAIKey: !!process.env.OPENAI_API_KEY,
        hasGoogleKey: !!process.env.GOOGLE_API_KEY,
        providerPriority: process.env.AI_PROVIDER_PRIORITY || 'claude,gemini,openai',
        claudeModel: process.env.CLAUDE_MODEL || 'not-set',
        openaiModel: process.env.OPENAI_MODEL || 'not-set',
        geminiModel: process.env.GEMINI_MODEL || 'not-set'
      },
      apis: {
        generateReport: '/api/generate-report',
        generateSummary: '/api/generate-summary', 
        generateICD: '/api/generate-icd',
        health: '/api/health'
      }
    };

    return NextResponse.json(healthData);
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}