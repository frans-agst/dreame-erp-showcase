import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { User } from '@supabase/supabase-js';

// Define route access rules
const publicRoutes = ['/login', '/auth/callback', '/forgot-password', '/reset-password', '/no-assignments'];
const adminOnlyRoutes = ['/master-data/staff', '/audit-log'];

// Dealer-specific routes
const dealerRoutes = [
  '/dealer/dashboard',
  '/dealer/purchase-orders',
  '/dealer/credit-notes',
];

type UserRole = 'admin' | 'manager' | 'staff' | 'dealer';

/**
 * Load store assignments for authenticated user and store in JWT metadata
 * Implements session caching to avoid repeated database queries
 * Requirements: 8.1, 8.2, 5.6, 13.6, 12.2
 */
async function loadStoreAssignments(supabase: SupabaseClient, user: User): Promise<void> {
  try {
    const role = user.app_metadata?.role as UserRole | undefined;
    
    // Only load assignments for staff role
    if (role !== 'staff') {
      return;
    }
    
    const currentMetadata = user.user_metadata || {};
    
    // Check if cache is valid
    // Cache is valid if:
    // 1. assignments_cached_at exists and is recent (within 5 minutes)
    // 2. assigned_store_ids exists and is not empty
    // Requirements: 12.2
    const cacheTimestamp = currentMetadata.assignments_cached_at;
    const cacheAge = cacheTimestamp ? Date.now() - new Date(cacheTimestamp).getTime() : Infinity;
    const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds
    
    const hasCachedAssignments = 
      currentMetadata.assigned_store_ids && 
      Array.isArray(currentMetadata.assigned_store_ids) &&
      currentMetadata.assigned_store_ids.length > 0;
    
    const isCacheValid = hasCachedAssignments && cacheAge < CACHE_TTL;
    
    // If cache is valid, skip database query
    if (isCacheValid) {
      // Still validate store context even with cached data
      const currentStoreId = currentMetadata.current_store_id;
      const assignedStoreIds = currentMetadata.assigned_store_ids;
      const primaryStoreId = currentMetadata.primary_store_id;
      
      // Validate store context - reset to primary if invalid
      // Requirements: 13.6
      if (currentStoreId && !assignedStoreIds.includes(currentStoreId)) {
        console.warn(`Invalid store context detected for user ${user.id}: ${currentStoreId} not in assigned stores. Resetting to primary store: ${primaryStoreId}`);
        
        await supabase.auth.updateUser({
          data: {
            ...currentMetadata,
            current_store_id: primaryStoreId,
          }
        });
      }
      
      // Cache hit - no database query needed
      return;
    }
    
    // Cache miss or expired - query database
    // Query staff_stores for authenticated user
    const { data: assignments } = await supabase
      .from('staff_stores')
      .select('store_id, is_primary')
      .eq('staff_id', user.id);
    
    // Extract assigned store IDs and primary store
    const assignedStoreIds = assignments?.map(a => a.store_id) || [];
    const primaryStore = assignments?.find(a => a.is_primary)?.store_id;
    
    // Fallback to profiles.store_id for backward compatibility
    let fallbackStoreId: string | null = null;
    if (!primaryStore && assignedStoreIds.length === 0) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('store_id')
        .eq('id', user.id)
        .single();
      
      fallbackStoreId = profile?.store_id || null;
    }
    
    const finalPrimaryStore = primaryStore || fallbackStoreId;
    const finalAssignedStoreIds = assignedStoreIds.length > 0 
      ? assignedStoreIds 
      : (fallbackStoreId ? [fallbackStoreId] : []);
    
    const currentStoreId = currentMetadata.current_store_id;
    
    // Validate store context - reset to primary if invalid
    // Requirements: 13.6
    let finalCurrentStoreId = finalPrimaryStore;
    if (currentStoreId && finalAssignedStoreIds.includes(currentStoreId)) {
      finalCurrentStoreId = currentStoreId;
    } else if (currentStoreId && !finalAssignedStoreIds.includes(currentStoreId)) {
      // Invalid context detected - log warning and reset to primary
      console.warn(`Invalid store context detected for user ${user.id}: ${currentStoreId} not in assigned stores. Resetting to primary store: ${finalPrimaryStore}`);
    }
    
    // Check if metadata needs updating
    const needsUpdate = 
      JSON.stringify(currentMetadata.assigned_store_ids) !== JSON.stringify(finalAssignedStoreIds) ||
      currentMetadata.primary_store_id !== finalPrimaryStore ||
      currentMetadata.current_store_id !== finalCurrentStoreId ||
      !currentMetadata.assignments_cached_at;
    
    // Store in JWT metadata with cache timestamp
    // Requirements: 12.2
    if (needsUpdate) {
      await supabase.auth.updateUser({
        data: {
          ...currentMetadata,
          assigned_store_ids: finalAssignedStoreIds,
          primary_store_id: finalPrimaryStore,
          current_store_id: finalCurrentStoreId,
          assignments_cached_at: new Date().toISOString(),
        }
      });
    }
  } catch (error) {
    console.error('Error loading store assignments:', error);
    // Don't throw - allow request to continue even if assignment loading fails
  }
}

