'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

/**
 * No Assignments Error Page
 * Displayed when a staff member has no store assignments
 * Requirements: 13.1 - Display error message if no stores assigned
 */
export default function NoAssignmentsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState<string>('');

  useEffect(() => {
    const checkAssignments = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push('/login');
        return;
      }

      // Get user name
      const { data: profile } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', user.id)
        .single();
      
      if (profile) {
        setUserName(profile.name);
      }

      // Check if user now has assignments (in case admin just assigned)
      const assignedStoreIds = user.user_metadata?.assigned_store_ids || [];
      if (assignedStoreIds.length > 0) {
        // User now has assignments, redirect to dashboard
        router.push('/dashboard');
        return;
      }

      setLoading(false);
    };

    checkAssignments();
  }, [router]);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-green"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="bg-surface rounded-3xl shadow-soft p-8 md:p-12 text-center max-w-md">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-accent-yellowLight flex items-center justify-center">
          <svg
            className="w-10 h-10 text-accent-yellow"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        
        <h1 className="text-3xl font-bold text-primary mb-2">
          No Store Assignments
        </h1>
        
        {userName && (
          <p className="text-secondary mb-4">
            Hello, {userName}
          </p>
        )}
        
        <p className="text-secondary mb-8">
          You have no store assignments. Please contact your administrator to assign you to one or more stores before you can access the system.
        </p>
        
        <div className="flex flex-col gap-3">
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center px-6 py-3 bg-accent-green text-white font-medium rounded-xl hover:bg-accent-green/90 transition-colors"
          >
            <svg
              className="w-5 h-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Check Again
          </button>
          
          <button
            onClick={handleSignOut}
            className="inline-flex items-center justify-center px-6 py-3 bg-secondary/10 text-primary font-medium rounded-xl hover:bg-secondary/20 transition-colors"
          >
            <svg
              className="w-5 h-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
