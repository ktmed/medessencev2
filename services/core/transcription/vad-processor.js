/**
 * Simple Voice Activity Detection processor
 * Detects speech in PCM audio to avoid sending silence
 */
class VADProcessor {
  constructor(sampleRate = 16000) {
    this.sampleRate = sampleRate;
    this.frameSize = Math.floor(sampleRate * 0.02); // 20ms frames
    this.energyThreshold = 0.0008; // Lower threshold for medical speech
    this.speechFrames = 0;
    this.silenceFrames = 0;
    this.isSpeaking = false;
    this.speechBuffer = Buffer.alloc(0);
    this.silenceThreshold = 40; // 0.8 second of silence (more patience for medical terms)
    this.speechThreshold = 2; // 40ms of speech to start (more sensitive)
    this.adaptiveThreshold = true;
    this.noiseFloor = 0.0015; // Lower noise floor for quiet medical dictation
    this.energyHistory = [];
    this.historySize = 50; // Track last 1 second of energy
    this.zcr = []; // Zero-crossing rate for better speech detection
    this.zcrThreshold = 0.05; // ZCR threshold for fricatives
  }

  /**
   * Process PCM audio and return speech segments
   * @param {Buffer} pcmData - 16-bit PCM audio
   * @returns {Buffer|null} - Speech audio or null if silence
   */
  processPCM(pcmData) {
    if (!pcmData || pcmData.length === 0) {
      return null;
    }

    // Add to speech buffer
    this.speechBuffer = Buffer.concat([this.speechBuffer, pcmData]);
    
    // Process in frames
    const results = [];
    let offset = 0;
    
    while (offset + this.frameSize * 2 <= this.speechBuffer.length) {
      const frame = this.speechBuffer.slice(offset, offset + this.frameSize * 2);
      const energy = this.calculateEnergy(frame);
      const zcr = this.calculateZCR(frame);
      
      // Update energy history for adaptive threshold
      this.energyHistory.push(energy);
      if (this.energyHistory.length > this.historySize) {
        this.energyHistory.shift();
      }
      
      // Calculate adaptive threshold if enabled
      let threshold = this.energyThreshold;
      if (this.adaptiveThreshold && this.energyHistory.length > 10) {
        const avgEnergy = this.energyHistory.reduce((a, b) => a + b, 0) / this.energyHistory.length;
        threshold = Math.max(this.noiseFloor, avgEnergy * 1.2); // More sensitive multiplier
      }
      
      // Enhanced speech detection: energy OR high ZCR (for fricatives/whispers)
      const isSpeech = energy > threshold || (energy > threshold * 0.5 && zcr > this.zcrThreshold);
      
      if (isSpeech) {
        this.speechFrames++;
        this.silenceFrames = 0;
        
        if (!this.isSpeaking && this.speechFrames >= this.speechThreshold) {
          this.isSpeaking = true;
          console.log('Speech started, energy:', energy, 'threshold:', threshold);
        }
      } else {
        this.silenceFrames++;
        this.speechFrames = 0;
        
        if (this.isSpeaking && this.silenceFrames >= this.silenceThreshold) {
          this.isSpeaking = false;
          console.log('Speech ended');
        }
      }
      
      offset += this.frameSize * 2;
    }
    
    // Keep unprocessed data
    this.speechBuffer = this.speechBuffer.slice(offset);
    
    // Return all data if speaking, otherwise return null
    if (this.isSpeaking) {
      const result = pcmData;
      return result;
    }
    
    return null;
  }

  /**
   * Calculate energy of audio frame
   */
  calculateEnergy(frame) {
    let sum = 0;
    for (let i = 0; i < frame.length; i += 2) {
      const sample = frame.readInt16LE(i) / 32768.0;
      sum += sample * sample;
    }
    return Math.sqrt(sum / (frame.length / 2));
  }
  
  /**
   * Calculate zero-crossing rate for better speech detection
   */
  calculateZCR(frame) {
    let crossings = 0;
    let prevSign = 0;
    
    for (let i = 0; i < frame.length; i += 2) {
      const sample = frame.readInt16LE(i);
      const sign = sample > 0 ? 1 : -1;
      
      if (prevSign !== 0 && prevSign !== sign) {
        crossings++;
      }
      prevSign = sign;
    }
    
    return crossings / (frame.length / 2);
  }

  /**
   * Reset VAD state
   */
  reset() {
    this.speechFrames = 0;
    this.silenceFrames = 0;
    this.isSpeaking = false;
    this.speechBuffer = Buffer.alloc(0);
  }
}

module.exports = VADProcessor;