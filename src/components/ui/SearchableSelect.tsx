'use client';

import { useState, useRef, useEffect, useMemo } from 'react';

export interface SearchableSelectOption {
  value: string;
  label: string;
  searchText?: string; // Additional text to search (e.g., SKU)
}

interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: boolean;
  id?: string;
  className?: string;
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  disabled = false,
  error = false,
  id,
  className = '',
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Get selected option label
  const selectedOption = options.find((opt) => opt.value === value);
  const displayValue = selectedOption?.label || '';

  // Filter options based on search query
  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    const query = searchQuery.toLowerCase();
    return options.filter((opt) => {
      const labelMatch = opt.label.toLowerCase().includes(query);
      const searchTextMatch = opt.searchText?.toLowerCase().includes(query);
      return labelMatch || searchTextMatch;
    });
  }, [options, searchQuery]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus input when dropdown opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleInputClick = () => {
    if (!disabled) {
      setIsOpen(true);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setSearchQuery('');
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Display field */}
      <div
        onClick={handleInputClick}
        className={`
          w-full px-6 py-3.5 rounded-xl border transition-all cursor-pointer
          flex items-center justify-between
          ${disabled ? 'bg-background cursor-not-allowed opacity-60' : 'bg-surface hover:border-accent-green/50'}
          ${error ? 'border-accent-red' : 'border-secondary/20'}
          ${isOpen ? 'border-accent-green ring-2 ring-accent-green/20' : ''}
        `}
      >
        <span className={`truncate ${displayValue ? 'text-primary' : 'text-secondary'}`}>
          {displayValue || placeholder}
        </span>
        <div className="flex items-center gap-1">
          {value && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 hover:bg-secondary/10 rounded"
            >
              <svg className="w-4 h-4 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          <svg
            className={`w-5 h-5 text-secondary transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Dropdown */}
      {isOpen && !disabled && (
        <div className="absolute z-[100] w-full mt-1 bg-surface border border-secondary/20 rounded-xl shadow-xl overflow-hidden max-h-[400px]">
          {/* Search input */}
          <div className="p-2 border-b border-secondary/20 bg-surface sticky top-0">
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Type to search..."
              id={id}
              className="w-full px-3 py-2 bg-background rounded-lg border border-secondary/20 
                         text-primary placeholder:text-secondary focus:outline-none 
                         focus:border-accent-green focus:ring-1 focus:ring-accent-green/20"
            />
          </div>

          {/* Options list */}
          <div className="max-h-60 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="px-4 py-3 text-secondary text-sm">No results found</div>
            ) : (
              filteredOptions.map((option) => (
                <div
                  key={option.value}
                  onClick={() => handleSelect(option.value)}
                  className={`
                    px-4 py-2.5 cursor-pointer transition-colors
                    ${option.value === value ? 'bg-accent-green/10 text-accent-green font-medium' : 'text-primary hover:bg-secondary/10'}
                  `}
                >
                  {option.label}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
