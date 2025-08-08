'use client';

import React from 'react';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export default function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  // Enhanced markdown rendering for medical reports with better text handling
  const renderContent = () => {
    if (!content) return null;
    
    // Ensure content is properly encoded and handle potential encoding issues
    const cleanContent = typeof content === 'string' ? content : String(content);
    
    // Split by lines to handle markdown, preserving empty lines
    const lines = cleanContent.split('\n');
    const elements: React.ReactNode[] = [];
    let currentIndex = 0;
    
    lines.forEach((line, index) => {
      // Handle bold text with **text**
      if (line.includes('**')) {
        const parts = line.split(/\*\*(.*?)\*\*/g);
        const lineElements: React.ReactNode[] = [];
        
        parts.forEach((part, partIndex) => {
          if (partIndex % 2 === 0) {
            // Regular text - preserve special characters and German text
            if (part.trim()) {
              lineElements.push(
                <span key={`text-${index}-${partIndex}`} className="whitespace-pre-wrap">
                  {part}
                </span>
              );
            }
          } else {
            // Bold text
            lineElements.push(
              <strong key={`bold-${index}-${partIndex}`} className="font-semibold text-gray-900 whitespace-pre-wrap">
                {part}
              </strong>
            );
          }
        });
        
        elements.push(
          <div key={`line-${currentIndex++}`} className="mb-2 leading-relaxed">
            {lineElements}
          </div>
        );
      } else if (line.trim() === '') {
        // Empty line creates spacing
        elements.push(<div key={`space-${currentIndex++}`} className="h-4" />);
      } else {
        // Regular line - preserve formatting and handle long German medical text
        elements.push(
          <div key={`line-${currentIndex++}`} className="mb-2 leading-relaxed whitespace-pre-wrap break-words">
            {line}
          </div>
        );
      }
    });
    
    return elements;
  };
  
  return (
    <div className={`${className} text-gray-700`}>
      {renderContent()}
    </div>
  );
}