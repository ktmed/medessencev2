const { spawn } = require('child_process');
const { PassThrough } = require('stream');

/**
 * WebM streaming converter
 * Maintains a persistent FFmpeg process for each session to handle streaming WebM
 */
class WebMStreamConverter {
  constructor() {
    this.sampleRate = 16000;
    this.channels = 1;
    this.sessions = new Map();
  }

  /**
   * Initialize FFmpeg streaming process for a session
   */
  initSession(socketId) {
    if (this.sessions.has(socketId)) {
      return;
    }

    console.log(`Initializing FFmpeg stream for session ${socketId}`);
    
    const ffmpegProcess = spawn('ffmpeg', [
      '-i', 'pipe:0',           // Input from stdin (auto-detect format)
      '-vn',                    // No video (audio only)
      '-f', 's16le',            // Output format
      '-acodec', 'pcm_s16le',   // Output codec
      '-ar', this.sampleRate.toString(),
      '-ac', this.channels.toString(),
      '-loglevel', 'debug',     // Debug logging
      'pipe:1'
    ]);

    const session = {
      ffmpeg: ffmpegProcess,
      pcmChunks: [],
      isActive: true,
      hasError: false
    };

    // Collect PCM output
    ffmpegProcess.stdout.on('data', (chunk) => {
      session.pcmChunks.push(chunk);
      // Check if the chunk contains non-zero data
      const isNonZero = chunk.some(byte => byte !== 0);
      console.log(`FFmpeg output chunk received for ${socketId}, size: ${chunk.length}, non-zero: ${isNonZero}`);
    });

    // Handle errors
    ffmpegProcess.stderr.on('data', (data) => {
      console.error(`FFmpeg stderr for ${socketId}:`, data.toString());
    });

    ffmpegProcess.on('error', (err) => {
      console.error(`FFmpeg error for ${socketId}:`, err);
      session.hasError = true;
      session.isActive = false;
    });

    ffmpegProcess.on('close', (code) => {
      console.log(`FFmpeg closed for ${socketId} with code ${code}`);
      session.isActive = false;
    });

    this.sessions.set(socketId, session);
  }

  /**
   * Feed WebM data to the streaming FFmpeg process
   */
  addData(socketId, webmData) {
    const session = this.sessions.get(socketId);
    if (!session) {
      this.initSession(socketId);
      return this.addData(socketId, webmData);
    }

    if (!session.isActive || session.hasError) {
      console.warn(`Session ${socketId} is not active or has error`);
      return;
    }

    try {
      // Debug WebM data
      console.log(`Feeding WebM data to FFmpeg: ${webmData.length} bytes, first bytes: ${Array.from(webmData.slice(0, 10)).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
      
      // Accumulate WebM data for debugging
      if (!session.webmData) {
        session.webmData = [];
      }
      session.webmData.push(webmData);
      
      // Feed data to FFmpeg
      session.ffmpeg.stdin.write(webmData);
    } catch (err) {
      console.error(`Error writing to FFmpeg for ${socketId}:`, err);
      session.hasError = true;
    }
  }

  /**
   * Get accumulated PCM data
   */
  getPCMData(socketId) {
    const session = this.sessions.get(socketId);
    if (!session || session.pcmChunks.length === 0) {
      return Buffer.alloc(0);
    }

    // Concatenate and clear chunks
    const pcmData = Buffer.concat(session.pcmChunks);
    session.pcmChunks = [];
    
    console.log(`Retrieved ${pcmData.length} bytes of PCM for session ${socketId}`);
    return pcmData;
  }

  /**
   * End session and cleanup
   */
  endSession(socketId) {
    const session = this.sessions.get(socketId);
    if (!session) return;

    console.log(`Ending session ${socketId}`);
    
    // Save WebM data for debugging
    if (session.webmData && session.webmData.length > 0) {
      const fs = require('fs');
      const totalWebM = Buffer.concat(session.webmData);
      const filename = `debug-audio-${socketId}-${Date.now()}.webm`;
      fs.writeFileSync(filename, totalWebM);
      console.log(`Saved WebM data to ${filename}, total size: ${totalWebM.length} bytes`);
    }
    
    if (session.ffmpeg) {
      try {
        session.ffmpeg.stdin.end();
        session.ffmpeg.kill('SIGTERM');
      } catch (err) {
        console.error(`Error ending FFmpeg for ${socketId}:`, err);
      }
    }

    this.sessions.delete(socketId);
  }

  /**
   * Check if session has PCM data available
   */
  hasPCMData(socketId) {
    const session = this.sessions.get(socketId);
    return session && session.pcmChunks.length > 0;
  }
}

module.exports = WebMStreamConverter;