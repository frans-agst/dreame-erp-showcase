// src/lib/legacy-data-access.ts
// Legacy data access layer for backward compatibility
// Requirements: 2.1, 2.2, 2.3

import { createClient } from '@/lib/supabase/server';
import type { Transaction, TransactionItem, UnifiedSalesItem } from '@/types';

/**
 * Converts a legacy sale record to transaction format
 * Requirements: 2.2 - Present legacy sales as single-item transactions
 */
export async function getLegacySaleAsTransaction(
  saleId: string
): Promise<Transaction | null> {
  try {
    const supabase = await createClient();

    // Use the database function to convert legacy sale to transaction format
    const { data, error } = await supabase
      .rpc('legacy_sale_to_transaction_format', {
        p_sale_id: saleId
      })
      .single();

    if (error || !data) {
      console.error('Error converting legacy sale to transaction:', error);
      return null;
    }

    // Type assertion for the RPC result
    const legacyData = data as {
      transaction_id: string | null;
      transaction_date: string;
      store_id: string;
      store_name: string;
      account_name: string;
      staff_id: string;
      staff_name: string;
      customer_name: string | null;
      customer_phone: string | null;
      total_before_discount: number;
      total_discount: number;
      total_after_discount: number;
      inventory_source: string;
      items: any[];
    };

    // Parse the items JSONB array
    const items = Array.isArray(legacyData.items) ? legacyData.items : [];

    // Construct Transaction object
    const transaction: Transaction = {
      id: saleId, // Use sale ID as transaction ID for legacy records
      store_id: legacyData.store_id,
      store: {
        id: legacyData.store_id,
        name: legacyData.store_name,
        account: legacyData.account_name ? {
          id: '',
          name: legacyData.account_name,
          channel_type: 'Retailer',
          is_active: true,
          created_at: '',
          updated_at: ''
        } : undefined,
        account_id: '',
        region: null,
        monthly_target: 0,
        is_active: true,
        created_at: '',
        updated_at: ''
      },
      staff_id: legacyData.staff_id,
      staff: {
        id: legacyData.staff_id,
        email: '',
        full_name: legacyData.staff_name,
        role: 'staff',
        store_id: legacyData.store_id,
        is_active: true,
        created_at: '',
        updated_at: ''
      },
      transaction_date: legacyData.transaction_date,
      total_before_discount: legacyData.total_before_discount,
      total_discount: legacyData.total_discount,
      total_after_discount: legacyData.total_after_discount,
      inventory_source: (legacyData.inventory_source === 'warehouse' ? 'warehouse' : 'in_store') as 'in_store' | 'warehouse',
      customer_name: legacyData.customer_name,
      customer_phone: legacyData.customer_phone,
      notes: null,
      created_by: legacyData.staff_id,
      created_at: '',
      updated_at: '',
      items: items.map((item: any) => ({
        id: item.id,
        transaction_id: saleId,
        product_id: item.product_id,
        product: {
          id: item.product_id,
          sku: item.sku,
          name: item.product_name,
          category: item.category,
          sub_category: item.sub_category,
          price_retail: item.unit_price,
          price_buy: item.unit_price,
          channel_pricing: {},
          is_active: true,
          created_at: '',
          updated_at: ''
        },
        quantity: item.quantity,
        unit_price: item.unit_price,
        line_discount: item.line_discount,
        line_total: item.line_total,
        gift_details: item.gift_details || [],
        created_at: ''
      }))
    };

    return transaction;
  } catch (error) {
    console.error('Error in getLegacySaleAsTransaction:', error);
    return null;
  }
}

/**
 * Gets unified sales data (both transactions and legacy sales)
 * Requirements: 2.1, 2.3 - Include legacy sales in all queries
 */
