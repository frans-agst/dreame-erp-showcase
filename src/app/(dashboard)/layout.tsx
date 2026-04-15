'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar, Header } from '@/components/layout';
import { createClient } from '@/lib/supabase/client';
import { Profile, UserRole } from '@/types';

interface UserWithLocation extends Pick<Profile, 'full_name' | 'email' | 'role'> {
  store_name?: string | null;
  account_name?: string | null;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState<UserWithLocation | null>(null);
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
        // Prefer current_store_id from user_metadata (updated by store selector)
        // Fall back to app_metadata.store_id (set at account creation)
        const storeId = (authUser.user_metadata?.current_store_id || authUser.user_metadata?.primary_store_id || authUser.app_metadata?.store_id) as string | undefined;
        const fullName = authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'User';

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
            // Handle the account relation - it could be an object or array
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
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
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
        <Sidebar
          userRole={user.role}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <Header
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
