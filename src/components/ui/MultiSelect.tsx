'use client';

import React, { useState, useRef, useEffect } from 'react';

interface Option {
  value: string;
  label: string;
}

interface MultiSelectProps {
  options: Option[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export const MultiSelect: React.FC<MultiSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Select options...',
  className = '',
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter options based on search query
  const filteredOptions = options.filter(option =>
    option.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleToggleOption = (optionValue: string) => {
    if (value.includes(optionValue)) {
      onChange(value.filter(v => v !== optionValue));
    } else {
      onChange([...value, optionValue]);
    }
  };

  const handleSelectAll = () => {
    if (value.length === options.length) {
      onChange([]);
    } else {
      onChange(options.map(option => option.value));
    }
  };

  const getDisplayText = () => {
    if (value.length === 0) return placeholder;
    if (value.length === 1) {
      const option = options.find(opt => opt.value === value[0]);
      return option?.label || '';
    }
    return `${value.length} stores selected`;
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <div
        className={`
          w-full px-3 py-2 border border-secondary/30 rounded-xl bg-background text-primary
          cursor-pointer flex items-center justify-between
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-secondary/50'}
          ${isOpen ? 'border-primary/50' : ''}
        `}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <span className={value.length === 0 ? 'text-secondary' : 'text-primary'}>
          {getDisplayText()}
        </span>
        <svg
          className={`w-4 h-4 text-secondary transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-background border border-secondary/30 rounded-xl shadow-lg max-h-64 overflow-hidden">
          {/* Search input */}
          <div className="p-2 border-b border-secondary/10">
            <input
              ref={inputRef}
              type="text"
              placeholder="Search stores..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-2 py-1 text-sm border border-secondary/30 rounded-lg bg-background text-primary placeholder-secondary focus:outline-none focus:border-primary/50"
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          {/* Select All option */}
          <div className="p-2 border-b border-secondary/10">
            <label className="flex items-center gap-2 cursor-pointer hover:bg-background/50 p-1 rounded">
              <input
                type="checkbox"
                checked={value.length === options.length}
                onChange={handleSelectAll}
                className="rounded border-secondary/30"
              />
              <span className="text-sm font-medium text-primary">
                Select All ({options.length})
              </span>
            </label>
          </div>

          {/* Options list */}
          <div className="max-h-48 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="p-3 text-sm text-secondary text-center">
                No stores found
              </div>
            ) : (
              filteredOptions.map((option) => (
                <label
                  key={option.value}
                  className="flex items-center gap-2 p-2 cursor-pointer hover:bg-background/50"
                >
                  <input
                    type="checkbox"
                    checked={value.includes(option.value)}
                    onChange={() => handleToggleOption(option.value)}
                    className="rounded border-secondary/30"
                  />
                  <span className="text-sm text-primary flex-1">
                    {option.label}
                  </span>
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};