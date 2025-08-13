import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    timestamp: new Date().toISOString(),
    deployment: 'latest',
    environmentVariables: {
      // AI Provider Keys (showing only if they exist, not the actual values)
      hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
      hasOpenAIKey: !!process.env.OPENAI_API_KEY, 
      hasGoogleKey: !!process.env.GOOGLE_API_KEY,
      
      // Old NEXT_PUBLIC keys (should be false if we're using new ones)
      hasOldAnthropicKey: !!process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY,
      hasOldOpenAIKey: !!process.env.NEXT_PUBLIC_OPENAI_API_KEY,
      hasOldGoogleKey: !!process.env.NEXT_PUBLIC_GOOGLE_API_KEY,
      
      // Configuration
      aiProviderPriority: process.env.AI_PROVIDER_PRIORITY || 'not-set',
      oldProviderPriority: process.env.NEXT_PUBLIC_AI_PROVIDER_PRIORITY || 'not-set',
      
      // Models
      claudeModel: process.env.CLAUDE_MODEL || 'not-set',
      openaiModel: process.env.OPENAI_MODEL || 'not-set', 
      geminiModel: process.env.GEMINI_MODEL || 'not-set',
      
      // Vercel Info
      vercelEnv: process.env.VERCEL_ENV,
      nodeEnv: process.env.NODE_ENV
    }
  });
}