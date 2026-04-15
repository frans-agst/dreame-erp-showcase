'use client';

import { forwardRef, InputHTMLAttributes } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ error = false, className = '', ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={`
          w-full px-4 py-2.5 rounded-xl
          bg-surface border transition-all duration-200
          text-primary placeholder:text-muted
          focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary
          disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-neutral-100 dark:disabled:bg-neutral-800
          ${error 
            ? 'border-neutral-500 focus:ring-neutral-500/20 focus:border-neutral-500' 
            : 'border-border hover:border-secondary'
          }
          ${className}
        `.trim().replace(/\s+/g, ' ')}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';
