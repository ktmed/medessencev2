#!/usr/bin/env python3
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
