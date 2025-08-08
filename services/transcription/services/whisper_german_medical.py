"""
German Medical Speech Recognition Client using Transformers pipeline.
Optimized for medical terminology and real-time transcription.
"""

import logging
import queue
import time
import threading
from threading import Event
from collections import deque
import numpy as np

try:
    import torch
    from transformers import AutoModelForSpeechSeq2Seq, AutoProcessor, pipeline
    TRANSFORMERS_AVAILABLE = True
except ImportError:
    TRANSFORMERS_AVAILABLE = False

try:
    import sounddevice as sd
    SOUNDDEVICE_AVAILABLE = True
except ImportError:
    SOUNDDEVICE_AVAILABLE = False


class WhisperGermanMedicalClient:
    """
    German Medical Speech Recognition Client using Transformers pipeline.
    Optimized for medical terminology and real-time transcription.
    FIXED to address timestamp errors and conflicting warnings.
    """
    def __init__(self, model_size="distil-large-v3", use_medical_enhancement=True):
        self.logger = logging.getLogger("WhisperGermanMedicalClient")
        self.logger.setLevel(logging.INFO)

        if not TRANSFORMERS_AVAILABLE:
            msg = "Transformers library not available. Please install: pip install transformers datasets accelerate"
            self.logger.error(msg)
            raise ImportError(msg)

        self.model_size = model_size
        self.use_medical_enhancement = use_medical_enhancement
        self._setup_model_config()

        self.sample_rate = 16000
        self.channels = 1
        self.stream = None
        self.chunk_length_s = 8
        self.batch_size = 8
        self.max_new_tokens = 256

        self.audio_queue = queue.Queue()
        self.transcription_queue = queue.Queue()
        self.stop_event = Event()

        self.model = None
        self.processor = None
        self.pipeline = None
        self.model_loaded = False

        self.silence_threshold = 0.008
        self.min_audio_length = 2.0
        self.buffer = np.array([], dtype=np.float32)
        self.last_process_time = time.time()
        self.process_interval = 1.0

        self.medical_terms = self._load_medical_terms() if use_medical_enhancement else {}
        self.chunks_processed = 0
        self.total_energy = 0
        self.transcription_times = []
        self._energy_history = deque(maxlen=50)

    def _setup_model_config(self):
        """Setup model configuration."""
        model_configs = {
            "distil-large-v3": {"model_id": "primeline/distil-whisper-large-v3-german", "params": "756M"},
            "large-v3": {"model_id": "primeline/whisper-large-v3-german", "params": "1.54B"},
            "tiny": {"model_id": "primeline/whisper-tiny-german", "params": "37.8M"}
        }
        self.model_config = model_configs.get(self.model_size, model_configs["distil-large-v3"])
        self.model_id = self.model_config["model_id"]
        self.device = "cuda:0" if torch.cuda.is_available() else "cpu"
        self.torch_dtype = torch.float16 if self.device.startswith("cuda") else torch.float32
        self.logger.info(f"Using model: {self.model_id} ({self.model_config['params']}) on {self.device}")

    def _load_medical_terms(self):
        """Load German medical terms."""
        return {
            "befund": ["befund", "befunde"], "diagnose": ["diagnose", "diagnosen"],
            "patient": ["patient", "patienten"], "röntgen": ["röntgen", "roentgen"],
            "ultraschall": ["ultraschall", "ultra schall"], "computertomographie": ["computertomographie", "ct", "c t"],
            "magnetresonanztomographie": ["magnetresonanztomographie", "mrt", "m r t"],
            "anamnese": ["anamnese"], "therapie": ["therapie", "behandlung"],
            "medikament": ["medikament", "medikamente"], "symptom": ["symptom", "symptome"],
            "untersuchung": ["untersuchung", "untersuchungen"],
        }

    def _enhance_medical_terminology(self, text):
        """Correct common medical terminology errors."""
        if not self.use_medical_enhancement or not text: return text
        enhanced_text = text.lower()
        for canonical, variants in self.medical_terms.items():
            for variant in variants:
                enhanced_text = enhanced_text.replace(variant, canonical)
        return enhanced_text

    def _load_model(self):
            """Load the ASR model and pipeline, configuring language and task
            using forced_decoder_ids."""
            if self.model_loaded: return True
            try:
                self.logger.info(f"Loading German medical ASR model: {self.model_id}")
                self.model = AutoModelForSpeechSeq2Seq.from_pretrained(
                    self.model_id, torch_dtype=self.torch_dtype,
                    low_cpu_mem_usage=True, use_safetensors=True
                ).to(self.device)
                self.processor = AutoProcessor.from_pretrained(self.model_id)

                # --- REVISED: Set language and task using forced_decoder_ids directly ---
                try:
                    # Get the decoder prompt IDs for German transcription.
                    # Language code "de" for German.
                    forced_decoder_ids = self.processor.get_decoder_prompt_ids(language="de", task="transcribe")
                    
                    # Apply these to the model's main configuration,
                    # which often propagates to the generation_config.
                    if forced_decoder_ids:
                        self.model.config.forced_decoder_ids = forced_decoder_ids
                        # Also update the generation_config directly if it exists and doesn't inherit automatically
                        if hasattr(self.model, 'generation_config'):
                            self.model.generation_config.forced_decoder_ids = forced_decoder_ids
                        self.logger.info(f"Successfully set forced_decoder_ids for German transcription: {forced_decoder_ids}")
                    else:
                        self.logger.warning("get_decoder_prompt_ids returned empty, forced_decoder_ids not set.")

                    # If the model is multilingual, explicitly setting language and task on generation_config
                    # can still be beneficial if supported, even with forced_decoder_ids.
                    # However, for monolingual models, forced_decoder_ids are often sufficient.
                    if hasattr(self.model, 'generation_config'):
                        self.model.generation_config.language = "german" # Or "de"
                        self.model.generation_config.task = "transcribe"
                    else:
                        self.logger.warning("Model does not have a 'generation_config' attribute to set language/task directly.")


                except Exception as e:
                    self.logger.error(f"Could not set forced_decoder_ids or language/task on generation_config: {e}", exc_info=True)
                    # Transcription might still work if the model is monolingual German or defaults correctly.

                # Ensure other relevant generation_config settings are present
                if hasattr(self.model, 'generation_config'):
                    if hasattr(self.model.generation_config, 'suppress_tokens'):
                        self.model.generation_config.suppress_tokens = self.model.generation_config.suppress_tokens or []
                    else:
                        self.model.generation_config.suppress_tokens = []
                else: # If no generation_config, try setting on main config (less common for suppress_tokens)
                    if hasattr(self.model.config, 'suppress_tokens'):
                        self.model.config.suppress_tokens = self.model.config.suppress_tokens or []
                    else:
                        self.model.config.suppress_tokens = []


                self.pipeline = pipeline(
                    "automatic-speech-recognition", model=self.model,
                    tokenizer=self.processor.tokenizer, feature_extractor=self.processor.feature_extractor,
                    max_new_tokens=self.max_new_tokens, chunk_length_s=self.chunk_length_s,
                    batch_size=self.batch_size, return_timestamps=False,
                    torch_dtype=self.torch_dtype, device=self.device,
                )
                self.model_loaded = True
                # Use a slightly different log message to confirm this version of the code ran
                self.logger.info("German medical ASR model loaded successfully (simplified forced_decoder_ids).")
                return True
            except Exception as e:
                self.logger.error(f"Error loading model or setting generation_config: {str(e)}", exc_info=True)
                return False


    def _preprocess_audio(self, audio_data):
        """Preprocess audio data."""
        if audio_data.size == 0: return audio_data
        audio_data = audio_data - np.mean(audio_data)
        max_val = np.abs(audio_data).max()
        if max_val > 1e-10: audio_data = audio_data / max_val * 0.9
        pre_emphasis = 0.95
        if len(audio_data) > 1: audio_data = np.append(audio_data[0], audio_data[1:] - pre_emphasis * audio_data[:-1])
        noise_floor = np.percentile(np.abs(audio_data), 10)
        audio_data = np.where(np.abs(audio_data) < noise_floor * 0.5, audio_data * 0.1, audio_data)
        return audio_data.astype(np.float32)

    def _is_silence(self, audio_data):
        """Detect silence."""
        if audio_data.size == 0: return True
        rms_energy = np.sqrt(np.mean(audio_data ** 2))
        self._energy_history.append(rms_energy)
        adaptive_threshold = np.mean(list(self._energy_history)) * 0.1 if self._energy_history else self.silence_threshold
        return rms_energy < max(adaptive_threshold, self.silence_threshold)

    def _transcribe_audio(self, audio_data):
        """Transcribe audio using the pipeline."""
        if not self._load_model(): return None # Ensures model and updated gen_config are loaded
        try:
            start_time = time.time()
            if len(audio_data.shape) > 1: audio_data = np.mean(audio_data, axis=1)
            if len(audio_data) < self.sample_rate * 0.5: return None

            # --- MODIFIED: Remove language and task from generate_kwargs ---
            # These are now set in the model.generation_config
            generate_kwargs = {
                # "language": "german", # REMOVED
                # "task": "transcribe", # REMOVED
                # "forced_decoder_ids": None, # REMOVED (handled by model.generation_config)
                "temperature": 0.1,
                "no_repeat_ngram_size": 3,
                "do_sample": False
            }
            # The pipeline will use the model's generation_config which now includes lang/task
            result = self.pipeline(audio_data, generate_kwargs=generate_kwargs)

            text = result.get('text', '').strip() if isinstance(result, dict) else str(result).strip()
            enhanced_text = self._enhance_medical_terminology(text)
            processing_time = time.time() - start_time
            self.transcription_times.append(processing_time)
            if enhanced_text: self.logger.info(f"Transcribed ({processing_time:.2f}s): {enhanced_text}")
            return enhanced_text
        except Exception as e:
            self.logger.error(f"Transcription error: {str(e)}", exc_info=True)
            return None

    def audio_callback(self, indata, frames, time_info, status):
        """Callback for sounddevice stream."""
        if status: self.logger.warning(f"Audio callback status: {status}")
        if not self.stop_event.is_set():
            try:
                self.audio_queue.put(indata.copy().mean(axis=1) if indata.ndim > 1 else indata.copy())
            except Exception as e: self.logger.error(f"Audio callback error: {str(e)}")

    def _process_loop(self):
        """Processing loop to get audio, check silence, and transcribe."""
        while not self.stop_event.is_set():
            try:
                collected_audio = []
                while not self.audio_queue.empty(): collected_audio.append(self.audio_queue.get_nowait())
                if collected_audio: self.buffer = np.concatenate([self.buffer] + collected_audio)

                current_time = time.time()
                buffer_duration = len(self.buffer) / self.sample_rate

                if (buffer_duration >= self.min_audio_length and
                    current_time - self.last_process_time >= self.process_interval):
                    audio_to_process = self.buffer
                    self.buffer = np.array([], dtype=np.float32)
                    self.last_process_time = current_time

                    if not self._is_silence(audio_to_process):
                        processed_audio = self._preprocess_audio(audio_to_process)
                        self.logger.info(f"Processing audio chunk: {buffer_duration:.2f}s")
                        text = self._transcribe_audio(processed_audio)
                        if text: self.transcription_queue.put(text)
                    else:
                        self.logger.debug(f"Skipping silent chunk: {buffer_duration:.2f}s")
                time.sleep(0.1)
            except Exception as e: self.logger.error(f"Processing loop error: {str(e)}", exc_info=True)

    def start(self):
        """Start the ASR client."""
        self.logger.info("Starting German Medical ASR Client...")
        self.stop_event.clear()
        self.buffer = np.array([], dtype=np.float32)
        while not self.audio_queue.empty(): self.audio_queue.get() # Clear queue
        self.chunks_processed = 0; self.total_energy = 0; self.transcription_times = []
        self._energy_history.clear()

        if SOUNDDEVICE_AVAILABLE:
            try:
                self.stream = sd.InputStream(
                    samplerate=self.sample_rate, channels=self.channels,
                    dtype=np.float32, callback=self.audio_callback,
                    blocksize=int(self.sample_rate * 0.1)
                )
                self.stream.start()
                self.logger.info("Audio stream started")
                self.process_thread = threading.Thread(target=self._process_loop, daemon=True)
                self.process_thread.start()
                return True
            except Exception as e:
                self.logger.error(f"Error starting client: {str(e)}", exc_info=True)
                return False
        else:
            self.logger.warning("sounddevice not available, starting without audio stream")
            self.process_thread = threading.Thread(target=self._process_loop, daemon=True)
            self.process_thread.start()
            return True

    def stop(self):
        """Stop the ASR client."""
        self.logger.info("Stopping German Medical ASR Client...")
        self.stop_event.set()
        if SOUNDDEVICE_AVAILABLE and self.stream:
            try: self.stream.stop(); self.stream.close()
            except Exception as e: self.logger.error(f"Error stopping audio stream: {str(e)}")
            self.stream = None
            self.logger.info("Audio stream stopped")
        if hasattr(self, 'process_thread') and self.process_thread.is_alive():
            self.process_thread.join(timeout=5.0)

    def get_transcription(self):
        """Get accumulated transcriptions."""
        transcripts = []
        while not self.transcription_queue.empty():
            try: transcripts.append(self.transcription_queue.get_nowait())
            except queue.Empty: break
        return transcripts

    def get_performance_stats(self):
        """Get performance statistics."""
        avg_energy = self.total_energy / self.chunks_processed if self.chunks_processed > 0 else 0
        avg_time = np.mean(self.transcription_times) if self.transcription_times else 0
        return {
            "chunks_processed": self.chunks_processed, "avg_energy": avg_energy,
            "avg_transcription_time": avg_time,
            "model_info": {
                "model_id": self.model_id, "parameters": self.model_config["params"],
                "device": self.device, "dtype": str(self.torch_dtype),
                "model_loaded": self.model_loaded
            },
            "audio_config": {
                "sample_rate": self.sample_rate, "chunk_length_s": self.chunk_length_s,
                "min_audio_length": self.min_audio_length, "process_interval": self.process_interval
            }
        }

    def transcribe_audio_buffer(self, audio_data):
        """Direct transcription method for integration with existing system."""
        if not self._load_model(): 
            return None
        
        # Preprocess and transcribe
        if not self._is_silence(audio_data):
            processed_audio = self._preprocess_audio(audio_data)
            return self._transcribe_audio(processed_audio)
        return None