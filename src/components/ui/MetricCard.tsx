'use client';

import { SoftCard } from './SoftCard';

export interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: React.ReactNode;
  className?: string;
}

export function MetricCard({
  title,
  value,
  change,
  changeLabel,
  icon,
  className = '',
}: MetricCardProps) {
  const isPositive = change !== undefined && change >= 0;
  // Semantic change indicators - green for positive, red for negative
  const changeColor = isPositive ? 'text-accent-green' : 'text-accent-red';
  const changeBg = isPositive ? 'bg-accent-green-light' : 'bg-accent-red-light';

  return (
    <SoftCard hover className={className}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-secondary mb-1">{title}</p>
          <p className="text-2xl font-semibold text-primary">{value}</p>
          
          {change !== undefined && (
            <div className="flex items-center gap-2 mt-2">
              <span
                className={`
                  inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium
                  ${changeBg} ${changeColor}
                `.trim().replace(/\s+/g, ' ')}
              >
                {isPositive ? (
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                  </svg>
                ) : (
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                )}
                {Math.abs(change).toFixed(1)}%
              </span>
              {changeLabel && (
                <span className="text-xs text-secondary">{changeLabel}</span>
              )}
            </div>
          )}
        </div>

        {icon && (
          <div className="w-10 h-10 bg-neutral-100 dark:bg-neutral-800 rounded-xl flex items-center justify-center text-primary">
            {icon}
          </div>
        )}
      </div>
    </SoftCard>
  );
}
