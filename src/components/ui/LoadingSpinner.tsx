'use client';

export interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeStyles = {
  sm: 'w-4 h-4 border-2',
  md: 'w-8 h-8 border-2',
  lg: 'w-12 h-12 border-3',
};

export function LoadingSpinner({ size = 'md', className = '' }: LoadingSpinnerProps) {
  return (
    <div
      className={`
        ${sizeStyles[size]}
        border-accent-green border-t-transparent
        rounded-full animate-spin
        ${className}
      `.trim().replace(/\s+/g, ' ')}
      role="status"
      aria-label="Loading"
    />
  );
}
