import { NextResponse } from 'next/server';

export async function GET() {
  const results = {
    timestamp: new Date().toISOString(),
    environmentCheck: {
      hasGoogleKey: !!process.env.GOOGLE_API_KEY,
      hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
      hasOpenAIKey: !!process.env.OPENAI_API_KEY,
      geminiModel: process.env.GEMINI_MODEL || 'gemini-1.5-pro'
    },
    tests: {} as any
  };

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

      if (response.ok) {
        const data = await response.json();
        results.tests.claude = {
          status: 'success',
          response: data.content?.[0]?.text || 'No text returned'
        };
      } else {
        const errorText = await response.text();
        results.tests.claude = {
          status: 'failed',
          error: `HTTP ${response.status}`,
          details: errorText
        };
      }
    } catch (error) {
      results.tests.claude = {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  return NextResponse.json(results);
}