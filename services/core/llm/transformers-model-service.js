/**
 * Transformers Model Service - Alternative to vLLM for macOS ARM
 * Uses Hugging Face Transformers with Python subprocess for local model inference
 * Provides vLLM-like API for German medical analysis
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class TransformersModelService {
  constructor() {
    this.currentModel = null;
    this.isInitialized = false;
    this.pythonProcess = null;
    this.modelConfigs = {
      'gemma-3b-medical': {
        displayName: 'Gemma 3B Medical (Transformers)',
        modelId: 'google/gemma-1.1-2b-it', // Using available model as example
        ramRequirement: 4000, // MB
        contextLength: 2048,
        quality: 'high',
        speed: 'fast',
        gemma3: true,
        medicalSpecialized: false,
        description: 'Gemma 3B via Transformers (good for medical analysis)',
        provider: 'transformers'
      },
      'llama-3-8b': {
        displayName: 'LLaMA 3 8B (Transformers)',
        modelId: 'meta-llama/Llama-3.1-8B-Instruct', 
        ramRequirement: 8000, // MB
        contextLength: 4096,
        quality: 'excellent',
        speed: 'medium',
        recommended: true,
        description: 'LLaMA 3.1 8B via Transformers (excellent for complex analysis)',
        provider: 'transformers'
      },
      'phi-3-mini': {
        displayName: 'Phi-3 Mini (Transformers)',
        modelId: 'microsoft/Phi-3-mini-4k-instruct',
        ramRequirement: 2000, // MB
        contextLength: 4096,
        quality: 'good',
        speed: 'very-fast',
        description: 'Microsoft Phi-3 Mini (fast, efficient for medical tasks)',
        provider: 'transformers'
      }
    };
  }

  /**
   * Initialize the Transformers model service
   */
  async initialize() {
    try {
      console.log('TransformersModelService: Initializing...');
      
      // Check if transformers is available
      await this.checkTransformersAvailability();
      
      // Create Python inference script if it doesn't exist
      await this.createPythonScript();
      
      // Select default model based on system resources
      const selectedModel = await this.selectDefaultModel();
      
      if (selectedModel) {
        console.log(`TransformersModelService: Selected ${selectedModel.displayName}`);
        this.currentModel = selectedModel.modelId;
      }
      
      this.isInitialized = true;
      console.log('TransformersModelService: Initialization complete');
      return true;
      
    } catch (error) {
      console.error('TransformersModelService: Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Check if transformers library is available
   */
  async checkTransformersAvailability() {
    return new Promise((resolve, reject) => {
      const checkProcess = spawn('python3', ['-c', 'import transformers, torch; print("OK")']);
      
      checkProcess.on('close', (code) => {
        if (code === 0) {
          console.log('TransformersModelService: Transformers library available');
          resolve(true);
        } else {
          reject(new Error('Transformers library not available'));
        }
      });
      
      checkProcess.on('error', (error) => {
        reject(new Error(`Failed to check transformers: ${error.message}`));
      });
    });
  }

  /**
   * Create Python inference script
   */
  async createPythonScript() {
    const scriptPath = path.join(__dirname, 'transformers_inference.py');
    
    const pythonScript = `#!/usr/bin/env python3
"""
Transformers Inference Script for MedEssence
Provides local model inference using Hugging Face Transformers
"""

import json
import sys
import torch
from transformers import AutoTokenizer, AutoModelForCausalLM, pipeline
import warnings
warnings.filterwarnings("ignore")

class TransformersInference:
    def __init__(self):
        self.model = None
        self.tokenizer = None
        self.pipeline = None
        self.current_model_id = None
        
    def load_model(self, model_id):
        """Load a model from Hugging Face"""
        try:
            print(f"Loading model: {model_id}", file=sys.stderr)
            
            # Use CPU for macOS ARM compatibility
            device = "cpu"
            
            # Load tokenizer
            self.tokenizer = AutoTokenizer.from_pretrained(model_id)
            
            # Add padding token if missing
            if self.tokenizer.pad_token is None:
                self.tokenizer.pad_token = self.tokenizer.eos_token
            
            # Load model
            self.model = AutoModelForCausalLM.from_pretrained(
                model_id,
                torch_dtype=torch.float32,  # Use float32 for CPU
                device_map="cpu",
                trust_remote_code=True
            )
            
            # Create pipeline
            self.pipeline = pipeline(
                "text-generation",
                model=self.model,
                tokenizer=self.tokenizer,
                device=device,
                return_full_text=False
            )
            
            self.current_model_id = model_id
            print(f"Model loaded successfully: {model_id}", file=sys.stderr)
            return True
            
        except Exception as e:
            print(f"Error loading model: {str(e)}", file=sys.stderr)
            return False
    
    def generate_response(self, prompt, max_length=512, temperature=0.3, top_p=0.9):
        """Generate response using loaded model"""
        try:
            if not self.pipeline:
                return {"error": "No model loaded"}
            
            # Generate response
            responses = self.pipeline(
                prompt,
                max_length=max_length,
                temperature=temperature,
                top_p=top_p,
                do_sample=True,
                num_return_sequences=1,
                pad_token_id=self.tokenizer.eos_token_id
            )
            
            if responses and len(responses) > 0:
                return {"response": responses[0]["generated_text"].strip()}
            else:
                return {"error": "No response generated"}
                
        except Exception as e:
            return {"error": f"Generation error: {str(e)}"}

def main():
    """Main inference loop"""
    inference = TransformersInference()
    
    # Process commands from Node.js
    for line in sys.stdin:
        try:
            command = json.loads(line.strip())
            
            if command["action"] == "load_model":
                model_id = command["model_id"]
                success = inference.load_model(model_id)
                result = {"success": success, "model_id": model_id}
                print(json.dumps(result))
                
            elif command["action"] == "generate":
                prompt = command["prompt"]
                max_length = command.get("max_length", 512)
                temperature = command.get("temperature", 0.3)
                top_p = command.get("top_p", 0.9)
                
                result = inference.generate_response(prompt, max_length, temperature, top_p)
                print(json.dumps(result))
                
            elif command["action"] == "health":
                result = {
                    "status": "ok", 
                    "current_model": inference.current_model_id,
                    "available": inference.pipeline is not None
                }
                print(json.dumps(result))
                
            sys.stdout.flush()
            
        except json.JSONDecodeError:
            print(json.dumps({"error": "Invalid JSON command"}))
        except Exception as e:
            print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    main()
`;

    fs.writeFileSync(scriptPath, pythonScript);
    console.log('TransformersModelService: Created Python inference script');
  }

  /**
   * Select default model based on system resources
   */
  async selectDefaultModel() {
    const totalRam = this.getSystemRam();
    console.log(`TransformersModelService: System RAM: ${totalRam}MB`);
    
    // Select model based on available RAM
    const availableModels = Object.values(this.modelConfigs)
      .filter(model => model.ramRequirement <= totalRam * 0.7) // Use 70% of RAM
      .sort((a, b) => b.ramRequirement - a.ramRequirement); // Prefer larger models
    
    if (availableModels.length > 0) {
      return availableModels[0];
    }
    
    // Fallback to smallest model
    return Object.values(this.modelConfigs)
      .sort((a, b) => a.ramRequirement - b.ramRequirement)[0];
  }

  /**
   * Get system RAM in MB
   */
  getSystemRam() {
    const os = require('os');
    return Math.round(os.totalmem() / 1024 / 1024);
  }

  /**
   * Start Python inference process
   */
  async startPythonProcess() {
    if (this.pythonProcess) {
      return; // Already running
    }
    
    const scriptPath = path.join(__dirname, 'transformers_inference.py');
    
    this.pythonProcess = spawn('python3', [scriptPath], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    this.pythonProcess.stderr.on('data', (data) => {
      console.log(`TransformersModelService: ${data.toString().trim()}`);
    });
    
    this.pythonProcess.on('error', (error) => {
      console.error('TransformersModelService: Python process error:', error);
      this.pythonProcess = null;
    });
    
    this.pythonProcess.on('close', (code) => {
      console.log(`TransformersModelService: Python process exited with code ${code}`);
      this.pythonProcess = null;
    });
    
    console.log('TransformersModelService: Started Python inference process');
  }

  /**
   * Send command to Python process
   */
  async sendCommand(command) {
    if (!this.pythonProcess) {
      await this.startPythonProcess();
      // Wait a bit for process to start
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    return new Promise((resolve, reject) => {
      let responseData = '';
      
      const onData = (data) => {
        responseData += data.toString();
        const lines = responseData.split('\\n');
        
        // Process complete JSON lines
        for (let i = 0; i < lines.length - 1; i++) {
          try {
            const result = JSON.parse(lines[i]);
            this.pythonProcess.stdout.removeListener('data', onData);
            resolve(result);
            return;
          } catch (e) {
            // Continue to next line
          }
        }
        
        // Keep incomplete line
        responseData = lines[lines.length - 1];
      };
      
      this.pythonProcess.stdout.on('data', onData);
      
      // Timeout after 30 seconds
      setTimeout(() => {
        this.pythonProcess.stdout.removeListener('data', onData);
        reject(new Error('Command timeout'));
      }, 30000);
      
      // Send command
      this.pythonProcess.stdin.write(JSON.stringify(command) + '\\n');
    });
  }

  /**
   * Generate medical report using Transformers
   */
  async generateReport(text, language = 'de', metadata = {}) {
    try {
      console.log('TransformersModelService: Generating report with Transformers...');
      const startTime = Date.now();
      
      // Create medical analysis prompt
      const prompt = this.createMedicalPrompt(text, language);
      
      // Load model if not already loaded
      if (!this.currentModel) {
        const defaultModel = await this.selectDefaultModel();
        const loadResult = await this.sendCommand({
          action: 'load_model',
          model_id: defaultModel.modelId
        });
        
        if (!loadResult.success) {
          throw new Error('Failed to load model');
        }
        
        this.currentModel = defaultModel.modelId;
      }
      
      // Generate response
      const result = await this.sendCommand({
        action: 'generate',
        prompt: prompt,
        max_length: 1024,
        temperature: 0.25,
        top_p: 0.9
      });
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      const processingTime = Date.now() - startTime;
      console.log(`TransformersModelService: Report generated in ${processingTime}ms`);
      
      // Parse and structure the response
      return this.parseResponse(result.response, processingTime);
      
    } catch (error) {
      console.error('TransformersModelService: Generation failed:', error);
      throw error;
    }
  }

  /**
   * Create medical analysis prompt
   */
  createMedicalPrompt(text, language) {
    const prompt = language === 'de' ? 
      `Analysiere diesen deutschen medizinischen Befund und erstelle einen strukturierten Bericht:

${text}

Erstelle eine strukturierte Analyse mit:
1. Befunde (wichtige medizinische Befunde)
2. Beurteilung (klinische Einschätzung)
3. Empfehlungen (weitere Maßnahmen)

Antwort:` :
      `Analyze this medical report and create a structured analysis:

${text}

Create a structured analysis with:
1. Findings (important medical findings)
2. Assessment (clinical evaluation)
3. Recommendations (further actions)

Response:`;
    
    return prompt;
  }

  /**
   * Parse model response into structured format
   */
  parseResponse(responseText, processingTime) {
    // Simple parsing - can be enhanced based on model output format
    const sections = responseText.split('\\n\\n');
    
    return {
      findings: responseText,
      impression: "Analysis generated by Transformers model",
      recommendations: "Consult with medical professional for detailed interpretation",
      model: this.currentModel,
      provider: 'transformers',
      inferenceTime: processingTime,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get available models
   */
  async getAvailableModels() {
    const systemRam = this.getSystemRam();
    const safeRam = systemRam * 0.7; // Use 70% of available RAM
    
    return Object.entries(this.modelConfigs).map(([key, config]) => ({
      name: key,
      displayName: config.displayName,
      provider: 'transformers',
      ramRequirement: config.ramRequirement,
      quality: config.quality,
      isAvailable: true,
      canRun: config.ramRequirement <= safeRam,
      current: this.currentModel === config.modelId,
      ...config
    }));
  }

  /**
   * Switch to different model
   */
  async switchModel(modelName) {
    const config = this.modelConfigs[modelName];
    if (!config) {
      throw new Error(`Unknown model: ${modelName}`);
    }
    
    console.log(`TransformersModelService: Switching to model ${config.displayName}...`);
    
    const result = await this.sendCommand({
      action: 'load_model',
      model_id: config.modelId
    });
    
    if (result.success) {
      this.currentModel = config.modelId;
      console.log(`TransformersModelService: Successfully switched to ${config.displayName}`);
      return true;
    } else {
      throw new Error('Failed to switch model');
    }
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      const result = await this.sendCommand({ action: 'health' });
      return {
        status: result.status,
        model: result.current_model,
        available: result.available,
        provider: 'transformers'
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message,
        provider: 'transformers'
      };
    }
  }

  /**
   * Cleanup
   */
  async cleanup() {
    console.log('TransformersModelService: Cleaning up...');
    if (this.pythonProcess) {
      this.pythonProcess.kill();
      this.pythonProcess = null;
    }
    console.log('TransformersModelService: Cleanup complete');
  }
}

module.exports = TransformersModelService;