function canAccessRoute(pathname: string, role: UserRole | null): boolean {
  // No role means no access to protected routes
  if (!role) return false;

  // Dealer can only access dealer routes
  if (role === 'dealer') {
    return dealerRoutes.some(route => pathname.startsWith(route));
  }

  // Non-dealers cannot access dealer routes
  if (dealerRoutes.some(route => pathname.startsWith(route))) {
    return false;
  }

  // Admin can access everything (except dealer routes, handled above)
  if (role === 'admin') return true;

  // Check admin-only routes
  if (adminOnlyRoutes.some(route => pathname.startsWith(route))) {
    return false;
  }

  // Manager can access manager routes
  if (role === 'manager') return true;

  // Staff can only access specific routes
  const staffAllowedRoutes = [
    '/dashboard',
    '/sales/input',
    '/sales/weekly',
    '/inventory/opname',
    '/staff/day-off',
    '/training',
  ];

  return staffAllowedRoutes.some(route => pathname.startsWith(route));
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Load store assignments for authenticated users
  if (user) {
    await loadStoreAssignments(supabase, user);
  }

  const pathname = request.nextUrl.pathname;
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));

  // Handle unauthenticated users
  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from login page
  if (user && pathname === '/login') {
    const url = request.nextUrl.clone();
    const role = user.app_metadata?.role as UserRole | undefined;
    // Redirect dealers to dealer dashboard
    url.pathname = role === 'dealer' ? '/dealer/dashboard' : '/dashboard';
    return NextResponse.redirect(url);
  }

  // Redirect root to appropriate dashboard for authenticated users
  if (user && pathname === '/') {
    const url = request.nextUrl.clone();
    const role = user.app_metadata?.role as UserRole | undefined;
    // Redirect dealers to dealer dashboard
    url.pathname = role === 'dealer' ? '/dealer/dashboard' : '/dashboard';
    return NextResponse.redirect(url);
  }

  // Role-based access control for authenticated users
  if (user && !isPublicRoute) {
    // Get role from JWT app_metadata
    const role = user.app_metadata?.role as UserRole | undefined;

    // If user has no role yet, allow access to dashboard only
    // This prevents redirect loops for new users without metadata
    if (!role) {
      if (pathname !== '/dashboard') {
        const url = request.nextUrl.clone();
        url.pathname = '/dashboard';
        return NextResponse.redirect(url);
      }
      // Allow access to dashboard even without role
      return supabaseResponse;
    }

    // Check for no-assignments error (staff with no stores assigned)
    // Requirements: 13.1
    if (role === 'staff' && pathname !== '/no-assignments') {
      const assignedStoreIds = user.user_metadata?.assigned_store_ids || [];
      if (assignedStoreIds.length === 0) {
        const url = request.nextUrl.clone();
        url.pathname = '/no-assignments';
        return NextResponse.redirect(url);
      }
    }

    if (!canAccessRoute(pathname, role)) {
      // User doesn't have permission, redirect to appropriate dashboard
      const url = request.nextUrl.clone();
      url.pathname = role === 'dealer' ? '/dealer/dashboard' : '/dashboard';
      return NextResponse.redirect(url);
    }
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is. If you're
  // creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!

  return supabaseResponse;
}
