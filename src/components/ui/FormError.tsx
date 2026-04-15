'use client';

export interface FormErrorProps {
  message?: string;
  className?: string;
}

export function FormError({ message, className = '' }: FormErrorProps) {
  if (!message) return null;

  return (
    <p
      className={`text-sm text-accent-red mt-1 ${className}`.trim()}
      role="alert"
    >
      {message}
    </p>
  );
}
