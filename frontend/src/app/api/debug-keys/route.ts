import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  console.log('🔍 DEBUG: Checking API key configuration');

  const debug = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    vercelEnv: process.env.VERCEL_ENV || 'development',
    
    // API Key presence and format validation
    keys: {
      anthropic: {
        present: !!process.env.ANTHROPIC_API_KEY,
        format: process.env.ANTHROPIC_API_KEY ? {
          starts_with_sk_ant: process.env.ANTHROPIC_API_KEY.startsWith('sk-ant-'),
          length: process.env.ANTHROPIC_API_KEY.length,
          first_12_chars: process.env.ANTHROPIC_API_KEY.substring(0, 12),
          valid_format: process.env.ANTHROPIC_API_KEY.startsWith('sk-ant-') && process.env.ANTHROPIC_API_KEY.length > 50
        } : null
      },
      google: {
        present: !!process.env.GOOGLE_API_KEY,
        format: process.env.GOOGLE_API_KEY ? {
          length: process.env.GOOGLE_API_KEY.length,
          first_8_chars: process.env.GOOGLE_API_KEY.substring(0, 8),
          expected_length_39: process.env.GOOGLE_API_KEY.length === 39
        } : null
      },
      openai: {
        present: !!process.env.OPENAI_API_KEY,
        format: process.env.OPENAI_API_KEY ? {
          starts_with_sk: process.env.OPENAI_API_KEY.startsWith('sk-'),
          length: process.env.OPENAI_API_KEY.length,
          first_8_chars: process.env.OPENAI_API_KEY.substring(0, 8)
        } : null
      }
    },
    
    // Model configurations
    models: {
      claude: process.env.CLAUDE_MODEL || 'claude-3-haiku-20240307',
      gemini: process.env.GEMINI_MODEL || 'gemini-1.5-pro',
      openai: process.env.OPENAI_MODEL || 'gpt-4o-mini'
    },
    
    // Provider priority
    aiProviderPriority: process.env.AI_PROVIDER_PRIORITY || 'claude,gemini,openai',
    
    // Legacy key check
    legacy: {
      hasLegacyAnthropicKey: !!process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY,
      hasLegacyOpenAIKey: !!process.env.NEXT_PUBLIC_OPENAI_API_KEY,
      hasLegacyGoogleKey: !!process.env.NEXT_PUBLIC_GOOGLE_API_KEY
    }
  };

  console.log('🔍 Key debug info:', JSON.stringify(debug, null, 2));

  return NextResponse.json(debug);
}