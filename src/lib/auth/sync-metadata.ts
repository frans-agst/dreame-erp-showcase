// src/lib/auth/sync-metadata.ts
// Client-side utility to sync user JWT metadata after login or profile update
// Requirements: 1.2 - Sync role, store_id, and account_id to JWT

import { createClient } from '@/lib/supabase/client';

interface SyncMetadataResult {
  success: boolean;
  error?: string;
  data?: {
    role: string;
    store_id: string | null;
    account_id: string | null;
  };
}

/**
 * Syncs user profile data (role, store_id, account_id) to JWT metadata
 * Call this after login or profile updates to ensure JWT contains current data
 * 
 * NOTE: This function is designed to be non-blocking. If the Edge Function
 * is not deployed, it will log a warning and return success anyway.
 * The app can still function without the Edge Function - the role will be
 * read from the profiles table via RLS policies.
 * 
 * @param userId - The user's UUID
 * @returns Promise with sync result
 */
export async function syncUserMetadata(userId: string): Promise<SyncMetadataResult> {
  try {
    const supabase = createClient();
    
    // Get current session for authorization
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      // No session is not a critical error - user might still be logging in
      console.warn('No active session for metadata sync');
      return {
        success: true, // Return success to not block login flow
        error: 'No active session',
      };
    }

    // Try to call the Edge Function, but don't fail if it's not deployed
    try {
      const { data, error } = await supabase.functions.invoke('sync-user-metadata', {
        body: { user_id: userId },
      });

      if (error) {
        // Edge Function not deployed or failed - this is OK
        // The app can still work using profile data from the database
        console.warn('Metadata sync via Edge Function skipped:', error.message);
        return {
          success: true, // Return success to not block login flow
          data: undefined,
        };
      }

      return {
        success: true,
        data: data?.data,
      };
    } catch (edgeFunctionError) {
      // Edge Function call failed (e.g., not deployed, network error)
      // This is non-critical - continue without blocking
      console.warn('Edge Function call failed (this is OK if not deployed):', edgeFunctionError);
      return {
        success: true,
        data: undefined,
      };
    }
  } catch (error) {
    // Even unexpected errors shouldn't block login
    console.error('Unexpected error syncing metadata:', error);
    return {
      success: true, // Return success to not block login flow
      error: 'An unexpected error occurred',
    };
  }
}

/**
 * Refreshes the user's session to get updated JWT with new metadata
 * Call this after syncUserMetadata to get a fresh token
 */
export async function refreshSession(): Promise<boolean> {
  try {
    const supabase = createClient();
    const { error } = await supabase.auth.refreshSession();
    return !error;
  } catch {
    return false;
  }
}

/**
 * Combined function to sync metadata and refresh session
 * Use this after login for a complete metadata sync
 */
export async function syncAndRefresh(userId: string): Promise<SyncMetadataResult> {
  const syncResult = await syncUserMetadata(userId);
  
  if (syncResult.success) {
    await refreshSession();
  }
  
  return syncResult;
}
