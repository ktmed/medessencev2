// Stub VAD Processor for testing
class VADProcessor {
  constructor() {
    this.lastHadSpeech = false;
  }

  processPCM(pcmBuffer) {
    // Simple mock: alternate between speech/no speech for testing
    this.lastHadSpeech = !this.lastHadSpeech;
    console.log(`VAD Processor: Speech detected: ${this.lastHadSpeech}`);
    return this.lastHadSpeech;
  }

  reset() {
    console.log('VAD Processor: Reset');
    this.lastHadSpeech = false;
  }
}

module.exports = VADProcessor;