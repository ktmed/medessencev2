import { io, Socket } from 'socket.io-client';
import { WebSocketMessage, TranscriptionData, MedicalReport, PatientSummary } from '@/types';

export class WebSocketClient {
  socket: Socket | null = null;  // Made public for access
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private connectionListeners: ((connected: boolean) => void)[] = [];
  private lastTranscriptionTime: number = 0;

  constructor(private url: string = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080') {
    console.log('WebSocket URL:', this.url);
    console.log('Environment WS URL:', process.env.NEXT_PUBLIC_WS_URL);
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.socket = io(this.url, {
          transports: ['websocket', 'polling'],
          timeout: 10000,
          reconnection: true,
          reconnectionAttempts: this.maxReconnectAttempts,
          reconnectionDelay: this.reconnectDelay,
          autoConnect: true,
          withCredentials: true,
        });

        // Set a timeout for the connection
        const connectTimeout = setTimeout(() => {
          console.log('Connection timeout, but socket might still connect');
          // Resolve anyway to allow the app to continue
          resolve();
        }, 3000);

        this.socket.on('connect', () => {
          console.log('WebSocket connected');
          clearTimeout(connectTimeout);
          this.reconnectAttempts = 0;
          this.notifyConnectionChange(true);
          resolve();
        });
        
        // Debug: log all events
        this.socket.onAny((eventName, ...args) => {
          console.log('Socket.IO event received:', eventName, args);
        });
        
        // Also listen for our custom connection event
        this.socket.on('connection', (data) => {
          console.log('Received connection event:', data);
        });

        this.socket.on('disconnect', (reason) => {
          console.log('WebSocket disconnected:', reason);
          this.notifyConnectionChange(false);
          
          // Auto-reconnect for certain disconnect reasons
          if (reason === 'io server disconnect' || reason === 'transport close') {
            setTimeout(() => {
              if (this.socket && !this.socket.connected) {
                console.log('Attempting manual reconnection...');
                this.socket.connect();
              }
            }, this.reconnectDelay);
          }
        });

        this.socket.on('connect_error', (error) => {
          console.error('WebSocket connection error:', error);
          this.notifyConnectionChange(false);
        });

        this.socket.on('reconnect_attempt', (attemptNumber) => {
          console.log(`WebSocket reconnect attempt ${attemptNumber}`);
          this.reconnectAttempts = attemptNumber;
        });

        this.socket.on('reconnect', (attemptNumber) => {
          console.log(`WebSocket reconnected after ${attemptNumber} attempts`);
          this.reconnectAttempts = 0;
          this.notifyConnectionChange(true);
        });

        this.socket.on('reconnect_failed', () => {
          console.error('WebSocket reconnection failed after maximum attempts');
          this.notifyConnectionChange(false);
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // Send audio data for transcription
  sendAudioData(audioData: ArrayBuffer, language: string): void {
    if (this.socket && this.socket.connected) {
      this.socket.emit('audio_data', {
        data: audioData,
        language,
        timestamp: Date.now(),
      });
    }
  }

  // Request report generation
  requestReport(transcriptionId: string, language: string, transcriptionText?: string): void {
    if (this.socket && this.socket.connected) {
      this.socket.emit('generate_report', {
        transcriptionId,
        language,
        transcriptionText, // Include the actual text for pasted content
        timestamp: Date.now(),
      });
    }
  }

  // Request summary generation
  requestSummary(reportId: string, language: string): void {
    if (this.socket && this.socket.connected) {
      this.socket.emit('generate_summary', {
        reportId,
        language,
        timestamp: Date.now(),
      });
    }
  }

  // Connection status management
  private notifyConnectionChange(connected: boolean): void {
    this.connectionListeners.forEach(listener => listener(connected));
  }

  onConnectionChange(callback: (connected: boolean) => void): void {
    this.connectionListeners.push(callback);
    // Immediately notify current status
    callback(this.isConnected());
  }

  removeConnectionListener(callback: (connected: boolean) => void): void {
    this.connectionListeners = this.connectionListeners.filter(l => l !== callback);
  }

  // Manual reconnection
  reconnect(): void {
    if (this.socket && !this.socket.connected) {
      console.log('Manual reconnection initiated');
      this.reconnectAttempts = 0;
      this.socket.connect();
    }
  }

  // Event listeners
  onTranscription(callback: (data: TranscriptionData) => void): void {
    if (this.socket) {
      this.socket.on('transcription', (data) => {
        this.lastTranscriptionTime = Date.now();
        callback(data);
      });
    }
  }

  onReport(callback: (data: MedicalReport) => void): void {
    if (this.socket) {
      this.socket.on('report', (data) => {
        console.log('WebSocket received report event:', data);
        callback(data);
      });
    }
  }

  onSummary(callback: (data: PatientSummary) => void): void {
    if (this.socket) {
      this.socket.on('summary', callback);
    }
  }

  onError(callback: (error: any) => void): void {
    if (this.socket) {
      this.socket.on('error', callback);
    }
  }

  // Remove event listeners
  removeAllListeners(): void {
    if (this.socket) {
      this.socket.removeAllListeners();
    }
  }

  // Check connection status
  isConnected(): boolean {
    const connected = this.socket?.connected || false;
    console.log('isConnected check:', connected, 'socket exists:', !!this.socket);
    return connected;
  }

  // Get connection status info
  getConnectionInfo(): { connected: boolean; reconnectAttempts: number; lastTranscriptionTime: number } {
    return {
      connected: this.isConnected(),
      reconnectAttempts: this.reconnectAttempts,
      lastTranscriptionTime: this.lastTranscriptionTime,
    };
  }
}