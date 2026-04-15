'use client';

export type StatusBadgeVariant = 'red' | 'yellow' | 'green';

export interface StatusBadgeProps {
  status: StatusBadgeVariant;
  label?: string;
  className?: string;
}

// Semantic status styles with colored indicators
const statusStyles: Record<StatusBadgeVariant, { bg: string; text: string; dot: string }> = {
  red: {
    bg: 'bg-accent-red-light',
    text: 'text-accent-red',
    dot: 'bg-accent-red',
  },
  yellow: {
    bg: 'bg-accent-yellow-light',
    text: 'text-accent-yellow',
    dot: 'bg-accent-yellow',
  },
  green: {
    bg: 'bg-accent-green-light',
    text: 'text-accent-green',
    dot: 'bg-accent-green',
  },
};

const defaultLabels: Record<StatusBadgeVariant, string> = {
  red: 'Low',
  yellow: 'Medium',
  green: 'High',
};

export function StatusBadge({ status, label, className = '' }: StatusBadgeProps) {
  const styles = statusStyles[status];
  const displayLabel = label ?? defaultLabels[status];

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
        ${styles.bg} ${styles.text}
        ${className}
      `.trim().replace(/\s+/g, ' ')}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${styles.dot}`} />
      {displayLabel}
    </span>
  );
}
