import { NextRequest, NextResponse } from 'next/server';

interface ClaudeRequest {
  prompt: string;
  maxTokens?: number;
  temperature?: number;
}

export async function POST(request: NextRequest) {
  try {
    const { prompt, maxTokens = 4000, temperature = 0.2 }: ClaudeRequest = await request.json();

    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error('ANTHROPIC_API_KEY not found in environment variables');
      return NextResponse.json(
        { error: 'Claude API not configured' },
        { status: 503 }
      );
    }

    console.log('📤 Making Claude API call...');
    console.log('- Model:', process.env.CLAUDE_MODEL || 'claude-3-haiku-20240307');
    console.log('- Max tokens:', maxTokens);
    console.log('- Temperature:', temperature);
    console.log('- API Key present:', !!apiKey);
    console.log('- API Key starts with sk-ant-:', apiKey.startsWith('sk-ant-'));

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: process.env.CLAUDE_MODEL || 'claude-3-haiku-20240307',
        max_tokens: maxTokens,
        temperature: temperature,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    });

    console.log('📥 Claude API response status:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Claude API error response:', errorText);
      
      // Parse error for better debugging
      let errorMessage = `Claude API error: ${response.status}`;
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
    const content = data.content?.[0]?.text;
    
    if (!content) {
      console.error('❌ No content in Claude response:', data);
      return NextResponse.json(
        { error: 'No content returned from Claude' },
        { status: 500 }
      );
    }

    console.log('✅ Claude API call successful, content length:', content.length);
    
    return NextResponse.json({
      text: content,
      provider: 'claude',
      model: process.env.CLAUDE_MODEL || 'claude-3-haiku-20240307'
    });

  } catch (error) {
    console.error('❌ Claude API route error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}