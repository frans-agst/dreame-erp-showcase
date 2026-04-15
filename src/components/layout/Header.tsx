'use client';

import { Profile } from '@/types';
import { MobileMenuTrigger } from './MobileMenuTrigger';
import { StoreSelector } from './StoreSelector';

export interface HeaderProps {
  user: Pick<Profile, 'full_name' | 'email' | 'role'> & {
    store_name?: string | null;
    account_name?: string | null;
  };
  onMenuClick: () => void;
  onLogout: () => void;
}

/**
 * Formats the location display as "Account - Store" format
 * Requirements: 2.3 - Show both Store Name and Account Name
 */
function formatLocationDisplay(accountName?: string | null, storeName?: string | null): string | null {
  if (accountName && storeName) {
    return `${accountName} - ${storeName}`;
  }
  if (accountName) {
    return accountName;
  }
  if (storeName) {
    return storeName;
  }
  return null;
}

export function Header({ user, onMenuClick, onLogout }: HeaderProps) {
  const locationDisplay = formatLocationDisplay(user.account_name, user.store_name);
  
  return (
    <header className="sticky top-0 z-30 bg-surface/80 backdrop-blur-sm border-b border-border">
      <div className="flex items-center h-16 px-4 lg:px-6">
        {/* Mobile menu trigger */}
        <MobileMenuTrigger onClick={onMenuClick} />

        {/* Store selector for multi-store staff - Requirements: 5.1, 9.1 */}
        <div className="lg:ml-6">
          <StoreSelector />
        </div>

        {/* Spacer to push user info to the right */}
        <div className="flex-1" />

        {/* User info and logout */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="text-right hidden md:block">
            <p className="text-sm font-medium text-primary">{user.full_name}</p>
            {user.store_name ? (
              <p className="text-xs text-secondary whitespace-nowrap">{user.store_name}</p>
            ) : (
              <p className="text-xs text-secondary capitalize">{user.role}</p>
            )}
          </div>

          {/* Avatar */}
          <div className="w-9 h-9 bg-neutral-100 dark:bg-neutral-800 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-primary font-medium text-sm">
              {user.full_name.charAt(0).toUpperCase()}
            </span>
          </div>

          {/* Logout button */}
          <button
            onClick={onLogout}
            className="p-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors duration-200 flex-shrink-0"
            aria-label="Logout"
          >
            <svg
              className="w-5 h-5 text-secondary hover:text-primary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}
