'use server';

import { createClient } from '@/lib/supabase/server';
import { DashboardMetrics, ProductPerformance, CategoryGMV, ProvinceData, FiscalPeriod, AccountGMV, StoreGMV } from '@/types';
import {
  getCurrentFiscalPeriod,
  getFiscalWeekInfo,
  getFiscalMonthInfo,
} from '@/lib/fiscal-calendar';
import { calculateFiscalRunRate } from '@/lib/fiscal-calculations';

// ============================================================================
// Types (not exported from 'use server' file)
// ============================================================================

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

export interface DateRange {
  start_date: string;
  end_date: string;
  account_id?: string;
  store_id?: string;
}

export interface GMVTrend {
  period: string;
  fiscal_week?: number;
  fiscal_month?: number;
  fiscal_year?: number;
  gmv: number;
  change_pct: number;
}

export interface GMVTrends {
  weekly: GMVTrend[];
  monthly: GMVTrend[];
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

function calculatePercentageChange(current: number, previous: number): number {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }
  return ((current - previous) / previous) * 100;
}

/**
 * Get fiscal week date range from fiscal_calendar table
 */
async function getFiscalWeekRange(fiscalYear: number, fiscalWeek: number): Promise<DateRange | null> {
  const weekInfo = await getFiscalWeekInfo(fiscalYear, fiscalWeek);
  if (!weekInfo) return null;
  
  return {
    start_date: weekInfo.startDate,
    end_date: weekInfo.endDate,
  };
}

/**
 * Get fiscal month date range from fiscal_calendar table
 */
async function getFiscalMonthRange(fiscalYear: number, fiscalMonth: number): Promise<DateRange | null> {
  const monthInfo = await getFiscalMonthInfo(fiscalYear, fiscalMonth);
  if (!monthInfo) return null;
  
  return {
    start_date: monthInfo.startDate,
    end_date: monthInfo.endDate,
  };
}

// ============================================================================
// Dashboard Actions
// ============================================================================

/**
 * Get dashboard metrics for a given date range
 * Uses fiscal calendar for run rate calculations
 * Requirements: 5.2, 14.2, 5.7, 14.6
 */
