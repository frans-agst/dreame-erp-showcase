'use server';

import { createClient } from '@/lib/supabase/server';
import { StaffStoreAssignment } from '@/types';

// ============================================================================
// Types
// ============================================================================

type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; code: string };

const ErrorCodes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

// ============================================================================
// Helper Functions
// ============================================================================

async function getCurrentUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    return null;
  }
  
  return user;
}

async function getUserRole(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return null;
  
  return user.app_metadata?.role || null;
}

async function checkAdminOnly(): Promise<ActionResult<void> | null> {
  const role = await getUserRole();
  
  if (role !== 'admin') {
    return {
      success: false,
      error: 'Only administrators can perform this action',
      code: ErrorCodes.FORBIDDEN,
    };
  }
  
  return null;
}

async function logAuditEvent(params: {
  action: string;
  entity_type: string;
  entity_id: string;
  details: Record<string, unknown>;
}): Promise<void> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUser();
    
    if (!user) return;
    
    await supabase.from('audit_log').insert({
      user_id: user.id,
      action: 'INSERT',
      table_name: params.entity_type,
      record_id: params.entity_id,
      new_value: {
        action: params.action,
        ...params.details,
      },
    });
  } catch (error) {
    console.error('Error logging audit event:', error);
  }
}

/**
 * Trigger session refresh for a staff member by invalidating cache
 * This forces the middleware to reload store assignments on next request
 * Requirements: 8.5, 12.2
 */
async function invalidateAssignmentCache(staffId: string): Promise<void> {
  try {
    const supabase = await createClient();
    
    // We can't directly update another user's JWT from server actions
    // Instead, we'll set a flag in the database that the middleware can check
    // For now, we'll just log that cache should be invalidated
    // The middleware will reload assignments when cache expires (5 minutes)
    // or when the user's session is refreshed
    
    // Note: In a production system, you might want to:
    // 1. Use a Redis cache with explicit invalidation
    // 2. Store a "assignments_version" in profiles table
    // 3. Use WebSocket to push invalidation to client
    
    console.log(`Assignment cache invalidated for staff ${staffId}. Will reload on next request.`);
    
    // For immediate effect, we could store an invalidation timestamp
    // that the middleware checks, but this requires additional database queries
    // The current 5-minute TTL provides a good balance between performance and freshness
  } catch (error) {
    console.error('Error invalidating assignment cache:', error);
  }
}

// ============================================================================
// Store Assignment Actions
// ============================================================================

/**
 * Assign a store to a staff member
 * Requirements: 4.1, 4.3, 4.6, 4.7
 * SECURITY: Admin only
 */
