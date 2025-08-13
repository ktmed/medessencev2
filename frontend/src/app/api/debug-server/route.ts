import { NextResponse } from 'next/server';

export async function GET() {
  const envVars = {
    'NEXT_PUBLIC_AI_PROVIDER_PRIORITY': process.env.NEXT_PUBLIC_AI_PROVIDER_PRIORITY,
    'NEXT_PUBLIC_ANTHROPIC_API_KEY': process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY ? 'SET (' + process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY.substring(0, 10) + '...)' : 'NOT SET',
    'NEXT_PUBLIC_OPENAI_API_KEY': process.env.NEXT_PUBLIC_OPENAI_API_KEY ? 'SET (' + process.env.NEXT_PUBLIC_OPENAI_API_KEY.substring(0, 10) + '...)' : 'NOT SET',
    'NEXT_PUBLIC_GOOGLE_API_KEY': process.env.NEXT_PUBLIC_GOOGLE_API_KEY ? 'SET (' + process.env.NEXT_PUBLIC_GOOGLE_API_KEY.substring(0, 10) + '...)' : 'NOT SET',
    'NEXT_PUBLIC_CLAUDE_MODEL': process.env.NEXT_PUBLIC_CLAUDE_MODEL,
    'NEXT_PUBLIC_OPENAI_MODEL': process.env.NEXT_PUBLIC_OPENAI_MODEL,
    'NEXT_PUBLIC_GEMINI_MODEL': process.env.NEXT_PUBLIC_GEMINI_MODEL,
    'NODE_ENV': process.env.NODE_ENV,
    'VERCEL': process.env.VERCEL,
    'VERCEL_ENV': process.env.VERCEL_ENV,
  };

  console.log('🔍 SERVER DEBUG - Environment variables:', envVars);

  return NextResponse.json({
    message: 'Server-side environment debug',
    timestamp: new Date().toISOString(),
    environment: envVars
  });
}