'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, Square, Play, Pause } from 'lucide-react';
import { AudioRecorder as AudioRecorderUtil, formatDuration, checkMicrophonePermission } from '@/utils/audio';
import { Language, AudioRecordingState, RecordingError } from '@/types';
import { cn } from '@/utils';
import { getMedicalTerm } from '@/utils/languages';

interface AudioRecorderProps {
  language: Language;
  onAudioData?: (audioData: ArrayBuffer) => void;
  onRecordingStateChange?: (state: AudioRecordingState) => void;
  onError?: (error: RecordingError) => void;
  className?: string;
}

export default function AudioRecorder({
  language,
  onAudioData,
  onRecordingStateChange,
  onError,
  className,
}: AudioRecorderProps) {
  const [recordingState, setRecordingState] = useState<AudioRecordingState>({
    isRecording: false,
    isPaused: false,
    duration: 0,
    audioLevel: 0,
  });
  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  
  const audioRecorderRef = useRef<AudioRecorderUtil | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioLevelIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const streamingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize audio recorder
  useEffect(() => {
    const initializeRecorder = async () => {
      console.log('AudioRecorder: Checking microphone permission...');
      try {
        const permission = await checkMicrophonePermission();
        console.log('AudioRecorder: Permission result:', permission);
        setHasPermission(permission);
        
        if (permission) {
          console.log('AudioRecorder: Initializing recorder...');
          audioRecorderRef.current = new AudioRecorderUtil();
          await audioRecorderRef.current.initialize();
          setError(null);
          console.log('AudioRecorder: Recorder initialized successfully');
        }
      } catch (err) {
        console.error('AudioRecorder: Error during initialization:', err);
        const error: RecordingError = {
          code: 'PERMISSION_DENIED',
          message: 'Microphone access denied',
          details: err,
        };
        setError(error.message);
        onError?.(error);
      }
    };

    initializeRecorder();

    return () => {
      if (audioRecorderRef.current) {
        audioRecorderRef.current.destroy();
      }
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      if (audioLevelIntervalRef.current) {
        clearInterval(audioLevelIntervalRef.current);
      }
    };
  }, [onError]);

  // Update recording state callback
  useEffect(() => {
    onRecordingStateChange?.(recordingState);
  }, [recordingState, onRecordingStateChange]);

  const startRecording = useCallback(async () => {
    console.log('startRecording called, hasPermission:', hasPermission, 'recorder exists:', !!audioRecorderRef.current);
    
    if (!audioRecorderRef.current || !hasPermission) {
      console.log('Cannot start recording - missing recorder or permission');
      if (!hasPermission) {
        console.log('No permission - requesting again');
        // Try to initialize again
        const initializeRecorder = async () => {
          try {
            const permission = await checkMicrophonePermission();
            console.log('Re-check permission result:', permission);
            setHasPermission(permission);
            
            if (permission) {
              audioRecorderRef.current = new AudioRecorderUtil();
              await audioRecorderRef.current.initialize();
              setError(null);
              console.log('Recorder re-initialized after permission grant');
              // Try to start recording again
              setTimeout(() => startRecording(), 100);
            }
          } catch (err) {
            console.error('Error during re-initialization:', err);
            const error: RecordingError = {
              code: 'PERMISSION_DENIED',
              message: 'Microphone access denied',
              details: err,
            };
            setError(error.message);
            onError?.(error);
          }
        };
        initializeRecorder();
      }
      return;
    }

    try {
      // Define streaming callback
      const streamingCallback = async (audioBlob: Blob) => {
        try {
          const audioData = await AudioRecorderUtil.blobToArrayBuffer(audioBlob);
          console.log('AudioRecorder: Streaming audio chunk, size:', audioData.byteLength);
          onAudioData?.(audioData);
        } catch (err) {
          console.error('AudioRecorder: Error converting blob for streaming:', err);
        }
      };
      
      await audioRecorderRef.current.startRecording(streamingCallback);
      startTimeRef.current = Date.now();
      setIsStreaming(true);
      
      setRecordingState(prev => ({
        ...prev,
        isRecording: true,
        isPaused: false,
      }));

      // Start duration timer
      durationIntervalRef.current = setInterval(() => {
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        setRecordingState(prev => ({
          ...prev,
          duration: elapsed,
        }));
      }, 100);

      // Start audio level monitoring
      audioLevelIntervalRef.current = setInterval(() => {
        if (audioRecorderRef.current) {
          const level = audioRecorderRef.current.getAudioLevel();
          setRecordingState(prev => ({
            ...prev,
            audioLevel: level,
          }));
        }
      }, 50);

      setError(null);
    } catch (err) {
      const error: RecordingError = {
        code: 'START_FAILED',
        message: 'Failed to start recording',
        details: err,
      };
      setError(error.message);
      onError?.(error);
    }
  }, [hasPermission, onError]);

  const stopRecording = useCallback(async () => {
    if (!audioRecorderRef.current) {
      return;
    }

    try {
      const audioBlob = await audioRecorderRef.current.stopRecording();
      console.log('AudioRecorder: Recording stopped, final blob size:', audioBlob.size);
      
      setIsStreaming(false);
      setRecordingState(prev => ({
        ...prev,
        isRecording: false,
        isPaused: false,
      }));

      // Clear intervals
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      if (audioLevelIntervalRef.current) {
        clearInterval(audioLevelIntervalRef.current);
      }

      // No need to send final audio data as we've been streaming
      console.log('AudioRecorder: Streaming completed');
      setError(null);
    } catch (err) {
      const error: RecordingError = {
        code: 'STOP_FAILED',
        message: 'Failed to stop recording',
        details: err,
      };
      setError(error.message);
      onError?.(error);
    }
  }, [onError]);

  const pauseRecording = useCallback(() => {
    if (audioRecorderRef.current) {
      audioRecorderRef.current.pauseRecording();
      setRecordingState(prev => ({
        ...prev,
        isPaused: true,
      }));

      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      if (audioLevelIntervalRef.current) {
        clearInterval(audioLevelIntervalRef.current);
      }
    }
  }, []);

  const resumeRecording = useCallback(() => {
    if (audioRecorderRef.current) {
      audioRecorderRef.current.resumeRecording();
      setRecordingState(prev => ({
        ...prev,
        isPaused: false,
      }));

      // Resume timers
      const pausedTime = Date.now() - startTimeRef.current - (recordingState.duration * 1000);
      startTimeRef.current = Date.now() - (recordingState.duration * 1000);

      durationIntervalRef.current = setInterval(() => {
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        setRecordingState(prev => ({
          ...prev,
          duration: elapsed,
        }));
      }, 100);

      audioLevelIntervalRef.current = setInterval(() => {
        if (audioRecorderRef.current) {
          const level = audioRecorderRef.current.getAudioLevel();
          setRecordingState(prev => ({
            ...prev,
            audioLevel: level,
          }));
        }
      }, 50);
    }
  }, [recordingState.duration]);

  const resetRecording = useCallback(() => {
    setRecordingState({
      isRecording: false,
      isPaused: false,
      duration: 0,
      audioLevel: 0,
    });

    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
    }
    if (audioLevelIntervalRef.current) {
      clearInterval(audioLevelIntervalRef.current);
    }
  }, []);

  if (!hasPermission) {
    return (
      <div className={cn('medical-card', className)}>
        <div className="text-center py-8">
          <MicOff className="mx-auto h-12 w-12 text-navy-400 mb-4" />
          <h3 className="text-lg font-medium text-navy-900 mb-2">
            Microphone Access Required
          </h3>
          <p className="text-sm text-navy-600 mb-4">
            Please enable microphone access to record audio for transcription.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="medical-button-primary"
          >
            Request Permission
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('medical-card', className)}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-navy-900">{getMedicalTerm('audioRecording', language)}</h3>
        <div className="text-sm text-navy-600">
          Language: <span className="font-medium">{language.toUpperCase()}</span>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-error-50 border border-error-200 rounded-md">
          <p className="text-sm text-error-600">{error}</p>
        </div>
      )}

      <div className="flex items-center space-x-4 mb-6">
        {/* Recording Controls */}
        <div className="flex items-center space-x-2">
          {!recordingState.isRecording ? (
            <button
              onClick={startRecording}
              className="medical-button-primary flex items-center space-x-2"
              disabled={!hasPermission}
            >
              <Mic className="w-4 h-4" />
              <span>Start Recording</span>
            </button>
          ) : (
            <>
              {!recordingState.isPaused ? (
                <button
                  onClick={pauseRecording}
                  className="medical-button-secondary flex items-center space-x-2"
                >
                  <Pause className="w-4 h-4" />
                  <span>Pause</span>
                </button>
              ) : (
                <button
                  onClick={resumeRecording}
                  className="medical-button-success flex items-center space-x-2"
                >
                  <Play className="w-4 h-4" />
                  <span>Resume</span>
                </button>
              )}
              
              <button
                onClick={stopRecording}
                className="medical-button-danger flex items-center space-x-2"
              >
                <Square className="w-4 h-4" />
                <span>Stop</span>
              </button>
            </>
          )}
        </div>

        {/* Duration Display */}
        <div className="text-lg font-mono text-navy-700">
          {formatDuration(recordingState.duration)}
        </div>

        {/* Recording Indicator */}
        {recordingState.isRecording && !recordingState.isPaused && (
          <div className="flex items-center space-x-2">
            <div className="recording-indicator" />
            <span className="text-sm text-orange-600 font-medium">REC</span>
          </div>
        )}
      </div>

      {/* Audio Level Visualization */}
      <div className="mb-4">
        <div className="flex items-center space-x-2">
          <span className="text-sm text-navy-600">Level:</span>
          <div className="flex-1 bg-navy-200 rounded-full h-2">
            <div
              className="bg-orange-500 h-2 rounded-full transition-all duration-100"
              style={{ width: `${recordingState.audioLevel * 100}%` }}
            />
          </div>
          <span className="text-sm text-navy-600">
            {Math.round(recordingState.audioLevel * 100)}%
          </span>
        </div>
      </div>

      {/* Status */}
      <div className="text-sm text-navy-600">
        {recordingState.isRecording ? (
          recordingState.isPaused ? (
            <span className="text-orange-600 font-medium">Recording paused</span>
          ) : (
            <span className="text-orange-600 font-medium animate-pulse">Recording in progress...</span>
          )
        ) : (
          'Ready to record'
        )}
      </div>
    </div>
  );
}