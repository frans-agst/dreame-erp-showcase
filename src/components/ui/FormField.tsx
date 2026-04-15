'use client';

import { ReactNode } from 'react';
import { FormError } from './FormError';

export interface FormFieldProps {
  label: string;
  htmlFor?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
  hint?: string;
}

export function FormField({
  label,
  htmlFor,
  error,
  required = false,
  children,
  className = '',
  hint,
}: FormFieldProps) {
  return (
    <div className={`space-y-1.5 ${className}`.trim()}>
      <label
        htmlFor={htmlFor}
        className="block text-sm font-medium text-primary"
      >
        {label}
        {required && <span className="text-accent-red ml-0.5">*</span>}
      </label>
      {children}
      {hint && !error && (
        <p className="text-xs text-secondary">{hint}</p>
      )}
      <FormError message={error} />
    </div>
  );
}
