'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Globe, Check } from 'lucide-react';
import { Language } from '@/types';
import { SUPPORTED_LANGUAGES, getLanguageName, getLanguageFlag } from '@/utils/languages';
import { cn } from '@/utils';

interface LanguageSelectorProps {
  selectedLanguage: Language;
  onLanguageChange: (language: Language) => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  label?: string;
}

export default function LanguageSelector({
  selectedLanguage,
  onLanguageChange,
  disabled = false,
  size = 'md',
  className,
  label,
}: LanguageSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !buttonRef.current?.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close dropdown on escape key
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscapeKey);
      return () => document.removeEventListener('keydown', handleEscapeKey);
    }
  }, [isOpen]);

  const handleLanguageSelect = (language: Language) => {
    onLanguageChange(language);
    setIsOpen(false);
  };

  const selectedLanguageData = SUPPORTED_LANGUAGES.find(
    lang => lang.code === selectedLanguage
  );

  const sizeClasses = {
    sm: 'px-2 py-1 text-sm',
    md: 'px-3 py-2 text-sm',
    lg: 'px-4 py-3 text-base',
  };

  return (
    <div className={cn('relative', className)}>
      {label && (
        <label className="block text-sm font-medium text-navy-700 mb-2">
          {label}
        </label>
      )}
      
      <div className="relative">
        <button
          ref={buttonRef}
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={cn(
            'medical-select flex items-center justify-between',
            sizeClasses[size],
            disabled && 'opacity-50 cursor-not-allowed',
            isOpen && 'ring-2 ring-orange-500 border-orange-500'
          )}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-label="Select language"
        >
          <div className="flex items-center space-x-2">
            <Globe className="w-4 h-4 text-navy-500" />
            <span className="text-lg">{selectedLanguageData?.flag}</span>
            <span className="font-medium text-navy-900">
              {selectedLanguageData?.name || 'Select Language'}
            </span>
          </div>
          <ChevronDown
            className={cn(
              'w-4 h-4 text-navy-500 transition-transform',
              isOpen && 'transform rotate-180'
            )}
          />
        </button>

        {/* Dropdown Menu */}
        {isOpen && (
          <div
            ref={dropdownRef}
            className="absolute z-50 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto"
            role="listbox"
          >
            {SUPPORTED_LANGUAGES.map((language) => {
              const isSelected = language.code === selectedLanguage;
              
              return (
                <button
                  key={language.code}
                  type="button"
                  onClick={() => handleLanguageSelect(language.code)}
                  className={cn(
                    'w-full px-3 py-2 text-left flex items-center justify-between hover:bg-navy-50 focus:bg-navy-50 focus:outline-none',
                    isSelected && 'bg-orange-50 text-orange-700'
                  )}
                  role="option"
                  aria-selected={isSelected}
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-lg">{language.flag}</span>
                    <div>
                      <div className="font-medium">{language.name}</div>
                      <div className="text-xs text-navy-500 uppercase">
                        {language.code}
                      </div>
                    </div>
                  </div>
                  {isSelected && (
                    <Check className="w-4 h-4 text-orange-600" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Help Text */}
      <div className="mt-2 text-xs text-navy-500">
        Select the language for transcription and report generation
      </div>
    </div>
  );
}

// Compact version for headers/toolbars
export function CompactLanguageSelector({
  selectedLanguage,
  onLanguageChange,
  disabled = false,
  className,
}: Pick<LanguageSelectorProps, 'selectedLanguage' | 'onLanguageChange' | 'disabled' | 'className'>) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !buttonRef.current?.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedLanguageData = SUPPORTED_LANGUAGES.find(
    lang => lang.code === selectedLanguage
  );

  const handleLanguageSelect = (language: Language) => {
    onLanguageChange(language);
    setIsOpen(false);
  };

  return (
    <div className={cn('relative', className)}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          'flex items-center space-x-1 px-2 py-1 rounded-md border border-navy-300 bg-white hover:bg-navy-50 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
        title={`Current language: ${selectedLanguageData?.name}`}
      >
        <span className="text-sm">{selectedLanguageData?.flag}</span>
        <span className="text-xs font-medium uppercase">
          {selectedLanguageData?.code}
        </span>
        <ChevronDown className="w-3 h-3 text-navy-400" />
      </button>

      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute right-0 z-50 mt-1 bg-white border border-gray-300 rounded-md shadow-lg min-w-[160px]"
        >
          {SUPPORTED_LANGUAGES.map((language) => {
            const isSelected = language.code === selectedLanguage;
            
            return (
              <button
                key={language.code}
                type="button"
                onClick={() => handleLanguageSelect(language.code)}
                className={cn(
                  'w-full px-3 py-2 text-left flex items-center space-x-2 hover:bg-navy-50 focus:bg-navy-50 focus:outline-none text-sm',
                  isSelected && 'bg-orange-50 text-orange-700'
                )}
              >
                <span>{language.flag}</span>
                <span className="font-medium">{language.name}</span>
                {isSelected && (
                  <Check className="w-3 h-3 text-orange-600 ml-auto" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}