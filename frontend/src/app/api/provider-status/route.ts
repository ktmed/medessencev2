import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  console.log('🔍 PROVIDER STATUS: Checking current provider configuration');

  const status = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    
    // Provider priority configuration
    providerPriority: process.env.AI_PROVIDER_PRIORITY || 'gemini,openai,claude',
    providerPriorityArray: (process.env.AI_PROVIDER_PRIORITY || 'gemini,openai,claude')
      .split(',')
      .map(p => p.trim()),
    
    // Test which providers would be initialized
    wouldInitialize: {
      claude: !!process.env.ANTHROPIC_API_KEY,
      openai: !!process.env.OPENAI_API_KEY,
      gemini: !!process.env.GOOGLE_API_KEY
    },
    
    // Expected initialization order
    initializationOrder: [],
    
    // Models configuration
    models: {
      claude: process.env.CLAUDE_MODEL || 'claude-3-haiku-20240307',
      gemini: process.env.GEMINI_MODEL || 'gemini-1.5-pro',
      openai: process.env.OPENAI_MODEL || 'gpt-4o-mini'
    }
  };

  // Simulate initialization order
  const providerPriority = status.providerPriorityArray;
  for (const providerName of providerPriority) {
    if (providerName === 'claude' && process.env.ANTHROPIC_API_KEY) {
      status.initializationOrder.push({ name: 'claude', status: 'would_initialize' });
    } else if (providerName === 'openai' && process.env.OPENAI_API_KEY) {
      status.initializationOrder.push({ name: 'openai', status: 'would_initialize' });
    } else if (providerName === 'gemini' && process.env.GOOGLE_API_KEY) {
      status.initializationOrder.push({ name: 'gemini', status: 'would_initialize' });
    }
  }

  console.log('🔍 Provider status:', JSON.stringify(status, null, 2));

  return NextResponse.json(status);
}