'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserRole } from '@/types';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { LanguageToggle } from '@/components/ui/LanguageToggle';
import { useI18n } from '@/lib/i18n/context';

interface NavItem {
  labelKey: string;
  href: string;
  icon: React.ReactNode;
  roles: UserRole[];
}

interface NavCategory {
  labelKey: string;
  items: NavItem[];
}

const navCategories: NavCategory[] = [
  {
    labelKey: 'sidebar.overview',
    items: [
      {
        labelKey: 'sidebar.dashboard',
        href: '/dashboard',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
        ),
        roles: ['admin', 'manager', 'staff'],
      },
    ],
  },
  {
    labelKey: 'sidebar.sales',
    items: [
      {
        labelKey: 'sidebar.salesAchievement',
        href: '/sales',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        ),
        roles: ['admin', 'manager'],
      },
      {
        labelKey: 'sidebar.weeklyReport',
        href: '/sales/weekly',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        ),
        roles: ['admin', 'manager', 'staff'],
      },
      {
        labelKey: 'sidebar.salesInput',
        href: '/sales/input',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
          </svg>
        ),
        roles: ['admin', 'manager', 'staff'],
      },
    ],
  },
  {
    labelKey: 'sidebar.inventory',
    items: [
      {
        labelKey: 'sidebar.inventory',
        href: '/inventory',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        ),
        roles: ['admin', 'manager'],
      },
      {
        labelKey: 'sidebar.stockOpname',
        href: '/inventory/opname',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        ),
        roles: ['admin', 'manager', 'staff'],
      },
    ],
  },
  {
    labelKey: 'sidebar.operations',
    items: [
      {
        labelKey: 'sidebar.purchaseOrders',
        href: '/purchase-orders',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        ),
        roles: ['admin', 'manager'],
      },
      {
        labelKey: 'sidebar.expenses',
        href: '/expenses',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        ),
        roles: ['admin', 'manager'],
      },
      {
        labelKey: 'sidebar.creditNotes',
        href: '/credit-notes',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2zM10 8.5a.5.5 0 11-1 0 .5.5 0 011 0zm5 5a.5.5 0 11-1 0 .5.5 0 011 0z" />
          </svg>
        ),
        roles: ['admin', 'manager'],
      },
    ],
  },
  {
    labelKey: 'sidebar.humanResources',
    items: [
      {
        labelKey: 'sidebar.dayOff',
        href: '/staff/day-off',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        ),
        roles: ['admin', 'manager', 'staff'],
      },
      {
        labelKey: 'sidebar.training',
        href: '/training',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        ),
        roles: ['admin', 'manager', 'staff'],
      },
    ],
  },
  {
    labelKey: 'sidebar.masterData',
    items: [
      {
        labelKey: 'sidebar.products',
        href: '/master-data/products',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        ),
        roles: ['admin', 'manager'],
      },
      {
        labelKey: 'sidebar.accounts',
        href: '/master-data/accounts',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        ),
        roles: ['admin', 'manager'],
      },
      {
        labelKey: 'sidebar.stores',
        href: '/master-data/stores',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        ),
        roles: ['admin', 'manager'],
      },
      {
        labelKey: 'sidebar.staff',
        href: '/master-data/staff',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        ),
        roles: ['admin'],
      },
      {
        labelKey: 'sidebar.staffAssignments',
        href: '/master-data/staff-assignments',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        ),
        roles: ['admin'],
      },
    ],
  },
  {
    labelKey: 'sidebar.system',
    items: [
      {
        labelKey: 'sidebar.auditLog',
        href: '/audit-log',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
        roles: ['admin'], // Changed from ['admin', 'manager'] to ['admin'] only
      },
    ],
  },
];

export interface SidebarProps {
  userRole: UserRole;
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ userRole, isOpen = true, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { t } = useI18n();

  // Filter categories and items based on user role
  const filteredCategories = navCategories
    .map(category => ({
      ...category,
      items: category.items.filter(item => item.roles.includes(userRole))
    }))
    .filter(category => category.items.length > 0); // Only show categories that have visible items

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
          <Link href="/dashboard" className="flex items-center gap-2">
            <img 
              src="/logo-icon.svg" 
              alt="Dreame ERP" 
              className="w-8 h-8"
              style={{ filter: 'drop-shadow(0 0 4px rgba(0,0,0,0.3))' }}
            />
            <span className="font-semibold text-primary">Dreame ERP</span>
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
        <nav className="p-4 space-y-6 flex-1 overflow-y-auto">
          {filteredCategories.map((category, categoryIndex) => (
            <div key={category.labelKey}>
              {/* Category Header */}
              <h3 className="text-xs font-semibold text-secondary uppercase tracking-wider mb-3 px-2">
                {t(category.labelKey)}
              </h3>
              
              {/* Category Items */}
              <div className="space-y-1">
                {category.items.map((item) => {
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
                          ? 'bg-neutral-600 dark:bg-neutral-200 text-white dark:text-neutral-900'
                          : 'text-secondary hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-primary'
                        }
                      `.trim().replace(/\s+/g, ' ')}
                    >
                      {item.icon}
                      <span className="font-medium">{t(item.labelKey)}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Theme and Language Toggle at bottom */}
        <div className="p-4 border-t border-border space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-secondary">{t('common.theme') || 'Theme'}</span>
            <ThemeToggle />
          </div>
          <div className="flex justify-end">
            <LanguageToggle />
          </div>
        </div>
      </aside>
    </>
  );
}
