/**
 * Multi-LLM Service for Frontend with fallback support
 * Priority: Claude -> Gemini -> OpenAI
 */

import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

interface LLMProvider {
  name: string;
  handler: (prompt: string) => Promise<string>;
}

interface LLMResponse {
  text: string;
  provider: string;
  fallback: boolean;
}

export class MultiLLMService {
  private providers: LLMProvider[] = [];
  private geminiClient: GoogleGenAI | null = null;

  constructor() {
    this.initializeProviders();
  }

  private initializeProviders() {
    // SECURITY NOTE: This service should NOT use API keys directly in the browser.
    // Instead, it should make requests to API routes that handle the actual LLM calls.
    // For now, maintaining compatibility but logging the security issue.
    
    console.log('⚠️  SECURITY WARNING: multiLLMService should not handle API keys in browser');
    console.log('⚠️  This service should delegate to API routes instead');
    
    // Get provider priority from environment variable
    const providerPriority = (process.env.AI_PROVIDER_PRIORITY || 'claude,gemini,openai')
      .split(',')
      .map(p => p.trim());
    
    console.log('🚀 INITIALIZING FRONTEND PROVIDERS:');
    console.log('- Provider priority order:', providerPriority);
    console.log('- This should delegate to /api routes instead of direct API calls');

    // Initialize available providers
    const availableProviders: { [key: string]: () => LLMProvider | null } = {
      // SECURITY FIX: Instead of using API keys directly, delegate to API routes
      claude: () => {
        // Always return the provider - the actual API call will be made server-side
        return {
          name: 'claude',
          handler: this.callClaudeViaAPI.bind(this)
        };
      },
      openai: () => {
        // Always return the provider - the actual API call will be made server-side
        return {
          name: 'openai', 
          handler: this.callOpenAIViaAPI.bind(this)
        };
      },
      gemini: () => {
        // Always return the provider - the actual API call will be made server-side
        return {
          name: 'gemini',
          handler: this.callGeminiViaAPI.bind(this)
        };
      }
    };

    // Add providers in priority order
    for (const providerName of providerPriority) {
      const providerFactory = availableProviders[providerName];
      if (providerFactory) {
        const provider = providerFactory();
        if (provider) {
          this.providers.push(provider);
          console.log(`Added ${providerName} provider to frontend service`);
        } else {
          console.log(`${providerName} provider not available (missing API key)`);
        }
      } else {
        console.log(`Unknown provider in priority list: ${providerName}`);
      }
    }

    console.log(`Frontend MultiLLMService initialized with providers: ${this.providers.map(p => p.name).join(', ')}`);
  }

  /**
   * Refine transcript using available LLMs with fallback
   */
  async refineTranscript(rawText: string, processingMode: 'cloud' | 'local' = 'cloud'): Promise<string> {
    console.log('🔍 REFINE TRANSCRIPT DEBUG:');
    console.log('- Raw text length:', rawText?.length || 0);
    console.log('- Processing mode:', processingMode);
    console.log('- Available providers:', this.providers.map(p => p.name));
    console.log('- Providers count:', this.providers.length);
    
    if (!rawText) {
      console.log('❌ No raw text provided, returning empty string');
      return "";
    }

    const prompt = this.createGermanMedicalPrompt(rawText);
    console.log('✅ Created prompt, length:', prompt.length);
    
    // For local processing, use Ollama models
    if (processingMode === 'local') {
      console.log('🏠 Using local processing mode (Ollama)');
      return await this.refineWithOllama(prompt);
    }
    
    console.log('☁️ Using cloud processing mode');
    
    if (this.providers.length === 0) {
      console.error('❌ NO PROVIDERS AVAILABLE - this explains rule-based fallback');
      throw new Error('No AI providers available. Check API keys.');
    }
    
    let lastError: Error | null = null;
    
    // Try each provider in order for cloud processing
    for (let i = 0; i < this.providers.length; i++) {
      const provider = this.providers[i];
      try {
        console.log(`🤖 Attempting transcript refinement with ${provider.name}...`);
        const result = await provider.handler(prompt);
        console.log(`✅ Successfully refined transcript with ${provider.name}`);
        console.log('- Result length:', result?.length || 0);
        
        return result;
        
      } catch (error) {
        console.error(`❌ ${provider.name} failed:`, error instanceof Error ? error.message : 'Unknown error');
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        // Continue to next provider
        continue;
      }
    }
    
    // All providers failed
    console.error('❌ ALL PROVIDERS FAILED');
    throw new Error(`All LLM providers failed. Last error: ${lastError?.message || 'Unknown error'}`);
  }

  /**
   * Create German medical transcription prompt
   */
  private createGermanMedicalPrompt(rawText: string): string {
    return `Korrigiere und formatiere den folgenden deutschen medizinischen Text. Behebe nur Fehler in der Rechtschreibung, Grammatik und Interpunktion. Verwende korrekte medizinische Fachbegriffe. Füge keine neuen Informationen hinzu. Antworte nur mit dem korrigierten Text:

${rawText}`;
  }

