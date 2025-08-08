'use client';

import React from 'react';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { cn } from '@/utils';

interface ConnectionStatusProps {
  isConnected: boolean;
  reconnectAttempts?: number;
  onReconnect?: () => void;
  className?: string;
}

export default function ConnectionStatus({ 
  isConnected, 
  reconnectAttempts = 0, 
  onReconnect,
  className 
}: ConnectionStatusProps) {
  return (
    <div className={cn('flex items-center space-x-2', className)}>
      <div className="flex items-center space-x-1">
        {isConnected ? (
          <Wifi className="w-4 h-4 text-orange-600" />
        ) : (
          <WifiOff className="w-4 h-4 text-red-600" />
        )}
        <span className={cn(
          'text-sm font-medium',
          isConnected ? 'text-orange-600' : 'text-red-600'
        )}>
          {isConnected ? 'Connected' : 'Disconnected'}
        </span>
      </div>
      
      {!isConnected && reconnectAttempts > 0 && (
        <span className="text-xs text-navy-500">
          (Retry {reconnectAttempts}/5)
        </span>
      )}
      
      {!isConnected && onReconnect && (
        <button
          onClick={onReconnect}
          className="p-1 text-navy-500 hover:text-navy-700 transition-colors"
          title="Reconnect"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}