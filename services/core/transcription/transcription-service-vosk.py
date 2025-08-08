#!/usr/bin/env python3
import asyncio
import websockets
import json
import base64
import numpy as np
import os
from datetime import datetime
from vosk import Model, KaldiRecognizer
from aiohttp import web

class VoskTranscriptionService:
    def __init__(self):
        # Use the large model for better accuracy
        self.model_path = "vosk-models/vosk-model-de-0.21"
        # For faster startup, use: "vosk-models/vosk-model-small-de-0.15"
        
        self.model = None
        self.sessions = {}
        self.sample_rate = 16000
        
    async def initialize(self):
        """Initialize Vosk model"""
        print(f"Loading Vosk model from {self.model_path}...", flush=True)
        self.model = Model(self.model_path)
        print("Vosk model loaded successfully!", flush=True)
        
    async def handle_client(self, websocket, path):
        """Handle WebSocket client connection"""
        session_id = str(datetime.now().timestamp())
        print(f"New client connected: {session_id}", flush=True)
        
        # Create recognizer for this session with optimized settings
        rec = KaldiRecognizer(self.model, self.sample_rate)
        rec.SetWords(True)  # Enable word-level timestamps for better accuracy
        rec.SetPartialWords(True)  # Enable partial word results
        rec.SetMaxAlternatives(3)  # Enable alternatives for better accuracy
        # Set beam width for better accuracy (higher = more accurate but slower)
        # Default is 13, we'll increase to 16 for better accuracy
        rec.SetGrammarFst(None)  # Ensure no grammar constraints
        
        # Send initial partial result immediately to reduce perceived latency
        rec.AcceptWaveform(b'\x00' * 320)  # Prime the recognizer with silence
        
        self.sessions[session_id] = {
            "recognizer": rec,
            "config": {"language": "de", "medical_context": True},
            "partial_result": "",
            "total_transcriptions": 0,
            "start_time": datetime.now(),
            "last_result_time": datetime.now(),
            "audio_buffer": bytearray()
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
        session = self.sessions.get(session_id)
        if not session:
            return
            
        # Decode base64 audio
        audio_data = base64.b64decode(data["data"])
        
        # Convert to numpy array (assuming 16-bit PCM)
        audio_array = np.frombuffer(audio_data, dtype=np.int16)
        
        # Audio preprocessing for better accuracy
        if len(audio_array) > 0:
            # Apply pre-emphasis filter to boost high frequencies
            pre_emphasis = 0.97
            emphasized = np.append(audio_array[0], audio_array[1:] - pre_emphasis * audio_array[:-1])
            
            # Normalize audio to prevent clipping and improve consistency
            max_val = np.max(np.abs(emphasized))
            if max_val > 0:
                # Normalize to 80% of maximum to avoid clipping
                scaling_factor = (0.8 * 32768) / max_val
                if scaling_factor < 1.0:  # Only scale down if too loud
                    emphasized = (emphasized * scaling_factor).astype(np.int16)
                audio_data = emphasized.tobytes()
            
        # Calculate RMS for logging (use original for accurate measurement)
        rms = np.sqrt(np.mean((audio_array.astype(np.float32) / 32768.0)**2))
        max_val = np.max(np.abs(audio_array)) if len(audio_array) > 0 else 0
        print(f"Audio chunk: {len(audio_data)} bytes, RMS: {rms:.4f}, Max: {max_val}, Non-zero: {np.count_nonzero(audio_array)}", flush=True)
        
        # Add to buffer for forced periodic results
        session["audio_buffer"].extend(audio_data)
        
        # Process with Vosk
        rec = session["recognizer"]
        start_time = datetime.now()
        
        # Accept waveform returns True if processing is complete
        if rec.AcceptWaveform(audio_data):
            # Final result
            result = json.loads(rec.Result())
            processing_time = (datetime.now() - start_time).total_seconds()
            
            if result.get("text", "").strip():
                await websocket.send(json.dumps({
                    "type": "transcription",
                    "data": {
                        "text": result["text"],
                        "language": session["config"]["language"],
                        "confidence": self.calculate_confidence(result),
                        "processing_time": processing_time,
                        "medical_terms": self.extract_medical_terms(result["text"]),
                        "quality_score": float(rms),
                        "segments": self.format_segments(result)
                    }
                }))
                session["total_transcriptions"] += 1
                session["last_result_time"] = datetime.now()
        
        # Always check for partial results
        partial = json.loads(rec.PartialResult())
        partial_text = partial.get("partial", "")
        if partial_text and partial_text != session["partial_result"]:
            session["partial_result"] = partial_text
            # Send partial results for real-time feedback
            await websocket.send(json.dumps({
                "type": "partial_transcription",
                "data": {
                    "text": partial_text,
                    "language": session["config"]["language"],
                    "is_partial": True
                }
            }))
            print(f"Sent partial: {partial_text}", flush=True)
        
        # Force a result if we haven't sent anything in 4 seconds (more patience for accuracy)
        time_since_last = (datetime.now() - session["last_result_time"]).total_seconds()
        if time_since_last > 4.0 and len(session["audio_buffer"]) > 32000:  # 2 seconds of audio
            # Force a final result
            final = json.loads(rec.FinalResult())
            if final.get("text", "").strip():
                await websocket.send(json.dumps({
                    "type": "transcription",
                    "data": {
                        "text": final["text"],
                        "language": session["config"]["language"],
                        "confidence": self.calculate_confidence(final),
                        "processing_time": 0,
                        "medical_terms": self.extract_medical_terms(final["text"]),
                        "quality_score": float(rms),
                        "segments": self.format_segments(final)
                    }
                }))
                print(f"Forced final: {final['text']}", flush=True)
            
            # Reset for next segment
            session["audio_buffer"] = bytearray()
            session["last_result_time"] = datetime.now()
            session["partial_result"] = ""
    
    async def handle_end_session(self, websocket, session_id):
        """Handle session end"""
        session = self.sessions.get(session_id)
        if session:
            # Get final result
            rec = session["recognizer"]
            final_result = json.loads(rec.FinalResult())
            
            if final_result.get("text", "").strip():
                await websocket.send(json.dumps({
                    "type": "transcription",
                    "data": {
                        "text": final_result["text"],
                        "language": session["config"]["language"],
                        "confidence": self.calculate_confidence(final_result),
                        "processing_time": 0,
                        "medical_terms": self.extract_medical_terms(final_result["text"]),
                        "quality_score": 1.0,
                        "segments": self.format_segments(final_result)
                    }
                }))
            
            duration = (datetime.now() - session["start_time"]).total_seconds()
            
            await websocket.send(json.dumps({
                "type": "session_ended",
                "session_id": session_id,
                "total_transcriptions": session["total_transcriptions"],
                "session_duration": duration
            }))
    
    def calculate_confidence(self, result):
        """Calculate average confidence from result"""
        if "result" in result and result["result"]:
            confidences = [word.get("conf", 0.5) for word in result["result"]]
            return sum(confidences) / len(confidences) if confidences else 0.5
        return 0.5
    
    def format_segments(self, result):
        """Format Vosk result into segments"""
        segments = []
        if "result" in result and result["result"]:
            words = result["result"]
            current_segment = {
                "text": "",
                "start": words[0]["start"] if words else 0,
                "end": 0,
                "words": []
            }
            
            for word in words:
                current_segment["text"] += word["word"] + " "
                current_segment["end"] = word["end"]
                current_segment["words"].append({
                    "word": word["word"],
                    "start": word["start"],
                    "end": word["end"],
                    "confidence": word.get("conf", 0.5)
                })
                
                # Create new segment after punctuation or long pause
                if len(current_segment["words"]) > 10:
                    current_segment["text"] = current_segment["text"].strip()
                    segments.append(current_segment)
                    current_segment = {
                        "text": "",
                        "start": word["end"],
                        "end": 0,
                        "words": []
                    }
            
            if current_segment["text"]:
                current_segment["text"] = current_segment["text"].strip()
                segments.append(current_segment)
        
        return segments
    
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
            'lymphknoten', 'axillär', 'benigne', 'maligne', 'überweisung',
            'indikation', 'vorsorge', 'belastung', 'brustkrebs', 'erkrankung'
        ]
        
        found = []
        lower_text = text.lower()
        
        for term in medical_terms:
            if term in lower_text:
                found.append(term)
        
        return list(set(found))

async def main():
    """Main server function"""
    service = VoskTranscriptionService()
    await service.initialize()
    
    # Start WebSocket server
    print("Starting Vosk transcription service on ws://localhost:8002/ws/transcribe", flush=True)
    
    async def serve_websocket(websocket):
        # Extract path from websocket object if needed
        path = websocket.path if hasattr(websocket, 'path') else '/'
        await service.handle_client(websocket, path)
    
    ws_server = await websockets.serve(serve_websocket, "localhost", 8002)
    
    # Start HTTP server for health checks
    async def health(request):
        return web.json_response({
            "status": "healthy", 
            "service": "vosk",
            "model": service.model_path,
            "sessions": len(service.sessions)
        })
    
    app = web.Application()
    app.router.add_get('/health', health)
    
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, 'localhost', 8003)
    await site.start()
    
    print("Health check available at http://localhost:8003/health", flush=True)
    print("Vosk transcription service ready!", flush=True)
    
    # Run forever
    await asyncio.Future()

if __name__ == "__main__":
    asyncio.run(main())