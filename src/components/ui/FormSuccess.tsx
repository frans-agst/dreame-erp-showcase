'use client';

export interface FormSuccessProps {
  message?: string;
  className?: string;
}

export function FormSuccess({ message, className = '' }: FormSuccessProps) {
  if (!message) return null;

  return (
    <p
      className={`text-sm text-accent-green mt-1 ${className}`.trim()}
      role="status"
    >
      {message}
    </p>
  );
}
