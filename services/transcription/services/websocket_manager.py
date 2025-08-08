"""
WebSocket Manager for real-time transcription
Handles WebSocket connections, session management, and audio streaming
"""

import asyncio
import json
import logging
import time
import uuid
from typing import Dict, List, Optional, Set

from fastapi import WebSocket
from pydantic import BaseModel

from config import Config, config

logger = logging.getLogger(__name__)

class SessionConfig(BaseModel):
    """WebSocket session configuration"""
    language: str = "auto"
    medical_context: bool = True
    quality_threshold: float = 0.7
    chunk_duration: float = 1.0  # Process every 1 second for lower latency
    enable_vad: bool = True
    noise_suppression: bool = True

class TranscriptionSession:
    """Individual transcription session"""
    
    def __init__(self, session_id: str, websocket: WebSocket):
        self.session_id = session_id
        self.websocket = websocket
        self.config = SessionConfig()
        self.created_at = time.time()
        self.last_activity = time.time()
        self.audio_buffer = bytearray()
        self.is_active = True
        self.transcription_history: List[Dict] = []
        self.partial_results: List[str] = []
        
    def update_activity(self):
        """Update last activity timestamp"""
        self.last_activity = time.time()
    
    def is_expired(self, timeout: int) -> bool:
        """Check if session is expired"""
        return time.time() - self.last_activity > timeout
    
    def add_audio_data(self, audio_data: bytes):
        """Add audio data to buffer"""
        self.audio_buffer.extend(audio_data)
        self.update_activity()
    
    def get_and_clear_buffer(self) -> bytes:
        """Get audio buffer and clear it"""
        data = bytes(self.audio_buffer)
        self.audio_buffer.clear()
        return data
    
    def add_transcription_result(self, result: Dict):
        """Add transcription result to history"""
        self.transcription_history.append({
            **result,
            "timestamp": time.time(),
            "session_id": self.session_id
        })
        self.update_activity()

