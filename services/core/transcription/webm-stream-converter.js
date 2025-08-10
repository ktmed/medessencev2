// Stub WebM Stream Converter for testing
class WebMStreamConverter {
  constructor() {
    this.sessions = new Map();
  }

  addData(sessionId, audioChunk) {
    console.log(`WebM Converter: Adding ${audioChunk.length} bytes for session ${sessionId}`);
  }

  getPCMData(sessionId) {
    // Return empty buffer for testing
    return Buffer.alloc(0);
  }

  initSession(sessionId) {
    console.log(`WebM Converter: Init session ${sessionId}`);
    this.sessions.set(sessionId, { buffers: [] });
  }

  endSession(sessionId) {
    console.log(`WebM Converter: End session ${sessionId}`);
    this.sessions.delete(sessionId);
  }
}

module.exports = WebMStreamConverter;