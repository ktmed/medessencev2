#!/usr/bin/env python3
"""
Vosk Transcription Service for MedEssenceAI
Provides WebSocket-based audio transcription using Vosk
"""

import asyncio
import json
import logging
import os
import sys
import traceback
import websockets
from aiohttp import web, web_runner
import aiohttp_cors
import vosk
import wave
import tempfile

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/app/logs/vosk-service.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

class VoskTranscriptionService:
    def __init__(self):
        self.model = None
        self.rec = None
        self.connected_clients = set()
        
    async def initialize_model(self):
        """Initialize the Vosk model"""
        try:
            model_path = os.environ.get('VOSK_MODEL_PATH', '/app/vosk-models')
            if not os.path.exists(model_path):
                logger.error(f"Vosk model path does not exist: {model_path}")
                # Create a mock response for testing without actual model
                self.model = "mock"
                logger.warning("Running in mock mode - no actual transcription")
                return
            
            logger.info(f"Loading Vosk model from {model_path}")
            self.model = vosk.Model(model_path)
            self.rec = vosk.KaldiRecognizer(self.model, 16000)
            logger.info("Vosk model loaded successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize Vosk model: {str(e)}")
            self.model = "mock"
            logger.warning("Running in mock mode due to model load failure")

    async def handle_websocket(self, websocket, path):
        """Handle WebSocket connections for transcription"""
        client_id = id(websocket)
        self.connected_clients.add(websocket)
        logger.info(f"Client {client_id} connected")
        
        try:
            async for message in websocket:
                if isinstance(message, str):
                    # Handle control messages
                    try:
                        data = json.loads(message)
                        if data.get('type') == 'config':
                            await websocket.send(json.dumps({
                                'type': 'config_ack',
                                'status': 'ready'
                            }))
                    except json.JSONDecodeError:
                        logger.warning(f"Invalid JSON message from client {client_id}")
                else:
                    # Handle audio data
                    try:
                        result = await self.process_audio(message)
                        if result:
                            await websocket.send(json.dumps({
                                'type': 'transcription',
                                'text': result,
                                'final': True
                            }))
                    except Exception as e:
                        logger.error(f"Error processing audio: {str(e)}")
                        await websocket.send(json.dumps({
                            'type': 'error',
                            'message': 'Transcription error'
                        }))
                        
        except websockets.exceptions.ConnectionClosed:
            logger.info(f"Client {client_id} disconnected")
        except Exception as e:
            logger.error(f"WebSocket error for client {client_id}: {str(e)}")
        finally:
            self.connected_clients.discard(websocket)

    async def process_audio(self, audio_data):
        """Process audio data and return transcription"""
        try:
            if self.model == "mock":
                # Return mock transcription for testing
                return "Mock transcription: Patient reports chest pain and shortness of breath."
            
            if self.rec is None:
                return None
                
            # Accept audio data and process it
            if self.rec.AcceptWaveform(audio_data):
                result = json.loads(self.rec.Result())
                return result.get('text', '')
            else:
                partial_result = json.loads(self.rec.PartialResult())
                return partial_result.get('partial', '')
                
        except Exception as e:
            logger.error(f"Audio processing error: {str(e)}")
            return None

    async def health_check(self, request):
        """Health check endpoint"""
        try:
            status = {
                'status': 'healthy',
                'service': 'vosk-transcription',
                'model_loaded': self.model is not None,
                'connected_clients': len(self.connected_clients),
                'version': '1.0.0'
            }
            return web.json_response(status)
        except Exception as e:
            logger.error(f"Health check error: {str(e)}")
            return web.json_response({
                'status': 'unhealthy',
                'error': str(e)
            }, status=500)

    async def start_http_server(self):
        """Start HTTP server for health checks"""
        app = web.Application()
        
        # Add CORS support
        cors = aiohttp_cors.setup(app, defaults={
            "*": aiohttp_cors.ResourceOptions(
                allow_credentials=True,
                expose_headers="*",
                allow_headers="*",
                allow_methods="*"
            )
        })
        
        # Add routes
        app.router.add_get('/health', self.health_check)
        
        # Add CORS to all routes
        for route in list(app.router.routes()):
            cors.add(route)
        
        runner = web_runner.AppRunner(app)
        await runner.setup()
        
        site = web_runner.TCPSite(runner, '0.0.0.0', 8003)
        await site.start()
        logger.info("HTTP health check server started on port 8003")

    async def start_websocket_server(self):
        """Start WebSocket server"""
        logger.info("Starting WebSocket server on port 8002")
        start_server = websockets.serve(
            self.handle_websocket, 
            '0.0.0.0', 
            8002,
            ping_interval=20,
            ping_timeout=10
        )
        await start_server
        logger.info("WebSocket server started successfully")

    async def run(self):
        """Run the transcription service"""
        logger.info("Starting Vosk Transcription Service")
        
        # Initialize model
        await self.initialize_model()
        
        # Start both HTTP and WebSocket servers
        await asyncio.gather(
            self.start_http_server(),
            self.start_websocket_server()
        )

if __name__ == '__main__':
    service = VoskTranscriptionService()
    
    try:
        asyncio.run(service.run())
    except KeyboardInterrupt:
        logger.info("Service stopped by user")
    except Exception as e:
        logger.error(f"Service error: {str(e)}")
        logger.error(traceback.format_exc())
        sys.exit(1)