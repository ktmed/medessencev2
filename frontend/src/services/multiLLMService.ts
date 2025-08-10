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
    // Get provider priority from environment variable
    const providerPriority = (process.env.NEXT_PUBLIC_AI_PROVIDER_PRIORITY || 'claude,gemini,openai')
      .split(',')
      .map(p => p.trim());
    
    console.log('Frontend Provider priority order:', providerPriority);

    // Initialize available providers
    const availableProviders: { [key: string]: () => LLMProvider | null } = {
      claude: () => {
        if (process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY) {
          return {
            name: 'claude',
            handler: this.callClaude.bind(this)
          };
        }
        return null;
      },
      openai: () => {
        if (process.env.NEXT_PUBLIC_OPENAI_API_KEY) {
          return {
            name: 'openai',
            handler: this.callOpenAI.bind(this)
          };
        }
        return null;
      },
      gemini: () => {
        if (process.env.NEXT_PUBLIC_GOOGLE_API_KEY || process.env.API_KEY) {
          this.geminiClient = new GoogleGenAI({ 
            apiKey: process.env.NEXT_PUBLIC_GOOGLE_API_KEY || process.env.API_KEY || "" 
          });
          return {
            name: 'gemini',
            handler: this.callGemini.bind(this)
          };
        }
        return null;
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
    if (!rawText) {
      return "";
    }

    const prompt = this.createGermanMedicalPrompt(rawText);
    
    // For local processing, use Ollama models
    if (processingMode === 'local') {
      return await this.refineWithOllama(prompt);
    }
    
    let lastError: Error | null = null;
    
    // Try each provider in order for cloud processing
    for (let i = 0; i < this.providers.length; i++) {
      const provider = this.providers[i];
      try {
        console.log(`Attempting transcript refinement with ${provider.name}...`);
        const result = await provider.handler(prompt);
        console.log(`Successfully refined transcript with ${provider.name}`);
        
        return result;
        
      } catch (error) {
        console.error(`${provider.name} failed:`, error instanceof Error ? error.message : 'Unknown error');
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        // Continue to next provider
        continue;
      }
    }
    
    // All providers failed
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
   * Call Claude API
   */
  private async callClaude(prompt: string): Promise<string> {
    const apiKey = process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is not configured');
    }

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: process.env.NEXT_PUBLIC_CLAUDE_MODEL || 'claude-3-haiku-20240307',
          max_tokens: 4000,
          temperature: 0.2,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ]
        })
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('Claude API error response:', error);
        throw new Error(`Claude API error: ${response.status} - ${error}`);
      }

      const data = await response.json();
      const content = data.content[0].text;
      
      console.log('Claude response received:', content.substring(0, 100) + '...');
      return content;
      
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('429')) {
          throw new Error('Claude rate limit exceeded');
        } else if (error.message.includes('401') || error.message.includes('authentication')) {
          throw new Error('Claude API key invalid');
        }
      }
      throw new Error(`Claude API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Call OpenAI API
   */
  private async callOpenAI(prompt: string): Promise<string> {
    const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: process.env.NEXT_PUBLIC_OPENAI_MODEL || 'gpt-4o-mini',
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
          temperature: 0.2,
          max_tokens: 4000
        })
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('OpenAI API error response:', error);
        throw new Error(`OpenAI API error: ${response.status} - ${error}`);
      }

      const data = await response.json();
      const content = data.choices[0].message.content;
      
      console.log('OpenAI response received:', content.substring(0, 100) + '...');
      return content;
      
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('429')) {
          throw new Error('OpenAI rate limit exceeded');
        } else if (error.message.includes('401')) {
          throw new Error('OpenAI API key invalid');
        }
      }
      throw new Error(`OpenAI API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Call Gemini API (fallback)
   */
  private async callGemini(prompt: string): Promise<string> {
    if (!this.geminiClient) {
      throw new Error('Gemini client not initialized');
    }

    try {
      const response: GenerateContentResponse = await this.geminiClient.models.generateContent({
        model: process.env.NEXT_PUBLIC_GEMINI_MODEL || "gemini-2.5-flash",
        contents: prompt,
        config: {
          temperature: 0.2,
        }
      });

      const content = response.text || "";
      console.log('Gemini response received:', content.substring(0, 100) + '...');
      return content;
      
    } catch (error) {
      console.error("Error calling Gemini API:", error);
      throw new Error("Gemini API request failed.");
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
   * Get the intended provider priority order (even when no API keys are configured)
   */
  getProviderPriority(): string[] {
    const providerPriority = (process.env.NEXT_PUBLIC_AI_PROVIDER_PRIORITY || 'claude,gemini,openai')
      .split(',')
      .map(p => p.trim());
    return providerPriority;
  }

  /**
   * Refine transcript using local Ollama models
   */
  private async refineWithOllama(prompt: string): Promise<string> {
    // Try medical-gemma-2b first, then gpt-oss:20b as fallback (use exact model names)
    const models = ['medical-gemma-2b:latest', 'gpt-oss:20b'];
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