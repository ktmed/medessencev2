'use client';

export default function DebugPage() {
  const envVars = {
    'NEXT_PUBLIC_AI_PROVIDER_PRIORITY': process.env.NEXT_PUBLIC_AI_PROVIDER_PRIORITY,
    'NEXT_PUBLIC_ANTHROPIC_API_KEY': process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY ? 'SET (' + process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY.substring(0, 10) + '...)' : 'NOT SET',
    'NEXT_PUBLIC_OPENAI_API_KEY': process.env.NEXT_PUBLIC_OPENAI_API_KEY ? 'SET (' + process.env.NEXT_PUBLIC_OPENAI_API_KEY.substring(0, 10) + '...)' : 'NOT SET',
    'NEXT_PUBLIC_GOOGLE_API_KEY': process.env.NEXT_PUBLIC_GOOGLE_API_KEY ? 'SET (' + process.env.NEXT_PUBLIC_GOOGLE_API_KEY.substring(0, 10) + '...)' : 'NOT SET',
    'NEXT_PUBLIC_CLAUDE_MODEL': process.env.NEXT_PUBLIC_CLAUDE_MODEL,
    'NEXT_PUBLIC_OPENAI_MODEL': process.env.NEXT_PUBLIC_OPENAI_MODEL,
    'NEXT_PUBLIC_GEMINI_MODEL': process.env.NEXT_PUBLIC_GEMINI_MODEL,
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Debug: Environment Variables</h1>
      <div className="bg-gray-100 p-4 rounded-lg">
        <pre>{JSON.stringify(envVars, null, 2)}</pre>
      </div>
      <div className="mt-6">
        <button 
          onClick={() => {
            console.log('Environment variables:', envVars);
          }}
          className="px-4 py-2 bg-blue-500 text-white rounded"
        >
          Log to Console
        </button>
      </div>
    </div>
  );
}