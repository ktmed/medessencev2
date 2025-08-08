import { AudioConstraints, RecordingError } from '@/types';

export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private microphone: MediaStreamAudioSourceNode | null = null;
  private stream: MediaStream | null = null;
  private chunks: Blob[] = [];
  private animationFrame: number | null = null;
  private onDataCallback: ((data: Blob) => void) | null = null;

  private readonly constraints: AudioConstraints = {
    sampleRate: 16000,
    channelCount: 1,
    echoCancellation: true,
    noiseSuppression: true,
  };

  async initialize(): Promise<void> {
    console.log('AudioRecorder.initialize: Starting initialization');
    try {
      // Request microphone access
      console.log('AudioRecorder.initialize: Requesting getUserMedia with constraints:', {
        sampleRate: this.constraints.sampleRate,
        channelCount: this.constraints.channelCount,
        echoCancellation: this.constraints.echoCancellation,
        noiseSuppression: this.constraints.noiseSuppression,
        autoGainControl: true,
      });
      
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: this.constraints.sampleRate,
          channelCount: this.constraints.channelCount,
          echoCancellation: this.constraints.echoCancellation,
          noiseSuppression: this.constraints.noiseSuppression,
          autoGainControl: true,
        },
      });
      
      console.log('AudioRecorder.initialize: Got media stream:', this.stream);

      // Create audio context for analysis
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.8;

      // Connect microphone to analyser
      this.microphone = this.audioContext.createMediaStreamSource(this.stream);
      this.microphone.connect(this.analyser);

      // Create MediaRecorder
      const mimeType = this.getSupportedMimeType();
      const options: MediaRecorderOptions = {
        mimeType: mimeType,
        audioBitsPerSecond: 128000,
      };

      console.log('AudioRecorder.initialize: Creating MediaRecorder with mimeType:', mimeType);
      this.mediaRecorder = new MediaRecorder(this.stream, options);
      
      // Check if the stream has audio tracks
      const audioTracks = this.stream.getAudioTracks();
      console.log('AudioRecorder.initialize: Audio tracks:', audioTracks.length);
      audioTracks.forEach((track, index) => {
        console.log(`Track ${index}: enabled=${track.enabled}, muted=${track.muted}, readyState=${track.readyState}`);
      });
      
      this.setupMediaRecorderEvents();
      
      console.log('AudioRecorder.initialize: Initialization complete, MediaRecorder state:', this.mediaRecorder.state);

    } catch (error) {
      console.error('AudioRecorder.initialize: Failed with error:', error);
      throw this.createRecordingError('INITIALIZATION_FAILED', 'Failed to initialize audio recorder', error);
    }
  }

  startRecording(onDataCallback?: (data: Blob) => void): Promise<void> {
    console.log('AudioRecorder.startRecording: Called, mediaRecorder state:', this.mediaRecorder?.state);
    
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        console.error('AudioRecorder.startRecording: MediaRecorder not initialized');
        reject(this.createRecordingError('NOT_INITIALIZED', 'Audio recorder not initialized'));
        return;
      }

      if (this.mediaRecorder.state === 'recording') {
        console.log('AudioRecorder.startRecording: Already recording');
        resolve();
        return;
      }

      try {
        this.chunks = [];
        this.onDataCallback = onDataCallback || null;
        console.log('AudioRecorder.startRecording: Starting MediaRecorder with streaming:', !!onDataCallback);
        
        // For streaming, use smaller time slices for lower latency
        const timeSlice = onDataCallback ? 250 : 1000; // 250ms chunks for streaming
        this.mediaRecorder.start(timeSlice);
        
        console.log('AudioRecorder.startRecording: MediaRecorder started, state:', this.mediaRecorder.state);
        this.startAudioLevelMonitoring();
        resolve();
      } catch (error) {
        console.error('AudioRecorder.startRecording: Failed to start:', error);
        reject(this.createRecordingError('START_FAILED', 'Failed to start recording', error));
      }
    });
  }

  stopRecording(): Promise<Blob> {
    console.log('AudioRecorder.stopRecording: Called, mediaRecorder state:', this.mediaRecorder?.state);
    console.log('AudioRecorder.stopRecording: Chunks collected:', this.chunks.length);
    
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        console.error('AudioRecorder.stopRecording: MediaRecorder not initialized');
        reject(this.createRecordingError('NOT_INITIALIZED', 'Audio recorder not initialized'));
        return;
      }

      if (this.mediaRecorder.state === 'inactive') {
        console.log('AudioRecorder.stopRecording: Already inactive, creating blob from chunks');
        const audioBlob = new Blob(this.chunks, { type: this.getSupportedMimeType() });
        console.log('AudioRecorder.stopRecording: Created blob, size:', audioBlob.size);
        resolve(audioBlob);
        return;
      }

      const handleStop = () => {
        console.log('AudioRecorder.stopRecording: Stop event received, creating blob from chunks:', this.chunks.length);
        const audioBlob = new Blob(this.chunks, { type: this.getSupportedMimeType() });
        console.log('AudioRecorder.stopRecording: Created blob, size:', audioBlob.size, 'type:', audioBlob.type);
        this.stopAudioLevelMonitoring();
        resolve(audioBlob);
      };

      this.mediaRecorder.addEventListener('stop', handleStop, { once: true });

      try {
        console.log('AudioRecorder.stopRecording: Calling mediaRecorder.stop()');
        this.mediaRecorder.stop();
      } catch (error) {
        console.error('AudioRecorder.stopRecording: Failed to stop:', error);
        reject(this.createRecordingError('STOP_FAILED', 'Failed to stop recording', error));
      }
    });
  }

  pauseRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.pause();
      this.stopAudioLevelMonitoring();
    }
  }

  resumeRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
      this.mediaRecorder.resume();
      this.startAudioLevelMonitoring();
    }
  }

  getAudioLevel(): number {
    if (!this.analyser) return 0;

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteFrequencyData(dataArray);

    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      sum += dataArray[i];
    }

    return (sum / bufferLength) / 255;
  }

  isRecording(): boolean {
    return this.mediaRecorder?.state === 'recording';
  }

  isPaused(): boolean {
    return this.mediaRecorder?.state === 'paused';
  }

  destroy(): void {
    this.stopAudioLevelMonitoring();

    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }

    this.mediaRecorder = null;
    this.audioContext = null;
    this.analyser = null;
    this.microphone = null;
    this.stream = null;
    this.chunks = [];
  }

  // Convert blob to ArrayBuffer for WebSocket transmission
  static async blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(new Error('Failed to convert blob to ArrayBuffer'));
      reader.readAsArrayBuffer(blob);
    });
  }

  // Get supported audio format
  private getSupportedMimeType(): string {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus',
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    return 'audio/webm'; // Fallback
  }

  private setupMediaRecorderEvents(): void {
    if (!this.mediaRecorder) return;

    this.mediaRecorder.ondataavailable = (event) => {
      console.log('AudioRecorder: Data available, size:', event.data.size);
      if (event.data.size > 0) {
        this.chunks.push(event.data);
        console.log('AudioRecorder: Total chunks:', this.chunks.length);
        
        // If streaming callback is set, send data immediately
        if (this.onDataCallback && event.data.size > 0) {
          console.log('AudioRecorder: Streaming chunk, size:', event.data.size);
          this.onDataCallback(event.data);
        }
      }
    };

    this.mediaRecorder.onerror = (event) => {
      console.error('MediaRecorder error:', event);
    };
    
    this.mediaRecorder.onstart = () => {
      console.log('AudioRecorder: MediaRecorder started event');
    };
    
    this.mediaRecorder.onstop = () => {
      console.log('AudioRecorder: MediaRecorder stopped event');
    };
  }

  private startAudioLevelMonitoring(): void {
    const updateLevel = () => {
      if (this.isRecording()) {
        this.animationFrame = requestAnimationFrame(updateLevel);
      }
    };
    updateLevel();
  }

  private stopAudioLevelMonitoring(): void {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  private createRecordingError(code: string, message: string, details?: any): RecordingError {
    return {
      code,
      message,
      details,
    };
  }
}

// Utility functions
export const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export const checkMicrophonePermission = async (): Promise<boolean> => {
  console.log('checkMicrophonePermission: Starting permission check');
  
  // Most browsers don't support permissions.query for microphone
  // So we directly try to access it
  try {
    console.log('checkMicrophonePermission: Requesting microphone access');
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    console.log('checkMicrophonePermission: Access granted, stream created');
    
    // Important: stop the tracks to release the microphone
    stream.getTracks().forEach(track => {
      console.log('checkMicrophonePermission: Stopping track:', track.label);
      track.stop();
    });
    
    return true;
  } catch (error) {
    console.error('checkMicrophonePermission: Access denied or error:', error);
    return false;
  }
};