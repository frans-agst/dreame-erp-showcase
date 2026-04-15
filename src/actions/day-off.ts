'use server';

import { createClient } from '@/lib/supabase/server';
import { 
  DayOffRequestSchema, 
  DayOffRequestInput, 
  DayOffFilterSchema,
  DayOffFilterInput 
} from '@/lib/validations/day-off';
import { DayOffRequest, Profile } from '@/types';

// ============================================================================
// Types
// ============================================================================

// Types (not exported - 'use server' files can only export async functions)
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

// Extended type with staff and store info for display
export interface DayOffRequestWithDetails extends DayOffRequest {
  staff?: Profile & { store?: { name: string } };
  reviewer?: Profile;
}

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
  
  return user.app_metadata?.role || 'staff';
}

// ============================================================================
// Day-Off Request Actions
// ============================================================================

/**
 * Create a new day-off request
 * Requirements: 6.1, 6.2
 * Initial status is always 'pending'
 */
export async function createDayOffRequest(data: DayOffRequestInput): Promise<ActionResult<DayOffRequest>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return {
        success: false,
        error: 'You must be logged in to create a day-off request',
        code: ErrorCodes.UNAUTHORIZED,
      };
    }

    // Validate input
    const validation = DayOffRequestSchema.safeParse(data);
    if (!validation.success) {
      const firstError = validation.error.issues[0];
      return {
        success: false,
        error: firstError.message,
        code: ErrorCodes.VALIDATION_ERROR,
      };
    }

    const validatedData = validation.data;
    const supabase = await createClient();

    // Insert day-off request with status='pending'
    const { data: request, error } = await supabase
      .from('day_off_requests')
      .insert({
        staff_id: user.id,
        start_date: validatedData.start_date,
        end_date: validatedData.end_date,
        reason: validatedData.reason,
        status: 'pending', // Always starts as pending (Requirement 6.1)
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating day-off request:', error);
      return {
        success: false,
        error: 'Failed to create day-off request',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }

    return { success: true, data: request };
  } catch (error) {
    console.error('Unexpected error in createDayOffRequest:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}


/**
 * Get day-off requests based on user role
 * Requirements: 6.2, 6.3
 * Staff sees own requests, manager/admin sees all
 */
export async function getDayOffRequests(
  filters?: DayOffFilterInput
): Promise<ActionResult<DayOffRequestWithDetails[]>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return {
        success: false,
        error: 'You must be logged in to view day-off requests',
        code: ErrorCodes.UNAUTHORIZED,
      };
    }

    // Validate filters if provided
    if (filters) {
      const filterValidation = DayOffFilterSchema.safeParse(filters);
      if (!filterValidation.success) {
        const firstError = filterValidation.error.issues[0];
        return {
          success: false,
          error: firstError.message,
          code: ErrorCodes.VALIDATION_ERROR,
        };
      }
    }

    const supabase = await createClient();
    const userRole = await getUserRole();

    // Build query with staff and store details
    let query = supabase
      .from('day_off_requests')
      .select(`
        *,
        staff:profiles!day_off_requests_staff_id_fkey (
          id,
          email,
          full_name,
          role,
          store_id,
          is_active,
          store:stores (
            name
          )
        ),
        reviewer:profiles!day_off_requests_reviewed_by_fkey (
          id,
          full_name
        )
      `)
      .order('created_at', { ascending: false });

    // Apply filters
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (filters?.staff_id) {
      query = query.eq('staff_id', filters.staff_id);
    }

    if (filters?.start_date) {
      query = query.gte('start_date', filters.start_date);
    }

    if (filters?.end_date) {
      query = query.lte('end_date', filters.end_date);
    }

    // RLS will automatically filter based on user role
    // Staff sees only their own, manager/admin sees all
    const { data, error } = await query;

    if (error) {
      console.error('Error fetching day-off requests:', error);
      return {
        success: false,
        error: 'Failed to fetch day-off requests',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }

    return { success: true, data: data || [] };
  } catch (error) {
    console.error('Unexpected error in getDayOffRequests:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}

/**
 * Get pending day-off requests for manager approval
 * Requirements: 6.3
 */
export async function getPendingDayOffRequests(): Promise<ActionResult<DayOffRequestWithDetails[]>> {
  return getDayOffRequests({ status: 'pending' });
}

/**
 * Get processed (approved/rejected) day-off requests for history
 * Requirements: 6.3
 */
export async function getProcessedDayOffRequests(): Promise<ActionResult<DayOffRequestWithDetails[]>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return {
        success: false,
        error: 'You must be logged in',
        code: ErrorCodes.UNAUTHORIZED,
      };
    }

    const userRole = await getUserRole();
    if (userRole !== 'admin' && userRole !== 'manager') {
      return {
        success: false,
        error: 'Only managers and admins can view request history',
        code: ErrorCodes.FORBIDDEN,
      };
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('day_off_requests')
      .select(`
        *,
        staff:profiles!day_off_requests_staff_id_fkey (
          id,
          email,
          full_name,
          role,
          store_id,
          is_active,
          store:stores (
            name
          )
        ),
        reviewer:profiles!day_off_requests_reviewed_by_fkey (
          id,
          full_name
        )
      `)
      .in('status', ['approved', 'rejected'])
      .order('reviewed_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error fetching processed requests:', error);
      return {
        success: false,
        error: 'Failed to fetch request history',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }

    return { success: true, data: data || [] };
  } catch (error) {
    console.error('Unexpected error in getProcessedDayOffRequests:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}

/**
 * Get current user's day-off requests
 * Requirements: 6.2
 */
export async function getMyDayOffRequests(): Promise<ActionResult<DayOffRequestWithDetails[]>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return {
        success: false,
        error: 'You must be logged in',
        code: ErrorCodes.UNAUTHORIZED,
      };
    }

    return getDayOffRequests({ staff_id: user.id });
  } catch (error) {
    console.error('Unexpected error in getMyDayOffRequests:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}


/**
 * Approve or reject a day-off request
 * Requirements: 6.3, 6.4
 * Only manager/admin can approve/reject
 * Sends email notification to staff member
 */
export async function approveDayOffRequest(
  id: string,
  approved: boolean,
  reviewerId: string,
  rejectionReason?: string
): Promise<ActionResult<DayOffRequest>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return {
        success: false,
        error: 'You must be logged in to approve/reject requests',
        code: ErrorCodes.UNAUTHORIZED,
      };
    }

    const userRole = await getUserRole();
    if (userRole !== 'admin' && userRole !== 'manager') {
      return {
        success: false,
        error: 'Only managers and admins can approve/reject day-off requests',
        code: ErrorCodes.FORBIDDEN,
      };
    }

    // Rejection requires a reason
    if (!approved && (!rejectionReason || rejectionReason.trim().length === 0)) {
      return {
        success: false,
        error: 'Please provide a reason for rejection',
        code: ErrorCodes.VALIDATION_ERROR,
      };
    }

    const supabase = await createClient();

    // Get the request first to check it exists and is pending
    const { data: existingRequest, error: fetchError } = await supabase
      .from('day_off_requests')
      .select('*, staff:profiles!day_off_requests_staff_id_fkey(email, full_name)')
      .eq('id', id)
      .single();

    if (fetchError || !existingRequest) {
      return {
        success: false,
        error: 'Day-off request not found',
        code: ErrorCodes.NOT_FOUND,
      };
    }

    if (existingRequest.status !== 'pending') {
      return {
        success: false,
        error: 'This request has already been processed',
        code: ErrorCodes.CONFLICT,
      };
    }

    // Update the request status
    const newStatus = approved ? 'approved' : 'rejected';
    const updateData: Record<string, unknown> = {
      status: newStatus,
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
    };

    // Store rejection reason in the reason field with a prefix (since we don't have a separate column)
    // Format: "Original reason | REJECTED: rejection reason"
    if (!approved && rejectionReason) {
      updateData.reason = `${existingRequest.reason} | REJECTED: ${rejectionReason}`;
    }

    const { data: updatedRequest, error: updateError } = await supabase
      .from('day_off_requests')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating day-off request:', updateError);
      return {
        success: false,
        error: 'Failed to update day-off request',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }

    // Try to send email notification (non-blocking)
    // The edge function will handle the actual email sending
    try {
      await sendDayOffNotification(
        existingRequest.staff?.email,
        existingRequest.staff?.full_name,
        newStatus,
        existingRequest.start_date,
        existingRequest.end_date,
        rejectionReason
      );
    } catch (emailError) {
      // Log but don't fail the request if email fails
      console.error('Failed to send email notification:', emailError);
    }

    return { success: true, data: updatedRequest };
  } catch (error) {
    console.error('Unexpected error in approveDayOffRequest:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}

/**
 * Send email notification for day-off request status change
 * Requirements: 6.4
 * Calls the Supabase Edge Function to send email via Resend
 * 
 * NOTE: This function is non-blocking. If the Edge Function is not deployed,
 * it will log a warning and return without throwing an error.
 */
async function sendDayOffNotification(
  staffEmail: string | undefined,
  staffName: string | undefined,
  status: 'approved' | 'rejected',
  startDate: string,
  endDate: string,
  rejectionReason?: string
): Promise<void> {
  if (!staffEmail) {
    console.warn('No staff email provided for notification');
    return;
  }

  try {
    const supabase = await createClient();
    
    // Call the edge function to send email
    const { error } = await supabase.functions.invoke('send-day-off-notification', {
      body: {
        to: staffEmail,
        staffName: staffName || 'Staff Member',
        status,
        startDate,
        endDate,
        rejectionReason,
      },
    });

    if (error) {
      // Edge Function not deployed or failed - log but don't throw
      console.warn('Day-off notification skipped (Edge Function not available):', error.message);
    }
  } catch (error) {
    // Network error or Edge Function not deployed - log but don't throw
    console.warn('Failed to send day-off notification (this is OK if Edge Function not deployed):', error);
  }
}

/**
 * Get current user's profile for day-off form
 */
export async function getCurrentUserForDayOff(): Promise<ActionResult<{ id: string; full_name: string; role: string }>> {
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
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .eq('id', user.id)
      .single();

    if (error || !profile) {
      return {
        success: false,
        error: 'Profile not found',
        code: ErrorCodes.NOT_FOUND,
      };
    }

    return { success: true, data: profile };
  } catch (error) {
    console.error('Unexpected error in getCurrentUserForDayOff:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}
