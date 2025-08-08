"""
Transcription service with OpenAI Whisper integration
Supports both local and API-based transcription with medical terminology optimization
"""

import asyncio
import io
import logging
import time
import tempfile
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import numpy as np
import openai
import torch
import whisper
from tenacity import retry, stop_after_attempt, wait_exponential

from config import Config, config
from utils.audio_processor import AudioProcessor
from utils.medical_terminology import MedicalTerminologyProcessor
from utils.redis_manager import RedisManager

# Try to import German medical Whisper client
try:
    from services.whisper_german_medical import WhisperGermanMedicalClient
    GERMAN_MEDICAL_AVAILABLE = True
except ImportError:
    GERMAN_MEDICAL_AVAILABLE = False
    logging.warning("German medical Whisper client not available")

# Try to import Gemini refiner
try:
    from services.gemini_refiner import gemini_refiner
    GEMINI_REFINER_AVAILABLE = gemini_refiner.is_available()
except Exception as e:
    GEMINI_REFINER_AVAILABLE = False
    logging.warning(f"Gemini refiner not available: {e}")

logger = logging.getLogger(__name__)

class TranscriptionResult:
    """Transcription result container"""
    
    def __init__(self, text: str, language: str, confidence: float, 
                 processing_time: float, medical_terms: List[str],
                 quality_score: float, segments: List[Dict]):
        self.text = text
        self.language = language
        self.confidence = confidence
        self.processing_time = processing_time
        self.medical_terms = medical_terms
        self.quality_score = quality_score
        self.segments = segments
    
    def dict(self) -> Dict:
        """Convert to dictionary"""
        return {
            "text": self.text,
            "language": self.language,
            "confidence": self.confidence,
            "processing_time": self.processing_time,
            "medical_terms": self.medical_terms,
            "quality_score": self.quality_score,
            "segments": self.segments
        }