class WebSocketManager:
    """Manages WebSocket connections and sessions"""
    
    def __init__(self):
        self.active_connections: Dict[str, TranscriptionSession] = {}
        self.ip_connection_count: Dict[str, int] = {}
        self.processing_tasks: Dict[str, asyncio.Task] = {}
        self._cleanup_task: Optional[asyncio.Task] = None
        self._start_cleanup_task()
    
    def _start_cleanup_task(self):
        """Start periodic cleanup task"""
        if not self._cleanup_task or self._cleanup_task.done():
            self._cleanup_task = asyncio.create_task(self._periodic_cleanup())
    
    async def _periodic_cleanup(self):
        """Periodically clean up expired sessions"""
        while True:
            try:
                await asyncio.sleep(config.HEALTH_CHECK_INTERVAL)
                await self._cleanup_expired_sessions()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Cleanup task error: {e}")
    
    async def _cleanup_expired_sessions(self):
        """Clean up expired sessions"""
        current_time = time.time()
        expired_sessions = []
        
        for session_id, session in self.active_connections.items():
            if session.is_expired(config.SESSION_TIMEOUT):
                expired_sessions.append(session_id)
        
        for session_id in expired_sessions:
            logger.info(f"Cleaning up expired session: {session_id}")
            await self.remove_connection(session_id)
    
    async def add_connection(self, websocket: WebSocket) -> str:
        """Add new WebSocket connection"""
        # Get client IP
        client_ip = self._get_client_ip(websocket)
        
        # Check connection limits
        if self.ip_connection_count.get(client_ip, 0) >= config.MAX_SESSIONS_PER_IP:
            await websocket.close(code=1008, reason="Too many connections from this IP")
            raise Exception("Connection limit exceeded")
        
        if len(self.active_connections) >= config.WS_MAX_CONNECTIONS:
            await websocket.close(code=1008, reason="Server at capacity")
            raise Exception("Server at capacity")
        
        # Create session
        session_id = str(uuid.uuid4())
        session = TranscriptionSession(session_id, websocket)
        
        # Store connection
        self.active_connections[session_id] = session
        self.ip_connection_count[client_ip] = self.ip_connection_count.get(client_ip, 0) + 1
        
        # Start heartbeat task
        heartbeat_task = asyncio.create_task(self._heartbeat_loop(session_id))
        self.processing_tasks[f"{session_id}_heartbeat"] = heartbeat_task
        
        logger.info(f"WebSocket connection added: {session_id} from {client_ip}")
        return session_id
    
    async def remove_connection(self, session_id: str):
        """Remove WebSocket connection"""
        if session_id not in self.active_connections:
            return
        
        session = self.active_connections[session_id]
        client_ip = self._get_client_ip(session.websocket)
        
        # Cancel processing tasks
        tasks_to_cancel = [
            task_id for task_id in self.processing_tasks.keys()
            if task_id.startswith(session_id)
        ]
        
        for task_id in tasks_to_cancel:
            task = self.processing_tasks.pop(task_id, None)
            if task and not task.done():
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass
        
        # Update connection count
        if client_ip in self.ip_connection_count:
            self.ip_connection_count[client_ip] -= 1
            if self.ip_connection_count[client_ip] <= 0:
                del self.ip_connection_count[client_ip]
        
        # Remove session
        del self.active_connections[session_id]
        session.is_active = False
        
        # Close WebSocket if still open
        try:
            if not session.websocket.client_state.name == "DISCONNECTED":
                await session.websocket.close()
        except Exception as e:
            logger.warning(f"Error closing WebSocket: {e}")
        
        logger.info(f"WebSocket connection removed: {session_id}")
    
    async def update_session_config(self, session_id: str, config_data: Dict):
        """Update session configuration"""
        if session_id not in self.active_connections:
            raise Exception("Session not found")
        
        session = self.active_connections[session_id]
        
        # Update configuration
        for key, value in config_data.items():
            if hasattr(session.config, key):
                setattr(session.config, key, value)
        
        session.update_activity()
        logger.info(f"Session config updated: {session_id}")
    
    async def process_audio_chunk(self, session_id: str, audio_data: str, transcription_service):
        """Process audio chunk for transcription"""
        if session_id not in self.active_connections:
            raise Exception("Session not found")
        
        session = self.active_connections[session_id]
        
        try:
            # Decode base64 audio data
            import base64
            audio_bytes = base64.b64decode(audio_data)
            
            # Add to buffer
            session.add_audio_data(audio_bytes)
            
            # Check if we have enough data to process
            buffer_duration = len(session.audio_buffer) / (config.AUDIO_SAMPLE_RATE * 2)  # 16-bit audio
            
            if buffer_duration >= session.config.chunk_duration:
                # Start processing task
                task_id = f"{session_id}_process_{int(time.time())}"
                task = asyncio.create_task(
                    self._process_audio_buffer(session_id, transcription_service)
                )
                self.processing_tasks[task_id] = task
        
        except Exception as e:
            logger.error(f"Error processing audio chunk: {e}")
            await session.websocket.send_json({
                "type": "error",
                "message": f"Audio processing error: {str(e)}"
            })
    
    async def _process_audio_buffer(self, session_id: str, transcription_service):
        """Process audio buffer for transcription"""
        if session_id not in self.active_connections:
            return
        
        session = self.active_connections[session_id]
        
        try:
            # Get audio data
            audio_data = session.get_and_clear_buffer()
            if not audio_data:
                return
            
            # Create transcription request
            from main import TranscriptionRequest
            request = TranscriptionRequest(
                language=session.config.language,
                medical_context=session.config.medical_context,
                quality_threshold=session.config.quality_threshold
            )
            
            # Process transcription
            result = await transcription_service.transcribe_audio_stream(
                audio_data=audio_data,
                request=request,
                session_id=session_id
            )
            
            # Send result to client
            await session.websocket.send_json({
                "type": "transcription",
                "data": result.dict(),
                "session_id": session_id
            })
            
            # Store in session history
            session.add_transcription_result(result.dict())
        
        except Exception as e:
            logger.error(f"Error processing audio buffer: {e}")
            if session.websocket and session.is_active:
                try:
                    await session.websocket.send_json({
                        "type": "error",
                        "message": f"Transcription error: {str(e)}"
                    })
                except:
                    pass
    
    async def end_session(self, session_id: str):
        """End transcription session"""
        if session_id not in self.active_connections:
            return
        
        session = self.active_connections[session_id]
        
        # Send final results
        try:
            await session.websocket.send_json({
                "type": "session_ended",
                "session_id": session_id,
                "total_transcriptions": len(session.transcription_history),
                "session_duration": time.time() - session.created_at
            })
        except:
            pass
        
        # Clean up session
        await self.remove_connection(session_id)
    
    async def _heartbeat_loop(self, session_id: str):
        """Send periodic heartbeat to keep connection alive"""
        while session_id in self.active_connections:
            try:
                session = self.active_connections[session_id]
                if not session.is_active:
                    break
                
                await session.websocket.send_json({
                    "type": "heartbeat",
                    "timestamp": time.time()
                })
                
                await asyncio.sleep(config.WS_HEARTBEAT_INTERVAL)
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.warning(f"Heartbeat error for session {session_id}: {e}")
                break
    
    def _get_client_ip(self, websocket: WebSocket) -> str:
        """Get client IP address from WebSocket"""
        try:
            # Try to get real IP from headers
            forwarded_for = websocket.headers.get("x-forwarded-for")
            if forwarded_for:
                return forwarded_for.split(",")[0].strip()
            
            real_ip = websocket.headers.get("x-real-ip")
            if real_ip:
                return real_ip
            
            # Fallback to client address
            if hasattr(websocket, "client") and websocket.client:
                return websocket.client.host
            
            return "unknown"
        except:
            return "unknown"
    
    def get_session_info(self, session_id: str) -> Optional[Dict]:
        """Get session information"""
        if session_id not in self.active_connections:
            return None
        
        session = self.active_connections[session_id]
        return {
            "session_id": session_id,
            "created_at": session.created_at,
            "last_activity": session.last_activity,
            "is_active": session.is_active,
            "config": session.config.dict(),
            "transcription_count": len(session.transcription_history),
            "buffer_size": len(session.audio_buffer)
        }
    
    def get_stats(self) -> Dict:
        """Get WebSocket manager statistics"""
        return {
            "active_connections": len(self.active_connections),
            "processing_tasks": len(self.processing_tasks),
            "ip_connections": dict(self.ip_connection_count),
            "total_sessions": len(self.active_connections)
        }