  /**
   * Call Claude via API route (secure server-side)
   */
  private async callClaudeViaAPI(prompt: string): Promise<string> {
    try {
      const response = await fetch('/api/llm/claude', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: prompt,
          maxTokens: 4000,
          temperature: 0.2
        })
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('Claude API route error:', error);
        throw new Error(`Claude API route error: ${response.status} - ${error}`);
      }

      const data = await response.json();
      const content = data.text || data.content;
      
      console.log('Claude response received via API route:', content.substring(0, 100) + '...');
      return content;
      
    } catch (error) {
      throw new Error(`Claude API route error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Call OpenAI via API route (secure server-side)
   */
  private async callOpenAIViaAPI(prompt: string): Promise<string> {
    try {
      const response = await fetch('/api/llm/openai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: prompt,
          maxTokens: 4000,
          temperature: 0.2
        })
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('OpenAI API route error:', error);
        throw new Error(`OpenAI API route error: ${response.status} - ${error}`);
      }

      const data = await response.json();
      const content = data.text || data.content;
      
      console.log('OpenAI response received via API route:', content.substring(0, 100) + '...');
      return content;
      
    } catch (error) {
      throw new Error(`OpenAI API route error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Call Gemini via API route (secure server-side)
   */
  private async callGeminiViaAPI(prompt: string): Promise<string> {
    try {
      const response = await fetch('/api/llm/gemini', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: prompt,
          maxTokens: 4000,
          temperature: 0.2
        })
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('Gemini API route error:', error);
        throw new Error(`Gemini API route error: ${response.status} - ${error}`);
      }

      const data = await response.json();
      const content = data.text || data.content;
      
      console.log('Gemini response received via API route:', content.substring(0, 100) + '...');
      return content;
      
    } catch (error) {
      throw new Error(`Gemini API route error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get list of available providers
   */
  getAvailableProviders(): string[] {
    return this.providers.map(p => p.name);
  }

  /**
   * Check if any providers are available
   */
  hasProviders(): boolean {
    return this.providers.length > 0;
  }

  /**
   * Get the intended provider priority order (from server-side config)
   */
  getProviderPriority(): string[] {
    const providerPriority = (process.env.AI_PROVIDER_PRIORITY || 'claude,gemini,openai')
      .split(',')
      .map(p => p.trim());
    return providerPriority;
  }

  /**
   * Refine transcript using local Ollama models
   */
  private async refineWithOllama(prompt: string): Promise<string> {
    // Try Gemma-3 medical models first, then GPT-OSS as fallback (use same models as Local Demo)
    const models = ['gemma3-medical-fp16:latest', 'gemma3-medical-q8:latest', 'gemma3-medical-q5:latest', 'gpt-oss:latest'];
    const ollamaBaseUrl = process.env.NEXT_PUBLIC_OLLAMA_BASE_URL || 'http://localhost:11434';
    
    let lastError: Error | null = null;
    
    for (const model of models) {
      try {
        console.log(`Attempting local refinement with ${model}...`);
        
        const response = await fetch(`${ollamaBaseUrl}/api/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: model,
            prompt: prompt,
            stream: false,
            options: {
              temperature: 0.2,
              top_p: 0.9,
              repeat_penalty: 1.1
            }
          })
        });

        if (!response.ok) {
          throw new Error(`Ollama API error: ${response.status} - ${response.statusText}`);
        }

        const data = await response.json();
        console.log(`Successfully refined transcript with local ${model}`);
        
        // Clean up the response by removing quotes, end tokens, and extra formatting
        let cleanedResponse = data.response || '';
        
        // Remove common model artifacts
        cleanedResponse = cleanedResponse
          .replace(/<\|im_end\|>/g, '')
          .replace(/<\/\|im_end\|>/g, '')
          .replace(/^["']|["']$/g, '') // Remove quotes at start/end
          .replace(/\s+/g, ' ') // Normalize spaces
          .trim();
        
        return cleanedResponse;
        
      } catch (error) {
        console.error(`Local model ${model} failed:`, error instanceof Error ? error.message : 'Unknown error');
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        // Continue to next model
        continue;
      }
    }
    
    // All local models failed
    throw new Error(`All local models failed. Last error: ${lastError?.message || 'Unknown error'}. Make sure Ollama is running and models are installed.`);
  }
}

// Create singleton instance
export const multiLLMService = new MultiLLMService();

// Legacy export for backward compatibility
export const refineTranscript = async (rawText: string, processingMode: 'cloud' | 'local' = 'cloud'): Promise<string> => {
  return multiLLMService.refineTranscript(rawText, processingMode);
};