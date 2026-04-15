'use client';

import { forwardRef, HTMLAttributes } from 'react';

export interface SoftCardProps extends HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  noPadding?: boolean;
  hover?: boolean;
}

export const SoftCard = forwardRef<HTMLDivElement, SoftCardProps>(
  ({ children, noPadding = false, hover = false, className = '', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`
          bg-surface rounded-3xl border border-border
          shadow-[0_1px_3px_rgba(0,0,0,0.05)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.3)]
          ${hover ? 'transition-all duration-200 hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_4px_12px_rgba(0,0,0,0.4)]' : ''}
          ${noPadding ? '' : 'p-6'}
          ${className}
        `.trim().replace(/\s+/g, ' ')}
        {...props}
      >
        {children}
      </div>
    );
  }
);

SoftCard.displayName = 'SoftCard';
