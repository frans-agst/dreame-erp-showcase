// src/lib/performance-optimization.ts
// Performance optimization utilities for database queries and exports
// Requirements: 10.4, 3.6, 4.1

import { createClient } from '@/lib/supabase/server';

/**
 * Query performance monitoring
 */
export interface QueryPerformanceMetrics {
  queryName: string;
  startTime: number;
  endTime: number;
  duration: number;
  rowCount?: number;
  success: boolean;
  error?: string;
}

const performanceMetrics: QueryPerformanceMetrics[] = [];

/**
 * Tracks query performance
 * Requirements: 10.4
 */
export function trackQueryPerformance<T>(
  queryName: string,
  operation: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();
  
  return operation()
    .then(result => {
      const endTime = Date.now();
      const metric: QueryPerformanceMetrics = {
        queryName,
        startTime,
        endTime,
        duration: endTime - startTime,
        success: true,
      };
      
      // Log slow queries (>1 second)
      if (metric.duration > 1000) {
        console.warn(`Slow query detected: ${queryName} took ${metric.duration}ms`);
      }
      
      performanceMetrics.push(metric);
      
      // Keep only last 100 metrics
      if (performanceMetrics.length > 100) {
        performanceMetrics.shift();
      }
      
      return result;
    })
    .catch(error => {
      const endTime = Date.now();
      const metric: QueryPerformanceMetrics = {
        queryName,
        startTime,
        endTime,
        duration: endTime - startTime,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      
      performanceMetrics.push(metric);
      
      if (performanceMetrics.length > 100) {
        performanceMetrics.shift();
      }
      
      throw error;
    });
}

/**
 * Gets performance metrics for analysis
 */
export function getPerformanceMetrics(): QueryPerformanceMetrics[] {
  return [...performanceMetrics];
}

/**
 * Clears performance metrics
 */
export function clearPerformanceMetrics(): void {
  performanceMetrics.length = 0;
}

/**
 * Batch processing utility for large datasets
 * Requirements: 10.4
 */
export async function processBatch<T, R>(
  items: T[],
  batchSize: number,
  processor: (batch: T[]) => Promise<R[]>,
  onProgress?: (processed: number, total: number) => void
): Promise<R[]> {
  const results: R[] = [];
  const total = items.length;
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await processor(batch);
    results.push(...batchResults);
    
    if (onProgress) {
      onProgress(Math.min(i + batchSize, total), total);
    }
  }
  
  return results;
}

/**
 * Optimized transaction query with pagination
 * Requirements: 10.4, 4.1
 */
export interface PaginationOptions {
  page: number;
  pageSize: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function getTransactionsPaginated(
  filters: {
    store_id?: string;
    staff_id?: string;
    start_date?: string;
    end_date?: string;
  },
  pagination: PaginationOptions
): Promise<PaginatedResult<any>> {
  const supabase = await createClient();
  
  const { page, pageSize } = pagination;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  
  // Build query with count
  let query = supabase
    .from('transactions')
    .select(`
      *,
      store:stores(id, name),
      staff:profiles(id, full_name),
      items:transaction_items(count)
    `, { count: 'exact' })
    .order('transaction_date', { ascending: false })
    .order('created_at', { ascending: false })
    .range(from, to);
  
  // Apply filters
  if (filters.store_id) {
    query = query.eq('store_id', filters.store_id);
  }
  if (filters.staff_id) {
    query = query.eq('staff_id', filters.staff_id);
  }
  if (filters.start_date) {
    query = query.gte('transaction_date', filters.start_date);
  }
  if (filters.end_date) {
    query = query.lte('transaction_date', filters.end_date);
  }
  
  const { data, error, count } = await query;
  
  if (error) {
    throw error;
  }
  
  return {
    data: data || [],
    total: count || 0,
    page,
    pageSize,
    totalPages: Math.ceil((count || 0) / pageSize),
  };
}

/**
 * Optimized export data fetching with streaming
 * Requirements: 3.6, 10.4
 */
export async function* streamTransactionExportData(
  transactionIds: string[],
  batchSize: number = 50
): AsyncGenerator<any[], void, unknown> {
  const supabase = await createClient();
  
  for (let i = 0; i < transactionIds.length; i += batchSize) {
    const batch = transactionIds.slice(i, i + batchSize);
    
    const { data, error } = await supabase
      .from('transactions')
      .select(`
        *,
        store:stores(id, name, account:accounts(name)),
        staff:profiles(id, full_name),
        items:transaction_items(
          *,
          product:products(id, sku, name, category, sub_category)
        )
      `)
      .in('id', batch);
    
    if (error) {
      throw error;
    }
    
    yield data || [];
  }
}

/**
 * Cache for frequently accessed data
 * Requirements: 10.4
 */
class SimpleCache<T> {
  private cache = new Map<string, { data: T; timestamp: number }>();
  private ttl: number;
  
