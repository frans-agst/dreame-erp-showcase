// src/lib/supabase/admin.ts
// Server-side Supabase client with admin privileges
// ONLY use in server actions - never expose to client

import { createClient } from '@supabase/supabase-js';

/**
 * Creates a Supabase client with service role key for admin operations
 * This bypasses RLS and should only be used for admin tasks like:
 * - Creating new users
 * - Updating user metadata
 * - Admin-only operations
 * 
 * WARNING: Never expose this client to the browser!
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase admin credentials');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
