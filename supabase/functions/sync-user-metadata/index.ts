// supabase/functions/sync-user-metadata/index.ts
// Edge Function to sync user profile data (role, store_id, account_id) to JWT metadata
// SECURITY: Uses service role key - never expose to client
// Requirements: 1.2 - Sync role, store_id, and account_id to JWT

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Profile {
  id: string;
  role: 'admin' | 'manager' | 'staff' | 'dealer';
  store_id: string | null;
}

interface Store {
  id: string;
  account_id: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { user_id } = await req.json();
    if (!user_id) {
      return new Response(
        JSON.stringify({ error: 'user_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create admin client with service role key
    // SECURITY: Service role key bypasses RLS - use only in Edge Functions
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Fetch user profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, role, store_id')
      .eq('id', user_id)
      .single<Profile>();

    if (profileError || !profile) {
      console.error('Profile fetch error:', profileError);
      return new Response(
        JSON.stringify({ error: 'Profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch account_id from store if user has a store_id
    // Requirements: 1.2 - Include account_id in JWT metadata
    let accountId: string | null = null;
    if (profile.store_id) {
      const { data: store, error: storeError } = await supabaseAdmin
        .from('stores')
        .select('id, account_id')
        .eq('id', profile.store_id)
        .single<Store>();

      if (!storeError && store) {
        accountId = store.account_id;
      }
    }

    // Update user's app_metadata with role, store_id, and account_id
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user_id,
      {
        app_metadata: {
          role: profile.role,
          store_id: profile.store_id,
          account_id: accountId,
        },
      }
    );

    if (updateError) {
      console.error('Metadata update error:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update user metadata' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'User metadata synced successfully',
        data: {
          role: profile.role,
          store_id: profile.store_id,
          account_id: accountId,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
