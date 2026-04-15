'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Profile, UserRole } from '@/types';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { LanguageToggle } from '@/components/ui/LanguageToggle';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useI18n } from '@/lib/i18n/context';

interface DealerNavItem {
  labelKey: string;
  href: string;
  icon: React.ReactNode;
}

const dealerNavItems: DealerNavItem[] = [
  {
    labelKey: 'dealer.dashboard',
    href: '/dealer/dashboard',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    labelKey: 'sidebar.purchaseOrders',
    href: '/dealer/purchase-orders',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    labelKey: 'dealer.creditNotes',
    href: '/dealer/credit-notes',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
];

function DealerSidebar({ 
  isOpen, 
  onClose 
}: { 
  isOpen: boolean; 
  onClose: () => void;
}) {
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 dark:bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 z-50 h-full w-64 
          bg-surface border-r border-border
          transform transition-transform duration-200 ease-in-out
          lg:translate-x-0 lg:static lg:z-auto
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `.trim().replace(/\s+/g, ' ')}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-6 border-b border-border">
          <Link href="/dealer/dashboard" className="flex items-center gap-2">
            <img 
              src="/logo-icon.svg" 
              alt="Dreame ERP" 
              className="w-8 h-8"
              style={{ filter: 'drop-shadow(0 0 4px rgba(0,0,0,0.3))' }}
            />
            <span className="font-semibold text-primary">{t('dealer.title')}</span>
          </Link>
          <button
            onClick={onClose}
            className="lg:hidden p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <svg className="w-5 h-5 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1 flex-1 overflow-y-auto">
          {dealerNavItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`
                  flex items-center gap-3 px-4 py-2.5 rounded-xl
                  transition-all duration-200
                  ${isActive
                    ? 'bg-blue-600 dark:bg-blue-500 text-white'
                    : 'text-secondary hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-primary'
                  }
                `.trim().replace(/\s+/g, ' ')}
              >
                {item.icon}
                <span className="font-medium">{t(item.labelKey)}</span>
              </Link>
            );
          })}
        </nav>

        {/* Theme Toggle at bottom */}
        <div className="p-4 border-t border-border">
          <div className="flex items-center justify-between">
            <span className="text-sm text-secondary">{t('common.theme')}</span>
            <ThemeToggle />
          </div>
        </div>
      </aside>
    </>
  );
}

function DealerHeader({ 
  user, 
  onMenuClick, 
  onLogout 
}: { 
  user: Pick<Profile, 'full_name' | 'email' | 'role'> & {
    store_name?: string | null;
    account_name?: string | null;
  };
  onMenuClick: () => void;
  onLogout: () => void;
}) {
  const { t } = useI18n();
  
  // Format location display as "Account - Store" (Requirements: 2.3)
  const locationDisplay = (() => {
    if (user.account_name && user.store_name) {
      return `${user.account_name} - ${user.store_name}`;
    }
    if (user.account_name) {
      return user.account_name;
    }
    if (user.store_name) {
      return user.store_name;
    }
    return null;
  })();
  
  return (
    <header className="sticky top-0 z-30 bg-surface/80 backdrop-blur-sm border-b border-border">
      <div className="flex items-center justify-between h-16 px-4 lg:px-6">
        {/* Mobile menu trigger */}
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800"
          aria-label="Open menu"
        >
          <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Spacer for desktop */}
        <div className="hidden lg:block" />

        {/* User info, language toggle, and logout */}
        <div className="flex items-center gap-4">
          {/* Language Toggle */}
          <LanguageToggle />

          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-primary">{user.full_name}</p>
            {locationDisplay ? (
              <p className="text-xs text-blue-600 dark:text-blue-400">{locationDisplay}</p>
            ) : (
              <p className="text-xs text-blue-600 dark:text-blue-400 capitalize">{t('dealer.title').split(' ')[0]}</p>
            )}
          </div>

          {/* Avatar */}
          <div className="w-9 h-9 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
            <span className="text-blue-600 dark:text-blue-400 font-medium text-sm">
              {user.full_name.charAt(0).toUpperCase()}
            </span>
          </div>

          {/* Logout button */}
          <button
            onClick={onLogout}
            className="p-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors duration-200"
            aria-label={t('sidebar.logout')}
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

export default function DealerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState<Pick<Profile, 'full_name' | 'email' | 'role'> & {
    store_name?: string | null;
    account_name?: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function getUser() {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        
        if (!authUser) {
          router.push('/login');
          return;
        }

        // Get role and store_id from JWT metadata
        const role = (authUser.app_metadata?.role as UserRole) || 'staff';
        const storeId = authUser.app_metadata?.store_id as string | undefined;
        
        // Redirect non-dealers to main dashboard
        if (role !== 'dealer') {
          router.push('/dashboard');
          return;
        }

        const fullName = authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'Dealer';

        let storeName: string | null = null;
        let accountName: string | null = null;

        // Fetch store and account info if user has a store_id
        // Requirements: 2.3 - Show "Account - Store" format
        if (storeId) {
          const { data: storeData } = await supabase
            .from('stores')
            .select(`
              name,
              account:accounts(name)
            `)
            .eq('id', storeId)
            .single();

          if (storeData) {
            storeName = storeData.name;
            // Handle the account relation
            const account = storeData.account;
            if (account && typeof account === 'object' && !Array.isArray(account)) {
              accountName = (account as { name: string }).name;
            }
          }
        }

        setUser({
          full_name: fullName,
          email: authUser.email || '',
          role,
          store_name: storeName,
          account_name: accountName,
        });
      } catch (error) {
        console.error('Error fetching user:', error);
        router.push('/login');
      } finally {
        setLoading(false);
      }
    }

    getUser();
  }, [router]);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        {/* Sidebar */}
        <DealerSidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <DealerHeader
            user={user}
            onMenuClick={() => setSidebarOpen(true)}
            onLogout={handleLogout}
          />

          <main className="p-4 lg:p-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