export async function getDashboardMetrics(dateRange: DateRange): Promise<ActionResult<DashboardMetrics>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return {
        success: false,
        error: 'You must be logged in to view dashboard metrics',
        code: ErrorCodes.UNAUTHORIZED,
      };
    }

    const supabase = await createClient();

    // Fetch from both legacy sales and new transactions tables
    // Legacy sales query
    let legacySalesQuery = supabase
      .from('sales')
      .select('total_price, quantity, store_id, stores(account_id)')
      .gte('sale_date', dateRange.start_date)
      .lte('sale_date', dateRange.end_date);

    if (dateRange.store_id) {
      legacySalesQuery = legacySalesQuery.eq('store_id', dateRange.store_id);
    } else if (dateRange.account_id) {
      legacySalesQuery = legacySalesQuery.eq('stores.account_id', dateRange.account_id);
    }

    // New transactions query
    let transactionsQuery = supabase
      .from('transactions')
      .select('id, total_after_discount, store_id, stores(account_id)')
      .gte('transaction_date', dateRange.start_date)
      .lte('transaction_date', dateRange.end_date);

    if (dateRange.store_id) {
      transactionsQuery = transactionsQuery.eq('store_id', dateRange.store_id);
    } else if (dateRange.account_id) {
      transactionsQuery = transactionsQuery.eq('stores.account_id', dateRange.account_id);
    }

    const [legacyResult, transactionsResult] = await Promise.all([
      legacySalesQuery,
      transactionsQuery
    ]);

    const { data: legacySales, error: legacyError } = legacyResult;
    const { data: newTransactions, error: transactionsError } = transactionsResult;

    const currentError = legacyError || transactionsError;

    if (currentError) {
      console.error('Error fetching sales data:', currentError);
      return {
        success: false,
        error: 'Failed to fetch sales data',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }

    // Calculate current period metrics from both sources
    // Legacy sales: sum total_price
    const legacyGmv = (legacySales || []).reduce((sum, sale) => sum + Number(sale.total_price), 0);
    const legacyOrderCount = (legacySales || []).length;
    const legacyQtySold = (legacySales || []).reduce((sum, sale) => sum + sale.quantity, 0);

    // New transactions: sum total_after_discount
    const transactionsGmv = (newTransactions || []).reduce((sum, txn) => sum + Number(txn.total_after_discount), 0);
    const transactionsOrderCount = (newTransactions || []).length;

    // For qty_sold from transactions, we need to query transaction_items
    let transactionsQtySold = 0;
    if (newTransactions && newTransactions.length > 0) {
      const transactionIds = newTransactions.map(t => t.id);
      const { data: items } = await supabase
        .from('transaction_items')
        .select('quantity')
        .in('transaction_id', transactionIds);
      transactionsQtySold = (items || []).reduce((sum, item) => sum + item.quantity, 0);
    }

    // Combine metrics
    const totalGmv = legacyGmv + transactionsGmv;
    const orderCount = legacyOrderCount + transactionsOrderCount;
    const qtySold = legacyQtySold + transactionsQtySold;
    const avgOrderValue = orderCount > 0 ? totalGmv / orderCount : 0;

    // Calculate previous period for comparison
    const startDate = new Date(dateRange.start_date);
    const endDate = new Date(dateRange.end_date);
    const periodDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    const prevStartDate = new Date(startDate);
    prevStartDate.setDate(prevStartDate.getDate() - periodDays);
    const prevEndDate = new Date(startDate);
    prevEndDate.setDate(prevEndDate.getDate() - 1);

    // Query both legacy sales and transactions for previous period
    const [prevLegacyResult, prevTransactionsResult] = await Promise.all([
      supabase
        .from('sales')
        .select('total_price')
        .gte('sale_date', prevStartDate.toISOString().split('T')[0])
        .lte('sale_date', prevEndDate.toISOString().split('T')[0]),
      supabase
        .from('transactions')
        .select('total_after_discount')
        .gte('transaction_date', prevStartDate.toISOString().split('T')[0])
        .lte('transaction_date', prevEndDate.toISOString().split('T')[0])
    ]);

    const prevLegacyGmv = (prevLegacyResult.data || []).reduce((sum, sale) => sum + Number(sale.total_price), 0);
    const prevTransactionsGmv = (prevTransactionsResult.data || []).reduce((sum, txn) => sum + Number(txn.total_after_discount), 0);
    const prevGmv = prevLegacyGmv + prevTransactionsGmv;
    const gmvChangePct = calculatePercentageChange(totalGmv, prevGmv);

    // Get current fiscal period for weekly/monthly calculations
    const fiscalPeriod = await getCurrentFiscalPeriod();
    
    let weeklyGmv = 0;
    let weeklyGmvChangePct = 0;
    let monthlyGmv = 0;
    let monthlyGmvChangePct = 0;

    if (fiscalPeriod) {
      // Get current fiscal week GMV
      const currentWeekRange = await getFiscalWeekRange(fiscalPeriod.fiscal_year, fiscalPeriod.fiscal_week);
      if (currentWeekRange) {
        const [weekLegacyResult, weekTransactionsResult] = await Promise.all([
          supabase
            .from('sales')
            .select('total_price')
            .gte('sale_date', currentWeekRange.start_date)
            .lte('sale_date', currentWeekRange.end_date),
          supabase
            .from('transactions')
            .select('total_after_discount')
            .gte('transaction_date', currentWeekRange.start_date)
            .lte('transaction_date', currentWeekRange.end_date)
        ]);

        const weekLegacyGmv = (weekLegacyResult.data || []).reduce((sum, sale) => sum + Number(sale.total_price), 0);
        const weekTransactionsGmv = (weekTransactionsResult.data || []).reduce((sum, txn) => sum + Number(txn.total_after_discount), 0);
        weeklyGmv = weekLegacyGmv + weekTransactionsGmv;

        // Get previous fiscal week for comparison
        const prevWeek = fiscalPeriod.fiscal_week > 1 ? fiscalPeriod.fiscal_week - 1 : 52;
        const prevWeekYear = fiscalPeriod.fiscal_week > 1 ? fiscalPeriod.fiscal_year : fiscalPeriod.fiscal_year - 1;
        const prevWeekRange = await getFiscalWeekRange(prevWeekYear, prevWeek);
        
        if (prevWeekRange) {
          const [prevWeekLegacyResult, prevWeekTransactionsResult] = await Promise.all([
            supabase
              .from('sales')
              .select('total_price')
              .gte('sale_date', prevWeekRange.start_date)
              .lte('sale_date', prevWeekRange.end_date),
            supabase
              .from('transactions')
              .select('total_after_discount')
              .gte('transaction_date', prevWeekRange.start_date)
              .lte('transaction_date', prevWeekRange.end_date)
          ]);

          const prevWeekLegacyGmv = (prevWeekLegacyResult.data || []).reduce((sum, sale) => sum + Number(sale.total_price), 0);
          const prevWeekTransactionsGmv = (prevWeekTransactionsResult.data || []).reduce((sum, txn) => sum + Number(txn.total_after_discount), 0);
          const prevWeeklyGmv = prevWeekLegacyGmv + prevWeekTransactionsGmv;
          weeklyGmvChangePct = calculatePercentageChange(weeklyGmv, prevWeeklyGmv);
        }
      }

      // Get current fiscal month GMV
      const currentMonthRange = await getFiscalMonthRange(fiscalPeriod.fiscal_year, fiscalPeriod.fiscal_month);
      if (currentMonthRange) {
        const [monthLegacyResult, monthTransactionsResult] = await Promise.all([
          supabase
            .from('sales')
            .select('total_price')
            .gte('sale_date', currentMonthRange.start_date)
            .lte('sale_date', currentMonthRange.end_date),
          supabase
            .from('transactions')
            .select('total_after_discount')
            .gte('transaction_date', currentMonthRange.start_date)
            .lte('transaction_date', currentMonthRange.end_date)
        ]);

        const monthLegacyGmv = (monthLegacyResult.data || []).reduce((sum, sale) => sum + Number(sale.total_price), 0);
        const monthTransactionsGmv = (monthTransactionsResult.data || []).reduce((sum, txn) => sum + Number(txn.total_after_discount), 0);
        monthlyGmv = monthLegacyGmv + monthTransactionsGmv;

        // Get previous fiscal month for comparison
        const prevMonth = fiscalPeriod.fiscal_month > 1 ? fiscalPeriod.fiscal_month - 1 : 12;
        const prevMonthYear = fiscalPeriod.fiscal_month > 1 ? fiscalPeriod.fiscal_year : fiscalPeriod.fiscal_year - 1;
        const prevMonthRange = await getFiscalMonthRange(prevMonthYear, prevMonth);
        
        if (prevMonthRange) {
          const [prevMonthLegacyResult, prevMonthTransactionsResult] = await Promise.all([
            supabase
              .from('sales')
              .select('total_price')
              .gte('sale_date', prevMonthRange.start_date)
              .lte('sale_date', prevMonthRange.end_date),
            supabase
              .from('transactions')
              .select('total_after_discount')
              .gte('transaction_date', prevMonthRange.start_date)
              .lte('transaction_date', prevMonthRange.end_date)
          ]);

          const prevMonthLegacyGmv = (prevMonthLegacyResult.data || []).reduce((sum, sale) => sum + Number(sale.total_price), 0);
          const prevMonthTransactionsGmv = (prevMonthTransactionsResult.data || []).reduce((sum, txn) => sum + Number(txn.total_after_discount), 0);
          const prevMonthlyGmv = prevMonthLegacyGmv + prevMonthTransactionsGmv;
          monthlyGmvChangePct = calculatePercentageChange(monthlyGmv, prevMonthlyGmv);
        }
      }
    }

    return {
      success: true,
      data: {
        total_gmv: totalGmv,
        gmv_change_pct: gmvChangePct,
        order_count: orderCount,
        qty_sold: qtySold,
        avg_order_value: avgOrderValue,
        weekly_gmv: weeklyGmv,
        weekly_gmv_change_pct: weeklyGmvChangePct,
        monthly_gmv: monthlyGmv,
        monthly_gmv_change_pct: monthlyGmvChangePct,
      },
    };
  } catch (error) {
    console.error('Unexpected error in getDashboardMetrics:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}

/**
 * Get GMV trends (weekly and monthly) using fiscal calendar grouping
 * OPTIMIZED: Fetches all sales in one query and groups client-side
 * Requirements: 5.2, 14.2
 */
export async function getGMVTrends(dateRange: DateRange): Promise<ActionResult<GMVTrends>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return {
        success: false,
        error: 'You must be logged in to view GMV trends',
        code: ErrorCodes.UNAUTHORIZED,
      };
    }

    const supabase = await createClient();

    // Get current fiscal period
    const fiscalPeriod = await getCurrentFiscalPeriod();
    if (!fiscalPeriod) {
      return {
        success: false,
        error: 'Unable to determine fiscal period',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }

    // Calculate date range for last 8 weeks (covers both weekly and monthly trends)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 180); // ~6 months back

    // Build query with optional account/store filtering for legacy sales
    let salesQuery = supabase
      .from('sales')
      .select('sale_date, total_price, store_id, stores(account_id)')
      .gte('sale_date', startDate.toISOString().split('T')[0])
      .lte('sale_date', endDate.toISOString().split('T')[0]);

    if (dateRange.store_id) {
      salesQuery = salesQuery.eq('store_id', dateRange.store_id);
    } else if (dateRange.account_id) {
      salesQuery = salesQuery.eq('stores.account_id', dateRange.account_id);
    }

    // Build query for new transactions
    let transactionsQuery = supabase
      .from('transactions')
      .select('transaction_date, total_after_discount, store_id, stores(account_id)')
      .gte('transaction_date', startDate.toISOString().split('T')[0])
      .lte('transaction_date', endDate.toISOString().split('T')[0]);

    if (dateRange.store_id) {
      transactionsQuery = transactionsQuery.eq('store_id', dateRange.store_id);
    } else if (dateRange.account_id) {
      transactionsQuery = transactionsQuery.eq('stores.account_id', dateRange.account_id);
    }

    const [salesResult, transactionsResult] = await Promise.all([
      salesQuery,
      transactionsQuery
    ]);

    const { data: allSales, error: salesError } = salesResult;
    const { data: allTransactions, error: transactionsError } = transactionsResult;

    if (salesError || transactionsError) {
      console.error('Error fetching sales for trends:', salesError || transactionsError);
      return {
        success: false,
        error: 'Failed to fetch sales data',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }

    // Fetch fiscal calendar data for the period
    const { data: fiscalData } = await supabase
      .from('fiscal_calendar')
      .select('date, fiscal_week, fiscal_month, fiscal_year')
      .gte('date', startDate.toISOString().split('T')[0])
      .lte('date', endDate.toISOString().split('T')[0]);

    // Create lookup map for fiscal periods
    const fiscalLookup = new Map<string, { fiscal_week: number; fiscal_month: number; fiscal_year: number }>();
    (fiscalData || []).forEach(row => {
      fiscalLookup.set(row.date, {
        fiscal_week: row.fiscal_week,
        fiscal_month: row.fiscal_month,
        fiscal_year: row.fiscal_year,
      });
    });

    // Group sales by fiscal week and month
    const weeklyMap = new Map<string, number>();
    const monthlyMap = new Map<string, number>();

    // Process legacy sales
    (allSales || []).forEach(sale => {
      const fiscal = fiscalLookup.get(sale.sale_date);
      if (!fiscal) return;

      const weekKey = `${fiscal.fiscal_year}-W${fiscal.fiscal_week}`;
      const monthKey = `${fiscal.fiscal_year}-M${fiscal.fiscal_month}`;

      weeklyMap.set(weekKey, (weeklyMap.get(weekKey) || 0) + Number(sale.total_price));
      monthlyMap.set(monthKey, (monthlyMap.get(monthKey) || 0) + Number(sale.total_price));
    });

    // Process new transactions
    (allTransactions || []).forEach(txn => {
      const fiscal = fiscalLookup.get(txn.transaction_date);
      if (!fiscal) return;

      const weekKey = `${fiscal.fiscal_year}-W${fiscal.fiscal_week}`;
      const monthKey = `${fiscal.fiscal_year}-M${fiscal.fiscal_month}`;

      weeklyMap.set(weekKey, (weeklyMap.get(weekKey) || 0) + Number(txn.total_after_discount));
      monthlyMap.set(monthKey, (monthlyMap.get(monthKey) || 0) + Number(txn.total_after_discount));
    });

    // Build weekly trends (last 8 weeks)
    const weeklyTrends: GMVTrend[] = [];
    for (let i = 7; i >= 0; i--) {
      let targetWeek = fiscalPeriod.fiscal_week - i;
      let targetYear = fiscalPeriod.fiscal_year;
      
      while (targetWeek <= 0) {
        targetYear--;
        targetWeek += 52;
      }

      const weekKey = `${targetYear}-W${targetWeek}`;
      const gmv = weeklyMap.get(weekKey) || 0;

      // Get previous week for comparison
      let prevWeek = targetWeek - 1;
      let prevYear = targetYear;
      if (prevWeek <= 0) {
        prevYear--;
        prevWeek += 52;
      }
      const prevWeekKey = `${prevYear}-W${prevWeek}`;
      const prevGmv = weeklyMap.get(prevWeekKey) || 0;

      weeklyTrends.push({
        period: `FW${targetWeek}`,
        fiscal_week: targetWeek,
        fiscal_year: targetYear,
        gmv,
        change_pct: calculatePercentageChange(gmv, prevGmv),
      });
    }

    // Build monthly trends (last 6 months)
    const monthlyTrends: GMVTrend[] = [];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    for (let i = 5; i >= 0; i--) {
      let targetMonth = fiscalPeriod.fiscal_month - i;
      let targetYear = fiscalPeriod.fiscal_year;
      
      while (targetMonth <= 0) {
        targetYear--;
        targetMonth += 12;
      }

      const monthKey = `${targetYear}-M${targetMonth}`;
      const gmv = monthlyMap.get(monthKey) || 0;

      // Get previous month for comparison
      let prevMonth = targetMonth - 1;
      let prevYear = targetYear;
      if (prevMonth <= 0) {
        prevYear--;
        prevMonth += 12;
      }
      const prevMonthKey = `${prevYear}-M${prevMonth}`;
      const prevGmv = monthlyMap.get(prevMonthKey) || 0;

      monthlyTrends.push({
        period: `${monthNames[targetMonth - 1]} ${targetYear}`,
        fiscal_month: targetMonth,
        fiscal_year: targetYear,
        gmv,
        change_pct: calculatePercentageChange(gmv, prevGmv),
      });
    }

    return {
      success: true,
      data: {
        weekly: weeklyTrends,
        monthly: monthlyTrends,
      },
    };
  } catch (error) {
    console.error('Unexpected error in getGMVTrends:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}

/**
 * Get top products by GMV
 * Requirements: 8.3
 */
export async function getProductPerformance(dateRange: DateRange): Promise<ActionResult<ProductPerformance[]>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return {
        success: false,
        error: 'You must be logged in to view product performance',
        code: ErrorCodes.UNAUTHORIZED,
      };
    }

    const supabase = await createClient();

    // Use unified_sales_export view which combines both legacy sales and new transactions
    let salesQuery = supabase
      .from('unified_sales_export')
      .select(`
        product_id,
        total_price,
        quantity,
        store_id,
        account_name,
        product_name,
        sku
      `)
      .gte('sale_date', dateRange.start_date)
      .lte('sale_date', dateRange.end_date);

    // Apply store filter if provided
    if (dateRange.store_id) {
      salesQuery = salesQuery.eq('store_id', dateRange.store_id);
    } else if (dateRange.account_id) {
      // For account filter, we filter by account_name since it's already joined in the view
      const { data: accounts } = await supabase
        .from('accounts')
        .select('name')
        .eq('id', dateRange.account_id)
        .single();
      if (accounts) {
        salesQuery = salesQuery.eq('account_name', accounts.name);
      }
    }

    const { data: sales, error: salesError } = await salesQuery;

    if (salesError) {
      console.error('Error fetching sales for product performance:', salesError);
      return {
        success: false,
        error: 'Failed to fetch product performance data',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }

    // Calculate previous period for delta
    const startDate = new Date(dateRange.start_date);
    const endDate = new Date(dateRange.end_date);
    const periodDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    const prevStartDate = new Date(startDate);
    prevStartDate.setDate(prevStartDate.getDate() - periodDays);
    const prevEndDate = new Date(startDate);
    prevEndDate.setDate(prevEndDate.getDate() - 1);

    // Build previous period query with same filters using unified view
    let prevQuery = supabase
      .from('unified_sales_export')
      .select('product_id, quantity')
      .gte('sale_date', prevStartDate.toISOString().split('T')[0])
      .lte('sale_date', prevEndDate.toISOString().split('T')[0]);

    if (dateRange.store_id) {
      prevQuery = prevQuery.eq('store_id', dateRange.store_id);
    } else if (dateRange.account_id) {
      const { data: accounts } = await supabase
        .from('accounts')
        .select('name')
        .eq('id', dateRange.account_id)
        .single();
      if (accounts) {
        prevQuery = prevQuery.eq('account_name', accounts.name);
      }
    }

    const { data: prevSales } = await prevQuery;

    // Aggregate by product
    const productMap = new Map<string, { name: string; sku: string; gmv: number; qty: number }>();
    const prevQtyMap = new Map<string, number>();

    // Aggregate previous period quantities
    (prevSales || []).forEach((sale) => {
      const currentQty = prevQtyMap.get(sale.product_id) || 0;
      prevQtyMap.set(sale.product_id, currentQty + sale.quantity);
    });

    // Aggregate current period
    (sales || []).forEach((sale) => {
      const productId = sale.product_id;
      const productName = sale.product_name || 'Unknown Product';
      const productSku = sale.sku || '';
      
      const existing = productMap.get(productId);
      if (existing) {
        existing.gmv += Number(sale.total_price);
        existing.qty += sale.quantity;
      } else {
        productMap.set(productId, {
          name: productName,
          sku: productSku,
          gmv: Number(sale.total_price),
          qty: sale.quantity,
        });
      }
    });

    // Convert to array and calculate delta
    const performance: ProductPerformance[] = Array.from(productMap.entries())
      .map(([productId, data]) => ({
        product_id: productId,
        product_name: data.name,
        sku: data.sku,
        gmv: data.gmv,
        delta_qty: data.qty - (prevQtyMap.get(productId) || 0),
      }))
      .sort((a, b) => b.gmv - a.gmv)
      .slice(0, 10); // Top 10 products

    return { success: true, data: performance };
  } catch (error) {
    console.error('Unexpected error in getProductPerformance:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}

/**
 * Get GMV breakdown by sub-category
 * Requirements: 8.4
 */
export async function getCategoryGMV(dateRange: DateRange): Promise<ActionResult<CategoryGMV[]>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return {
        success: false,
        error: 'You must be logged in to view category GMV',
        code: ErrorCodes.UNAUTHORIZED,
      };
    }

    const supabase = await createClient();

    // Use unified_sales_export view
    let salesQuery = supabase
      .from('unified_sales_export')
      .select(`
        total_price,
        quantity,
        store_id,
        account_name,
        sub_category
      `)
      .gte('sale_date', dateRange.start_date)
      .lte('sale_date', dateRange.end_date);

    // Apply store filter if provided
    if (dateRange.store_id) {
      salesQuery = salesQuery.eq('store_id', dateRange.store_id);
    } else if (dateRange.account_id) {
      const { data: accounts } = await supabase
        .from('accounts')
        .select('name')
        .eq('id', dateRange.account_id)
        .single();
      if (accounts) {
        salesQuery = salesQuery.eq('account_name', accounts.name);
      }
    }

    const { data: sales, error: salesError } = await salesQuery;

    if (salesError) {
      console.error('Error fetching sales for category GMV:', salesError);
      return {
        success: false,
        error: 'Failed to fetch category GMV data',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }

    // Aggregate by sub_category
    const categoryMap = new Map<string, { gmv: number; qty: number }>();

    (sales || []).forEach((sale) => {
      const category = sale.sub_category || 'Uncategorized';
      const existing = categoryMap.get(category);
      if (existing) {
        existing.gmv += Number(sale.total_price);
        existing.qty += sale.quantity;
      } else {
        categoryMap.set(category, {
          gmv: Number(sale.total_price),
          qty: sale.quantity,
        });
      }
    });

    // Convert to array and sort by GMV
    const categoryGmv: CategoryGMV[] = Array.from(categoryMap.entries())
      .map(([category, data]) => ({ category, gmv: data.gmv, qty: data.qty }))
      .sort((a, b) => b.gmv - a.gmv);

    return { success: true, data: categoryGmv };
  } catch (error) {
    console.error('Unexpected error in getCategoryGMV:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}

/**
 * Get GMV and quantity sold by region (using stores)
 * Requirements: 8.5
 */
export async function getProvinceData(dateRange: DateRange): Promise<ActionResult<ProvinceData[]>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return {
        success: false,
        error: 'You must be logged in to view province data',
        code: ErrorCodes.UNAUTHORIZED,
      };
    }

    const supabase = await createClient();

    // Fetch sales with store region info
    const { data: sales, error: salesError } = await supabase
      .from('sales')
      .select(`
        total_price,
        quantity,
        stores:store_id (
          region
        )
      `)
      .gte('sale_date', dateRange.start_date)
      .lte('sale_date', dateRange.end_date);

    if (salesError) {
      console.error('Error fetching sales for province data:', salesError);
      return {
        success: false,
        error: 'Failed to fetch province data',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }

    // Aggregate by region
    const provinceMap = new Map<string, { gmv: number; qty: number }>();

    (sales || []).forEach((sale) => {
      const storeData = sale.stores as unknown as { region: string | null } | null;
      const province = storeData?.region || 'Unknown';
      
      const existing = provinceMap.get(province);
      if (existing) {
        existing.gmv += Number(sale.total_price);
        existing.qty += sale.quantity;
      } else {
        provinceMap.set(province, {
          gmv: Number(sale.total_price),
          qty: sale.quantity,
        });
      }
    });

    // Convert to array and sort by GMV
    const provinceData: ProvinceData[] = Array.from(provinceMap.entries())
      .map(([province, data]) => ({
        province,
        gmv: data.gmv,
        qty_sold: data.qty,
      }))
      .sort((a, b) => b.gmv - a.gmv);

    return { success: true, data: provinceData };
  } catch (error) {
    console.error('Unexpected error in getProvinceData:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}

/**
 * Get GMV and quantity sold by Store
 * Requirements: 14.5
 */
export async function getStoreGMV(dateRange: DateRange): Promise<ActionResult<StoreGMV[]>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return {
        success: false,
        error: 'You must be logged in to view store data',
        code: ErrorCodes.UNAUTHORIZED,
      };
    }

    const supabase = await createClient();

    // Use unified_sales_export view
    let salesQuery = supabase
      .from('unified_sales_export')
      .select(`
        total_price,
        quantity,
        store_id,
        store_name,
        account_name
      `)
      .gte('sale_date', dateRange.start_date)
      .lte('sale_date', dateRange.end_date);

    // Apply store filter if provided
    if (dateRange.store_id) {
      salesQuery = salesQuery.eq('store_id', dateRange.store_id);
    } else if (dateRange.account_id) {
      const { data: accounts } = await supabase
        .from('accounts')
        .select('name')
        .eq('id', dateRange.account_id)
        .single();
      if (accounts) {
        salesQuery = salesQuery.eq('account_name', accounts.name);
      }
    }

    const { data: storeSales, error: storeError } = await salesQuery;

    if (storeError) {
      console.error('Error fetching sales for store data:', storeError);
      return {
        success: false,
        error: 'Failed to fetch store data',
        code: ErrorCodes.INTERNAL_ERROR,
      };
    }

    // Aggregate by store
    const storeMap = new Map<string, { name: string; accountName: string; gmv: number; qty: number }>();

    (storeSales || []).forEach((sale) => {
      const storeId = sale.store_id;
      const storeName = sale.store_name;
      const accountName = sale.account_name || 'No Account';
      const price = Number(sale.total_price || 0);
      
      const existing = storeMap.get(storeId);
      if (existing) {
        existing.gmv += price;
        existing.qty += sale.quantity;
      } else {
        storeMap.set(storeId, {
          name: storeName,
          accountName: accountName,
          gmv: price,
          qty: sale.quantity,
        });
      }
    });

    // Convert to array and sort by GMV
    const storeGmv: StoreGMV[] = Array.from(storeMap.entries())
      .map(([storeId, data]) => ({
        store_id: storeId,
        store_name: data.name,
        account_name: data.accountName,
        gmv: data.gmv,
        qty_sold: data.qty,
      }))
      .sort((a, b) => b.gmv - a.gmv);

    return { success: true, data: storeGmv };
  } catch (error) {
    console.error('Unexpected error in getStoreGMV:', error);
    return {
      success: false,
      error: 'An unexpected error occurred',
      code: ErrorCodes.INTERNAL_ERROR,
    };
  }
}
