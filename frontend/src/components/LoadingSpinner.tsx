'use client';

import React from 'react';
import { cn } from '@/utils';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  label?: string;
}

export default function LoadingSpinner({ 
  size = 'md', 
  className,
  label 
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  return (
    <div className={cn('flex items-center justify-center', className)}>
      <div className="flex flex-col items-center space-y-2">
        <div
          className={cn(
            'animate-spin border-4 border-navy-200 border-t-orange-500 rounded-full',
            sizeClasses[size]
          )}
        />
        {label && (
          <p className="text-sm text-navy-600">{label}</p>
        )}
      </div>
    </div>
  );
}

// Inline spinner for buttons
export function InlineSpinner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-spin w-4 h-4 border-2 border-white border-t-orange-400 rounded-full',
        className
      )}
    />
  );
}