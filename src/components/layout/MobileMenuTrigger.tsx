'use client';

export interface MobileMenuTriggerProps {
  onClick: () => void;
  className?: string;
}

export function MobileMenuTrigger({ onClick, className = '' }: MobileMenuTriggerProps) {
  return (
    <button
      onClick={onClick}
      className={`
        lg:hidden p-2 rounded-xl hover:bg-background
        transition-colors duration-200
        ${className}
      `.trim().replace(/\s+/g, ' ')}
      aria-label="Open menu"
    >
      <svg
        className="w-6 h-6 text-primary"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M4 6h16M4 12h16M4 18h16"
        />
      </svg>
    </button>
  );
}