  constructor(ttlSeconds: number = 300) {
    this.ttl = ttlSeconds * 1000;
  }
  
  get(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }
    
    const now = Date.now();
    if (now - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }
  
  set(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }
  
  clear(): void {
    this.cache.clear();
  }
  
  delete(key: string): void {
    this.cache.delete(key);
  }
}

// Export cache instances for common data
export const fiscalCalendarCache = new SimpleCache<any>(3600); // 1 hour TTL
export const productCache = new SimpleCache<any>(1800); // 30 minutes TTL
export const storeCache = new SimpleCache<any>(1800); // 30 minutes TTL

/**
 * Optimized fiscal week lookup with caching
 * Requirements: 10.4
 */
export async function getFiscalWeekCached(date: string): Promise<number | null> {
  const cacheKey = `fiscal_week_${date}`;
  const cached = fiscalCalendarCache.get(cacheKey);
  
  if (cached !== null) {
    return cached;
  }
  
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('fiscal_calendar')
    .select('fiscal_week')
    .eq('date', date)
    .single();
  
  if (error || !data) {
    return null;
  }
  
  fiscalCalendarCache.set(cacheKey, data.fiscal_week);
  return data.fiscal_week;
}

/**
 * Bulk fiscal week lookup for multiple dates
 * Requirements: 10.4, 3.6
 */
export async function getFiscalWeeksBulk(
  dates: string[]
): Promise<Map<string, number>> {
  const supabase = await createClient();
  const result = new Map<string, number>();
  
  // Check cache first
  const uncachedDates: string[] = [];
  for (const date of dates) {
    const cacheKey = `fiscal_week_${date}`;
    const cached = fiscalCalendarCache.get(cacheKey);
    
    if (cached !== null) {
      result.set(date, cached);
    } else {
      uncachedDates.push(date);
    }
  }
  
  // Fetch uncached dates in bulk
  if (uncachedDates.length > 0) {
    const { data, error } = await supabase
      .from('fiscal_calendar')
      .select('date, fiscal_week')
      .in('date', uncachedDates);
    
    if (!error && data) {
      for (const row of data) {
        result.set(row.date, row.fiscal_week);
        fiscalCalendarCache.set(`fiscal_week_${row.date}`, row.fiscal_week);
      }
    }
  }
  
  return result;
}

/**
 * Database connection pool health check
 * Requirements: 10.4
 */
export async function checkDatabaseHealth(): Promise<{
  healthy: boolean;
  latency: number;
  error?: string;
}> {
  const startTime = Date.now();
  
  try {
    const supabase = await createClient();
    await supabase.from('transactions').select('id').limit(1);
    
    const latency = Date.now() - startTime;
    
    return {
      healthy: true,
      latency,
    };
  } catch (error) {
    return {
      healthy: false,
      latency: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Optimized query builder for unified sales data
 * Requirements: 4.1, 10.4
 */
export function buildOptimizedUnifiedSalesQuery(
  filters: {
    start_date: string;
    end_date: string;
    store_id?: string;
    staff_id?: string;
  }
) {
  // Use the database function for optimized unified data access
  return {
    rpcName: 'get_unified_sales_data',
    params: {
      p_start_date: filters.start_date,
      p_end_date: filters.end_date,
      p_store_id: filters.store_id || null,
      p_staff_id: filters.staff_id || null,
    },
  };
}

/**
 * Optimizes large transaction exports by batching
 * Requirements: 3.6, 10.4, 11.4
 */
export async function optimizeTransactionExport(
  transactionIds: string[],
  batchSize: number = 50
): Promise<{
  batches: string[][];
  estimatedTime: number;
  recommendations: string[];
}> {
  const batches: string[][] = [];
  const recommendations: string[] = [];
  
  // Split into batches
  for (let i = 0; i < transactionIds.length; i += batchSize) {
    batches.push(transactionIds.slice(i, i + batchSize));
  }
  
  // Estimate processing time (rough estimate: 100ms per transaction)
  const estimatedTime = transactionIds.length * 100;
  
  // Provide recommendations based on size
  if (transactionIds.length > 100) {
    recommendations.push('Consider exporting in smaller date ranges for better performance');
  }
  
  if (transactionIds.length > 500) {
    recommendations.push('Large export detected. This may take several minutes.');
    recommendations.push('Consider using background job processing for exports over 500 transactions');
  }
  
  return {
    batches,
    estimatedTime,
    recommendations
  };
}

/**
 * Monitors and logs slow queries for optimization
 * Requirements: 10.4, 11.4
 */
export function getSlowQueryReport(): {
  slowQueries: QueryPerformanceMetrics[];
  averageDuration: number;
  recommendations: string[];
} {
  const metrics = getPerformanceMetrics();
  const slowQueries = metrics.filter(m => m.duration > 1000);
  
  const totalDuration = metrics.reduce((sum, m) => sum + m.duration, 0);
  const averageDuration = metrics.length > 0 ? totalDuration / metrics.length : 0;
  
  const recommendations: string[] = [];
  
  if (slowQueries.length > 0) {
    recommendations.push(`Found ${slowQueries.length} slow queries (>1s)`);
    
    // Group by query name
    const queryGroups = new Map<string, number>();
    slowQueries.forEach(q => {
      queryGroups.set(q.queryName, (queryGroups.get(q.queryName) || 0) + 1);
    });
    
    queryGroups.forEach((count, name) => {
      if (count > 2) {
        recommendations.push(`Query "${name}" is frequently slow (${count} times)`);
      }
    });
  }
  
  if (averageDuration > 500) {
    recommendations.push('Average query duration is high. Consider adding indexes or optimizing queries.');
  }
  
  return {
    slowQueries,
    averageDuration,
    recommendations
  };
}

/**
 * Validates database performance health
 * Requirements: 10.4, 11.4
 */
export async function validateSystemPerformance(): Promise<{
  healthy: boolean;
  issues: string[];
  metrics: {
    dbLatency: number;
    avgQueryDuration: number;
    slowQueryCount: number;
  };
}> {
  const issues: string[] = [];
  
  // Check database health
  const dbHealth = await checkDatabaseHealth();
  if (!dbHealth.healthy) {
    issues.push(`Database connection unhealthy: ${dbHealth.error}`);
  }
  
  if (dbHealth.latency > 500) {
    issues.push(`High database latency: ${dbHealth.latency}ms`);
  }
  
  // Check query performance
  const slowQueryReport = getSlowQueryReport();
  if (slowQueryReport.slowQueries.length > 5) {
    issues.push(`Multiple slow queries detected: ${slowQueryReport.slowQueries.length}`);
  }
  
  if (slowQueryReport.averageDuration > 500) {
    issues.push(`High average query duration: ${slowQueryReport.averageDuration.toFixed(0)}ms`);
  }
  
  return {
    healthy: issues.length === 0,
    issues,
    metrics: {
      dbLatency: dbHealth.latency,
      avgQueryDuration: slowQueryReport.averageDuration,
      slowQueryCount: slowQueryReport.slowQueries.length
    }
  };
}
