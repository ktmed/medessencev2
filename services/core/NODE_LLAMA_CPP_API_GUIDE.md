# node-llama-cpp v3.11.0 API Guide

This guide provides the correct API usage for node-llama-cpp version 3.11.0 with GGUF models.

## Key Changes in v3.x

The API has significantly changed from v2.x to v3.x:
- No more `LlamaCpp` constructor
- Direct import of functions like `loadModel()`
- New `ChatWrapper` class for conversational AI
- Improved context and sequence management

## Installation

```bash
npm install node-llama-cpp@3.11.0
```

## Basic Usage

### 1. Loading a GGUF Model

```javascript
// Import the library
const llama = await import('node-llama-cpp');

// Load model from disk
const model = await llama.loadModel({
  modelPath: '/path/to/your/model.gguf',
  threads: 4,              // CPU threads to use
  contextSize: 4096,       // Context window size
  batchSize: 512,          // Batch size for processing
  gpuLayers: 20            // GPU layers (0 = CPU only)
});
```

### 2. Creating a Context

```javascript
const context = await model.createContext({
  contextSize: 4096
});
```

### 3. Text Generation Methods

#### Method A: Direct Sequence Evaluation
```javascript
const sequence = context.getSequence();

const response = await sequence.evaluate(prompt, {
  temperature: 0.3,
  maxTokens: 1000,
  topP: 0.9,
  repetitionPenalty: 1.1,
  stopStrings: ['</end>']
});
```

#### Method B: Chat Wrapper (Recommended)
```javascript
const chatSession = new llama.ChatWrapper(context, {
  systemPrompt: "You are a helpful AI assistant."
});

const response = await chatSession.chat(userPrompt, {
  temperature: 0.7,
  maxTokens: 500,
  topP: 0.9,
  repetitionPenalty: 1.1
});
```

## Parameters Reference

### Model Loading Parameters
- `modelPath` (string): Path to the GGUF file
- `threads` (number): CPU threads (default: CPU cores - 1)
- `contextSize` (number): Context window size (default: model's max)
- `batchSize` (number): Processing batch size (default: 512)
- `gpuLayers` (number): Layers to offload to GPU (default: 0)

### Generation Parameters
- `temperature` (number): Randomness (0.0-2.0, lower = more focused)
- `maxTokens` (number): Maximum tokens to generate
- `topP` (number): Nucleus sampling threshold (0.0-1.0)
- `repetitionPenalty` (number): Penalty for repetition (1.0 = none)
- `stopStrings` (array): Stop generation at these strings

## Medical AI Example

```javascript
async function generateMedicalReport(transcription) {
  const llama = await import('node-llama-cpp');
  
  // Load GPT-OSS-20B model
  const model = await llama.loadModel({
    modelPath: './models/gpt-oss-20b-MXFP4.gguf',
    threads: 6,
    contextSize: 4096,
    gpuLayers: 30
  });
  
  const context = await model.createContext({
    contextSize: 4096
  });
  
  // Create medical chat session
  const medicalAI = new llama.ChatWrapper(context, {
    systemPrompt: "You are a medical AI specializing in radiology reports. Generate structured JSON reports with medical accuracy."
  });
  
  const prompt = `Create a structured German radiology report:
  
Transcription: ${transcription}

Format as JSON with sections: technicalDetails, findings, impression, recommendations`;
  
  const report = await medicalAI.chat(prompt, {
    temperature: 0.3,  // Low for medical accuracy
    maxTokens: 2000,
    topP: 0.9,
    repetitionPenalty: 1.1,
    stopStrings: ['\n\nUser:', '</report>']
  });
  
  // Cleanup
  await context.dispose();
  await model.dispose();
  
  return report;
}
```

## Error Handling

```javascript
try {
  const llama = await import('node-llama-cpp');
  const model = await llama.loadModel({ modelPath: './model.gguf' });
  // ... use model
} catch (error) {
  if (error.message.includes('Cannot resolve module')) {
    console.error('node-llama-cpp not installed');
  } else if (error.message.includes('ENOENT')) {
    console.error('Model file not found');
  } else if (error.message.includes('out of memory')) {
    console.error('Insufficient RAM for model');
  } else {
    console.error('Model loading failed:', error.message);
  }
}
```

## Performance Tips

1. **GPU Acceleration**: Set `gpuLayers` to offload computation
2. **Thread Optimization**: Use `threads: Math.max(1, os.cpus().length - 2)`
3. **Context Reuse**: Keep context alive for multiple generations
4. **Batch Size**: Adjust based on available memory
5. **Temperature**: Use lower values (0.1-0.3) for factual content

## Resource Management

Always clean up resources:

```javascript
// Cleanup sequence
await context.dispose();
await model.dispose();
```

## Common Issues

### "LlamaCpp is not a constructor"
- **Cause**: Using old v2.x API
- **Fix**: Use `llama.loadModel()` instead of `new LlamaCpp()`

### "Cannot find module 'node-llama-cpp'"
- **Cause**: Package not installed
- **Fix**: `npm install node-llama-cpp@3.11.0`

### "Out of memory" errors
- **Cause**: Model too large for available RAM
- **Fix**: Use smaller quantized model or reduce `contextSize`

### GPU acceleration not working
- **Cause**: CUDA/Metal not properly configured
- **Fix**: Install appropriate GPU drivers and set `gpuLayers: 0` as fallback

## Complete Working Example

See `test-gpt-oss-api.js` for a complete working example with error handling and cleanup.