class TranscriptionService:
    """Main transcription service"""
    
    def __init__(self, audio_processor: AudioProcessor, 
                 medical_processor: MedicalTerminologyProcessor,
                 redis_manager: RedisManager):
        self.audio_processor = audio_processor
        self.medical_processor = medical_processor
        self.redis_manager = redis_manager
        
        # Model instances
        self.local_model = None  # Whisper model instance
        self.german_medical_client = None  # German medical Whisper client
        self.openai_client: Optional[openai.AsyncOpenAI] = None
        
        # Performance tracking
        self.transcription_count = 0
        self.total_processing_time = 0.0
        self.error_count = 0
        
        # Concurrency control
        self.transcription_semaphore = asyncio.Semaphore(config.MAX_CONCURRENT_TRANSCRIPTIONS)
        
        self._initialized = False
    
    async def initialize(self):
        """Initialize transcription models"""
        try:
            logger.info("Initializing transcription service...")
            logger.info(f"USE_LOCAL_WHISPER: {config.USE_LOCAL_WHISPER}")
            logger.info(f"OPENAI_API_KEY present: {bool(config.OPENAI_API_KEY)}")
            
            # Initialize OpenAI client if API key is provided
            if config.OPENAI_API_KEY:
                self.openai_client = openai.AsyncOpenAI(
                    api_key=config.OPENAI_API_KEY,
                    timeout=config.OPENAI_TIMEOUT
                )
                logger.info("OpenAI client initialized")
            
            # Initialize local Whisper model if enabled
            if config.USE_LOCAL_WHISPER:
                # Check if we should use German medical model
                if config.USE_GERMAN_MEDICAL_MODEL and GERMAN_MEDICAL_AVAILABLE:
                    logger.info("Initializing German medical Whisper model...")
                    await self._initialize_german_medical_model()
                    logger.info(f"German medical model loaded: {self.german_medical_client is not None}")
                else:
                    logger.info("Initializing local Whisper model...")
                    await self._initialize_local_model()
                    logger.info(f"Local model loaded: {self.local_model is not None}")
            else:
                logger.info("Local Whisper model disabled")
            
            self._initialized = True
            logger.info("Transcription service initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize transcription service: {e}")
            raise
    
    async def _initialize_local_model(self):
        """Initialize local Whisper model"""
        try:
            logger.info(f"Loading Whisper model: {config.WHISPER_MODEL}")
            
            # Run model loading in thread pool to avoid blocking
            loop = asyncio.get_event_loop()
            self.local_model = await loop.run_in_executor(
                None, self._load_whisper_model
            )
            
            logger.info("Local Whisper model loaded successfully")
            
        except Exception as e:
            logger.error(f"Failed to load local Whisper model: {e}")
            if not config.OPENAI_API_KEY:
                raise Exception("No fallback available - both local model and OpenAI API failed")
    
    def _load_whisper_model(self):
        """Load Whisper model (runs in thread pool)"""
        device = config.WHISPER_DEVICE
        if device == "auto":
            device = "cuda" if torch.cuda.is_available() else "cpu"
        
        return whisper.load_model(
            config.WHISPER_MODEL,
            device=device,
            download_root=str(config.model_cache_dir_path)
        )
    
    async def _initialize_german_medical_model(self):
        """Initialize German medical Whisper model"""
        try:
            logger.info(f"Loading German medical Whisper model: {config.GERMAN_MEDICAL_MODEL}")
            
            # Create client instance
            self.german_medical_client = WhisperGermanMedicalClient(
                model_size=config.GERMAN_MEDICAL_MODEL,
                use_medical_enhancement=True
            )
            
            # Load model (this is synchronous but quick)
            self.german_medical_client._load_model()
            
            logger.info("German medical Whisper model loaded successfully")
            
        except Exception as e:
            logger.error(f"Failed to load German medical Whisper model: {e}")
            if not config.OPENAI_API_KEY:
                raise Exception("No fallback available - both German medical model and OpenAI API failed")
    
    def is_initialized(self) -> bool:
        """Check if service is initialized"""
        return self._initialized
    
    async def transcribe_audio(self, audio_data: bytes, filename: str, 
                             request) -> TranscriptionResult:
        """Transcribe uploaded audio file"""
        async with self.transcription_semaphore:
            start_time = time.time()
            
            try:
                # Process audio
                audio_array, sample_rate = await self.audio_processor.process_uploaded_file(
                    audio_data, filename
                )
                
                # Calculate quality metrics
                quality_metrics = self.audio_processor.calculate_audio_quality_metrics(
                    audio_array, sample_rate
                )
                
                # Check quality threshold
                if quality_metrics['quality_score'] < request.quality_threshold:
                    logger.warning(f"Audio quality below threshold: {quality_metrics['quality_score']}")
                
                # Split long audio if needed
                audio_chunks = self.audio_processor.split_long_audio(
                    audio_array, sample_rate, config.AUDIO_CHUNK_DURATION
                )
                
                # Transcribe chunks
                all_segments = []
                all_text = []
                total_confidence = 0.0
                
                for i, chunk in enumerate(audio_chunks):
                    chunk_result = await self._transcribe_chunk(
                        chunk, sample_rate, request.language, i
                    )
                    
                    all_segments.extend(chunk_result['segments'])
                    all_text.append(chunk_result['text'])
                    total_confidence += chunk_result['confidence']
                
                # Combine results
                combined_text = " ".join(all_text).strip()
                average_confidence = total_confidence / len(audio_chunks) if audio_chunks else 0.0
                
                # Apply medical terminology processing
                medical_terms = []
                if request.medical_context:
                    combined_text, medical_terms = await self.medical_processor.process_text(
                        combined_text, request.language
                    )
                
                # Apply Gemini refinement if available and language is German
                # TEMPORARILY DISABLED DUE TO STARTUP ISSUES
                # if GEMINI_REFINER_AVAILABLE and detected_language in ['de', 'german']:
                #     try:
                #         logger.info("Applying Gemini refinement to transcription")
                #         refined_text = await gemini_refiner.refine_transcription(combined_text, 'de')
                #         if refined_text and refined_text != combined_text:
                #             logger.info(f"Gemini refinement improved transcription - Original: {len(combined_text)} chars, Refined: {len(refined_text)} chars")
                #             combined_text = refined_text
                #     except Exception as e:
                #         logger.warning(f"Gemini refinement failed, using original text: {e}")
                
                # Detect language if auto
                detected_language = request.language
                if request.language == "auto" and all_segments:
                    detected_language = all_segments[0].get('language', 'en')
                
                processing_time = time.time() - start_time
                
                # Update metrics
                self.transcription_count += 1
                self.total_processing_time += processing_time
                
                return TranscriptionResult(
                    text=combined_text,
                    language=detected_language,
                    confidence=average_confidence,
                    processing_time=processing_time,
                    medical_terms=medical_terms,
                    quality_score=quality_metrics['quality_score'],
                    segments=all_segments
                )
                
            except Exception as e:
                self.error_count += 1
                logger.error(f"Transcription failed: {e}")
                raise
    
    async def transcribe_audio_stream(self, audio_data: bytes, request, 
                                    session_id: str) -> TranscriptionResult:
        """Transcribe streaming audio data"""
        async with self.transcription_semaphore:
            start_time = time.time()
            
            try:
                # Process streaming audio
                audio_array, sample_rate = await self.audio_processor.process_streaming_audio(
                    audio_data
                )
                
                # Calculate basic quality metrics
                quality_metrics = self.audio_processor.calculate_audio_quality_metrics(
                    audio_array, sample_rate
                )
                
                # Transcribe
                result = await self._transcribe_chunk(
                    audio_array, sample_rate, request.language, 0
                )
                
                # Apply medical terminology processing
                medical_terms = []
                text = result['text']
                if request.medical_context:
                    text, medical_terms = await self.medical_processor.process_text(
                        text, request.language
                    )
                
                # Apply Gemini refinement if available and language is German
                # TEMPORARILY DISABLED DUE TO STARTUP ISSUES
                # detected_lang = result.get('language', request.language)
                # if GEMINI_REFINER_AVAILABLE and detected_lang in ['de', 'german']:
                #     try:
                #         logger.info("Applying Gemini refinement to streaming transcription")
                #         refined_text = await gemini_refiner.refine_transcription(text, 'de')
                #         if refined_text and refined_text != text:
                #             logger.info(f"Gemini refinement improved streaming transcription")
                #             text = refined_text
                #     except Exception as e:
                #         logger.warning(f"Gemini refinement failed for streaming, using original text: {e}")
                
                processing_time = time.time() - start_time
                
                # Cache result in Redis
                await self._cache_streaming_result(session_id, result, processing_time)
                
                return TranscriptionResult(
                    text=text,
                    language=result.get('language', request.language),
                    confidence=result['confidence'],
                    processing_time=processing_time,
                    medical_terms=medical_terms,
                    quality_score=quality_metrics['quality_score'],
                    segments=result['segments']
                )
                
            except Exception as e:
                self.error_count += 1
                logger.error(f"Streaming transcription failed: {e}")
                raise
    
    async def _transcribe_chunk(self, audio_array: np.ndarray, sample_rate: int, 
                              language: str, chunk_index: int) -> Dict:
        """Transcribe a single audio chunk"""
        try:
            logger.info(f"Transcribing chunk {chunk_index}, array shape: {audio_array.shape}, sample_rate: {sample_rate}")
            logger.info(f"German medical client available: {self.german_medical_client is not None}")
            logger.info(f"Local model available: {self.local_model is not None}, USE_LOCAL_WHISPER: {config.USE_LOCAL_WHISPER}")
            logger.info(f"OpenAI client available: {self.openai_client is not None}")
            
            # Try German medical model first if available and language is German
            if self.german_medical_client and language in ['de', 'german', 'auto'] and config.USE_LOCAL_WHISPER:
                logger.info("Using German medical Whisper model for transcription")
                return await self._transcribe_with_german_medical_model(
                    audio_array, sample_rate, language, chunk_index
                )
            
            # Try local model if available
            elif self.local_model and config.USE_LOCAL_WHISPER:
                logger.info("Using local Whisper model for transcription")
                return await self._transcribe_with_local_model(
                    audio_array, sample_rate, language, chunk_index
                )
            
            # Fallback to OpenAI API
            elif self.openai_client:
                logger.info("Using OpenAI API for transcription")
                return await self._transcribe_with_openai_api(
                    audio_array, sample_rate, language, chunk_index
                )
            
            else:
                raise Exception("No transcription method available")
                
        except Exception as e:
            logger.error(f"Chunk transcription failed: {e}")
            # Return empty result rather than failing completely
            return {
                'text': '',
                'confidence': 0.0,
                'language': language if language != 'auto' else 'en',
                'segments': []
            }
    
    async def _transcribe_with_local_model(self, audio_array: np.ndarray, 
                                         sample_rate: int, language: str, 
                                         chunk_index: int) -> Dict:
        """Transcribe using local Whisper model"""
        try:
            # Prepare options - optimized for quality
            options = {
                'task': 'transcribe',
                'language': 'de' if language in ['de', 'auto'] else language,  # Force German for better results
                'fp16': False,  # Use fp32 for better accuracy
                'beam_size': 5,  # Increased for better accuracy
                'best_of': 5,  # Increased for better accuracy
                'temperature': 0.0,
                'word_timestamps': True,  # Enable for better alignment
                'condition_on_previous_text': True,  # Better context understanding
                'compression_ratio_threshold': 2.4,
                'logprob_threshold': -1.0,
                'no_speech_threshold': 0.5,  # More sensitive
                'initial_prompt': 'Dies ist eine medizinische Diktation. Radiologischer Befund. ',  # German medical context
                'patience': 1.0,  # Better decoding
                'length_penalty': 1.0,
                'suppress_tokens': [-1]  # Don't suppress any tokens
            }
            
            # Run transcription in thread pool
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None, self._run_whisper_transcription, audio_array, options
            )
            
            # Calculate confidence from word-level timestamps
            confidence = self._calculate_confidence_from_segments(result.get('segments', []))
            
            return {
                'text': result['text'].strip(),
                'confidence': confidence,
                'language': result.get('language', 'en'),
                'segments': result.get('segments', [])
            }
            
        except Exception as e:
            logger.error(f"Local model transcription failed: {e}")
            raise
    
    def _run_whisper_transcription(self, audio_array: np.ndarray, options: Dict) -> Dict:
        """Run Whisper transcription (executed in thread pool)"""
        logger.info(f"Whisper transcription - audio shape: {audio_array.shape}, dtype: {audio_array.dtype}, range: [{audio_array.min()}, {audio_array.max()}]")
        
        # Check if audio is empty or too quiet
        if audio_array.size == 0:
            logger.warning("Empty audio array received")
            return {'text': '', 'segments': []}
        
        # Apply audio enhancement before checking RMS
        # Remove DC offset
        audio_array = audio_array - np.mean(audio_array)
        
        # Apply spectral subtraction for noise reduction
        if len(audio_array) > 1600:  # At least 0.1 second
            # Simple spectral gating
            noise_profile = audio_array[:1600]  # First 0.1 second as noise
            noise_spectrum = np.abs(np.fft.rfft(noise_profile))
            noise_threshold = np.mean(noise_spectrum) * 2
            
            # Process in chunks
            chunk_size = 1600
            processed_audio = []
            for i in range(0, len(audio_array) - chunk_size, chunk_size):
                chunk = audio_array[i:i+chunk_size]
                spectrum = np.fft.rfft(chunk)
                magnitude = np.abs(spectrum)
                phase = np.angle(spectrum)
                
                # Apply spectral gating
                magnitude[magnitude < noise_threshold] *= 0.1
                
                # Reconstruct
                cleaned_spectrum = magnitude * np.exp(1j * phase)
                cleaned_chunk = np.fft.irfft(cleaned_spectrum)
                processed_audio.append(cleaned_chunk)
            
            if processed_audio:
                audio_array = np.concatenate(processed_audio)
        
        # Calculate RMS after preprocessing
        rms = np.sqrt(np.mean(audio_array ** 2))
        logger.info(f"Audio RMS level after preprocessing: {rms}")
        
        if rms < 0.0005:  # Lower threshold after preprocessing
            logger.warning(f"Audio too quiet (RMS: {rms}), likely silence")
            return {'text': '', 'segments': []}
        
        # Ensure audio is in the correct format for Whisper
        # Whisper expects float32 audio with values between -1 and 1
        if audio_array.dtype != np.float32:
            audio_array = audio_array.astype(np.float32)
        
        # Normalize if needed
        if audio_array.max() > 1.0 or audio_array.min() < -1.0:
            max_val = max(abs(audio_array.max()), abs(audio_array.min()))
            if max_val > 0:
                audio_array = audio_array / max_val
        
        logger.info(f"Normalized audio - shape: {audio_array.shape}, dtype: {audio_array.dtype}, range: [{audio_array.min()}, {audio_array.max()}]")
        
        # Check audio duration
        duration = len(audio_array) / 16000  # Assuming 16kHz
        logger.info(f"Audio duration: {duration:.2f} seconds")
        
        if duration < 0.1:  # Less than 100ms
            logger.warning("Audio too short for reliable transcription")
            return {'text': '', 'segments': []}
        
        # Ensure audio is 1D
        if len(audio_array.shape) > 1:
            audio_array = audio_array.flatten()
            logger.info(f"Flattened audio to 1D - new shape: {audio_array.shape}")
        
        # Ensure minimum length for Whisper (at least 0.1 seconds)
        min_samples = int(0.1 * 16000)  # 0.1 seconds at 16kHz
        if len(audio_array) < min_samples:
            # Pad with zeros if too short
            audio_array = np.pad(audio_array, (0, min_samples - len(audio_array)), mode='constant')
            logger.info(f"Padded audio to minimum length - new shape: {audio_array.shape}")
        
        # Ensure maximum length for Whisper (max 30 seconds)
        max_samples = int(30 * 16000)  # 30 seconds at 16kHz
        if len(audio_array) > max_samples:
            logger.warning(f"Audio too long ({len(audio_array)/16000:.1f}s), truncating to 30s")
            audio_array = audio_array[:max_samples]
        
        return self.local_model.transcribe(audio_array, **options)
    
    async def _transcribe_with_german_medical_model(self, audio_array: np.ndarray, 
                                                  sample_rate: int, language: str, 
                                                  chunk_index: int) -> Dict:
        """Transcribe using German medical Whisper model"""
        try:
            # Run transcription in thread pool to avoid blocking
            loop = asyncio.get_event_loop()
            text = await loop.run_in_executor(
                None, self.german_medical_client.transcribe_audio_buffer, audio_array
            )
            
            if text:
                # Calculate confidence score (German medical model doesn't provide this)
                confidence = 0.85  # High confidence as this is a specialized model
                
                return {
                    'text': text,
                    'confidence': confidence,
                    'language': 'de',  # Always German
                    'segments': []  # German medical model doesn't provide segments
                }
            else:
                return {
                    'text': '',
                    'confidence': 0.0,
                    'language': 'de',
                    'segments': []
                }
                
        except Exception as e:
            logger.error(f"German medical model transcription failed: {e}")
            raise
    
    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=10))
    async def _transcribe_with_openai_api(self, audio_array: np.ndarray, 
                                        sample_rate: int, language: str, 
                                        chunk_index: int) -> Dict:
        """Transcribe using OpenAI API"""
        try:
            # Convert numpy array to audio file in memory
            with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_file:
                import soundfile as sf
                sf.write(temp_file.name, audio_array, sample_rate)
                temp_path = temp_file.name
            
            try:
                # Prepare API request
                with open(temp_path, 'rb') as audio_file:
                    transcript = await self.openai_client.audio.transcriptions.create(
                        model=config.OPENAI_MODEL,
                        file=audio_file,
                        language=None if language == 'auto' else language,
                        response_format="verbose_json"
                    )
                
                # Calculate confidence (OpenAI doesn't provide confidence scores)
                # We'll estimate based on segment count and text length
                confidence = self._estimate_openai_confidence(transcript.text)
                
                # Convert OpenAI response to our format
                segments = []
                if hasattr(transcript, 'words') and transcript.words:
                    for word in transcript.words:
                        segments.append({
                            'start': word.start,
                            'end': word.end,
                            'text': word.word,
                            'avg_logprob': -0.5,  # Estimated
                            'no_speech_prob': 0.1  # Estimated
                        })
                
                return {
                    'text': transcript.text.strip(),
                    'confidence': confidence,
                    'language': transcript.language if hasattr(transcript, 'language') else 'en',
                    'segments': segments
                }
                
            finally:
                # Clean up temporary file
                Path(temp_path).unlink(missing_ok=True)
                
        except Exception as e:
            logger.error(f"OpenAI API transcription failed: {e}")
            raise
    
    def _calculate_confidence_from_segments(self, segments: List[Dict]) -> float:
        """Calculate confidence score from Whisper segments"""
        if not segments:
            return 0.0
        
        # Use average log probability and no speech probability
        total_logprob = 0.0
        total_no_speech_prob = 0.0
        
        for segment in segments:
            total_logprob += segment.get('avg_logprob', -1.0)
            total_no_speech_prob += segment.get('no_speech_prob', 0.5)
        
        avg_logprob = total_logprob / len(segments)
        avg_no_speech_prob = total_no_speech_prob / len(segments)
        
        # Convert to confidence score (0-1)
        # avg_logprob ranges from -inf to 0, typically -3 to 0 for good audio
        logprob_confidence = max(0, min(1, (avg_logprob + 3) / 3))
        
        # no_speech_prob ranges from 0 to 1, lower is better
        speech_confidence = 1 - avg_no_speech_prob
        
        # Combine confidences
        return (logprob_confidence + speech_confidence) / 2
    
    def _estimate_openai_confidence(self, text: str) -> float:
        """Estimate confidence for OpenAI transcription based on text quality"""
        if not text:
            return 0.0
        
        # Simple heuristics for confidence estimation
        score = 0.7  # Base score for OpenAI
        
        # Length factor (longer text generally more reliable)
        if len(text) > 100:
            score += 0.1
        elif len(text) < 20:
            score -= 0.2
        
        # Check for obvious transcription errors
        error_indicators = ['[inaudible]', '[unclear]', '...', '???']
        for indicator in error_indicators:
            if indicator in text.lower():
                score -= 0.3
                break
        
        # Check for medical terms (indicates domain alignment)
        medical_keywords = ['patient', 'diagnosis', 'treatment', 'symptoms', 'medical', 'doctor']
        if any(keyword in text.lower() for keyword in medical_keywords):
            score += 0.1
        
        return max(0, min(1, score))
    
    async def _cache_streaming_result(self, session_id: str, result: Dict, processing_time: float):
        """Cache streaming transcription result"""
        try:
            cache_key = f"transcription:{session_id}:{int(time.time())}"
            cache_data = {
                **result,
                'processing_time': processing_time,
                'timestamp': time.time()
            }
            
            await self.redis_manager.set_with_expiry(
                cache_key, cache_data, expiry=config.SESSION_TIMEOUT
            )
            
        except Exception as e:
            logger.warning(f"Failed to cache streaming result: {e}")
    
    async def get_metrics(self) -> Dict:
        """Get service metrics"""
        return {
            'transcription_count': self.transcription_count,
            'total_processing_time': self.total_processing_time,
            'average_processing_time': (
                self.total_processing_time / self.transcription_count 
                if self.transcription_count > 0 else 0
            ),
            'error_count': self.error_count,
            'error_rate': (
                self.error_count / (self.transcription_count + self.error_count)
                if (self.transcription_count + self.error_count) > 0 else 0
            ),
            'models_available': {
                'local_whisper': self.local_model is not None,
                'german_medical': self.german_medical_client is not None,
                'openai_api': self.openai_client is not None,
                'gemini_refiner': GEMINI_REFINER_AVAILABLE
            },
            'concurrent_limit': config.MAX_CONCURRENT_TRANSCRIPTIONS,
            'active_transcriptions': config.MAX_CONCURRENT_TRANSCRIPTIONS - self.transcription_semaphore._value
        }
    
    async def health_check(self) -> Dict:
        """Perform health check"""
        health = {
            'initialized': self._initialized,
            'local_model_available': self.local_model is not None,
            'german_medical_model_available': self.german_medical_client is not None,
            'openai_api_available': self.openai_client is not None,
            'gemini_refiner_available': GEMINI_REFINER_AVAILABLE,
            'redis_connected': await self.redis_manager.is_connected(),
            'error_rate': 0.0
        }
        
        if self.transcription_count > 0:
            health['error_rate'] = self.error_count / (self.transcription_count + self.error_count)
        
        return health