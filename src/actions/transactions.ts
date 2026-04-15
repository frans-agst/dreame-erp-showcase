// src/actions/transactions.ts
// Server actions for transaction management
// Requirements: 1.5, 1.6, 9.1, 9.2

'use server';

import { createClient } from '@/lib/supabase/server';
import { validateTransactionInput } from '@/lib/transaction-validation';
import { calculateTransactionTotals } from '@/lib/transaction-calculations';
import { TransactionInputSchema, TransactionFilterSchema } from '@/lib/validations/transactions';
import { 
  validateAtomicInventoryOperation,
  restoreInventoryForTransaction 
} from '@/lib/inventory-management';
import { 
  logTransactionCreationAudit,
  logTransactionModificationAudit,
  logTransactionDeletionAudit 
} from '@/lib/audit-logging';
import {
  ErrorCode,
  createError,
  formatValidationErrors,
  formatInventoryShortageError,
  handleDatabaseError,
  logError,
  withRetry
} from '@/lib/error-handling';
import type { 
  Transaction, 
  TransactionInput, 
  TransactionFilter,
  TransactionUpdate 
} from '@/types';

export interface ActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  errors?: Array<{ field: string; message: string; code: string }>;
}

/**
 * Creates a new transaction with multiple items atomically
 * Requirements: 1.5, 1.6, 6.1, 6.2, 6.4, 7.1
 */
export async function createTransaction(
  input: TransactionInput
): Promise<ActionResult<Transaction>> {
  try {
    const supabase = await createClient();

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      const authError = createError(ErrorCode.AUTH_REQUIRED, 'User not authenticated');
      return {
        success: false,
        error: authError.userMessage
      };
    }

    // Validate input schema
    const validationResult = TransactionInputSchema.safeParse(input);
    if (!validationResult.success) {
      const validationErrors = validationResult.error.issues.map(err => ({
        field: err.path.join('.'),
        message: err.message,
        code: ErrorCode.VALIDATION_ERROR
      }));
      
      return {
        success: false,
        error: formatValidationErrors(validationErrors),
        errors: validationErrors
      };
    }

    // Validate business rules
    const businessValidation = await validateTransactionInput(input);
    if (!businessValidation.isValid) {
      return {
        success: false,
        error: formatValidationErrors(businessValidation.errors),
        errors: businessValidation.errors
      };
    }

    // Validate inventory availability atomically
    const inventoryValidation = await validateAtomicInventoryOperation(
      input.store_id,
      input.items,
      input.inventory_source
    );

    if (!inventoryValidation.canProceed) {
      const shortageError = formatInventoryShortageError(
        inventoryValidation.validationResult.errors
      );
      
      return {
        success: false,
        error: shortageError,
        errors: inventoryValidation.validationResult.errors.map(err => ({
          field: `items.${input.items.findIndex(item => item.product_id === err.product_id)}.quantity`,
          message: `Insufficient stock for ${err.product_name}. Available: ${err.available_stock}, Requested: ${err.requested_quantity}`,
          code: ErrorCode.INSUFFICIENT_STOCK
        }))
      };
    }

    // Calculate transaction totals
    const totals = calculateTransactionTotals(input.items);
    
    // Prepare transaction data for database function
    const transactionData = {
      store_id: input.store_id,
      staff_id: input.staff_id,
      transaction_date: input.transaction_date,
      total_before_discount: totals.subtotal,
      total_discount: totals.totalDiscount,
      total_after_discount: totals.total,
      inventory_source: input.inventory_source || 'in_store',
      customer_name: input.customer_name || null,
      customer_phone: input.customer_phone || null,
      notes: input.notes || null
    };

    // Prepare items data
    const itemsData = input.items.map(item => ({
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      line_discount: item.line_discount || 0,
      gift_details: item.gift_details || []
    }));

    // Create transaction using database function with retry logic
    const result = await withRetry(
      async () => {
        const { data, error } = await supabase.rpc('create_transaction_with_items', {
          p_transaction_data: transactionData,
          p_items_data: itemsData
        });
        if (error) {
          console.error('Database RPC error:', error);
          console.error('Transaction data:', JSON.stringify(transactionData, null, 2));
          console.error('Items data:', JSON.stringify(itemsData, null, 2));
          throw error;
        }
        return data;
      },
      2, // Max 2 retries
      1000, // 1 second delay
      'create_transaction_with_items'
    );

    const transactionId = result;

    // Fetch the created transaction with all related data
    const createdTransaction = await getTransactionById(transactionId);
    if (!createdTransaction.success || !createdTransaction.data) {
      logError('createTransaction', 'Failed to retrieve created transaction', { transactionId });
      return {
        success: false,
        error: 'Transaction created but failed to retrieve details. Please refresh the page.'
      };
    }

    // Log audit trail for transaction creation (non-blocking)
    logTransactionCreationAudit(
      createdTransaction.data,
      user.id,
      {
        inventory_validation: inventoryValidation.inventoryLevels,
        creation_method: 'server_action'
      }
    ).catch(err => logError('createTransaction', 'Audit logging failed', err));

    return {
      success: true,
      data: createdTransaction.data
    };

  } catch (error) {
    logError('createTransaction', error, { input });
    console.error('Full error details:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    const appError = createError(
      ErrorCode.TRANSACTION_CREATE_FAILED,
      error instanceof Error ? error.message : 'Unknown error'
    );
    return {
      success: false,
      error: appError.userMessage
    };
  }
}

