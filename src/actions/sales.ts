'use server';

import { createClient } from '@/lib/supabase/server';
import { SaleInputSchema, SalesFilterSchema, SaleInput } from '@/lib/validations/sales';
import { 
  calculateRunRatePct, 
  calculateAchievementPct, 
  getAchievementStatus 
} from '@/lib/calculations';
import { Sale, WeeklySalesReport, WeeklySalesItem, WeeklySalesTotals, WeeklySalesFilter, StoreAchievement, GiftItem, TransactionGroupedReport, TransactionGroupItem } from '@/types';
import {
  getCurrentFiscalPeriod,
  getFiscalMonthInfo,
  getFiscalDaysElapsed,
  getFiscalWeeksForYear,
} from '@/lib/fiscal-calendar';
import { calculateFiscalRunRate } from '@/lib/fiscal-calculations';

// ============================================================================
// Types (not exported - 'use server' files can only export async functions)
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
  INSUFFICIENT_STOCK: 'INSUFFICIENT_STOCK',
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

async function getUserStoreId(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return null;
  
  // For multi-store support: use current_store_id from user_metadata (set by store selector)
  // This respects the user's selected store context
  const currentStoreId = user.user_metadata?.current_store_id;
  if (currentStoreId) return currentStoreId;
  
  // Fallback to primary_store_id if no current context is set
  const primaryStoreId = user.user_metadata?.primary_store_id;
  if (primaryStoreId) return primaryStoreId;
  
  // Legacy fallback: Check app_metadata
  const metadataStoreId = user.app_metadata?.store_id;
  if (metadataStoreId) return metadataStoreId;
  
  // Final fallback: Check profile table directly
  const { data: profile } = await supabase
    .from('profiles')
    .select('store_id')
    .eq('id', user.id)
    .single();
  
  return profile?.store_id || null;
}

// ============================================================================
// Sales Actions
// ============================================================================

/**
 * Create a new sale with inventory decrement
 * Requirements: 8.2, 8.3, 8.4, 8.5, 8.7, 8.8, 8.9, 8.11
 * SECURITY: Staff can only create sales for their store (enforced by RLS)
 * NOTE: Inventory is decremented ONLY for the main sold item, NOT for gifts
 */
