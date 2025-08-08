"""
Audio processing utilities for transcription service
Handles audio format conversion, preprocessing, and quality enhancement
"""

import io
import logging
import tempfile
from pathlib import Path
from typing import Optional, Tuple

import librosa
import numpy as np
import soundfile as sf
import webrtcvad
from pydub import AudioSegment
from pydub.effects import normalize
from scipy import signal

try:
    import noisereduce as nr
    NOISE_REDUCE_AVAILABLE = True
except ImportError:
    NOISE_REDUCE_AVAILABLE = False
    logging.warning("noisereduce not available, noise reduction disabled")

from config import Config, config

logger = logging.getLogger(__name__)

class AudioProcessor:
    """Audio processing and preprocessing utilities"""
    
    def __init__(self):
        self.target_sample_rate = config.AUDIO_SAMPLE_RATE
        self.target_channels = config.AUDIO_CHANNELS
        self.vad = webrtcvad.Vad(2)  # Aggressiveness level 2 (0-3)
        
    async def process_uploaded_file(self, audio_data: bytes, filename: str) -> Tuple[np.ndarray, int]:
        """
        Process uploaded audio file
        
        Args:
            audio_data: Raw audio file data
            filename: Original filename for format detection
            
        Returns:
            Tuple of (audio_array, sample_rate)
        """
        try:
            # Detect file format and convert
            audio_segment = await self._load_audio_segment(audio_data, filename)
            
            # Convert to target format
            audio_segment = await self._convert_to_target_format(audio_segment)
            
            # Convert to numpy array
            audio_array = np.array(audio_segment.get_array_of_samples(), dtype=np.float32)
            
            # Normalize to [-1, 1] range
            if audio_segment.sample_width == 2:  # 16-bit
                audio_array = audio_array / 32768.0
            elif audio_segment.sample_width == 4:  # 32-bit
                audio_array = audio_array / 2147483648.0
            
            # Apply preprocessing
            audio_array = await self._preprocess_audio(audio_array, self.target_sample_rate)
            
            return audio_array, self.target_sample_rate
            
        except Exception as e:
            logger.error(f"Error processing audio file {filename}: {e}")
            raise
    
    async def process_streaming_audio(self, audio_data: bytes) -> Tuple[np.ndarray, int]:
        """
        Process streaming audio data
        
        Args:
            audio_data: Raw audio bytes (assumed to be 16-bit PCM)
            
        Returns:
            Tuple of (audio_array, sample_rate)
        """
        try:
            # Convert bytes to numpy array (assuming 16-bit PCM)
            audio_array = np.frombuffer(audio_data, dtype=np.int16).astype(np.float32)
            audio_array = audio_array / 32768.0  # Normalize to [-1, 1]
            
            # Apply light preprocessing for streaming
            audio_array = await self._preprocess_streaming_audio(audio_array, self.target_sample_rate)
            
            return audio_array, self.target_sample_rate
            
        except Exception as e:
            logger.error(f"Error processing streaming audio: {e}")
            raise
    
    async def _load_audio_segment(self, audio_data: bytes, filename: str) -> AudioSegment:
        """Load audio data into AudioSegment"""
        try:
            # Determine format from filename
            file_extension = Path(filename).suffix.lower()
            
            # Create temporary file
            with tempfile.NamedTemporaryFile(suffix=file_extension, delete=False) as temp_file:
                temp_file.write(audio_data)
                temp_path = temp_file.name
            
            try:
                # Load based on file extension
                if file_extension in ['.mp3']:
                    audio_segment = AudioSegment.from_mp3(temp_path)
                elif file_extension in ['.wav']:
                    audio_segment = AudioSegment.from_wav(temp_path)
                elif file_extension in ['.m4a', '.mp4']:
                    audio_segment = AudioSegment.from_file(temp_path, format="mp4")
                elif file_extension in ['.webm']:
                    audio_segment = AudioSegment.from_file(temp_path, format="webm")
                elif file_extension in ['.ogg']:
                    audio_segment = AudioSegment.from_ogg(temp_path)
                elif file_extension in ['.flac']:
                    audio_segment = AudioSegment.from_file(temp_path, format="flac")
                else:
                    # Try to auto-detect format
                    audio_segment = AudioSegment.from_file(temp_path)
                
                return audio_segment
                
            finally:
                # Clean up temporary file
                Path(temp_path).unlink(missing_ok=True)
                
        except Exception as e:
            logger.error(f"Error loading audio segment: {e}")
            raise
    
    async def _convert_to_target_format(self, audio_segment: AudioSegment) -> AudioSegment:
        """Convert audio to target format"""
        try:
            # Convert to mono if needed
            if audio_segment.channels != self.target_channels:
                if self.target_channels == 1:
                    audio_segment = audio_segment.set_channels(1)
                else:
                    audio_segment = audio_segment.set_channels(2)
            
            # Convert sample rate if needed
            if audio_segment.frame_rate != self.target_sample_rate:
                audio_segment = audio_segment.set_frame_rate(self.target_sample_rate)
            
            # Ensure 16-bit depth
            if audio_segment.sample_width != 2:
                audio_segment = audio_segment.set_sample_width(2)
            
            return audio_segment
            
        except Exception as e:
            logger.error(f"Error converting audio format: {e}")
            raise
    
    async def _preprocess_audio(self, audio_array: np.ndarray, sample_rate: int) -> np.ndarray:
        """Apply audio preprocessing"""
        try:
            # Remove DC offset
            audio_array = audio_array - np.mean(audio_array)
            
            # Apply high-pass filter to remove low-frequency noise
            audio_array = await self._apply_highpass_filter(audio_array, sample_rate)
            
            # Noise reduction if available
            if NOISE_REDUCE_AVAILABLE:
                audio_array = await self._apply_noise_reduction(audio_array, sample_rate)
            
            # Normalize audio
            audio_array = await self._normalize_audio(audio_array)
            
            # Apply voice activity detection and remove silence
            audio_array = await self._remove_silence(audio_array, sample_rate)
            
            return audio_array
            
        except Exception as e:
            logger.error(f"Error preprocessing audio: {e}")
            return audio_array  # Return original if preprocessing fails
    
    async def _preprocess_streaming_audio(self, audio_array: np.ndarray, sample_rate: int) -> np.ndarray:
        """Apply light preprocessing for streaming audio"""
        try:
            # Remove DC offset
            audio_array = audio_array - np.mean(audio_array)
            
            # Apply gentle high-pass filter to remove low-frequency noise
            audio_array = await self._apply_highpass_filter(audio_array, sample_rate, cutoff=50.0)
            
            # Apply light noise gate to remove background noise
            audio_array = await self._apply_noise_gate(audio_array, threshold=0.01)
            
            # Adaptive gain control for consistent volume
            audio_array = await self._apply_adaptive_gain(audio_array)
            
            return audio_array
            
        except Exception as e:
            logger.error(f"Error preprocessing streaming audio: {e}")
            return audio_array
    
    async def _apply_highpass_filter(self, audio_array: np.ndarray, sample_rate: int, cutoff: float = 80.0) -> np.ndarray:
        """Apply high-pass filter to remove low-frequency noise"""
        try:
            nyquist = sample_rate / 2
            normalized_cutoff = cutoff / nyquist
            
            # Design Butterworth high-pass filter
            b, a = signal.butter(N=5, Wn=normalized_cutoff, btype='high', analog=False)
            
            # Apply filter
            filtered_audio = signal.filtfilt(b, a, audio_array)
            
            return filtered_audio.astype(np.float32)
            
        except Exception as e:
            logger.warning(f"High-pass filter failed: {e}")
            return audio_array
    
    async def _apply_noise_reduction(self, audio_array: np.ndarray, sample_rate: int) -> np.ndarray:
        """Apply noise reduction"""
        try:
            if not NOISE_REDUCE_AVAILABLE:
                return audio_array
            
            # Apply noise reduction
            reduced_noise = nr.reduce_noise(y=audio_array, sr=sample_rate, stationary=False)
            
            return reduced_noise.astype(np.float32)
            
        except Exception as e:
            logger.warning(f"Noise reduction failed: {e}")
            return audio_array
    
    async def _normalize_audio(self, audio_array: np.ndarray, target_level: float = 0.8) -> np.ndarray:
        """Normalize audio to target level"""
        try:
            # Calculate RMS
            rms = np.sqrt(np.mean(audio_array ** 2))
            
            if rms > 0:
                # Scale to target level
                scaling_factor = target_level / rms
                # Limit scaling to prevent excessive amplification
                scaling_factor = min(scaling_factor, 10.0)
                audio_array = audio_array * scaling_factor
            
            # Clip to prevent distortion
            audio_array = np.clip(audio_array, -1.0, 1.0)
            
            return audio_array
            
        except Exception as e:
            logger.warning(f"Audio normalization failed: {e}")
            return audio_array
    
    async def _remove_silence(self, audio_array: np.ndarray, sample_rate: int, 
                            frame_duration: int = 30) -> np.ndarray:
        """Remove silence using voice activity detection"""
        try:
            # Convert to 16-bit PCM for VAD
            audio_16bit = (audio_array * 32767).astype(np.int16)
            
            # Frame size for VAD (10, 20, or 30 ms)
            frame_size = int(sample_rate * frame_duration / 1000)
            
            # Ensure frame size is compatible with VAD
            if frame_duration not in [10, 20, 30]:
                frame_duration = 20
                frame_size = int(sample_rate * frame_duration / 1000)
            
            # Split audio into frames
            frames = []
            voice_frames = []
            
            for i in range(0, len(audio_16bit) - frame_size, frame_size):
                frame = audio_16bit[i:i + frame_size]
                frames.append(frame)
                
                # Check if frame contains voice
                try:
                    is_voice = self.vad.is_speech(frame.tobytes(), sample_rate)
                    voice_frames.append(is_voice)
                except:
                    # If VAD fails, assume it's voice
                    voice_frames.append(True)
            
            # Keep only voice frames
            if any(voice_frames):
                voice_audio = []
                for i, is_voice in enumerate(voice_frames):
                    if is_voice:
                        voice_audio.extend(frames[i])
                
                if voice_audio:
                    return np.array(voice_audio, dtype=np.float32) / 32767.0
            
            # If no voice detected, return original
            return audio_array
            
        except Exception as e:
            logger.warning(f"Silence removal failed: {e}")
            return audio_array
    
    def calculate_audio_quality_metrics(self, audio_array: np.ndarray, sample_rate: int) -> dict:
        """Calculate audio quality metrics"""
        try:
            metrics = {}
            
            # Signal-to-noise ratio estimation
            # Simple approach: compare energy in different frequency bands
            freqs, psd = signal.welch(audio_array, sample_rate, nperseg=1024)
            
            # Voice frequency range (roughly 85-255 Hz for fundamental, 85-8000 Hz for harmonics)
            voice_mask = (freqs >= 85) & (freqs <= 8000)
            noise_mask = (freqs < 85) | (freqs > 8000)
            
            voice_power = np.sum(psd[voice_mask])
            noise_power = np.sum(psd[noise_mask])
            
            if noise_power > 0:
                snr_db = 10 * np.log10(voice_power / noise_power)
            else:
                snr_db = 60  # Very high SNR
            
            metrics['snr_db'] = float(snr_db)
            
            # RMS level
            rms = np.sqrt(np.mean(audio_array ** 2))
            metrics['rms_level'] = float(rms)
            
            # Peak level
            peak = np.max(np.abs(audio_array))
            metrics['peak_level'] = float(peak)
            
            # Crest factor (peak to RMS ratio)
            if rms > 0:
                crest_factor = peak / rms
            else:
                crest_factor = 0
            metrics['crest_factor'] = float(crest_factor)
            
            # Zero-crossing rate (indicator of noise)
            zero_crossings = np.sum(np.diff(np.sign(audio_array)) != 0)
            zcr = zero_crossings / len(audio_array)
            metrics['zero_crossing_rate'] = float(zcr)
            
            # Spectral centroid (brightness indicator)
            spectral_centroids = librosa.feature.spectral_centroid(y=audio_array, sr=sample_rate)[0]
            metrics['spectral_centroid_mean'] = float(np.mean(spectral_centroids))
            
            # Overall quality score (0-1)
            quality_score = self._calculate_quality_score(metrics)
            metrics['quality_score'] = quality_score
            
            return metrics
            
        except Exception as e:
            logger.error(f"Error calculating audio quality metrics: {e}")
            return {'quality_score': 0.5, 'error': str(e)}
    
    def _calculate_quality_score(self, metrics: dict) -> float:
        """Calculate overall quality score from metrics"""
        try:
            score = 0.5  # Base score
            
            # SNR contribution (0-0.3)
            snr = metrics.get('snr_db', 0)
            snr_score = min(max(snr, 0) / 40, 1) * 0.3
            score += snr_score - 0.15  # Subtract base to center around 0.5
            
            # RMS level contribution (0-0.2)
            rms = metrics.get('rms_level', 0)
            # Optimal RMS range is 0.1-0.7
            if 0.1 <= rms <= 0.7:
                rms_score = 0.2
            else:
                rms_score = max(0, 0.2 - abs(rms - 0.4) * 0.5)
            score += rms_score - 0.1
            
            # Zero-crossing rate contribution (0-0.2)
            zcr = metrics.get('zero_crossing_rate', 0)
            # Lower ZCR is generally better for speech
            zcr_score = max(0, 0.2 - zcr * 2)
            score += zcr_score - 0.1
            
            # Crest factor contribution (0-0.2)
            crest = metrics.get('crest_factor', 0)
            # Optimal crest factor for speech is around 3-8
            if 3 <= crest <= 8:
                crest_score = 0.2
            else:
                crest_score = max(0, 0.2 - abs(crest - 5.5) * 0.05)
            score += crest_score - 0.1
            
            # Spectral centroid contribution (0-0.1)
            centroid = metrics.get('spectral_centroid_mean', 0)
            # Optimal range for speech is roughly 1000-4000 Hz
            if 1000 <= centroid <= 4000:
                centroid_score = 0.1
            else:
                centroid_score = max(0, 0.1 - abs(centroid - 2500) / 10000)
            score += centroid_score - 0.05
            
            # Clamp to [0, 1]
            return max(0, min(1, score))
            
        except Exception as e:
            logger.error(f"Error calculating quality score: {e}")
            return 0.5
    
    def split_long_audio(self, audio_array: np.ndarray, sample_rate: int, 
                        max_duration: float = 30.0) -> list:
        """Split long audio into chunks"""
        try:
            max_samples = int(max_duration * sample_rate)
            
            if len(audio_array) <= max_samples:
                return [audio_array]
            
            chunks = []
            for i in range(0, len(audio_array), max_samples):
                chunk = audio_array[i:i + max_samples]
                if len(chunk) > sample_rate:  # Only include chunks longer than 1 second
                    chunks.append(chunk)
            
            return chunks
            
        except Exception as e:
            logger.error(f"Error splitting audio: {e}")
            return [audio_array]
    
    async def save_audio_debug(self, audio_array: np.ndarray, sample_rate: int, 
                             filename: str) -> Optional[str]:
        """Save audio for debugging purposes"""
        try:
            debug_path = config.temp_dir_path / f"debug_{filename}"
            sf.write(debug_path, audio_array, sample_rate)
            return str(debug_path)
        except Exception as e:
            logger.error(f"Error saving debug audio: {e}")
            return None
    
    async def _apply_noise_gate(self, audio_array: np.ndarray, threshold: float = 0.01) -> np.ndarray:
        """Apply noise gate to remove low-level background noise"""
        try:
            # Calculate envelope using Hilbert transform
            analytic_signal = signal.hilbert(audio_array)
            envelope = np.abs(analytic_signal)
            
            # Smooth envelope
            window_size = int(0.01 * self.target_sample_rate)  # 10ms window
            envelope_smooth = np.convolve(envelope, np.ones(window_size)/window_size, mode='same')
            
            # Apply gate
            gate_mask = envelope_smooth > threshold
            gated_audio = audio_array * gate_mask
            
            return gated_audio
            
        except Exception as e:
            logger.warning(f"Noise gate failed: {e}")
            return audio_array
    
    async def _apply_adaptive_gain(self, audio_array: np.ndarray, target_rms: float = 0.3) -> np.ndarray:
        """Apply adaptive gain control for consistent volume"""
        try:
            # Calculate current RMS
            current_rms = np.sqrt(np.mean(audio_array ** 2))
            
            if current_rms > 0:
                # Calculate gain factor
                gain = target_rms / current_rms
                
                # Limit gain to prevent clipping
                max_gain = 0.95 / np.max(np.abs(audio_array)) if np.max(np.abs(audio_array)) > 0 else 1.0
                gain = min(gain, max_gain, 3.0)  # Cap at 3x gain
                
                # Apply gain
                audio_array = audio_array * gain
            
            return audio_array
            
        except Exception as e:
            logger.warning(f"Adaptive gain failed: {e}")
            return audio_array