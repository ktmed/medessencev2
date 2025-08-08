const { spawn } = require('child_process');
const { PassThrough } = require('stream');

/**
 * WebM accumulator and converter
 * Accumulates WebM chunks and converts them to PCM when we have enough data
 */
class WebMAccumulator {
  constructor() {
    this.sampleRate = 16000;
    this.channels = 1;
    this.sessions = new Map(); // Store session data per socket
  }

  /**
   * Initialize a session for a socket
   */
  initSession(socketId) {
    if (!this.sessions.has(socketId)) {
      this.sessions.set(socketId, {
        webmBuffer: Buffer.alloc(0),
        hasHeader: false,
        ffmpegProcess: null,
        pcmChunks: [],
        isProcessing: false
      });
    }
  }

  /**
   * Add WebM data to the session buffer
   */
  addData(socketId, webmData) {
    const session = this.sessions.get(socketId);
    if (!session) {
      this.initSession(socketId);
      return this.addData(socketId, webmData);
    }

    // Accumulate the data
    session.webmBuffer = Buffer.concat([session.webmBuffer, webmData]);
    
    // Check if we have a WebM header
    if (!session.hasHeader && session.webmBuffer.length >= 4) {
      session.hasHeader = session.webmBuffer[0] === 0x1a && 
                         session.webmBuffer[1] === 0x45 && 
                         session.webmBuffer[2] === 0xdf && 
                         session.webmBuffer[3] === 0xa3;
    }

    console.log(`Session ${socketId}: Buffer size: ${session.webmBuffer.length}, Has header: ${session.hasHeader}`);
  }

  /**
   * Convert accumulated WebM data to PCM
   */
  async convertToPCM(socketId) {
    const session = this.sessions.get(socketId);
    if (!session || session.isProcessing || session.webmBuffer.length === 0) {
      return Buffer.alloc(0);
    }

    // Don't process if we don't have a proper WebM header
    if (!session.hasHeader) {
      console.warn(`Session ${socketId}: No WebM header found, skipping conversion`);
      return Buffer.alloc(0);
    }

    session.isProcessing = true;
    
    try {
      const pcmData = await this.processWithFFmpeg(session.webmBuffer);
      
      // Clear the buffer after successful conversion
      session.webmBuffer = Buffer.alloc(0);
      session.hasHeader = false;
      session.isProcessing = false;
      
      return pcmData;
    } catch (error) {
      console.error(`Session ${socketId}: Conversion error:`, error);
      session.isProcessing = false;
      
      // On error, clear the buffer to start fresh
      session.webmBuffer = Buffer.alloc(0);
      session.hasHeader = false;
      
      return Buffer.alloc(0);
    }
  }

  /**
   * Process WebM data with FFmpeg
   */
  async processWithFFmpeg(webmBuffer) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      
      // Write complete WebM data to a temporary file or use streaming
      const ffmpeg = spawn('ffmpeg', [
        '-i', 'pipe:0',           // Input from stdin
        '-f', 's16le',            // Output format
        '-acodec', 'pcm_s16le',   // Output codec
        '-ar', this.sampleRate.toString(),
        '-ac', this.channels.toString(),
        '-loglevel', 'error',
        'pipe:1'
      ]);

      const timeout = setTimeout(() => {
        ffmpeg.kill();
        reject(new Error('FFmpeg timeout'));
      }, 10000);

      ffmpeg.stdout.on('data', (chunk) => {
        chunks.push(chunk);
      });

      ffmpeg.on('close', (code) => {
        clearTimeout(timeout);
        if (code === 0) {
          const pcmBuffer = Buffer.concat(chunks);
          console.log('Successfully converted WebM to PCM:', webmBuffer.length, '->', pcmBuffer.length);
          resolve(pcmBuffer);
        } else {
          reject(new Error(`FFmpeg exited with code ${code}`));
        }
      });

      ffmpeg.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });

      let stderrData = '';
      ffmpeg.stderr.on('data', (data) => {
        stderrData += data.toString();
      });

      ffmpeg.stdin.on('error', (err) => {
        console.error('FFmpeg stdin error:', err);
      });

      // Write the complete WebM data
      ffmpeg.stdin.end(webmBuffer);
    });
  }

  /**
   * Clean up session
   */
  endSession(socketId) {
    const session = this.sessions.get(socketId);
    if (session) {
      if (session.ffmpegProcess) {
        session.ffmpegProcess.kill();
      }
      this.sessions.delete(socketId);
    }
  }
}

module.exports = WebMAccumulator;