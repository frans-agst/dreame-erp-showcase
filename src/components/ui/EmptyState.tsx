'use client';

import { ReactNode } from 'react';
import { SoftCard } from './SoftCard';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <SoftCard className={`text-center py-12 ${className}`.trim()}>
      {icon && (
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 bg-background rounded-full flex items-center justify-center text-secondary">
            {icon}
          </div>
        </div>
      )}
      <h3 className="text-lg font-semibold text-primary mb-1">{title}</h3>
      {description && (
        <p className="text-secondary text-sm mb-4">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </SoftCard>
  );
}
