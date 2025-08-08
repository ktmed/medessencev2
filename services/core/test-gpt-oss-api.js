/**
 * Test script demonstrating correct node-llama-cpp v3.11.0 API usage
 * This shows the proper way to load GGUF models and generate text
 */

const path = require('path');

async function testNodeLlamaCppAPI() {
  try {
    console.log('Testing node-llama-cpp v3.11.0 API...');
    
    // Import the library (dynamic import for ESM compatibility)
    const llama = await import('node-llama-cpp');
    console.log('✅ node-llama-cpp imported successfully');
    
    // Example model path - adjust to your GPT-OSS-20B GGUF file location
    const modelPath = path.join(__dirname, '../../../gpt-oss-models/gpt-oss-20b-MXFP4.gguf');
    console.log('📁 Model path:', modelPath);
    
    // 1. Load the GGUF model file from disk
    console.log('🔄 Loading model...');
    const model = await llama.loadModel({
      modelPath: modelPath,
      threads: 4,              // Number of CPU threads
      contextSize: 4096,       // Context window size
      batchSize: 512,          // Batch size for processing
      gpuLayers: 20            // Number of layers to offload to GPU (0 = CPU only)
    });
    console.log('✅ Model loaded successfully');
    
    // 2. Create a context for inference
    console.log('🔄 Creating context...');
    const context = await model.createContext({
      contextSize: 4096
    });
    console.log('✅ Context created successfully');
    
    // 3. Generate text with prompts - Method 1: Direct context evaluation
    console.log('🔄 Method 1: Direct context evaluation...');
    const prompt1 = "What is the capital of France?";
    const sequence = context.getSequence();
    
    const response1 = await sequence.evaluate(prompt1, {
      temperature: 0.3,
      maxTokens: 100,
      topP: 0.9,
      repetitionPenalty: 1.1
    });
    console.log('Response 1:', response1);
    
    // 3. Generate text with prompts - Method 2: Chat wrapper (recommended)
    console.log('🔄 Method 2: Chat wrapper...');
    const chatSession = new llama.ChatWrapper(context, {
      systemPrompt: "You are a helpful AI assistant."
    });
    
    const response2 = await chatSession.chat("Explain quantum computing in simple terms.", {
      temperature: 0.7,
      maxTokens: 200,
      topP: 0.9,
      repetitionPenalty: 1.1
    });
    console.log('Response 2:', response2);
    
    // Cleanup
    console.log('🧹 Cleaning up...');
    await context.dispose();
    await model.dispose();
    
    console.log('✅ Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
    
    // Common troubleshooting tips
    console.log('\n📝 Troubleshooting tips:');
    console.log('1. Make sure node-llama-cpp@3.11.0 is installed: npm install node-llama-cpp@3.11.0');
    console.log('2. Ensure your GGUF model file exists at the specified path');
    console.log('3. Check system requirements: sufficient RAM and CPU cores');
    console.log('4. For GPU acceleration, ensure CUDA/Metal is properly configured');
  }
}

// Medical report generation example
async function testMedicalReportGeneration() {
  try {
    console.log('\n🏥 Testing medical report generation...');
    
    const llama = await import('node-llama-cpp');
    
    // Load medical model (adjust path as needed)
    const modelPath = path.join(__dirname, '../../../gpt-oss-models/gpt-oss-20b-MXFP4.gguf');
    
    const model = await llama.loadModel({
      modelPath: modelPath,
      threads: 4,
      contextSize: 4096,
      batchSize: 512,
      gpuLayers: 20
    });
    
    const context = await model.createContext({
      contextSize: 4096
    });
    
    const chatSession = new llama.ChatWrapper(context, {
      systemPrompt: "You are a medical AI assistant specializing in radiology report generation. Create structured medical reports from transcribed dictations with high accuracy and proper medical terminology."
    });
    
    const medicalPrompt = `Generate a structured radiology report in JSON format for the following transcription:

Patient shows signs of pneumonia in the right lower lobe. Consolidation visible on chest X-ray. No pleural effusion observed. Heart size normal.

Required JSON structure:
- technicalDetails: Technical examination details
- findings: Detailed medical findings
- impression: Summary and assessment
- recommendations: Further recommendations

Format: JSON only, no additional explanations.`;
    
    const medicalReport = await chatSession.chat(medicalPrompt, {
      temperature: 0.3,  // Low temperature for medical accuracy
      maxTokens: 1000,
      topP: 0.9,
      repetitionPenalty: 1.1,
      stopStrings: ['\n\nUser:', '\n\nAssistant:']
    });
    
    console.log('🏥 Medical Report Generated:');
    console.log(medicalReport);
    
    // Try to parse as JSON
    try {
      const jsonMatch = medicalReport.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsedReport = JSON.parse(jsonMatch[0]);
        console.log('✅ Successfully parsed as JSON:', parsedReport);
      }
    } catch (parseError) {
      console.log('⚠️ Could not parse as JSON, but text generation successful');
    }
    
    // Cleanup
    await context.dispose();
    await model.dispose();
    
    console.log('✅ Medical report test completed!');
    
  } catch (error) {
    console.error('❌ Medical report test failed:', error.message);
  }
}

// Run tests
if (require.main === module) {
  (async () => {
    await testNodeLlamaCppAPI();
    await testMedicalReportGeneration();
  })();
}

module.exports = {
  testNodeLlamaCppAPI,
  testMedicalReportGeneration
};