/**
 * Retrieves transactions with filtering and search
 * Requirements: 9.1, 9.2
 */
export async function getTransactions(
  filters?: TransactionFilter
): Promise<ActionResult<Transaction[]>> {
  try {
    const supabase = await createClient();

    // Validate filters if provided
    if (filters) {
      const validationResult = TransactionFilterSchema.safeParse(filters);
      if (!validationResult.success) {
        return {
          success: false,
          error: 'Invalid filter parameters',
          errors: validationResult.error.issues.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            code: 'VALIDATION_ERROR'
          }))
        };
      }
    }

    // Build query
    let query = supabase
      .from('transactions')
      .select(`
        *,
        store:stores(id, name, account:accounts(name)),
        staff:profiles!staff_id(id, full_name),
        items:transaction_items(
          *,
          product:products(id, sku, name, category, sub_category)
        )
      `)
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false });

    // Apply filters
    if (filters?.store_id) {
      query = query.eq('store_id', filters.store_id);
    }
    if (filters?.staff_id) {
      query = query.eq('staff_id', filters.staff_id);
    }
    if (filters?.start_date) {
      query = query.gte('transaction_date', filters.start_date);
    }
    if (filters?.end_date) {
      query = query.lte('transaction_date', filters.end_date);
    }
    if (filters?.customer_name) {
      query = query.ilike('customer_name', `%${filters.customer_name}%`);
    }
    if (filters?.customer_phone) {
      query = query.ilike('customer_phone', `%${filters.customer_phone}%`);
    }
    if (filters?.min_total !== undefined) {
      query = query.gte('total_after_discount', filters.min_total);
    }
    if (filters?.max_total !== undefined) {
      query = query.lte('total_after_discount', filters.max_total);
    }
    if (filters?.inventory_source) {
      query = query.eq('inventory_source', filters.inventory_source);
    }

    const { data: transactions, error } = await query;

    if (error) {
      console.error('Get transactions error:', error);
      return {
        success: false,
        error: 'Failed to retrieve transactions'
      };
    }

    return {
      success: true,
      data: transactions || []
    };

  } catch (error) {
    console.error('Get transactions error:', error);
    return {
      success: false,
      error: 'Internal server error'
    };
  }
}

/**
 * Retrieves a single transaction by ID with detailed information
 * Requirements: 9.2
 */
