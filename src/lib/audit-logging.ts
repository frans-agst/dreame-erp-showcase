// src/lib/audit-logging.ts
// Audit logging for transaction operations
// Requirements: 7.1, 7.2, 7.3, 7.4, 7.5

import { createClient } from '@/lib/supabase/server';
import type { Transaction, TransactionItem } from '@/types';

export interface AuditLogEntry {
  id: string;
  user_id: string | null;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  table_name: string;
  record_id: string;
  old_value: any;
  new_value: any;
  created_at: string;
}

export interface TransactionAuditContext {
  transaction_id: string;
  user_id: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'VOID';
  reason?: string;
  metadata?: Record<string, any>;
}

/**
 * Logs transaction-level audit events
 * Requirements: 7.1, 7.2, 7.3
 */
export async function logTransactionAudit(
  context: TransactionAuditContext,
  transactionData?: Partial<Transaction>,
  previousData?: Partial<Transaction>
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    // Create audit log entry for the transaction
    const auditEntry = {
      user_id: context.user_id,
      action: context.action === 'CREATE' ? 'INSERT' : 
              context.action === 'UPDATE' ? 'UPDATE' : 'DELETE',
      table_name: 'transactions',
      record_id: context.transaction_id,
      old_value: previousData || null,
      new_value: transactionData || null,
      metadata: {
        transaction_action: context.action,
        reason: context.reason,
        timestamp: new Date().toISOString(),
        ...context.metadata
      }
    };

    const { error } = await supabase
      .from('audit_log')
      .insert(auditEntry);

    if (error) {
      console.error('Failed to log transaction audit:', error);
      return {
        success: false,
        error: error.message
      };
    }

    return { success: true };

  } catch (error) {
    console.error('Transaction audit logging error:', error);
    return {
      success: false,
      error: 'Internal server error'
    };
  }
}

/**
 * Logs transaction item audit events
 * Requirements: 7.1, 7.4
 */
export async function logTransactionItemsAudit(
  transactionId: string,
  userId: string,
  action: 'CREATE' | 'UPDATE' | 'DELETE',
  items: TransactionItem[],
  previousItems?: TransactionItem[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    const auditEntries = items.map((item, index) => ({
      user_id: userId,
      action: action === 'CREATE' ? 'INSERT' : 
              action === 'UPDATE' ? 'UPDATE' : 'DELETE',
      table_name: 'transaction_items',
      record_id: item.id,
      old_value: previousItems?.[index] || null,
      new_value: item,
      metadata: {
        transaction_id: transactionId,
        transaction_action: action,
        timestamp: new Date().toISOString()
      }
    }));

    const { error } = await supabase
      .from('audit_log')
      .insert(auditEntries);

    if (error) {
      console.error('Failed to log transaction items audit:', error);
      return {
        success: false,
        error: error.message
      };
    }

    return { success: true };

  } catch (error) {
    console.error('Transaction items audit logging error:', error);
    return {
      success: false,
      error: 'Internal server error'
    };
  }
}

/**
 * Logs comprehensive transaction creation audit trail
 * Requirements: 7.1, 7.5
 */
export async function logTransactionCreationAudit(
  transaction: Transaction,
  userId: string,
  metadata?: Record<string, any>
): Promise<{ success: boolean; error?: string }> {
  try {
    // Log transaction creation
    const transactionAuditResult = await logTransactionAudit({
      transaction_id: transaction.id,
      user_id: userId,
      action: 'CREATE',
      metadata: {
        total_items: transaction.items.length,
        total_amount: transaction.total_after_discount,
        inventory_source: transaction.inventory_source,
        store_id: transaction.store_id,
        ...metadata
      }
    }, transaction);

    if (!transactionAuditResult.success) {
      return transactionAuditResult;
    }

    // Log transaction items creation
    const itemsAuditResult = await logTransactionItemsAudit(
      transaction.id,
      userId,
      'CREATE',
      transaction.items
    );

    return itemsAuditResult;

  } catch (error) {
    console.error('Transaction creation audit error:', error);
    return {
      success: false,
      error: 'Internal server error'
    };
  }
}

/**
 * Logs transaction modification audit trail
 * Requirements: 7.2, 7.5
 */
export async function logTransactionModificationAudit(
  transactionId: string,
  userId: string,
  changes: Partial<Transaction>,
  previousData: Partial<Transaction>,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    return await logTransactionAudit({
      transaction_id: transactionId,
      user_id: userId,
      action: 'UPDATE',
      reason,
      metadata: {
        fields_changed: Object.keys(changes),
        change_summary: generateChangeSummary(changes, previousData)
      }
    }, changes, previousData);

  } catch (error) {
    console.error('Transaction modification audit error:', error);
    return {
      success: false,
      error: 'Internal server error'
    };
  }
}

/**
 * Logs transaction deletion/void audit trail
 * Requirements: 7.3, 7.5
 */
