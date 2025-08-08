#!/usr/bin/env python3
import asyncio
import websockets
import json
import base64
import numpy as np
import tempfile
import os
import whisperx
import torch
import gc
from datetime import datetime

class WhisperXTranscriptionService:
    def __init__(self):
        self.device = "mps" if torch.backends.mps.is_available() else "cpu"
        self.compute_type = "float32"  # float16 not supported on CPU/MPS
        self.batch_size = 16
        self.model = None
        self.model_a = None
        self.metadata = None
        self.sessions = {}
        
    async def initialize(self):
        """Initialize WhisperX model"""
        print(f"Initializing WhisperX on {self.device}...")
        
        # Load model - using large-v2 for better non-English support
        self.model = whisperx.load_model(
            "large-v2", 
            self.device, 
            compute_type=self.compute_type,
            language="de"
        )
        
        # Load alignment model for German
        print("Loading alignment model for German...")
        self.model_a, self.metadata = whisperx.load_align_model(
            language_code="de", 
            device=self.device
        )
        
        print("WhisperX initialized successfully!")
        
    async def handle_client(self, websocket, path):
        """Handle WebSocket client connection"""
        session_id = str(datetime.now().timestamp())
        print(f"New client connected: {session_id}")
        
        self.sessions[session_id] = {
            "config": {"language": "de", "medical_context": True},
            "audio_buffer": []
        }
        
        try:
            # Send initial heartbeat
            await websocket.send(json.dumps({
                "type": "heartbeat",
                "timestamp": datetime.now().timestamp()
            }))
            
            async for message in websocket:
                data = json.loads(message)
                
                if data["type"] == "config":
                    await self.handle_config(websocket, session_id, data["config"])
                    
                elif data["type"] == "audio":
                    await self.handle_audio(websocket, session_id, data)
                    
                elif data["type"] == "end_session":
                    await self.handle_end_session(websocket, session_id)
                    
        except websockets.exceptions.ConnectionClosed:
            print(f"Client disconnected: {session_id}")
        except Exception as e:
            print(f"Error handling client {session_id}: {e}")
            await websocket.send(json.dumps({
                "type": "error",
                "message": str(e)
            }))
        finally:
            if session_id in self.sessions:
                del self.sessions[session_id]
    
    async def handle_config(self, websocket, session_id, config):
        """Handle configuration update"""
        self.sessions[session_id]["config"].update(config)
        print(f"Config updated for {session_id}: {config}")
        
        await websocket.send(json.dumps({
            "type": "config_updated",
            "session_id": session_id
        }))
    
    async def handle_audio(self, websocket, session_id, data):
        """Handle audio data"""
        # Decode base64 audio
        audio_data = base64.b64decode(data["data"])
        audio_array = np.frombuffer(audio_data, dtype=np.int16).astype(np.float32) / 32768.0
        
        # Add to buffer
        session = self.sessions[session_id]
        session["audio_buffer"].extend(audio_array)
        
        # Process when we have 2 seconds of audio (32000 samples at 16kHz)
        if len(session["audio_buffer"]) >= 32000:
            audio_segment = np.array(session["audio_buffer"][:32000])
            session["audio_buffer"] = session["audio_buffer"][32000:]
            
            # Check if audio is loud enough
            rms = np.sqrt(np.mean(audio_segment**2))
            if rms < 0.001:
                print("Audio too quiet, skipping")
                return
            
            # Save to temporary file
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp_file:
                import wave
                with wave.open(tmp_file.name, 'wb') as wav_file:
                    wav_file.setnchannels(1)
                    wav_file.setsampwidth(2)
                    wav_file.setframerate(16000)
                    wav_file.writeframes((audio_segment * 32768).astype(np.int16).tobytes())
                
                # Transcribe with WhisperX
                try:
                    result = await self.transcribe_audio(tmp_file.name, session["config"]["language"])
                    
                    if result and result["text"]:
                        await websocket.send(json.dumps({
                            "type": "transcription",
                            "data": {
                                "text": result["text"],
                                "language": result["language"],
                                "confidence": 0.9,
                                "processing_time": result["processing_time"],
                                "medical_terms": self.extract_medical_terms(result["text"]),
                                "quality_score": rms,
                                "segments": result.get("segments", [])
                            }
                        }))
                        
                finally:
                    # Clean up temp file
                    if os.path.exists(tmp_file.name):
                        os.unlink(tmp_file.name)
    
    async def transcribe_audio(self, audio_path, language="de"):
        """Transcribe audio using WhisperX"""
        start_time = datetime.now()
        
        print(f"Transcribing {audio_path}...")
        
        # Load audio
        audio = whisperx.load_audio(audio_path)
        
        # Transcribe
        result = self.model.transcribe(
            audio, 
            batch_size=self.batch_size,
            language=language
        )
        
        # Align whisper output
        if self.model_a and self.metadata:
            result = whisperx.align(
                result["segments"], 
                self.model_a, 
                self.metadata, 
                audio, 
                self.device,
                return_char_alignments=False
            )
        
        processing_time = (datetime.now() - start_time).total_seconds()
        
        # Extract text
        text = " ".join([segment["text"] for segment in result["segments"]])
        
        print(f"Transcription: {text}")
        
        return {
            "text": text,
            "segments": result["segments"],
            "language": language,
            "processing_time": processing_time
        }
    
    async def handle_end_session(self, websocket, session_id):
        """Handle session end"""
        await websocket.send(json.dumps({
            "type": "session_ended",
            "session_id": session_id
        }))
    
    def extract_medical_terms(self, text):
        """Extract medical terms from text"""
        if not text:
            return []
        
        # German medical terms
        medical_terms = [
            'befund', 'diagnose', 'patient', 'untersuchung', 'behandlung',
            'therapie', 'medikament', 'symptom', 'anamnese', 'labor',
            'röntgen', 'mrt', 'ct', 'ultraschall', 'ekg', 'blutdruck',
            'herzfrequenz', 'temperatur', 'schmerz', 'entzündung',
            'infektion', 'allergie', 'operation', 'eingriff', 'narkose',
            'wirbelsäule', 'lendenwirbelsäule', 'bandscheibe', 'fraktur',
            'arthrose', 'osteoporose', 'stenose', 'protrusion', 'prolaps',
            'mammographie', 'sonographie', 'parenchym', 'mikrokalzifikation',
            'lymphknoten', 'axillär', 'benigne', 'maligne'
        ]
        
        found = []
        lower_text = text.lower()
        
        for term in medical_terms:
            if term in lower_text:
                found.append(term)
        
        return list(set(found))

async def main():
    """Main server function"""
    service = WhisperXTranscriptionService()
    await service.initialize()
    
    # Start WebSocket server
    print("Starting WhisperX transcription service on ws://localhost:8001/ws/transcribe")
    
    async with websockets.serve(service.handle_client, "localhost", 8001, path="/ws/transcribe"):
        # Also start HTTP server for health checks
        from aiohttp import web
        
        async def health(request):
            return web.json_response({"status": "healthy", "service": "whisperx"})
        
        app = web.Application()
        app.router.add_get('/health', health)
        
        runner = web.AppRunner(app)
        await runner.setup()
        site = web.TCPSite(runner, 'localhost', 8002)
        await site.start()
        
        print("Health check available at http://localhost:8002/health")
        
        # Run forever
        await asyncio.Future()

if __name__ == "__main__":
    asyncio.run(main())