export async function createSale(data: SaleInput): Promise<ActionResult<Sale>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return {
        success: false,
        error: 'You must be logged in to create a sale',
        code: ErrorCodes.UNAUTHORIZED,
      };
    }

    // Validate input
    const validation = SaleInputSchema.safeParse(data);
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

    // Use store_id
    const storeId = validatedData.store_id;
    if (!storeId) {
      return {
        success: false,
        error: 'Store is required',
        code: ErrorCodes.VALIDATION_ERROR,
      };
    }

    // Validate store access - check if selected store is in user's assigned stores
    // Requirement 6.1: Staff can only create sales for their assigned stores
    const { data: assignedStoreIds, error: storeAccessError } = await supabase.rpc(
      'get_user_store_ids',
      { user_id: user.id }
    );

    if (storeAccessError) {
      console.error('Error checking store access:', storeAccessError);
      return {
        success: false,
        error: 'Failed to verify store access',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }

    // Check if the selected store is in the user's assigned stores
    if (!assignedStoreIds || !assignedStoreIds.includes(storeId)) {
      return {
        success: false,
        error: 'You do not have access to this store',
        code: ErrorCodes.FORBIDDEN,
      };
    }

    // Calculate final price
    // validatedData.price is now the AFTER-TAX price (editable by staff)
    // No need to multiply by 1.11 since it's already tax-inclusive
    const priceAfterTax = validatedData.price;
    const totalPrice = priceAfterTax * validatedData.quantity;
    const finalPrice = totalPrice - validatedData.discount;

    // Try to decrement inventory using the database function
    // IMPORTANT: Only decrement for the MAIN SOLD ITEM, NOT for gifts (Requirement 8.7, 8.8)
    // IMPORTANT: Only decrement for "in_store" inventory source, skip for "warehouse" (new requirement)
    // This handles locking and validation in a single atomic operation
    if (validatedData.inventory_source === 'in_store') {
      const { error: decrementError } = await supabase.rpc('decrement_inventory', {
        p_store_id: storeId,
        p_product_id: validatedData.product_id,
        p_qty: validatedData.quantity,
      });

      if (decrementError) {
        // Check if it's an insufficient stock error
        if (decrementError.message.includes('Insufficient stock')) {
          return {
            success: false,
            error: decrementError.message,
            code: ErrorCodes.INSUFFICIENT_STOCK,
          };
        }
        
        // For other errors, fall back to manual check
        const { data: inventory } = await supabase
          .from('inventory')
          .select('quantity')
          .eq('store_id', storeId)
          .eq('product_id', validatedData.product_id)
          .single();

        const currentStock = inventory?.quantity ?? 0;
        if (currentStock < validatedData.quantity) {
          return {
            success: false,
            error: `Insufficient stock. Available: ${currentStock}, Requested: ${validatedData.quantity}`,
            code: ErrorCodes.INSUFFICIENT_STOCK,
          };
        }

        // If stock check passes but decrement failed, try manual update
        if (inventory) {
          const { error: updateError } = await supabase
            .from('inventory')
            .update({ quantity: currentStock - validatedData.quantity })
            .eq('store_id', storeId)
            .eq('product_id', validatedData.product_id);

          if (updateError) {
            console.error('Error updating inventory:', updateError);
            return {
              success: false,
              error: 'Failed to update inventory',
              code: ErrorCodes.INTERNAL_ERROR,
            };
          }
        }
      }
    }
    // For warehouse sales, skip inventory deduction entirely

    // Prepare sale data
    // Use sale_date from form if provided, otherwise use today's date
    // Use local date to avoid timezone issues (e.g., UTC+7 showing previous day)
    let saleDate: string;
    if (validatedData.sale_date) {
      saleDate = validatedData.sale_date;
    } else {
      const today = new Date();
      saleDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    }
    
    const saleData: Record<string, unknown> = {
      store_id: storeId,
      product_id: validatedData.product_id,
      staff_id: validatedData.staff_id,
      quantity: validatedData.quantity,
      unit_price: validatedData.price,
      discount: validatedData.discount,
      total_price: finalPrice,
      sale_date: saleDate,
      created_by: user.id,
      // Inventory source tracking
      inventory_source: validatedData.inventory_source,
      // Customer info (Requirements: 8.4, 8.11)
      customer_name: validatedData.customer_name || null,
      customer_phone: validatedData.customer_phone || null,
      // Gift details JSONB (Requirements: 8.5, 8.9)
      gift_details: validatedData.gift_details || [],
    };

    // Insert sale with created_by tracking who submitted
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .insert(saleData)
      .select()
      .single();

    if (saleError) {
      console.error('Error creating sale:', saleError);
      // Note: Inventory was already decremented, ideally this should be in a transaction
      return {
        success: false,
        error: 'Failed to create sale',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }

    return { success: true, data: sale };
  } catch (error) {
    console.error('Unexpected error in createSale:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}

/**
 * Get sales for a specific store with optional date range filter
 * Requirements: 5.6
 * SECURITY: RLS enforces store-level access
 */
export async function getSalesForStore(
  storeId: string,
  dateRange?: { start_date?: string; end_date?: string }
): Promise<ActionResult<Sale[]>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return {
        success: false,
        error: 'You must be logged in to view sales',
        code: ErrorCodes.UNAUTHORIZED,
      };
    }

    // Validate filter
    const filterValidation = SalesFilterSchema.safeParse({
      store_id: storeId,
      ...dateRange,
    });

    if (!filterValidation.success) {
      const firstError = filterValidation.error.issues[0];
      return {
        success: false,
        error: firstError.message,
        code: ErrorCodes.VALIDATION_ERROR,
      };
    }

    const supabase = await createClient();

    let query = supabase
      .from('sales')
      .select('*')
      .eq('store_id', storeId)
      .order('sale_date', { ascending: false });

    if (dateRange?.start_date) {
      query = query.gte('sale_date', dateRange.start_date);
    }

    if (dateRange?.end_date) {
      query = query.lte('sale_date', dateRange.end_date);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching sales:', error);
      return {
        success: false,
        error: 'Failed to fetch sales',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }

    return { success: true, data: data || [] };
  } catch (error) {
    console.error('Unexpected error in getSalesForStore:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}

/**
 * Get sales for all assigned stores with optional filters
 * Requirements: 6.2, 6.5
 * SECURITY: RLS automatically filters by assigned stores
 * @param filters - Optional filters for store_id and date range
 * @returns Sales with store information
 */
export async function getSales(
  filters?: { 
    store_id?: string; 
    start_date?: string; 
    end_date?: string;
  }
): Promise<ActionResult<Sale[]>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return {
        success: false,
        error: 'You must be logged in to view sales',
        code: ErrorCodes.UNAUTHORIZED,
      };
    }

    // Validate filter if provided
    if (filters) {
      const filterValidation = SalesFilterSchema.safeParse(filters);
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

    // Query sales with store information
    // RLS will automatically filter by assigned stores
    let query = supabase
      .from('sales')
      .select(`
        *,
        store:stores!sales_store_id_fkey(id, name),
        product:products!sales_product_id_fkey(name, sku),
        staff:profiles!sales_staff_id_fkey(full_name)
      `)
      .order('sale_date', { ascending: false });

    // Apply optional store filter
    if (filters?.store_id) {
      query = query.eq('store_id', filters.store_id);
    }

    // Apply date range filters
    if (filters?.start_date) {
      query = query.gte('sale_date', filters.start_date);
    }

    if (filters?.end_date) {
      query = query.lte('sale_date', filters.end_date);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching sales:', error);
      return {
        success: false,
        error: 'Failed to fetch sales',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }

    return { success: true, data: data || [] };
  } catch (error) {
    console.error('Unexpected error in getSales:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}

// Legacy alias for backward compatibility
export const getSalesForBranch = getSalesForStore;

/**
 * Get current user's store ID
 * Helper for the sales input form
 */
export async function getCurrentUserStoreId(): Promise<ActionResult<string | null>> {
  try {
    const storeId = await getUserStoreId();
    return { success: true, data: storeId };
  } catch (error) {
    console.error('Unexpected error in getCurrentUserStoreId:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}

// Legacy alias
export const getCurrentUserBranchId = getCurrentUserStoreId;

/**
 * Get current user's profile for sales form
 * Includes session metadata for multi-store support
 */
export async function getCurrentUserProfile(): Promise<ActionResult<{ 
  id: string; 
  full_name: string; 
  store_id: string | null;
  role: string;
  current_store_id?: string;
  primary_store_id?: string;
}>> {
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
      .select('id, full_name, store_id, role')
      .eq('id', user.id)
      .single();

    if (error || !profile) {
      return {
        success: false,
        error: 'Profile not found',
        code: ErrorCodes.NOT_FOUND,
      };
    }

    // Include session metadata for multi-store support
    const currentStoreId = user.user_metadata?.current_store_id;
    const primaryStoreId = user.user_metadata?.primary_store_id;

    return { 
      success: true, 
      data: {
        ...profile,
        current_store_id: currentStoreId,
        primary_store_id: primaryStoreId,
      }
    };
  } catch (error) {
    console.error('Unexpected error in getCurrentUserProfile:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}

/**
 * Get assigned stores for current user
 * Requirements: 6.3
 * Returns list of stores for dropdowns in forms
 * @returns Array of stores ordered by name
 */
export async function getAssignedStores(): Promise<ActionResult<Array<{
  id: string;
  name: string;
}>>> {
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

    // Get user's assigned store IDs
    const { data: assignedStoreIds, error: storeIdsError } = await supabase.rpc(
      'get_user_store_ids',
      { user_id: user.id }
    );

    if (storeIdsError) {
      console.error('Error fetching assigned store IDs:', storeIdsError);
      return {
        success: false,
        error: 'Failed to fetch assigned stores',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }

    if (!assignedStoreIds || assignedStoreIds.length === 0) {
      return { success: true, data: [] };
    }

    // Fetch store details for assigned stores
    const { data: stores, error: storesError } = await supabase
      .from('stores')
      .select('id, name')
      .in('id', assignedStoreIds)
      .eq('is_active', true)
      .order('name');

    if (storesError) {
      console.error('Error fetching stores:', storesError);
      return {
        success: false,
        error: 'Failed to fetch stores',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }

    return { success: true, data: stores || [] };
  } catch (error) {
    console.error('Unexpected error in getAssignedStores:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}


// ============================================================================
// Sales Achievement Actions
// ============================================================================

/**
 * Get sales achievement data for all stores for a given month
 * Uses fiscal calendar for run rate calculations
 * Requirements: 5.1, 5.2, 5.7
 * @param monthStr - Month string in format "YYYY-MM" (e.g., "2026-03")
 * @returns Array of StoreAchievement with calculated metrics using fiscal calendar
 */
export async function getSalesAchievement(monthStr: string): Promise<ActionResult<StoreAchievement[]>> {
  try {
    // Validate input format (YYYY-MM)
    if (!/^\d{4}-\d{2}$/.test(monthStr)) {
      return {
        success: false,
        error: 'Invalid month format. Expected YYYY-MM (e.g., "2026-03")',
        code: ErrorCodes.VALIDATION_ERROR,
      };
    }

    const user = await getCurrentUser();
    if (!user) {
      return {
        success: false,
        error: 'You must be logged in to view sales achievement',
        code: ErrorCodes.UNAUTHORIZED,
      };
    }

    const supabase = await createClient();

    // Parse month string to get year and month
    const [year, month] = monthStr.split('-').map(Number);
    const monthIndex = month - 1; // Convert to 0-based index

    // Validate parsed values
    if (year < 2000 || year > 2100 || month < 1 || month > 12) {
      return {
        success: false,
        error: 'Invalid year or month value',
        code: ErrorCodes.VALIDATION_ERROR,
      };
    }

    // Calculate date range for the month (standard calendar for date filtering)
    const startOfMonth = new Date(year, monthIndex, 1);
    const endOfMonth = new Date(year, monthIndex + 1, 0);

    // Use local date format to avoid timezone issues (not toISOString which converts to UTC)
    const startDateStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}-01`;
    const endDateStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(endOfMonth.getDate()).padStart(2, '0')}`;

    // Get fiscal info for the start of the month to determine fiscal month/year
    const { data: fiscalData } = await supabase
      .from('fiscal_calendar')
      .select('fiscal_month, fiscal_year')
      .eq('date', startDateStr)
      .single();

    let fiscalMonth = monthIndex + 1; // Default to calendar month
    let fiscalYear = year;

    if (fiscalData) {
      fiscalMonth = fiscalData.fiscal_month;
      fiscalYear = fiscalData.fiscal_year;
    }

    // Get fiscal month info for run rate calculation
    const fiscalMonthInfo = await getFiscalMonthInfo(fiscalYear, fiscalMonth);

    let totalFiscalDays = endOfMonth.getDate(); // Fallback to calendar days
    let fiscalDaysElapsed = 0;

    // Use calendar dates for sales query (more reliable)
    const salesStartDate = startDateStr;
    const salesEndDate = endDateStr;

    if (fiscalMonthInfo) {
      totalFiscalDays = fiscalMonthInfo.totalDays;

      // Calculate days elapsed using fiscal calendar
      const today = new Date();
      // Use local date format to avoid timezone issues
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      if (todayStr >= fiscalMonthInfo.startDate && todayStr <= fiscalMonthInfo.endDate) {
        // Current fiscal month - get days elapsed up to today
        fiscalDaysElapsed = await getFiscalDaysElapsed(fiscalYear, fiscalMonth, todayStr);
      } else if (todayStr > fiscalMonthInfo.endDate) {
        // Past fiscal month - all days elapsed
        fiscalDaysElapsed = totalFiscalDays;
      } else {
        // Future fiscal month - no days elapsed
        fiscalDaysElapsed = 0;
      }
    } else {
      // Fallback to standard calendar calculation
      const today = new Date();
      if (year === today.getFullYear() && monthIndex === today.getMonth()) {
        fiscalDaysElapsed = today.getDate();
      } else if (startOfMonth > today) {
        fiscalDaysElapsed = 0;
      } else {
        fiscalDaysElapsed = totalFiscalDays;
      }
    }

    // Fetch stores with account info
    const { data: stores, error: storeError } = await supabase
      .from('stores')
      .select(`
        id,
        name,
        monthly_target,
        account_id,
        account:accounts(id, name)
      `)
      .eq('is_active', true)
      .order('name');

    if (storeError) {
      console.error('[getSalesAchievement] Error fetching stores:', storeError);
      return {
        success: false,
        error: 'Failed to fetch stores',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }

    // If stores table exists and has data, use new schema
    if (stores && stores.length > 0) {
      // Fetch both legacy sales and new transactions for the calendar month date range
      const [salesResult, transactionsResult] = await Promise.all([
        supabase
          .from('sales')
          .select('store_id, total_price, sale_date')
          .gte('sale_date', salesStartDate)
          .lte('sale_date', salesEndDate)
          .order('sale_date', { ascending: false }),
        supabase
          .from('transactions')
          .select('store_id, total_after_discount, transaction_date')
          .gte('transaction_date', salesStartDate)
          .lte('transaction_date', salesEndDate)
          .order('transaction_date', { ascending: false })
      ]);

      const { data: salesData, error: salesError } = salesResult;
      const { data: transactionsData, error: transactionsError } = transactionsResult;

      if (salesError || transactionsError) {
        console.error('[getSalesAchievement] Error fetching sales:', salesError || transactionsError);
        return {
          success: false,
          error: 'Failed to fetch sales data',
          code: ErrorCodes.INTERNAL_ERROR,
        };
      }

      // Aggregate sales by store from both sources
      const salesByStore: Record<string, number> = {};
      
      // Add legacy sales
      (salesData || []).forEach((sale) => {
        const storeId = sale.store_id;
        if (storeId) {
          const price = Number(sale.total_price || 0);
          salesByStore[storeId] = (salesByStore[storeId] || 0) + price;
        }
      });

      // Add new transactions
      (transactionsData || []).forEach((txn) => {
        const storeId = txn.store_id;
        if (storeId) {
          const price = Number(txn.total_after_discount || 0);
          salesByStore[storeId] = (salesByStore[storeId] || 0) + price;
        }
      });

      // Calculate achievement metrics for each store using fiscal calendar
      const achievements: StoreAchievement[] = stores.map((store) => {
        const sales = salesByStore[store.id] || 0;
        const target = Number(store.monthly_target) || 0;

        const achievementPct = calculateAchievementPct(sales, target);
        // Use fiscal calendar run rate calculation
        const runRate = calculateFiscalRunRate(sales, fiscalDaysElapsed, totalFiscalDays);
        const runRatePct = calculateRunRatePct(runRate, target);
        const status = getAchievementStatus(achievementPct);

        // Get account info
        const account = store.account as unknown as { id: string; name: string } | null;

        return {
          store_id: store.id,
          store_name: store.name,
          account_id: store.account_id || '',
          account_name: account?.name || '',
          sales,
          target,
          achievement_pct: achievementPct,
          run_rate: runRate,
          run_rate_pct: runRatePct,
          status,
        };
      });

      return { success: true, data: achievements };
    }

    // No stores found
    return { success: true, data: [] };
  } catch (error) {
    console.error('Unexpected error in getSalesAchievement:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}


// ============================================================================
// Staff Achievement Actions
// ============================================================================

/**
 * Get staff-level sales achievement for a given month.
 * Aggregates sales by staff_id across both sales and transactions tables.
 * Only staff who have sales OR a target set will appear.
 */
export async function getStaffAchievement(monthStr: string): Promise<ActionResult<import('@/types').StaffAchievement[]>> {
  try {
    if (!/^\d{4}-\d{2}$/.test(monthStr)) {
      return { success: false, error: 'Invalid month format. Expected YYYY-MM', code: ErrorCodes.VALIDATION_ERROR };
    }
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'You must be logged in', code: ErrorCodes.UNAUTHORIZED };
    }
    const supabase = await createClient();
    const [year, month] = monthStr.split('-').map(Number);
    const monthIndex = month - 1;
    const endOfMonth = new Date(year, monthIndex + 1, 0);
    const startDateStr = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(endOfMonth.getDate()).padStart(2, '0')}`;

    // Fiscal calendar for run rate
    const { data: fiscalData } = await supabase
      .from('fiscal_calendar')
      .select('fiscal_month, fiscal_year')
      .eq('date', startDateStr)
      .single();
    const fiscalMonth = fiscalData?.fiscal_month ?? month;
    const fiscalYear = fiscalData?.fiscal_year ?? year;
    const fiscalMonthInfo = await getFiscalMonthInfo(fiscalYear, fiscalMonth);
    let totalFiscalDays = endOfMonth.getDate();
    let fiscalDaysElapsed = 0;
    if (fiscalMonthInfo) {
      totalFiscalDays = fiscalMonthInfo.totalDays;
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      if (todayStr >= fiscalMonthInfo.startDate && todayStr <= fiscalMonthInfo.endDate) {
        fiscalDaysElapsed = await getFiscalDaysElapsed(fiscalYear, fiscalMonth, todayStr);
      } else if (todayStr > fiscalMonthInfo.endDate) {
        fiscalDaysElapsed = totalFiscalDays;
      }
    } else {
      const today = new Date();
      if (year === today.getFullYear() && monthIndex === today.getMonth()) {
        fiscalDaysElapsed = today.getDate();
      } else if (new Date(year, monthIndex, 1) <= today) {
        fiscalDaysElapsed = totalFiscalDays;
      }
    }

    // Fetch all active non-dealer staff
    const { data: staffList, error: staffError } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('is_active', true)
      .in('role', ['staff', 'manager', 'admin'])
      .order('full_name');
    if (staffError || !staffList) {
      return { success: false, error: 'Failed to fetch staff', code: ErrorCodes.INTERNAL_ERROR };
    }

    // Fetch sales, transactions, and targets in parallel
    const [salesResult, txnResult, targetsResult] = await Promise.all([
      supabase.from('sales').select('staff_id, total_price').gte('sale_date', startDateStr).lte('sale_date', endDateStr),
      supabase.from('transactions').select('staff_id, total_after_discount').gte('transaction_date', startDateStr).lte('transaction_date', endDateStr),
      supabase.from('staff_targets').select('staff_id, target').eq('year', year).eq('month', month),
    ]);

    if (salesResult.error || txnResult.error) {
      return { success: false, error: 'Failed to fetch sales data', code: ErrorCodes.INTERNAL_ERROR };
    }

    // Aggregate sales by staff
    const salesByStaff: Record<string, number> = {};
    (salesResult.data || []).forEach((s) => {
      if (s.staff_id) salesByStaff[s.staff_id] = (salesByStaff[s.staff_id] || 0) + Number(s.total_price || 0);
    });
    (txnResult.data || []).forEach((t) => {
      if (t.staff_id) salesByStaff[t.staff_id] = (salesByStaff[t.staff_id] || 0) + Number(t.total_after_discount || 0);
    });

    // Build targets map
    const targetsByStaff: Record<string, number> = {};
    (targetsResult.data || []).forEach((t) => {
      targetsByStaff[t.staff_id] = Number(t.target || 0);
    });

    // Only include staff who have sales or a target set
    const achievements: import('@/types').StaffAchievement[] = staffList
      .filter((s) => salesByStaff[s.id] !== undefined || targetsByStaff[s.id] !== undefined)
      .map((s) => {
        const sales = salesByStaff[s.id] || 0;
        const target = targetsByStaff[s.id] || 0;
        const achievementPct = calculateAchievementPct(sales, target);
        const runRate = calculateFiscalRunRate(sales, fiscalDaysElapsed, totalFiscalDays);
        const runRatePct = calculateRunRatePct(runRate, target);
        const status = getAchievementStatus(achievementPct);
        return { staff_id: s.id, staff_name: s.full_name, sales, target, achievement_pct: achievementPct, run_rate: runRate, run_rate_pct: runRatePct, status };
      });

    return { success: true, data: achievements };
  } catch (error) {
    console.error('Unexpected error in getStaffAchievement:', error);
    return { success: false, error: 'An unexpected error occurred', code: ErrorCodes.INTERNAL_ERROR };
  }
}

/**
 * Upsert a staff target for a given month.
 * Admin/Manager only.
 */
export async function upsertStaffTarget(staffId: string, monthStr: string, target: number): Promise<ActionResult<void>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'You must be logged in', code: ErrorCodes.UNAUTHORIZED };
    }
    const supabase = await createClient();
    const role = user.app_metadata?.role;
    if (!role || !['admin', 'manager'].includes(role)) {
      return { success: false, error: 'Only admin or manager can set staff targets', code: ErrorCodes.FORBIDDEN };
    }
    if (!/^\d{4}-\d{2}$/.test(monthStr)) {
      return { success: false, error: 'Invalid month format', code: ErrorCodes.VALIDATION_ERROR };
    }
    const [year, month] = monthStr.split('-').map(Number);
    const { error } = await supabase
      .from('staff_targets')
      .upsert({ staff_id: staffId, year, month, target }, { onConflict: 'staff_id,year,month' });
    if (error) {
      console.error('Error upserting staff target:', error);
      return { success: false, error: 'Failed to save target', code: ErrorCodes.INTERNAL_ERROR };
    }
    return { success: true, data: undefined };
  } catch (error) {
    console.error('Unexpected error in upsertStaffTarget:', error);
    return { success: false, error: 'An unexpected error occurred', code: ErrorCodes.INTERNAL_ERROR };
  }
}


// ============================================================================
// Weekly Sales Report Actions
// ============================================================================

/**
 * Get weekly sales report with detailed transaction data
 * Uses fiscal calendar for week determination
 * Requirements: 9.1, 9.2, 9.6, 15.1, 15.2, 15.3
 * - Admin/Manager: Can see all sales
 * - Staff: Can only see their own submissions (created_by = user.id)
 * @param filters - Optional filters for fiscal_week, fiscal_year, account, store, and staff
 * @returns WeeklySalesReport with items ordered by date ascending and totals
 */
export async function getWeeklySales(filters?: WeeklySalesFilter): Promise<ActionResult<WeeklySalesReport>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return {
        success: false,
        error: 'You must be logged in to view weekly sales',
        code: ErrorCodes.UNAUTHORIZED,
      };
    }

    const supabase = await createClient();
    
    // Get user role to determine access level
    const userRole = user.app_metadata?.role || 'staff';
    const isStaff = userRole === 'staff';

    // Get current fiscal period for default week
    const fiscalPeriod = await getCurrentFiscalPeriod();
    const defaultFiscalWeek = fiscalPeriod?.fiscal_week || 1;
    const defaultFiscalYear = fiscalPeriod?.fiscal_year || new Date().getFullYear();

    // Determine fiscal week and year to query
    const targetFiscalWeek = filters?.fiscal_week || defaultFiscalWeek;
    const targetFiscalYear = filters?.fiscal_year || defaultFiscalYear;

    // Get date range from fiscal_calendar for the target fiscal week
    // This ensures we use fiscal calendar week boundaries (Requirement 15.1)
    let startDate = filters?.start_date;
    let endDate = filters?.end_date;

    if (!startDate || !endDate) {
      // Get fiscal week date range from fiscal_calendar table
      const { data: fiscalWeekDates } = await supabase
        .from('fiscal_calendar')
        .select('date')
        .eq('fiscal_year', targetFiscalYear)
        .eq('fiscal_week', targetFiscalWeek)
        .order('date', { ascending: true });

      if (fiscalWeekDates && fiscalWeekDates.length > 0) {
        startDate = startDate || fiscalWeekDates[0].date;
        endDate = endDate || fiscalWeekDates[fiscalWeekDates.length - 1].date;
      }
    }

    // Build query with joins to get all required data
    // Try to use new schema (stores) first, fallback to legacy (branches)
    let query = supabase
      .from('sales')
      .select(`
        id,
        sale_date,
        quantity,
        unit_price,
        total_price,
        discount,
        gift_details,
        customer_name,
        customer_phone,
        store_id,
        created_by,
        staff:profiles!sales_staff_id_fkey(full_name),
        submitter:profiles!sales_created_by_fkey(full_name),
        store:stores!sales_store_id_fkey(name, account:accounts(name)),
        product:products!sales_product_id_fkey(name, sku, category, sub_category)
      `)
      .order('sale_date', { ascending: true });

    // Apply date filters based on fiscal week
    if (startDate) {
      query = query.gte('sale_date', startDate);
    }

    if (endDate) {
      query = query.lte('sale_date', endDate);
    }

    // Apply store filter
    if (filters?.store_id) {
      query = query.eq('store_id', filters.store_id);
    }

    if (filters?.staff_id) {
      query = query.eq('staff_id', filters.staff_id);
    }
    
    // Staff can only see their own submissions
    if (isStaff) {
      query = query.eq('created_by', user.id);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching weekly sales:', error);
      return {
        success: false,
        error: 'Failed to fetch weekly sales data',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }

    // Get fiscal week info for each sale date by joining with fiscal_calendar
    const saleDates = [...new Set((data || []).map(s => s.sale_date))];
    const fiscalWeekMap = new Map<string, number>();
    
    if (saleDates.length > 0) {
      const { data: fiscalData } = await supabase
        .from('fiscal_calendar')
        .select('date, fiscal_week')
        .in('date', saleDates);
      
      if (fiscalData) {
        fiscalData.forEach(fd => {
          fiscalWeekMap.set(fd.date, fd.fiscal_week);
        });
      }
    }

    // Get store info if store_id is present (for new schema)
    const storeIds = [...new Set((data || []).filter(s => s.store_id).map(s => s.store_id))];
    const storeMap = new Map<string, { name: string; account_name: string }>();
    
    if (storeIds.length > 0) {
      const { data: storeData } = await supabase
        .from('stores')
        .select(`
          id,
          name,
          account:accounts(name)
        `)
        .in('id', storeIds);
      
      if (storeData) {
        storeData.forEach(store => {
          const account = store.account as unknown as { name: string } | null;
          storeMap.set(store.id, {
            name: store.name,
            account_name: account?.name || '',
          });
        });
      }
    }

    // Filter by account_id if provided
    let filteredData = data || [];
    if (filters?.account_id && storeIds.length > 0) {
      // Get stores for the account
      const { data: accountStores } = await supabase
        .from('stores')
        .select('id')
        .eq('account_id', filters.account_id);
      
      const accountStoreIds = new Set((accountStores || []).map(s => s.id));
      filteredData = filteredData.filter(sale => 
        sale.store_id && accountStoreIds.has(sale.store_id)
      );
    }

    // Transform data to WeeklySalesItem format
    const items: WeeklySalesItem[] = filteredData.map((sale) => {
      // Supabase returns single objects for foreign key relations
      const staff = sale.staff as unknown as { full_name: string } | null;
      const submitter = sale.submitter as unknown as { full_name: string } | null;
      const store = sale.store as unknown as { name: string; account: { name: string } | null } | null;
      const product = sale.product as unknown as { name: string; sku: string; category?: string; sub_category?: string } | null;

      // Use store info from join or from storeMap
      const storeInfo = sale.store_id ? storeMap.get(sale.store_id) : null;
      const accountName = store?.account?.name || storeInfo?.account_name || '';
      const storeName = store?.name || storeInfo?.name || 'Unknown';

      // Use new schema columns
      const unitPrice = sale.unit_price ?? 0;
      const totalPrice = sale.total_price ?? 0;

      return {
        id: sale.id,
        sale_date: sale.sale_date,
        fiscal_week: fiscalWeekMap.get(sale.sale_date) || targetFiscalWeek,
        staff_name: staff?.full_name || 'Unknown',
        submitted_by: submitter?.full_name || staff?.full_name || 'Unknown',
        account_name: accountName,
        store_name: storeName,
        sku: product?.sku || '',
        category: product?.category || '',
        sub_category: product?.sub_category || '',
        product_name: product?.name || 'Unknown',
        quantity: sale.quantity,
        unit_price: Number(unitPrice),
        discount: Number(sale.discount),
        total_price: Number(totalPrice),
        customer_name: sale.customer_name || null,
        customer_phone: sale.customer_phone || null,
        gift_details: sale.gift_details as unknown as GiftItem[] || [],
        // Legacy fields for backward compatibility
        account: accountName || null,
        branch_name: storeName,
        item_name: product?.name || 'Unknown',
        price: Number(unitPrice),
        final_price: Number(totalPrice),
        gift: null,
      };
    });

    // Calculate totals
    const totals: WeeklySalesTotals = items.reduce(
      (acc, item) => ({
        total_quantity: acc.total_quantity + item.quantity,
        total_revenue: acc.total_revenue + (item.total_price || 0),
        total_discount: acc.total_discount + item.discount,
      }),
      { total_quantity: 0, total_revenue: 0, total_discount: 0 }
    );

    return {
      success: true,
      data: { 
        items, 
        totals,
        fiscal_week: targetFiscalWeek,
        fiscal_year: targetFiscalYear,
        start_date: startDate,
        end_date: endDate,
      },
    };
  } catch (error) {
    console.error('Unexpected error in getWeeklySales:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}

/**
 * Get available fiscal weeks for a given year (for dropdown selector)
 * Requirements: 15.4
 */
export async function getFiscalWeeksForReport(fiscalYear: number): Promise<ActionResult<{ week: number; startDate: string; endDate: string }[]>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return {
        success: false,
        error: 'You must be logged in',
        code: ErrorCodes.UNAUTHORIZED,
      };
    }

    const weeks = await getFiscalWeeksForYear(fiscalYear);
    return { success: true, data: weeks };
  } catch (error) {
    console.error('Unexpected error in getFiscalWeeksForReport:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}

/**
 * Delete a sale record (admin/manager only)
 * Note: This does NOT restore inventory - it's a permanent delete
 */
export async function deleteSale(saleId: string): Promise<ActionResult<void>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return {
        success: false,
        error: 'You must be logged in to delete a sale',
        code: ErrorCodes.UNAUTHORIZED,
      };
    }

    // Check user role - only admin/manager can delete
    const role = user.app_metadata?.role;
    if (!['admin', 'manager'].includes(role)) {
      return {
        success: false,
        error: 'Access denied. Only admin or manager can delete sales.',
        code: ErrorCodes.FORBIDDEN,
      };
    }

    const supabase = await createClient();

    // Verify the sale exists
    const { data: sale, error: fetchError } = await supabase
      .from('sales')
      .select('id')
      .eq('id', saleId)
      .single();

    if (fetchError || !sale) {
      return {
        success: false,
        error: 'Sale not found',
        code: ErrorCodes.NOT_FOUND,
      };
    }

    // Delete the sale
    const { error: deleteError } = await supabase
      .from('sales')
      .delete()
      .eq('id', saleId);

    if (deleteError) {
      console.error('Error deleting sale:', deleteError);
      return {
        success: false,
        error: 'Failed to delete sale',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }

    return { success: true, data: undefined };
  } catch (error) {
    console.error('Unexpected error in deleteSale:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}

/**
 * Get transaction-grouped weekly sales data
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 * 
 * This function fetches sales data from the unified_sales_export view and groups by transactions.
 * - For new transactions: groups all items by transaction_id
 * - For legacy sales: treats each sale as a single-item transaction
 * 
 * Access control:
 * - Admin/Manager: Can see all transactions
 * - Staff: Can only see their own submissions
 */
export async function getTransactionGroupedWeeklySales(
  filters?: WeeklySalesFilter
): Promise<ActionResult<TransactionGroupedReport>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return {
        success: false,
        error: 'You must be logged in to view weekly sales',
        code: ErrorCodes.UNAUTHORIZED,
      };
    }

    const supabase = await createClient();
    
    // Get user role to determine access level
    const userRole = user.app_metadata?.role || 'staff';
    const isStaff = userRole === 'staff';

    // Get current fiscal period for default week
    const fiscalPeriod = await getCurrentFiscalPeriod();
    const defaultFiscalWeek = fiscalPeriod?.fiscal_week || 1;
    const defaultFiscalYear = fiscalPeriod?.fiscal_year || new Date().getFullYear();

    // Determine fiscal week and year to query
    const targetFiscalWeek = filters?.fiscal_week || defaultFiscalWeek;
    const targetFiscalYear = filters?.fiscal_year || defaultFiscalYear;

    // Get date range from fiscal_calendar for the target fiscal week
    let startDate = filters?.start_date;
    let endDate = filters?.end_date;

    if (!startDate || !endDate) {
      // Get fiscal week date range from fiscal_calendar table
      const { data: fiscalWeekDates } = await supabase
        .from('fiscal_calendar')
        .select('date')
        .eq('fiscal_year', targetFiscalYear)
        .eq('fiscal_week', targetFiscalWeek)
        .order('date', { ascending: true });

      if (fiscalWeekDates && fiscalWeekDates.length > 0) {
        startDate = startDate || fiscalWeekDates[0].date;
        endDate = endDate || fiscalWeekDates[fiscalWeekDates.length - 1].date;
      }
    }

    // Build query from unified_sales_export view
    let query = supabase
      .from('unified_sales_export')
      .select('*')
      .order('sale_date', { ascending: true })
      .order('transaction_id', { ascending: true });

    // Apply date filters
    if (startDate) {
      query = query.gte('sale_date', startDate);
    }
    if (endDate) {
      query = query.lte('sale_date', endDate);
    }

    // Apply store filter
    if (filters?.store_id) {
      query = query.eq('store_id', filters.store_id);
    }

    // Apply staff filter
    if (filters?.staff_id) {
      query = query.eq('staff_id', filters.staff_id);
    }

    // Staff can only see their own submissions
    // Note: unified_sales_export doesn't have created_by, so we filter by staff_id
    if (isStaff) {
      query = query.eq('staff_id', user.id);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching transaction-grouped weekly sales:', error);
      return {
        success: false,
        error: 'Failed to fetch weekly sales data',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }

    // Filter by account_id if provided
    let filteredData = data || [];
    if (filters?.account_id) {
      // Get stores for the account
      const { data: accountStores } = await supabase
        .from('stores')
        .select('id')
        .eq('account_id', filters.account_id);
      
      const accountStoreIds = new Set((accountStores || []).map(s => s.id));
      filteredData = filteredData.filter(item => 
        item.store_id && accountStoreIds.has(item.store_id)
      );
    }

    // Group by transaction_id (null for legacy sales)
    const transactionMap = new Map<string, TransactionGroupItem>();
    
    filteredData.forEach((item) => {
      // Use transaction_id as key, or generate unique key for legacy sales
      const key = item.transaction_id || `legacy-${item.id}`;
      
      // Convert to WeeklySalesItem format
      const salesItem: WeeklySalesItem = {
        id: item.id,
        sale_date: item.sale_date,
        fiscal_week: item.fiscal_week || targetFiscalWeek,
        staff_name: item.staff_name,
        submitted_by: item.staff_name,
        account_name: item.account_name || '',
        store_name: item.store_name,
        sku: item.sku,
        category: item.category || '',
        sub_category: item.sub_category || '',
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: Number(item.unit_price),
        discount: Number(item.discount),
        total_price: Number(item.total_price),
        customer_name: item.customer_name,
        customer_phone: item.customer_phone,
        gift_details: (item.gift_details as GiftItem[]) || [],
        gift: item.gift,
      };

      if (transactionMap.has(key)) {
        // Add to existing transaction group
        const group = transactionMap.get(key)!;
        group.items.push(salesItem);
        group.item_count += 1;
        group.total_quantity += item.quantity;
        group.total_discount += Number(item.discount);
        group.total_after_discount += Number(item.total_price);
        group.total_before_discount += Number(item.total_price) + Number(item.discount);
      } else {
        // Create new transaction group
        transactionMap.set(key, {
          transaction_id: item.transaction_id,
          sale_date: item.sale_date,
          fiscal_week: item.fiscal_week || targetFiscalWeek,
          staff_name: item.staff_name,
          account_name: item.account_name || '',
          store_name: item.store_name,
          customer_name: item.customer_name,
          customer_phone: item.customer_phone,
          item_count: 1,
          total_quantity: item.quantity,
          total_before_discount: Number(item.total_price) + Number(item.discount),
          total_discount: Number(item.discount),
          total_after_discount: Number(item.total_price),
          items: [salesItem],
          source_type: item.source_type as 'transaction' | 'legacy',
        });
      }
    });

    // Convert map to array
    const transactions = Array.from(transactionMap.values());

    // Calculate totals
    const totalTransactions = transactions.length;
    const totalQuantity = transactions.reduce((sum, t) => sum + t.total_quantity, 0);
    const totalRevenue = transactions.reduce((sum, t) => sum + t.total_after_discount, 0);
    const totalDiscount = transactions.reduce((sum, t) => sum + t.total_discount, 0);
    const totalItems = transactions.reduce((sum, t) => sum + t.item_count, 0);
    const averageTransactionValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

    return {
      success: true,
      data: {
        transactions,
        totals: {
          total_transactions: totalTransactions,
          total_quantity: totalQuantity,
          total_revenue: totalRevenue,
          total_discount: totalDiscount,
          total_items: totalItems,
          average_transaction_value: averageTransactionValue,
        },
        fiscal_week: targetFiscalWeek,
        fiscal_year: targetFiscalYear,
        start_date: startDate,
        end_date: endDate,
      },
    };
  } catch (error) {
    console.error('Unexpected error in getTransactionGroupedWeeklySales:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}
