import { NextResponse } from 'next/server';

export async function GET() {
  const results = {
    timestamp: new Date().toISOString(),
    environmentCheck: {
      hasGoogleKey: !!process.env.GOOGLE_API_KEY,
      hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
      hasOpenAIKey: !!process.env.OPENAI_API_KEY,
      geminiModel: process.env.GEMINI_MODEL || 'gemini-1.5-pro',
      claudeModel: process.env.CLAUDE_MODEL || 'claude-3-haiku-20240307',
      openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini'
    },
    keyValidation: {
      anthropic: {
        present: !!process.env.ANTHROPIC_API_KEY,
        correctFormat: process.env.ANTHROPIC_API_KEY?.startsWith('sk-ant-') || false,
        length: process.env.ANTHROPIC_API_KEY?.length || 0
      },
      google: {
        present: !!process.env.GOOGLE_API_KEY,
        hasCorrectPattern: /^[A-Za-z0-9_-]{39}$/.test(process.env.GOOGLE_API_KEY || ''),
        length: process.env.GOOGLE_API_KEY?.length || 0
      },
      openai: {
        present: !!process.env.OPENAI_API_KEY,
        correctFormat: process.env.OPENAI_API_KEY?.startsWith('sk-') || false,
        length: process.env.OPENAI_API_KEY?.length || 0
      }
    },
    tests: {} as any
  };

  console.log('\ud83e\uddea Starting AI API tests...');
  console.log('- Anthropic key format valid:', results.keyValidation.anthropic.correctFormat);
  console.log('- Google key format valid:', results.keyValidation.google.hasCorrectPattern);
  console.log('- OpenAI key format valid:', results.keyValidation.openai.correctFormat);

  // Test Gemini API call
  if (process.env.GOOGLE_API_KEY) {
    try {
      const model = process.env.GEMINI_MODEL || 'gemini-1.5-pro';
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GOOGLE_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Hello, respond with just "OK"' }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 10 },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        results.tests.gemini = {
          status: 'success',
          response: data.candidates?.[0]?.content?.parts?.[0]?.text || 'No text returned'
        };
      } else {
        const errorText = await response.text();
        results.tests.gemini = {
          status: 'failed',
          error: `HTTP ${response.status}`,
          details: errorText
        };
      }
    } catch (error) {
      results.tests.gemini = {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Test Claude API call
  if (process.env.ANTHROPIC_API_KEY) {
    console.log('\ud83d\udce4 Testing Claude API...');
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: process.env.CLAUDE_MODEL || 'claude-3-haiku-20240307',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Hello, respond with just "OK"' }],
        }),
      });

      console.log('\ud83d\udce5 Claude response status:', response.status, response.statusText);

      if (response.ok) {
        const data = await response.json();
        results.tests.claude = {
          status: 'success',
          response: data.content?.[0]?.text || 'No text returned',
          model: process.env.CLAUDE_MODEL || 'claude-3-haiku-20240307'
        };
        console.log('\u2705 Claude test successful');
      } else {
        const errorText = await response.text();
        console.error('\u274c Claude API error:', response.status, errorText);
        results.tests.claude = {
          status: 'failed',
          error: `HTTP ${response.status}`,
          details: errorText,
          troubleshooting: {
            keyFormat: results.keyValidation.anthropic.correctFormat ? 'OK' : 'Invalid key format (should start with sk-ant-)',
            keyLength: results.keyValidation.anthropic.length,
            possibleCauses: [
              !results.keyValidation.anthropic.correctFormat ? 'API key format incorrect' : null,
              response.status === 401 ? 'API key invalid or expired' : null,
              response.status === 429 ? 'Rate limit exceeded' : null,
              response.status >= 500 ? 'Anthropic service issue' : null
            ].filter(Boolean)
          }
        };
      }
    } catch (error) {
      console.error('\u274c Claude test error:', error);
      results.tests.claude = {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        troubleshooting: {
          networkIssue: true,
          possibleCauses: ['Network connectivity', 'Vercel function timeout', 'DNS resolution']
        }
      };
    }
  } else {
    results.tests.claude = {
      status: 'no-key',
      message: 'ANTHROPIC_API_KEY not configured'
    };
  }

  console.log('\u2705 AI tests completed');
  return NextResponse.json(results);
}