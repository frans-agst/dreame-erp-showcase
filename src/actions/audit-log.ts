'use server';

import { createClient } from '@/lib/supabase/server';
import { AuditLogEntry } from '@/types';
import * as XLSX from 'xlsx';

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
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export interface AuditLogFilter {
  start_date?: string;
  end_date?: string;
  user_id?: string;
  action?: 'INSERT' | 'UPDATE' | 'DELETE';
  table_name?: string;
  page?: number;
  page_size?: number;
}

export interface PaginatedAuditLogs {
  data: AuditLogEntry[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
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
  
  return user.app_metadata?.role || null;
}

// ============================================================================
// Audit Log Actions
// ============================================================================

/**
 * Get audit logs with filtering and pagination
 * Requirements: 18.2, 18.3, 18.5
 * SECURITY: Only admin users can access
 */
export async function getAuditLogs(filters?: AuditLogFilter): Promise<ActionResult<PaginatedAuditLogs>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return {
        success: false,
        error: 'You must be logged in to view audit logs',
        code: ErrorCodes.UNAUTHORIZED,
      };
    }

    const role = await getUserRole();
    if (!role || role !== 'admin') {
      return {
        success: false,
        error: 'You do not have permission to view audit logs. Admin access required.',
        code: ErrorCodes.FORBIDDEN,
      };
    }

    const supabase = await createClient();
    
    // Set pagination defaults
    const page = filters?.page || 1;
    const pageSize = filters?.page_size || 20;
    const offset = (page - 1) * pageSize;

    // Build query with user join
    let query = supabase
      .from('audit_log')
      .select(`
        id,
        user_id,
        action,
        table_name,
        record_id,
        old_value,
        new_value,
        created_at,
        user:profiles!audit_log_user_id_fkey(id, full_name, email)
      `, { count: 'exact' })
      .order('created_at', { ascending: false });

    // Apply filters
    if (filters?.start_date) {
      query = query.gte('created_at', filters.start_date);
    }

    if (filters?.end_date) {
      // Add time to end_date to include the entire day
      const endDateTime = `${filters.end_date}T23:59:59.999Z`;
      query = query.lte('created_at', endDateTime);
    }

    if (filters?.user_id) {
      query = query.eq('user_id', filters.user_id);
    }

    if (filters?.action) {
      query = query.eq('action', filters.action);
    }

    if (filters?.table_name) {
      query = query.eq('table_name', filters.table_name);
    }

    // Apply pagination
    query = query.range(offset, offset + pageSize - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching audit logs:', error);
      return {
        success: false,
        error: 'Failed to fetch audit logs',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }

    // Transform data to match AuditLogEntry interface
    const auditLogs: AuditLogEntry[] = (data || []).map((log) => {
      const userData = log.user as unknown as { id: string; full_name: string; email: string } | null;
      
      return {
        id: log.id,
        user_id: log.user_id,
        user: userData ? {
          id: userData.id,
          email: userData.email,
          full_name: userData.full_name,
          role: 'staff' as const, // Default, not fetched for performance
          store_id: null,
          is_active: true,
          created_at: '',
          updated_at: '',
        } : undefined,
        action: log.action as 'INSERT' | 'UPDATE' | 'DELETE',
        table_name: log.table_name,
        record_id: log.record_id,
        old_value: log.old_value as Record<string, unknown> | null,
        new_value: log.new_value as Record<string, unknown> | null,
        created_at: log.created_at,
      };
    });

    const total = count || 0;
    const totalPages = Math.ceil(total / pageSize);

    return {
      success: true,
      data: {
        data: auditLogs,
        total,
        page,
        page_size: pageSize,
        total_pages: totalPages,
      },
    };
  } catch (error) {
    console.error('Unexpected error in getAuditLogs:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}

/**
 * Export audit logs to Excel format
 * Requirements: 18.4, 18.5
 * SECURITY: Only admin users can access
 */
export async function exportAuditLogs(filters?: Omit<AuditLogFilter, 'page' | 'page_size'>): Promise<ActionResult<string>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return {
        success: false,
        error: 'You must be logged in to export audit logs',
        code: ErrorCodes.UNAUTHORIZED,
      };
    }

    const role = await getUserRole();
    if (!role || role !== 'admin') {
      return {
        success: false,
        error: 'You do not have permission to export audit logs. Admin access required.',
        code: ErrorCodes.FORBIDDEN,
      };
    }

    const supabase = await createClient();

    // Build query with user join (no pagination for export)
    let query = supabase
      .from('audit_log')
      .select(`
        id,
        user_id,
        action,
        table_name,
        record_id,
        old_value,
        new_value,
        created_at,
        user:profiles!audit_log_user_id_fkey(full_name, email)
      `)
      .order('created_at', { ascending: false })
      .limit(10000); // Limit export to 10,000 records for performance

    // Apply filters
    if (filters?.start_date) {
      query = query.gte('created_at', filters.start_date);
    }

    if (filters?.end_date) {
      const endDateTime = `${filters.end_date}T23:59:59.999Z`;
      query = query.lte('created_at', endDateTime);
    }

    if (filters?.user_id) {
      query = query.eq('user_id', filters.user_id);
    }

    if (filters?.action) {
      query = query.eq('action', filters.action);
    }

    if (filters?.table_name) {
      query = query.eq('table_name', filters.table_name);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching audit logs for export:', error);
      return {
        success: false,
        error: 'Failed to fetch audit logs for export',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }

    // Transform data for Excel export
    const excelData = (data || []).map((log) => {
      const userData = log.user as unknown as { full_name: string; email: string } | null;
      
      return {
        'Date/Time': new Date(log.created_at).toLocaleString(),
        'User': userData?.full_name || 'System',
        'Email': userData?.email || '-',
        'Action': log.action,
        'Table': log.table_name,
        'Record ID': log.record_id,
        'Old Value': log.old_value ? JSON.stringify(log.old_value, null, 2) : '-',
        'New Value': log.new_value ? JSON.stringify(log.new_value, null, 2) : '-',
      };
    });

    // Create workbook and worksheet
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Audit Log');

    // Set column widths
    worksheet['!cols'] = [
      { wch: 20 }, // Date/Time
      { wch: 25 }, // User
      { wch: 30 }, // Email
      { wch: 10 }, // Action
      { wch: 20 }, // Table
      { wch: 40 }, // Record ID
      { wch: 50 }, // Old Value
      { wch: 50 }, // New Value
    ];

    // Generate base64 string
    const excelBuffer = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });

    return {
      success: true,
      data: excelBuffer,
    };
  } catch (error) {
    console.error('Unexpected error in exportAuditLogs:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}

/**
 * Get list of unique table names from audit log
 * Helper for filter dropdown
 */
export async function getAuditedTables(): Promise<ActionResult<string[]>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return {
        success: false,
        error: 'You must be logged in',
        code: ErrorCodes.UNAUTHORIZED,
      };
    }

    const role = await getUserRole();
    if (!role || role !== 'admin') {
      return {
        success: false,
        error: 'You do not have permission to access this resource. Admin access required.',
        code: ErrorCodes.FORBIDDEN,
      };
    }

    // Return the list of audited tables based on the triggers
    const auditedTables = [
      'profiles',
      'branches',
      'products',
      'inventory',
      'sales',
      'purchase_orders',
      'day_off_requests',
      'stock_opname',
      'staff_stores',
    ];

    return { success: true, data: auditedTables };
  } catch (error) {
    console.error('Unexpected error in getAuditedTables:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}

/**
 * Get list of users for filter dropdown
 * Helper for filter dropdown
 */
export async function getAuditLogUsers(): Promise<ActionResult<{ id: string; full_name: string }[]>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return {
        success: false,
        error: 'You must be logged in',
        code: ErrorCodes.UNAUTHORIZED,
      };
    }

    const role = await getUserRole();
    if (!role || role !== 'admin') {
      return {
        success: false,
        error: 'You do not have permission to access this resource. Admin access required.',
        code: ErrorCodes.FORBIDDEN,
      };
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('is_active', true)
      .order('full_name');

    if (error) {
      console.error('Error fetching users:', error);
      return {
        success: false,
        error: 'Failed to fetch users',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }

    return { success: true, data: data || [] };
  } catch (error) {
    console.error('Unexpected error in getAuditLogUsers:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}

/**
 * Get store assignment history for a specific staff member
 * Requirements: 11.5
 * SECURITY: Only admin users can access
 */
export async function getStaffAssignmentHistory(staffId: string): Promise<ActionResult<AuditLogEntry[]>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return {
        success: false,
        error: 'You must be logged in',
        code: ErrorCodes.UNAUTHORIZED,
      };
    }

    const role = await getUserRole();
    if (!role || role !== 'admin') {
      return {
        success: false,
        error: 'You do not have permission to view assignment history. Admin access required.',
        code: ErrorCodes.FORBIDDEN,
      };
    }

    const supabase = await createClient();

    // Query audit log for staff_stores table entries related to this staff member
    const { data, error } = await supabase
      .from('audit_log')
      .select(`
        id,
        user_id,
        action,
        table_name,
        record_id,
        old_value,
        new_value,
        created_at,
        user:profiles!audit_log_user_id_fkey(id, full_name, email)
      `)
      .eq('table_name', 'staff_stores')
      .or(`record_id.eq.${staffId},new_value->>staff_id.eq.${staffId}`)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Error fetching staff assignment history:', error);
      return {
        success: false,
        error: 'Failed to fetch assignment history',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }

    // Transform data to match AuditLogEntry interface
    const auditLogs: AuditLogEntry[] = (data || []).map((log) => {
      const userData = log.user as unknown as { id: string; full_name: string; email: string } | null;
      
      return {
        id: log.id,
        user_id: log.user_id,
        user: userData ? {
          id: userData.id,
          email: userData.email,
          full_name: userData.full_name,
          role: 'staff' as const,
          store_id: null,
          is_active: true,
          created_at: '',
          updated_at: '',
        } : undefined,
        action: log.action as 'INSERT' | 'UPDATE' | 'DELETE',
        table_name: log.table_name,
        record_id: log.record_id,
        old_value: log.old_value as Record<string, unknown> | null,
        new_value: log.new_value as Record<string, unknown> | null,
        created_at: log.created_at,
      };
    });

    return {
      success: true,
      data: auditLogs,
    };
  } catch (error) {
    console.error('Unexpected error in getStaffAssignmentHistory:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}

