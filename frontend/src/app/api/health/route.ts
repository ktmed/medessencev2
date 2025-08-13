import { NextResponse } from 'next/server';

export async function GET() {
  try {
    return NextResponse.json({
      status: 'healthy-updated',
      service: 'medessence-frontend',
      timestamp: new Date().toISOString(),
      version: '2.0.0',
      environment: process.env.NODE_ENV || 'development',
      deployment: {
        commit: '328a04f',
        vercelEnv: process.env.VERCEL_ENV
      },
      environmentCheck: {
        // New environment variables
        hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
        hasOpenAIKey: !!process.env.OPENAI_API_KEY,
        hasGoogleKey: !!process.env.GOOGLE_API_KEY,
        aiProviderPriority: process.env.AI_PROVIDER_PRIORITY || 'not-set',
        
        // Old environment variables (should be false)
        hasOldAnthropicKey: !!process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY,
        hasOldOpenAIKey: !!process.env.NEXT_PUBLIC_OPENAI_API_KEY,
        hasOldGoogleKey: !!process.env.NEXT_PUBLIC_GOOGLE_API_KEY,
        oldProviderPriority: process.env.NEXT_PUBLIC_AI_PROVIDER_PRIORITY || 'not-set'
      }
    });
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