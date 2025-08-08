'use client';

import React, { useEffect, useState } from 'react';
import { Activity, Mic, MicOff } from 'lucide-react';
import { cn } from '@/utils';

interface TranscriptionStatusProps {
  isRecording: boolean;
  isTranscribing: boolean;
  audioLevel: number;
  lastTranscriptionTime?: number;
  className?: string;
}

export default function TranscriptionStatus({
  isRecording,
  isTranscribing,
  audioLevel,
  lastTranscriptionTime,
  className
}: TranscriptionStatusProps) {
  const [timeSinceLastTranscription, setTimeSinceLastTranscription] = useState<number>(0);

  useEffect(() => {
    if (!lastTranscriptionTime) return;

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - lastTranscriptionTime) / 1000);
      setTimeSinceLastTranscription(elapsed);
    }, 1000);

    return () => clearInterval(interval);
  }, [lastTranscriptionTime]);

  // Audio level visualization
  const audioLevelBars = Array.from({ length: 5 }, (_, i) => {
    const threshold = (i + 1) * 0.2;
    const isActive = audioLevel >= threshold;
    return isActive;
  });

  return (
    <div className={cn('flex items-center space-x-3', className)}>
      {/* Recording Status */}
      <div className="flex items-center space-x-2">
        {isRecording ? (
          <Mic className="w-4 h-4 text-orange-600" />
        ) : (
          <MicOff className="w-4 h-4 text-navy-400" />
        )}
        <span className={cn(
          'text-sm font-medium',
          isRecording ? 'text-orange-600' : 'text-navy-400'
        )}>
          {isRecording ? 'Recording' : 'Not Recording'}
        </span>
      </div>

      {/* Audio Level Indicator */}
      {isRecording && (
        <div className="flex items-center space-x-1">
          {audioLevelBars.map((isActive, index) => (
            <div
              key={index}
              className={cn(
                'w-1 transition-all duration-100',
                isActive ? 'bg-orange-500' : 'bg-navy-300',
                index === 0 && 'h-2',
                index === 1 && 'h-3',
                index === 2 && 'h-4',
                index === 3 && 'h-3',
                index === 4 && 'h-2'
              )}
            />
          ))}
        </div>
      )}

      {/* Transcription Activity */}
      {isTranscribing && (
        <div className="flex items-center space-x-1">
          <Activity className="w-4 h-4 text-navy-600 animate-pulse" />
          <span className="text-sm text-navy-600">Processing</span>
        </div>
      )}

      {/* Time Since Last Transcription */}
      {!isTranscribing && lastTranscriptionTime && timeSinceLastTranscription > 3 && (
        <span className="text-xs text-navy-500">
          Last: {timeSinceLastTranscription}s ago
        </span>
      )}
    </div>
  );
}