export async function logTransactionDeletionAudit(
  transaction: Transaction,
  userId: string,
  reason?: string,
  isVoid: boolean = false
): Promise<{ success: boolean; error?: string }> {
  try {
    return await logTransactionAudit({
      transaction_id: transaction.id,
      user_id: userId,
      action: isVoid ? 'VOID' : 'DELETE',
      reason,
      metadata: {
        deletion_type: isVoid ? 'void' : 'delete',
        original_total: transaction.total_after_discount,
        items_count: transaction.items.length,
        inventory_restored: transaction.inventory_source === 'in_store'
      }
    }, undefined, transaction);

  } catch (error) {
    console.error('Transaction deletion audit error:', error);
    return {
      success: false,
      error: 'Internal server error'
    };
  }
}

/**
 * Retrieves audit trail for a specific transaction
 * Requirements: 7.4, 7.5
 */
export async function getTransactionAuditTrail(
  transactionId: string
): Promise<{
  success: boolean;
  data?: AuditLogEntry[];
  error?: string;
}> {
  try {
    const supabase = await createClient();

    const { data: auditLogs, error } = await supabase
      .from('audit_log')
      .select(`
        *,
        user:profiles(id, full_name)
      `)
      .or(`record_id.eq.${transactionId},metadata->>transaction_id.eq.${transactionId}`)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch audit trail:', error);
      return {
        success: false,
        error: error.message
      };
    }

    return {
      success: true,
      data: auditLogs || []
    };

  } catch (error) {
    console.error('Get audit trail error:', error);
    return {
      success: false,
      error: 'Internal server error'
    };
  }
}

/**
 * Retrieves audit summary for reporting
 * Requirements: 7.4, 7.5
 */
export async function getTransactionAuditSummary(
  filters: {
    start_date?: string;
    end_date?: string;
    store_id?: string;
    user_id?: string;
    action?: string;
  }
): Promise<{
  success: boolean;
  data?: Array<{
    date: string;
    action: string;
    count: number;
    user_name: string;
    store_name?: string;
  }>;
  error?: string;
}> {
  try {
    const supabase = await createClient();

    let query = supabase
      .from('audit_log')
      .select(`
        created_at,
        action,
        user_id,
        metadata,
        user:profiles(full_name)
      `)
      .eq('table_name', 'transactions')
      .order('created_at', { ascending: false });

    // Apply filters
    if (filters.start_date) {
      query = query.gte('created_at', filters.start_date);
    }
    if (filters.end_date) {
      query = query.lte('created_at', filters.end_date);
    }
    if (filters.user_id) {
      query = query.eq('user_id', filters.user_id);
    }
    if (filters.action) {
      query = query.eq('action', filters.action);
    }

    const { data: auditLogs, error } = await query;

    if (error) {
      console.error('Failed to fetch audit summary:', error);
      return {
        success: false,
        error: error.message
      };
    }

    // Group and summarize the data
    const summary = (auditLogs || []).reduce((acc, log) => {
      const date = log.created_at.split('T')[0];
      const key = `${date}-${log.action}-${log.user_id}`;
      
      if (!acc[key]) {
        acc[key] = {
          date,
          action: log.action,
          count: 0,
          user_name: (log.user as any)?.full_name || 'Unknown User',
          store_name: log.metadata?.store_name
        };
      }
      
      acc[key].count++;
      return acc;
    }, {} as Record<string, any>);

    return {
      success: true,
      data: Object.values(summary)
    };

  } catch (error) {
    console.error('Get audit summary error:', error);
    return {
      success: false,
      error: 'Internal server error'
    };
  }
}

/**
 * Helper function to generate change summary for audit logs
 */
function generateChangeSummary(
  changes: Partial<Transaction>,
  previousData: Partial<Transaction>
): string {
  const summaryParts: string[] = [];

  Object.keys(changes).forEach(key => {
    const oldValue = previousData[key as keyof Transaction];
    const newValue = changes[key as keyof Transaction];
    
    if (oldValue !== newValue) {
      summaryParts.push(`${key}: "${oldValue}" → "${newValue}"`);
    }
  });

  return summaryParts.join(', ');
}

/**
 * Validates audit log retention and cleanup
 * Requirements: 7.5
 */
export async function cleanupOldAuditLogs(
  retentionDays: number = 2555 // ~7 years default
): Promise<{ success: boolean; deletedCount?: number; error?: string }> {
  try {
    const supabase = await createClient();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const { data, error } = await supabase
      .from('audit_log')
      .delete()
      .lt('created_at', cutoffDate.toISOString())
      .select('id');

    if (error) {
      console.error('Failed to cleanup audit logs:', error);
      return {
        success: false,
        error: error.message
      };
    }

    return {
      success: true,
      deletedCount: data?.length || 0
    };

  } catch (error) {
    console.error('Audit log cleanup error:', error);
    return {
      success: false,
      error: 'Internal server error'
    };
  }
}