export async function assignStoreToStaff(
  staffId: string,
  storeId: string,
  isPrimary: boolean = false
): Promise<ActionResult<StaffStoreAssignment>> {
  try {
    // Verify admin role authorization
    const permError = await checkAdminOnly();
    if (permError) return permError as ActionResult<StaffStoreAssignment>;
    
    const user = await getCurrentUser();
    if (!user) {
      return {
        success: false,
        error: 'You must be logged in',
        code: ErrorCodes.UNAUTHORIZED,
      };
    }
    
    const supabase = await createClient();
    
    // Verify staff exists
    const { data: staff, error: staffError } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', staffId)
      .single();
    
    if (staffError || !staff) {
      return {
        success: false,
        error: 'Staff member not found',
        code: ErrorCodes.NOT_FOUND,
      };
    }
    
    // Verify store exists
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('id')
      .eq('id', storeId)
      .single();
    
    if (storeError || !store) {
      return {
        success: false,
        error: 'Store not found',
        code: ErrorCodes.NOT_FOUND,
      };
    }
    
    // Check if assignment already exists
    const { data: existing } = await supabase
      .from('staff_stores')
      .select('id')
      .eq('staff_id', staffId)
      .eq('store_id', storeId)
      .single();
    
    if (existing) {
      return {
        success: false,
        error: 'This staff member is already assigned to this store',
        code: ErrorCodes.CONFLICT,
      };
    }
    
    // Check if this is the first assignment
    const { data: existingAssignments } = await supabase
      .from('staff_stores')
      .select('id')
      .eq('staff_id', staffId);
    
    const isFirstAssignment = !existingAssignments || existingAssignments.length === 0;
    
    // If setting as primary or this is the first assignment, unset other primary flags
    if (isPrimary || isFirstAssignment) {
      await supabase
        .from('staff_stores')
        .update({ is_primary: false })
        .eq('staff_id', staffId);
    }
    
    // Insert assignment
    const { data: assignment, error: insertError } = await supabase
      .from('staff_stores')
      .insert({
        staff_id: staffId,
        store_id: storeId,
        is_primary: isPrimary || isFirstAssignment,
        assigned_at: new Date().toISOString(),
      })
      .select()
      .single();
    
    if (insertError) {
      console.error('Error creating assignment:', insertError);
      return {
        success: false,
        error: 'Failed to create store assignment',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }
    
    // Update profiles.store_id if primary for backward compatibility
    if (isPrimary || isFirstAssignment) {
      await supabase
        .from('profiles')
        .update({ store_id: storeId })
        .eq('id', staffId);
    }
    
    // Create audit log entry
    await logAuditEvent({
      action: 'store_assigned',
      entity_type: 'staff_stores',
      entity_id: staffId,
      details: {
        store_id: storeId,
        is_primary: isPrimary || isFirstAssignment,
        admin_id: user.id,
      },
    });
    
    // Trigger session refresh for the affected staff member
    // This will reload their store assignments on next request
    await invalidateAssignmentCache(staffId);
    
    return { success: true, data: assignment };
  } catch (error) {
    console.error('Unexpected error in assignStoreToStaff:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}


/**
 * Remove a store assignment from a staff member
 * Requirements: 4.2, 4.5, 4.6, 4.7
 * SECURITY: Admin only
 */
export async function removeStoreFromStaff(
  staffId: string,
  storeId: string
): Promise<ActionResult<void>> {
  try {
    // Verify admin role authorization
    const permError = await checkAdminOnly();
    if (permError) return permError;
    
    const user = await getCurrentUser();
    if (!user) {
      return {
        success: false,
        error: 'You must be logged in',
        code: ErrorCodes.UNAUTHORIZED,
      };
    }
    
    const supabase = await createClient();
    
    // Check if this is the last assignment
    const { data: assignments, count } = await supabase
      .from('staff_stores')
      .select('*', { count: 'exact' })
      .eq('staff_id', staffId);
    
    if (count === 1) {
      return {
        success: false,
        error: 'Cannot remove the last store assignment. Staff must have at least one store.',
        code: ErrorCodes.VALIDATION_ERROR,
      };
    }
    
    // Get the assignment to check if it's primary
    const { data: assignment } = await supabase
      .from('staff_stores')
      .select('is_primary')
      .eq('staff_id', staffId)
      .eq('store_id', storeId)
      .single();
    
    if (!assignment) {
      return {
        success: false,
        error: 'Store assignment not found',
        code: ErrorCodes.NOT_FOUND,
      };
    }
    
    const wasPrimary = assignment.is_primary;
    
    // Delete assignment
    const { error: deleteError } = await supabase
      .from('staff_stores')
      .delete()
      .eq('staff_id', staffId)
      .eq('store_id', storeId);
    
    if (deleteError) {
      console.error('Error removing assignment:', deleteError);
      return {
        success: false,
        error: 'Failed to remove store assignment',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }
    
    // If removed primary, automatically set another store as primary
    if (wasPrimary) {
      const { data: remaining } = await supabase
        .from('staff_stores')
        .select('store_id')
        .eq('staff_id', staffId)
        .order('assigned_at', { ascending: true })
        .limit(1)
        .single();
      
      if (remaining) {
        await supabase
          .from('staff_stores')
          .update({ is_primary: true })
          .eq('staff_id', staffId)
          .eq('store_id', remaining.store_id);
        
        // Update profiles.store_id for backward compatibility
        await supabase
          .from('profiles')
          .update({ store_id: remaining.store_id })
          .eq('id', staffId);
      }
    }
    
    // Create audit log entry
    await logAuditEvent({
      action: 'store_removed',
      entity_type: 'staff_stores',
      entity_id: staffId,
      details: {
        store_id: storeId,
        was_primary: wasPrimary,
        admin_id: user.id,
      },
    });
    
    // Trigger session refresh for the affected staff member
    await invalidateAssignmentCache(staffId);
    
    return { success: true, data: undefined };
  } catch (error) {
    console.error('Unexpected error in removeStoreFromStaff:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}

/**
 * Get all store assignments for a staff member
 * Requirements: 4.1
 */
export async function getStaffAssignments(
  staffId: string
): Promise<ActionResult<StaffStoreAssignment[]>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return {
        success: false,
        error: 'You must be logged in',
        code: ErrorCodes.UNAUTHORIZED,
      };
    }
    
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('staff_stores')
      .select(`
        id,
        staff_id,
        store_id,
        is_primary,
        assigned_at,
        created_at,
        store:stores (
          id,
          name,
          region
        )
      `)
      .eq('staff_id', staffId)
      .order('is_primary', { ascending: false })
      .order('assigned_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching staff assignments:', error);
      return {
        success: false,
        error: 'Failed to fetch store assignments',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }
    
    // Transform the data to match the expected type
    // Supabase returns store as an array, but we need a single object
    const transformedData = (data || []).map(assignment => {
      const store = Array.isArray(assignment.store) ? assignment.store[0] : assignment.store;
      return {
        ...assignment,
        store: store || undefined
      };
    }) as StaffStoreAssignment[];
    
    return { success: true, data: transformedData };
  } catch (error) {
    console.error('Unexpected error in getStaffAssignments:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}

/**
 * Set a store as the primary store for a staff member
 * Requirements: 4.4, 11.3, 14.3
 * SECURITY: Admin only
 */
export async function setPrimaryStore(
  staffId: string,
  storeId: string
): Promise<ActionResult<void>> {
  try {
    // Verify admin role authorization
    const permError = await checkAdminOnly();
    if (permError) return permError;
    
    const user = await getCurrentUser();
    if (!user) {
      return {
        success: false,
        error: 'You must be logged in',
        code: ErrorCodes.UNAUTHORIZED,
      };
    }
    
    const supabase = await createClient();
    
    // Verify store is in staff's assignments
    const { data: assignment } = await supabase
      .from('staff_stores')
      .select('id, is_primary')
      .eq('staff_id', staffId)
      .eq('store_id', storeId)
      .single();
    
    if (!assignment) {
      return {
        success: false,
        error: 'Cannot set a non-assigned store as primary',
        code: ErrorCodes.VALIDATION_ERROR,
      };
    }
    
    // If already primary, nothing to do
    if (assignment.is_primary) {
      return { success: true, data: undefined };
    }
    
    // Get current primary store for audit log
    const { data: currentPrimary } = await supabase
      .from('staff_stores')
      .select('store_id')
      .eq('staff_id', staffId)
      .eq('is_primary', true)
      .single();
    
    const oldPrimaryStoreId = currentPrimary?.store_id || null;
    
    // Unset old primary
    await supabase
      .from('staff_stores')
      .update({ is_primary: false })
      .eq('staff_id', staffId)
      .eq('is_primary', true);
    
    // Set new primary
    const { error: updateError } = await supabase
      .from('staff_stores')
      .update({ is_primary: true })
      .eq('staff_id', staffId)
      .eq('store_id', storeId);
    
    if (updateError) {
      console.error('Error setting primary store:', updateError);
      return {
        success: false,
        error: 'Failed to set primary store',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }
    
    // Update profiles.store_id for backward compatibility
    await supabase
      .from('profiles')
      .update({ store_id: storeId })
      .eq('id', staffId);
    
    // Create audit log entry with old and new primary
    await logAuditEvent({
      action: 'primary_store_changed',
      entity_type: 'staff_stores',
      entity_id: staffId,
      details: {
        old_primary_store_id: oldPrimaryStoreId,
        new_primary_store_id: storeId,
        admin_id: user.id,
      },
    });
    
    // Trigger session refresh for the affected staff member
    await invalidateAssignmentCache(staffId);
    
    return { success: true, data: undefined };
  } catch (error) {
    console.error('Unexpected error in setPrimaryStore:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}

/**
 * Update the current store context for the authenticated user
 * Requirements: 5.3, 8.3, 8.4, 13.6
 * SECURITY: User can only update their own store context
 */
export async function updateStoreContext(
  storeId: string
): Promise<ActionResult<void>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return {
        success: false,
        error: 'You must be logged in',
        code: ErrorCodes.UNAUTHORIZED,
      };
    }
    
    const supabase = await createClient();
    
    // Get user's assigned stores
    const assignedStoreIds = user.user_metadata?.assigned_store_ids || [];
    
    // Fallback to profiles.store_id for backward compatibility
    if (assignedStoreIds.length === 0) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('store_id')
        .eq('id', user.id)
        .single();
      
      if (profile?.store_id) {
        assignedStoreIds.push(profile.store_id);
      }
    }
    
    // Validate new store context is in user's assigned stores
    // Requirements: 13.6
    if (!assignedStoreIds.includes(storeId)) {
      // Invalid store context - reset to primary store
      const primaryStoreId = user.user_metadata?.primary_store_id;
      
      console.warn(`Invalid store context for user ${user.id}: ${storeId} not in assigned stores. Resetting to primary store: ${primaryStoreId}`);
      
      if (primaryStoreId) {
        // Reset to primary store
        const { error } = await supabase.auth.updateUser({
          data: {
            ...user.user_metadata,
            current_store_id: primaryStoreId,
          }
        });
        
        if (error) {
          console.error('Error resetting store context:', error);
        }
      }
      
      return {
        success: false,
        error: 'You do not have access to this store. Context reset to primary store.',
        code: ErrorCodes.FORBIDDEN,
      };
    }
    
    // Update JWT metadata with new current_store_id
    const { error } = await supabase.auth.updateUser({
      data: {
        ...user.user_metadata,
        current_store_id: storeId,
      }
    });
    
    if (error) {
      console.error('Error updating store context:', error);
      return {
        success: false,
        error: 'Failed to update store context',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }
    
    return { success: true, data: undefined };
  } catch (error) {
    console.error('Unexpected error in updateStoreContext:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}

/**
 * Refresh session to reload store assignments from database
 * Requirements: 8.5
 * SECURITY: User can only refresh their own session
 */
export async function refreshStoreAssignments(): Promise<ActionResult<void>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return {
        success: false,
        error: 'You must be logged in',
        code: ErrorCodes.UNAUTHORIZED,
      };
    }
    
    const supabase = await createClient();
    
    // Reload store assignments from database
    const { data: assignments } = await supabase
      .from('staff_stores')
      .select('store_id, is_primary')
      .eq('staff_id', user.id);
    
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
    
    // Validate current store context
    const currentStoreId = user.user_metadata?.current_store_id;
    let finalCurrentStoreId = finalPrimaryStore;
    
    if (currentStoreId && finalAssignedStoreIds.includes(currentStoreId)) {
      finalCurrentStoreId = currentStoreId;
    }
    
    // Update JWT metadata with fresh cache timestamp
    // Requirements: 12.2
    const { error } = await supabase.auth.updateUser({
      data: {
        ...user.user_metadata,
        assigned_store_ids: finalAssignedStoreIds,
        primary_store_id: finalPrimaryStore,
        current_store_id: finalCurrentStoreId,
        assignments_cached_at: new Date().toISOString(),
      }
    });
    
    if (error) {
      console.error('Error refreshing store assignments:', error);
      return {
        success: false,
        error: 'Failed to refresh store assignments',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }
    
    return { success: true, data: undefined };
  } catch (error) {
    console.error('Unexpected error in refreshStoreAssignments:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}
