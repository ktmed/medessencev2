# Multi-LLM Setup Guide

The Radiology AI System now supports multiple Large Language Model (LLM) providers with automatic fallback. This ensures high availability and better performance for report generation.

## Supported Providers

The system supports the following LLM providers in order of priority:

1. **OpenAI (GPT-4)** - Primary provider
2. **Claude (Anthropic)** - First fallback
3. **Gemini (Google)** - Second fallback

## Configuration

### 1. Environment Variables

Add your API keys to the `.env` file:

```bash
# OpenAI (GPT-4)
OPENAI_API_KEY=sk-your-openai-api-key-here

# Claude (Anthropic)
ANTHROPIC_API_KEY=sk-ant-your-anthropic-api-key-here

# Google Gemini
GEMINI_API_KEY=your-gemini-api-key-here
```

**Note:** You don't need all three API keys. The system will use whichever providers have valid API keys configured.

### 2. Getting API Keys

#### OpenAI
1. Visit [OpenAI Platform](https://platform.openai.com/)
2. Sign up or log in
3. Navigate to API Keys section
4. Create a new API key

#### Anthropic (Claude)
1. Visit [Anthropic Console](https://console.anthropic.com/)
2. Sign up or log in
3. Navigate to API Keys
4. Create a new API key

#### Google Gemini
1. Visit [Google AI Studio](https://makersuite.google.com/)
2. Sign in with Google account
3. Get API key from the settings

## How It Works

### Automatic Fallback

When generating a report or patient summary:

1. The system first attempts to use OpenAI (if configured)
2. If OpenAI fails (rate limit, error, or not configured), it tries Claude
3. If Claude fails, it tries Gemini
4. If all AI providers fail, it falls back to the rule-based orchestrator

### Error Handling

Common failure scenarios and how they're handled:

- **Rate Limiting**: Automatically tries the next provider
- **Invalid API Key**: Skips that provider and tries the next
- **Network Issues**: Retries with the next provider
- **All Providers Fail**: Uses the intelligent rule-based system

## Usage

No changes are required in how you use the system. The multi-LLM support works transparently:

1. Start the system as usual
2. Generate reports normally
3. The system automatically selects the best available provider

### Checking Provider Status

When a report is generated, the console logs will show which provider was used:

```
Attempting report generation with Multi-LLM service...
Successfully generated report with openai
```

Or if fallback occurred:

```
openai failed: OpenAI rate limit exceeded
Attempting report generation with Multi-LLM service...
Successfully generated report with claude
```

## Benefits

1. **High Availability**: If one provider is down, others take over
2. **Cost Optimization**: Can configure based on pricing preferences
3. **Performance**: Different providers may excel at different types of reports
4. **No Vendor Lock-in**: Easy to switch between providers

## Monitoring

The report metadata includes information about which provider was used:

```javascript
{
  metadata: {
    ai_generated: true,
    ai_provider: "openai",  // or "claude", "gemini"
    fallback_used: false
  }
}
```

## Troubleshooting

### All providers failing

1. Check your API keys are valid
2. Verify you have credits/quota with each provider
3. Check network connectivity
4. Review console logs for specific error messages

### Slow response times

- The system tries providers sequentially, so failures add latency
- Consider removing providers that consistently fail
- Monitor which providers perform best for your use case

### Provider-specific issues

**OpenAI**: Check usage limits at https://platform.openai.com/usage
**Claude**: Verify API access at https://console.anthropic.com/
**Gemini**: Check quotas at https://console.cloud.google.com/

## Best Practices

1. **Configure at least 2 providers** for redundancy
2. **Monitor usage** across providers to optimize costs
3. **Test regularly** to ensure API keys remain valid
4. **Set up alerts** for when fallbacks occur frequently

## Future Enhancements

Planned improvements:

- Parallel provider calls with fastest response wins
- Provider-specific prompt optimization
- Usage analytics and cost tracking
- Custom provider priority configuration
- Support for additional LLM providers (Cohere, AI21, etc.)