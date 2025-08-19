import { NextRequest, NextResponse } from 'next/server';

interface OpenAIRequest {
  prompt: string;
  maxTokens?: number;
  temperature?: number;
}

export async function POST(request: NextRequest) {
  try {
    const { prompt, maxTokens = 4000, temperature = 0.2 }: OpenAIRequest = await request.json();

    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error('OPENAI_API_KEY not found in environment variables');
      return NextResponse.json(
        { error: 'OpenAI API not configured' },
        { status: 503 }
      );
    }

    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    console.log('📤 Making OpenAI API call...');
    console.log('- Model:', model);
    console.log('- Max tokens:', maxTokens);
    console.log('- Temperature:', temperature);
    console.log('- API Key present:', !!apiKey);
    console.log('- API Key starts with sk-:', apiKey.startsWith('sk-'));

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'system',
            content: 'You are a medical transcriptionist specializing in German medical terminology. Correct and format the provided text while maintaining all original medical information.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: temperature,
        max_tokens: maxTokens
      })
    });

    console.log('📥 OpenAI API response status:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ OpenAI API error response:', errorText);
      
      let errorMessage = `OpenAI API error: ${response.status}`;
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
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      console.error('❌ No content in OpenAI response:', data);
      return NextResponse.json(
        { error: 'No content returned from OpenAI' },
        { status: 500 }
      );
    }

    console.log('✅ OpenAI API call successful, content length:', content.length);
    
    return NextResponse.json({
      text: content,
      provider: 'openai',
      model: model
    });

  } catch (error) {
    console.error('❌ OpenAI API route error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}