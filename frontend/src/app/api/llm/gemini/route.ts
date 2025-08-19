import { NextRequest, NextResponse } from 'next/server';

interface GeminiRequest {
  prompt: string;
  maxTokens?: number;
  temperature?: number;
}

export async function POST(request: NextRequest) {
  try {
    const { prompt, maxTokens = 4000, temperature = 0.2 }: GeminiRequest = await request.json();

    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      console.error('GOOGLE_API_KEY not found in environment variables');
      return NextResponse.json(
        { error: 'Gemini API not configured' },
        { status: 503 }
      );
    }

    const model = process.env.GEMINI_MODEL || 'gemini-1.5-pro';
    console.log('📤 Making Gemini API call...');
    console.log('- Model:', model);
    console.log('- Max tokens:', maxTokens);
    console.log('- Temperature:', temperature);
    console.log('- API Key present:', !!apiKey);

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: temperature,
          maxOutputTokens: maxTokens,
        }
      })
    });

    console.log('📥 Gemini API response status:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Gemini API error response:', errorText);
      
      let errorMessage = `Gemini API error: ${response.status}`;
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.error?.message || errorData.message || errorMessage;
      } catch (e) {
        errorMessage += ` - ${errorText}`;
      }
      
      return NextResponse.json(
        { 
          error: errorMessage,
          status: response.status,
          details: errorText 
        },
        { status: response.status === 401 ? 401 : 500 }
      );
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!content) {
      console.error('❌ No content in Gemini response:', data);
      return NextResponse.json(
        { error: 'No content returned from Gemini' },
        { status: 500 }
      );
    }

    console.log('✅ Gemini API call successful, content length:', content.length);
    
    return NextResponse.json({
      text: content,
      provider: 'gemini',
      model: model
    });

  } catch (error) {
    console.error('❌ Gemini API route error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}