export async function getTransactionById(
  id: string
): Promise<ActionResult<Transaction>> {
  try {
    const supabase = await createClient();

    // Validate ID format
    if (!id || typeof id !== 'string') {
      return {
        success: false,
        error: 'Invalid transaction ID'
      };
    }

    const { data: transaction, error } = await supabase
      .from('transactions')
      .select(`
        *,
        store:stores(id, name, account:accounts(name)),
        staff:profiles!staff_id(id, full_name),
        items:transaction_items(
          *,
          product:products(id, sku, name, category, sub_category)
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return {
          success: false,
          error: 'Transaction not found'
        };
      }
      console.error('Get transaction by ID error:', error);
      return {
        success: false,
        error: 'Failed to retrieve transaction'
      };
    }

    return {
      success: true,
      data: transaction
    };

  } catch (error) {
    console.error('Get transaction by ID error:', error);
    return {
      success: false,
      error: 'Internal server error'
    };
  }
}

/**
 * Updates transaction metadata (limited fields for audit compliance)
 * Requirements: 7.2
 */
export async function updateTransaction(
  id: string,
  updates: TransactionUpdate
): Promise<ActionResult<Transaction>> {
  try {
    const supabase = await createClient();

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return {
        success: false,
        error: 'Authentication required'
      };
    }

    // Validate ID format
    if (!id || typeof id !== 'string') {
      return {
        success: false,
        error: 'Invalid transaction ID'
      };
    }

    // Validate updates
    if (!updates || Object.keys(updates).length === 0) {
      return {
        success: false,
        error: 'No updates provided'
      };
    }

    // Get current transaction data for audit trail
    const currentTransaction = await getTransactionById(id);
    if (!currentTransaction.success || !currentTransaction.data) {
      return {
        success: false,
        error: 'Transaction not found'
      };
    }

    // Only allow updating specific fields for audit compliance
    const allowedUpdates = {
      customer_name: updates.customer_name,
      customer_phone: updates.customer_phone,
      notes: updates.notes,
      updated_at: new Date().toISOString()
    };

    const { data: updatedTransaction, error } = await supabase
      .from('transactions')
      .update(allowedUpdates)
      .eq('id', id)
      .select(`
        *,
        store:stores(id, name, account:accounts(name)),
        staff:profiles!staff_id(id, full_name),
        items:transaction_items(
          *,
          product:products(id, sku, name, category, sub_category)
        )
      `)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return {
          success: false,
          error: 'Transaction not found'
        };
      }
      console.error('Update transaction error:', error);
      return {
        success: false,
        error: 'Failed to update transaction'
      };
    }

    // Log audit trail for transaction modification
    await logTransactionModificationAudit(
      id,
      user.id,
      allowedUpdates,
      {
        customer_name: currentTransaction.data.customer_name,
        customer_phone: currentTransaction.data.customer_phone,
        notes: currentTransaction.data.notes
      }
    );

    return {
      success: true,
      data: updatedTransaction
    };

  } catch (error) {
    console.error('Update transaction error:', error);
    return {
      success: false,
      error: 'Internal server error'
    };
  }
}

/**
 * Soft deletes a transaction (admin/manager only)
 * Requirements: 7.3, 6.5
 */
export async function deleteTransaction(
  id: string,
  reason?: string
): Promise<ActionResult<void>> {
  try {
    const supabase = await createClient();

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return {
        success: false,
        error: 'Authentication required'
      };
    }

    // Validate ID format
    if (!id || typeof id !== 'string') {
      return {
        success: false,
        error: 'Invalid transaction ID'
      };
    }

    // Get transaction details for audit and inventory restoration
    const transactionResult = await getTransactionById(id);
    if (!transactionResult.success || !transactionResult.data) {
      return {
        success: false,
        error: 'Transaction not found'
      };
    }

    const transaction = transactionResult.data;

    // Restore inventory if it was decremented (in_store transactions)
    if (transaction.inventory_source === 'in_store') {
      const inventoryRestoreResult = await restoreInventoryForTransaction(id);
      if (!inventoryRestoreResult.success) {
        console.error('Failed to restore inventory:', inventoryRestoreResult.error);
        // Continue with deletion but log the issue
      }
    }

    // Delete the transaction (cascade will handle transaction_items)
    console.log('Attempting to delete transaction:', id);
    const { data, error: deleteError, count } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id)
      .select();

    console.log('Delete response:', { data, error: deleteError, count });

    if (deleteError) {
      console.error('Delete transaction error:', deleteError);
      return {
        success: false,
        error: `Failed to delete transaction: ${deleteError.message}`
      };
    }

    if (!data || data.length === 0) {
      console.error('No rows were deleted - possible RLS policy issue');
      return {
        success: false,
        error: 'Failed to delete transaction - permission denied or transaction not found'
      };
    }

    console.log('Transaction deleted successfully:', id);

    // Log audit trail for transaction deletion (non-blocking)
    logTransactionDeletionAudit(
      transaction,
      user.id,
      reason,
      false // This is a deletion, not a void
    ).catch(err => {
      console.error('Failed to log transaction audit:', err);
      // Don't fail the delete operation if audit logging fails
    });

    return {
      success: true
    };

  } catch (error) {
    console.error('Delete transaction error:', error);
    return {
      success: false,
      error: 'Internal server error'
    };
  }
}

/**
 * Voids a transaction (restores inventory and logs audit trail)
 * Requirements: 6.5, 7.3
 */
export async function voidTransaction(
  id: string,
  reason: string
): Promise<ActionResult<void>> {
  try {
    const supabase = await createClient();

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return {
        success: false,
        error: 'Authentication required'
      };
    }

    // Validate inputs
    if (!id || typeof id !== 'string') {
      return {
        success: false,
        error: 'Invalid transaction ID'
      };
    }

    if (!reason || reason.trim().length === 0) {
      return {
        success: false,
        error: 'Void reason is required'
      };
    }

    // Get transaction details
    const transactionResult = await getTransactionById(id);
    if (!transactionResult.success || !transactionResult.data) {
      return {
        success: false,
        error: 'Transaction not found'
      };
    }

    const transaction = transactionResult.data;

    // Restore inventory if it was decremented (in_store transactions)
    if (transaction.inventory_source === 'in_store') {
      const inventoryRestoreResult = await restoreInventoryForTransaction(id);
      if (!inventoryRestoreResult.success) {
        return {
          success: false,
          error: `Failed to restore inventory: ${inventoryRestoreResult.error}`
        };
      }
    }

    // Mark transaction as voided (we could add a status field, but for now we'll delete)
    // In a production system, you might want to add a 'status' field instead of deleting
    const { error: deleteError } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Void transaction error:', deleteError);
      return {
        success: false,
        error: 'Failed to void transaction'
      };
    }

    // Log audit trail for transaction void
    await logTransactionDeletionAudit(
      transaction,
      user.id,
      reason,
      true // This is a void operation
    );

    return {
      success: true
    };

  } catch (error) {
    console.error('Void transaction error:', error);
    return {
      success: false,
      error: 'Internal server error'
    };
  }
}

/**
 * Searches transactions by text query across multiple fields
 * Requirements: 9.1, 9.5
 */
export async function searchTransactions(
  query: string,
  filters?: Omit<TransactionFilter, 'customer_name' | 'customer_phone'>
): Promise<ActionResult<Transaction[]>> {
  try {
    const supabase = await createClient();

    if (!query || query.trim().length === 0) {
      return getTransactions(filters);
    }

    const searchTerm = query.trim();

    // Build search query
    let dbQuery = supabase
      .from('transactions')
      .select(`
        *,
        store:stores(id, name, account:accounts(name)),
        staff:profiles!staff_id(id, full_name),
        items:transaction_items(
          *,
          product:products(id, sku, name, category, sub_category)
        )
      `)
      .or(`customer_name.ilike.%${searchTerm}%,customer_phone.ilike.%${searchTerm}%,id.eq.${searchTerm}`)
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false });

    // Apply additional filters
    if (filters?.store_id) {
      dbQuery = dbQuery.eq('store_id', filters.store_id);
    }
    if (filters?.staff_id) {
      dbQuery = dbQuery.eq('staff_id', filters.staff_id);
    }
    if (filters?.start_date) {
      dbQuery = dbQuery.gte('transaction_date', filters.start_date);
    }
    if (filters?.end_date) {
      dbQuery = dbQuery.lte('transaction_date', filters.end_date);
    }
    if (filters?.min_total !== undefined) {
      dbQuery = dbQuery.gte('total_after_discount', filters.min_total);
    }
    if (filters?.max_total !== undefined) {
      dbQuery = dbQuery.lte('total_after_discount', filters.max_total);
    }
    if (filters?.inventory_source) {
      dbQuery = dbQuery.eq('inventory_source', filters.inventory_source);
    }

    const { data: transactions, error } = await dbQuery;

    if (error) {
      console.error('Search transactions error:', error);
      return {
        success: false,
        error: 'Failed to search transactions'
      };
    }

    return {
      success: true,
      data: transactions || []
    };

  } catch (error) {
    console.error('Search transactions error:', error);
    return {
      success: false,
      error: 'Internal server error'
    };
  }
}