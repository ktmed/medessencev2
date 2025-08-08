"""
FastAPI Transcription Service for Medical Audio Processing
Real-time transcription with OpenAI Whisper, WebSocket support, and medical terminology optimization
"""

import asyncio
import json
import logging
import os
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Dict, List, Optional

import redis.asyncio as redis
from fastapi import FastAPI, File, Form, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from config import Config, config
from services.transcription_service import TranscriptionService
from services.websocket_manager import WebSocketManager
from utils.audio_processor import AudioProcessor
from utils.error_handler import ErrorHandler
from utils.logger import setup_logger, setup_structlog, TranscriptionLogger
from utils.medical_terminology import MedicalTerminologyProcessor
from utils.redis_manager import RedisManager

# Setup logging after config is loaded
setup_structlog(debug=config.DEBUG, log_level=config.LOG_LEVEL)
logger = setup_logger(__name__, config.LOG_LEVEL)

# Global transcription logger instance
transcription_logger = TranscriptionLogger()

# Global instances
transcription_service: Optional[TranscriptionService] = None
websocket_manager: Optional[WebSocketManager] = None
audio_processor: Optional[AudioProcessor] = None
redis_manager: Optional[RedisManager] = None
medical_processor: Optional[MedicalTerminologyProcessor] = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan management"""
    global transcription_service, websocket_manager, audio_processor, redis_manager, medical_processor
    
    try:
        logger.info("Starting transcription service...")
        
        # Initialize Redis connection
        redis_manager = RedisManager()
        try:
            await redis_manager.connect()
        except Exception as e:
            logger.warning(f"Redis connection failed: {e}. Continuing without Redis.")
        
        # Initialize services
        audio_processor = AudioProcessor()
        medical_processor = MedicalTerminologyProcessor()
        transcription_service = TranscriptionService(
            audio_processor=audio_processor,
            medical_processor=medical_processor,
            redis_manager=redis_manager
        )
        websocket_manager = WebSocketManager()
        
        # Initialize transcription models
        await transcription_service.initialize()
        
        logger.info("Transcription service initialized successfully")
        yield
        
    except Exception as e:
        logger.error(f"Failed to initialize transcription service: {e}")
        raise
    finally:
        logger.info("Shutting down transcription service...")
        if redis_manager:
            await redis_manager.close()

# Create FastAPI app
app = FastAPI(
    title="Medical Transcription Service",
    description="Real-time audio transcription with medical terminology optimization",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models
class TranscriptionRequest(BaseModel):
    language: Optional[str] = Field(default="auto", description="Language code (auto, en, de, fr, es, it, tr)")
    medical_context: Optional[bool] = Field(default=True, description="Enable medical terminology optimization")
    quality_threshold: Optional[float] = Field(default=0.7, description="Minimum confidence threshold")

class TranscriptionResponse(BaseModel):
    text: str
    language: str
    confidence: float
    processing_time: float
    medical_terms: List[str]
    quality_score: float
    segments: List[Dict]

class HealthResponse(BaseModel):
    status: str
    version: str
    models_loaded: bool
    redis_connected: bool
    uptime: float

class LanguageInfo(BaseModel):
    code: str
    name: str
    medical_support: bool

# Error handler
error_handler = ErrorHandler()

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    return await error_handler.handle_exception(request, exc)

# Health check endpoint
@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    try:
        models_loaded = transcription_service and transcription_service.is_initialized()
        redis_connected = False
        try:
            redis_connected = redis_manager and await redis_manager.is_connected()
        except:
            pass
        
        return HealthResponse(
            status="healthy" if models_loaded else "degraded",
            version="1.0.0",
            models_loaded=models_loaded,
            redis_connected=redis_connected,
            uptime=time.time() - app.extra.get("start_time", time.time())
        )
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(status_code=503, detail="Service unavailable")

# Get supported languages
@app.get("/languages", response_model=List[LanguageInfo])
async def get_supported_languages():
    """Get list of supported languages"""
    languages = [
        LanguageInfo(code="auto", name="Auto-detect", medical_support=True),
        LanguageInfo(code="en", name="English", medical_support=True),
        LanguageInfo(code="de", name="German", medical_support=True),
        LanguageInfo(code="fr", name="French", medical_support=True),
        LanguageInfo(code="es", name="Spanish", medical_support=True),
        LanguageInfo(code="it", name="Italian", medical_support=True),
        LanguageInfo(code="tr", name="Turkish", medical_support=True),
    ]
    return languages

# File transcription endpoint
@app.post("/transcribe", response_model=TranscriptionResponse)
async def transcribe_audio(
    file: UploadFile = File(...),
    language: str = Form(default="auto"),
    medical_context: bool = Form(default=True),
    quality_threshold: float = Form(default=0.7)
):
    """Transcribe uploaded audio file"""
    if not transcription_service:
        raise HTTPException(status_code=503, detail="Transcription service not available")
    
    # Validate file
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    
    supported_formats = {'.wav', '.mp3', '.m4a', '.webm', '.ogg', '.flac'}
    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in supported_formats:
        raise HTTPException(
            status_code=400, 
            detail=f"Unsupported file format. Supported: {', '.join(supported_formats)}"
        )
    
    try:
        # Read file content
        audio_data = await file.read()
        
        # Create transcription request
        request = TranscriptionRequest(
            language=language,
            medical_context=medical_context,
            quality_threshold=quality_threshold
        )
        
        # Process transcription
        result = await transcription_service.transcribe_audio(
            audio_data=audio_data,
            filename=file.filename,
            request=request
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Transcription failed: {e}")
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")

# WebSocket endpoint for real-time transcription
@app.websocket("/ws/transcribe")
async def websocket_transcribe(websocket: WebSocket):
    """WebSocket endpoint for real-time audio transcription"""
    if not websocket_manager or not transcription_service:
        await websocket.close(code=1011, reason="Service unavailable")
        return
    
    await websocket.accept()
    session_id = await websocket_manager.add_connection(websocket)
    
    try:
        logger.info(f"WebSocket connection established: {session_id}")
        
        while True:
            try:
                # Receive message
                message = await websocket.receive_text()
                data = json.loads(message)
                
                if data.get("type") == "config":
                    # Update session configuration
                    await websocket_manager.update_session_config(session_id, data.get("config", {}))
                    await websocket.send_json({
                        "type": "config_updated",
                        "session_id": session_id
                    })
                    
                elif data.get("type") == "audio":
                    # Process audio chunk
                    audio_data = data.get("data")
                    if audio_data:
                        await websocket_manager.process_audio_chunk(
                            session_id=session_id,
                            audio_data=audio_data,
                            transcription_service=transcription_service
                        )
                
                elif data.get("type") == "end_session":
                    # End transcription session
                    await websocket_manager.end_session(session_id)
                    break
                    
            except WebSocketDisconnect:
                logger.info(f"WebSocket disconnected: {session_id}")
                break
            except json.JSONDecodeError:
                await websocket.send_json({
                    "type": "error",
                    "message": "Invalid JSON format"
                })
            except Exception as e:
                logger.error(f"WebSocket error: {e}")
                await websocket.send_json({
                    "type": "error",
                    "message": str(e)
                })
                
    except Exception as e:
        logger.error(f"WebSocket connection error: {e}")
    finally:
        await websocket_manager.remove_connection(session_id)

# Session management endpoints
@app.get("/sessions/{session_id}")
async def get_session_info(session_id: str):
    """Get session information"""
    if not redis_manager:
        raise HTTPException(status_code=503, detail="Redis service unavailable")
    
    session_data = await redis_manager.get_session(session_id)
    if not session_data:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return session_data

@app.delete("/sessions/{session_id}")
async def delete_session(session_id: str):
    """Delete session and associated data"""
    if not redis_manager:
        raise HTTPException(status_code=503, detail="Redis service unavailable")
    
    await redis_manager.delete_session(session_id)
    return {"message": "Session deleted successfully"}

# Metrics endpoint
@app.get("/metrics")
async def get_metrics():
    """Get service metrics"""
    if not transcription_service:
        raise HTTPException(status_code=503, detail="Service unavailable")
    
    metrics = await transcription_service.get_metrics()
    return metrics

if __name__ == "__main__":
    import uvicorn
    
    # Store start time
    app.extra = {"start_time": time.time()}
    
    uvicorn.run(
        "main:app",
        host=config.HOST,
        port=config.PORT,
        reload=config.DEBUG,
        log_level="info"
    )