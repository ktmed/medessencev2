const { spawn } = require('child_process');
const { Readable } = require('stream');

/**
 * Simple webm to PCM conversion handler
 * This converts webm/opus audio to 16-bit PCM for the transcription service
 */
class WebmToPCMConverter {
  constructor() {
    this.sampleRate = 16000;
    this.channels = 1;
    this.webmHeader = null;
    this.isFirstChunk = true;
  }

  /**
   * Convert webm audio buffer to PCM using ffmpeg
   * Since we receive streaming chunks, we need to handle them differently
   * @param {Buffer} webmBuffer - The webm audio data chunk
   * @returns {Promise<Buffer>} - PCM audio data
   */
  async convertToPCM(webmBuffer) {
    // For streaming WebM, we might need to accumulate chunks
    // or use a different approach. For now, let's try to detect
    // if this is a complete WebM file or just a chunk
    
    const isWebMHeader = webmBuffer.length > 4 && 
                        webmBuffer[0] === 0x1a && 
                        webmBuffer[1] === 0x45 && 
                        webmBuffer[2] === 0xdf && 
                        webmBuffer[3] === 0xa3;
    
    console.log('WebM chunk info:', {
      size: webmBuffer.length,
      hasWebMHeader: isWebMHeader,
      first10Bytes: webmBuffer.slice(0, 10).toString('hex')
    });
    
    // If it's too small, it's probably not a valid chunk
    if (webmBuffer.length < 100) {
      console.warn('WebM chunk too small, returning empty buffer');
      return Buffer.alloc(0);
    }
    
    // Try a different approach - use ffmpeg with specific codec settings
    return this.convertWithFFmpeg(webmBuffer);
  }
  
  async convertWithFFmpeg(webmBuffer) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      
      // Try with more specific settings for WebM/Opus
      const ffmpeg = spawn('ffmpeg', [
        '-f', 'webm',             // Input format
        '-acodec', 'libopus',     // Input codec (WebM usually uses Opus)
        '-i', 'pipe:0',           // Input from stdin
        '-f', 's16le',            // Output format: 16-bit little-endian PCM
        '-acodec', 'pcm_s16le',   // Output codec
        '-ar', this.sampleRate.toString(),    // Sample rate
        '-ac', this.channels.toString(),      // Number of channels
        '-loglevel', 'warning',   // Show warnings
        'pipe:1'                  // Output to stdout
      ]);

      // Timeout to prevent hanging
      const timeout = setTimeout(() => {
        console.error('FFmpeg conversion timeout');
        ffmpeg.kill();
        reject(new Error('FFmpeg conversion timeout'));
      }, 5000);

      // Collect output data
      ffmpeg.stdout.on('data', (chunk) => {
        chunks.push(chunk);
      });

      // Handle completion
      ffmpeg.on('close', (code) => {
        clearTimeout(timeout);
        if (code === 0) {
          const pcmBuffer = Buffer.concat(chunks);
          console.log('Successfully converted WebM to PCM, size:', webmBuffer.length, '->', pcmBuffer.length);
          resolve(pcmBuffer);
        } else if (code === null) {
          // Killed by timeout
          reject(new Error('FFmpeg conversion timeout'));
        } else {
          console.error('FFmpeg exited with code:', code);
          // Try alternative approach
          this.tryAlternativeConversion(webmBuffer).then(resolve).catch(reject);
        }
      });

      // Handle errors
      ffmpeg.on('error', (err) => {
        clearTimeout(timeout);
        console.error('FFmpeg spawn error:', err);
        if (err.code === 'ENOENT') {
          reject(new Error('FFmpeg not found. Please install FFmpeg.'));
        } else {
          reject(err);
        }
      });

      let stderrData = '';
      ffmpeg.stderr.on('data', (data) => {
        stderrData += data.toString();
      });

      // Handle stdin errors
      ffmpeg.stdin.on('error', (err) => {
        console.error('FFmpeg stdin error:', err);
        ffmpeg.stdin.end();
      });

      // Write input data and close stdin
      try {
        ffmpeg.stdin.write(webmBuffer);
        ffmpeg.stdin.end();
      } catch (err) {
        console.error('Error writing to FFmpeg stdin:', err);
        clearTimeout(timeout);
        ffmpeg.kill();
        reject(err);
      }
    });
  }
  
  async tryAlternativeConversion(webmBuffer) {
    return new Promise((resolve, reject) => {
      console.log('Trying alternative FFmpeg settings...');
      const chunks = [];
      
      // Try without specifying input format/codec
      const ffmpeg = spawn('ffmpeg', [
        '-i', 'pipe:0',           // Let FFmpeg auto-detect
        '-f', 's16le',            // Output format
        '-acodec', 'pcm_s16le',   // Output codec
        '-ar', '16000',           // Sample rate
        '-ac', '1',               // Mono
        '-loglevel', 'error',     // Only errors
        'pipe:1'
      ]);

      const timeout = setTimeout(() => {
        ffmpeg.kill();
        reject(new Error('Alternative conversion timeout'));
      }, 5000);

      ffmpeg.stdout.on('data', (chunk) => {
        chunks.push(chunk);
      });

      ffmpeg.on('close', (code) => {
        clearTimeout(timeout);
        if (code === 0) {
          const pcmBuffer = Buffer.concat(chunks);
          console.log('Alternative conversion successful, size:', pcmBuffer.length);
          resolve(pcmBuffer);
        } else {
          // If all else fails, return silence
          console.error('All conversion attempts failed, returning silence');
          resolve(this.createSilence(1000)); // 1 second of silence
        }
      });

      ffmpeg.on('error', (err) => {
        clearTimeout(timeout);
        console.error('Alternative FFmpeg error:', err);
        resolve(this.createSilence(1000));
      });

      let stderrData = '';
      ffmpeg.stderr.on('data', (data) => {
        stderrData += data.toString();
        console.error('Alternative FFmpeg stderr:', stderrData);
      });

      try {
        ffmpeg.stdin.write(webmBuffer);
        ffmpeg.stdin.end();
      } catch (err) {
        clearTimeout(timeout);
        ffmpeg.kill();
        resolve(this.createSilence(1000));
      }
    });
  }

  /**
   * Create silence PCM data
   */
  createSilence(durationMs) {
    const samples = Math.floor((durationMs / 1000) * this.sampleRate);
    const buffer = Buffer.alloc(samples * 2); // 16-bit = 2 bytes per sample
    return buffer;
  }
}

module.exports = WebmToPCMConverter;