export async function getUnifiedSalesData(
  startDate: string,
  endDate: string,
  storeId?: string,
  staffId?: string
): Promise<UnifiedSalesItem[]> {
  try {
    const supabase = await createClient();

    // Use the database function to get unified data
    const { data, error } = await supabase
      .rpc('get_unified_sales_data', {
        p_start_date: startDate,
        p_end_date: endDate,
        p_store_id: storeId || null,
        p_staff_id: staffId || null
      });

    if (error) {
      console.error('Error fetching unified sales data:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getUnifiedSalesData:', error);
    return [];
  }
}

/**
 * Queries the unified_sales_export view directly
 * Requirements: 2.1, 2.2, 2.3 - Maintain read access to legacy sales
 */
export async function queryUnifiedSalesExport(filters: {
  startDate?: string;
  endDate?: string;
  storeId?: string;
  staffId?: string;
  sourceType?: 'transaction' | 'legacy';
}): Promise<UnifiedSalesItem[]> {
  try {
    const supabase = await createClient();

    let query = supabase
      .from('unified_sales_export')
      .select('*')
      .order('sale_date', { ascending: false });

    // Apply filters
    if (filters.startDate) {
      query = query.gte('sale_date', filters.startDate);
    }
    if (filters.endDate) {
      query = query.lte('sale_date', filters.endDate);
    }
    if (filters.storeId) {
      query = query.eq('store_id', filters.storeId);
    }
    if (filters.staffId) {
      query = query.eq('staff_id', filters.staffId);
    }
    if (filters.sourceType) {
      query = query.eq('source_type', filters.sourceType);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error querying unified sales export:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in queryUnifiedSalesExport:', error);
    return [];
  }
}

/**
 * Checks if a given ID is a legacy sale or a new transaction
 * Requirements: 2.2 - Distinguish between legacy and new data
 */
export async function isLegacySale(id: string): Promise<boolean> {
  try {
    const supabase = await createClient();

    // Check if ID exists in sales table (legacy)
    const { data: legacySale, error: legacyError } = await supabase
      .from('sales')
      .select('id')
      .eq('id', id)
      .single();

    if (!legacyError && legacySale) {
      return true;
    }

    // Check if ID exists in transactions table (new)
    const { data: transaction, error: transactionError } = await supabase
      .from('transactions')
      .select('id')
      .eq('id', id)
      .single();

    if (!transactionError && transaction) {
      return false;
    }

    // ID not found in either table
    throw new Error(`ID ${id} not found in sales or transactions`);
  } catch (error) {
    console.error('Error in isLegacySale:', error);
    throw error;
  }
}

/**
 * Gets all sales data (legacy and transactions) for a date range
 * Returns in a unified format suitable for reporting
 * Requirements: 2.3 - Include legacy sales in all reporting functions
 */
export async function getAllSalesForReporting(
  startDate: string,
  endDate: string,
  filters?: {
    storeId?: string;
    staffId?: string;
    accountId?: string;
  }
): Promise<UnifiedSalesItem[]> {
  try {
    const supabase = await createClient();

    let query = supabase
      .from('unified_sales_export')
      .select('*')
      .gte('sale_date', startDate)
      .lte('sale_date', endDate)
      .order('sale_date', { ascending: true })
      .order('transaction_id', { ascending: true });

    // Apply filters
    if (filters?.storeId) {
      query = query.eq('store_id', filters.storeId);
    }
    if (filters?.staffId) {
      query = query.eq('staff_id', filters.staffId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching all sales for reporting:', error);
      return [];
    }

    let results = data || [];

    // Filter by account if provided (requires additional query)
    if (filters?.accountId) {
      const { data: accountStores } = await supabase
        .from('stores')
        .select('id')
        .eq('account_id', filters.accountId);

      const accountStoreIds = new Set((accountStores || []).map(s => s.id));
      results = results.filter(item => item.store_id && accountStoreIds.has(item.store_id));
    }

    return results;
  } catch (error) {
    console.error('Error in getAllSalesForReporting:', error);
    return [];
  }
}

/**
 * Gets count of legacy sales vs new transactions for a date range
 * Useful for monitoring migration progress
 * Requirements: 2.1 - Maintain read access to legacy sales
 */
export async function getSalesDataStats(
  startDate: string,
  endDate: string
): Promise<{
  legacyCount: number;
  transactionCount: number;
  totalCount: number;
}> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('unified_sales_export')
      .select('source_type')
      .gte('sale_date', startDate)
      .lte('sale_date', endDate);

    if (error) {
      console.error('Error fetching sales data stats:', error);
      return { legacyCount: 0, transactionCount: 0, totalCount: 0 };
    }

    const legacyCount = data.filter(item => item.source_type === 'legacy').length;
    const transactionCount = data.filter(item => item.source_type === 'transaction').length;

    return {
      legacyCount,
      transactionCount,
      totalCount: data.length
    };
  } catch (error) {
    console.error('Error in getSalesDataStats:', error);
    return { legacyCount: 0, transactionCount: 0, totalCount: 0 };
  }
}
