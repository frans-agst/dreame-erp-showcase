'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  getDashboardMetrics,
  getGMVTrends,
  getProductPerformance,
  getCategoryGMV,
  getStoreGMV,
  DateRange,
  GMVTrends,
} from '@/actions/dashboard';
import { getAccounts, getStoresByAccount, getStores } from '@/actions/master-data';
import { getCurrentUserProfile } from '@/actions/sales';
import { DashboardMetrics, ProductPerformance, CategoryGMV, Account, Store, StoreGMV } from '@/types';
import { MetricCard } from '@/components/ui/MetricCard';
import { SoftCard } from '@/components/ui/SoftCard';
import { DataTable, Column } from '@/components/ui/DataTable';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { useI18n } from '@/lib/i18n/context';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

// ============================================================================
// Cache Configuration
// ============================================================================

const CACHE_DURATION = 30 * 1000; // 30 seconds for testing

interface CachedDashboardData {
  metrics: DashboardMetrics | null;
  gmvTrends: GMVTrends | null;
  productPerformance: ProductPerformance[];
  categoryGmv: CategoryGMV[];
  storeGmv: StoreGMV[];
  timestamp: number;
  cacheKey: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCompactCurrency(value: number): string {
  if (value >= 1000000000) {
    return `Rp ${(value / 1000000000).toFixed(1)}B`;
  }
  if (value >= 1000000) {
    return `Rp ${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `Rp ${(value / 1000).toFixed(1)}K`;
  }
  return `Rp ${value}`;
}

function getDateRangeOptions(): { value: string; label: string; range: DateRange }[] {
  const today = new Date();
  // Use local date string to avoid timezone issues
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  
  // Last 7 days
  const last7Start = new Date(today);
  last7Start.setDate(today.getDate() - 6);
  const last7StartStr = `${last7Start.getFullYear()}-${String(last7Start.getMonth() + 1).padStart(2, '0')}-${String(last7Start.getDate()).padStart(2, '0')}`;
  
  // Last 30 days
  const last30Start = new Date(today);
  last30Start.setDate(today.getDate() - 29);
  const last30StartStr = `${last30Start.getFullYear()}-${String(last30Start.getMonth() + 1).padStart(2, '0')}-${String(last30Start.getDate()).padStart(2, '0')}`;
  
  // This month
  const thisMonthStartStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
  
  // Last month
  const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
  const lastMonthStartStr = `${lastMonthStart.getFullYear()}-${String(lastMonthStart.getMonth() + 1).padStart(2, '0')}-01`;
  const lastMonthEndStr = `${lastMonthEnd.getFullYear()}-${String(lastMonthEnd.getMonth() + 1).padStart(2, '0')}-${String(lastMonthEnd.getDate()).padStart(2, '0')}`;
  
  // This year
  const thisYearStartStr = `${today.getFullYear()}-01-01`;

  return [
    {
      value: 'last7',
      label: 'Last 7 Days',
      range: {
        start_date: last7StartStr,
        end_date: todayStr,
      },
    },
    {
      value: 'last30',
      label: 'Last 30 Days',
      range: {
        start_date: last30StartStr,
        end_date: todayStr,
      },
    },
    {
      value: 'thisMonth',
      label: 'This Month',
      range: {
        start_date: thisMonthStartStr,
        end_date: todayStr,
      },
    },
    {
      value: 'lastMonth',
      label: 'Last Month',
      range: {
        start_date: lastMonthStartStr,
        end_date: lastMonthEndStr,
      },
    },
    {
      value: 'thisYear',
      label: 'This Year',
      range: {
        start_date: thisYearStartStr,
        end_date: todayStr,
      },
    },
  ];
}

// Chart colors
const CHART_COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];


// ============================================================================
// Component
// ============================================================================

export default function DashboardPage() {
  const { t } = useI18n();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [gmvTrends, setGmvTrends] = useState<GMVTrends | null>(null);
  const [productPerformance, setProductPerformance] = useState<ProductPerformance[]>([]);
  const [categoryGmv, setCategoryGmv] = useState<CategoryGMV[]>([]);
  const [storeGmv, setStoreGmv] = useState<StoreGMV[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trendView, setTrendView] = useState<'weekly' | 'monthly'>('weekly');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  // Cache ref to persist across renders
  const cacheRef = useRef<CachedDashboardData | null>(null);
  
  // User role state
  const [userRole, setUserRole] = useState<string>('staff');
  const [userStoreId, setUserStoreId] = useState<string | null>(null);
  const [userStoreName, setUserStoreName] = useState<string>('');
  const isStaff = userRole === 'staff';

  const dateRangeOptions = getDateRangeOptions();
  const [selectedRange, setSelectedRange] = useState('last30');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');

  // Generate cache key based on filters
  const getCacheKey = useCallback((range: DateRange, accountId: string, storeId: string) => {
    return `${range.start_date}-${range.end_date}-${accountId}-${storeId}`;
  }, []);

  // Check if cache is valid
  const isCacheValid = useCallback((cacheKey: string) => {
    if (!cacheRef.current) return false;
    if (cacheRef.current.cacheKey !== cacheKey) return false;
    return Date.now() - cacheRef.current.timestamp < CACHE_DURATION;
  }, []);

  // Fetch user profile and accounts on mount
  useEffect(() => {
    const fetchUserAndAccounts = async () => {
      // Get current user profile first
      const userResult = await getCurrentUserProfile();
      if (userResult.success && userResult.data) {
        const role = userResult.data.role;
        setUserRole(role);
        
        if (role === 'staff') {
          // For staff, use current_store_id from session (set by store selector)
          // This ensures the dashboard reflects the selected store
          const currentStoreId = userResult.data.current_store_id || userResult.data.primary_store_id || userResult.data.store_id;
          if (currentStoreId) {
            setUserStoreId(currentStoreId);
            setSelectedStoreId(currentStoreId);
            
            // Get store name for display
            const storesResult = await getStores(true);
            if (storesResult.success) {
              const userStore = storesResult.data.find(s => s.id === currentStoreId);
              if (userStore) {
                setUserStoreName(userStore.name);
              }
            }
          }
        } else {
          // For admin/manager, fetch accounts
          const result = await getAccounts(true);
          if (result.success) {
            setAccounts(result.data);
          }
        }
      }
    };
    fetchUserAndAccounts();
  }, []);

  // Fetch stores when account changes (only for non-staff users)
  useEffect(() => {
    // Staff users have their store pre-set, skip this
    if (isStaff) return;
    
    const fetchStores = async () => {
      if (selectedAccountId) {
        const result = await getStoresByAccount(selectedAccountId, true);
        if (result.success) {
          // Filter to show only brandstores
          const brandstores = result.data.filter(store => {
            const account = accounts.find(a => a.id === store.account_id);
            return account?.channel_type === 'Brandstore';
          });
          setStores(brandstores);
        }
      } else {
        setStores([]);
      }
      setSelectedStoreId(''); // Reset store selection when account changes
    };
    fetchStores();
  }, [selectedAccountId, isStaff]);

  // Memoize the date range to prevent infinite re-renders
  const currentRange = useMemo(() => {
    return dateRangeOptions.find((opt) => opt.value === selectedRange)?.range || dateRangeOptions[1].range;
  }, [selectedRange]);

  const fetchDashboardData = useCallback(async (range: DateRange, forceRefresh = false) => {
    // Add account/store filters to the range
    const filterRange: DateRange = {
      ...range,
      account_id: selectedAccountId || undefined,
      store_id: selectedStoreId || undefined,
    };

    const cacheKey = getCacheKey(filterRange, selectedAccountId, selectedStoreId);

    // Use cache if valid and not forcing refresh
    if (!forceRefresh && isCacheValid(cacheKey) && cacheRef.current) {
      setMetrics(cacheRef.current.metrics);
      setGmvTrends(cacheRef.current.gmvTrends);
      setProductPerformance(cacheRef.current.productPerformance);
      setCategoryGmv(cacheRef.current.categoryGmv);
      setStoreGmv(cacheRef.current.storeGmv);
      setLastUpdated(new Date(cacheRef.current.timestamp));
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [metricsResult, trendsResult, productResult, categoryResult, storeResult] = await Promise.all([
        getDashboardMetrics(filterRange),
        getGMVTrends(filterRange),
        getProductPerformance(filterRange),
        getCategoryGMV(filterRange),
        getStoreGMV(filterRange),
      ]);

      const now = Date.now();

      if (metricsResult.success) {
        setMetrics(metricsResult.data);
      } else {
        setError(metricsResult.error);
      }

      if (trendsResult.success) {
        setGmvTrends(trendsResult.data);
      }

      if (productResult.success) {
        setProductPerformance(productResult.data);
      }

      if (categoryResult.success) {
        setCategoryGmv(categoryResult.data);
      }

      if (storeResult.success) {
        setStoreGmv(storeResult.data);
      }

      // Update cache
      cacheRef.current = {
        metrics: metricsResult.success ? metricsResult.data : null,
        gmvTrends: trendsResult.success ? trendsResult.data : null,
        productPerformance: productResult.success ? productResult.data : [],
        categoryGmv: categoryResult.success ? categoryResult.data : [],
        storeGmv: storeResult.success ? storeResult.data : [],
        timestamp: now,
        cacheKey,
      };
      
      setLastUpdated(new Date(now));
    } catch (err) {
      setError('Failed to load dashboard data');
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedAccountId, selectedStoreId, getCacheKey, isCacheValid]);

  useEffect(() => {
    fetchDashboardData(currentRange);
  }, [currentRange, selectedStoreId, fetchDashboardData]);

  // Manual refresh handler
  const handleRefresh = useCallback(() => {
    fetchDashboardData(currentRange, true);
  }, [currentRange, fetchDashboardData]);

  const productColumns: Column<ProductPerformance>[] = [
    {
      key: 'product_name',
      header: t('sales.product'),
      sortable: true,
    },
    {
      key: 'gmv',
      header: 'GMV',
      sortable: true,
      render: (row) => formatCurrency(row.gmv),
    },
    {
      key: 'delta_qty',
      header: t('dashboard.deltaQty'),
      sortable: true,
      render: (row) => (
        <span className={row.delta_qty >= 0 ? 'text-accent-green' : 'text-accent-red'}>
          {row.delta_qty >= 0 ? '+' : ''}{row.delta_qty}
        </span>
      ),
    },
  ];

  const storeColumns: Column<StoreGMV>[] = [
    {
      key: 'store_name',
      header: t('form.store'),
      sortable: true,
    },
    {
      key: 'account_name',
      header: t('form.account'),
      sortable: true,
    },
    {
      key: 'gmv',
      header: 'GMV',
      sortable: true,
      render: (row) => formatCurrency(row.gmv),
    },
    {
      key: 'qty_sold',
      header: t('dashboard.qtySold'),
      sortable: true,
    },
  ];

  // Get the trend data based on selected view
  const trendData = trendView === 'weekly' ? gmvTrends?.weekly : gmvTrends?.monthly;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-primary">{t('dashboard.title')}</h1>
          <p className="text-secondary mt-1">{t('dashboard.overview')}</p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-secondary">
              {t('common.lastUpdated') || 'Updated'}: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <Button
            variant="secondary"
            onClick={handleRefresh}
            disabled={loading}
          >
            {loading ? (
              <LoadingSpinner size="sm" />
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Staff notice */}
        {isStaff && userStoreName && (
          <div className="w-full p-3 bg-accent-greenLight rounded-lg">
            <p className="text-sm text-primary">
              {t('dashboard.viewingStore') || `Viewing data for: ${userStoreName}`}
            </p>
          </div>
        )}
        
        {/* Date Range Filter - always visible */}
        <div className="w-full sm:w-48">
          <label className="block text-sm text-secondary mb-1">{t('common.period')}</label>
          <Select
            value={selectedRange}
            onChange={(e) => setSelectedRange(e.target.value)}
            aria-label={t('common.period')}
          >
            {dateRangeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>

        {/* Account Filter - hidden for staff */}
        {!isStaff && (
          <div className="w-full sm:w-48">
            <label className="block text-sm text-secondary mb-1">{t('form.account')}</label>
            <Select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              aria-label={t('dashboard.filterByAccount')}
            >
              <option value="">{t('dashboard.allAccounts')}</option>
              {[...accounts]
                .sort((a, b) => `${a.channel_type} - ${a.name}`.localeCompare(`${b.channel_type} - ${b.name}`))
                .map((account) => (
                <option key={account.id} value={account.id}>
                  {account.channel_type} - {account.name}
                </option>
              ))}
            </Select>
          </div>
        )}

        {/* Store Filter - hidden for staff */}
        {!isStaff && (
          <div className="w-full sm:w-48">
            <label className="block text-sm text-secondary mb-1">{t('form.store')}</label>
            <Select
              value={selectedStoreId}
              onChange={(e) => setSelectedStoreId(e.target.value)}
              aria-label={t('dashboard.filterByStore')}
              disabled={!selectedAccountId}
            >
              <option value="">{t('dashboard.allStores')}</option>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <SoftCard className="bg-accent-redLight border border-accent-red/20">
          <p className="text-accent-red">{error}</p>
        </SoftCard>
      )}

      {/* Metric Cards */}
      {metrics && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title={t('dashboard.totalGMV')}
            value={formatCompactCurrency(metrics.total_gmv)}
            change={metrics.gmv_change_pct}
            changeLabel="vs previous period"
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
          <MetricCard
            title={t('dashboard.orderCount')}
            value={metrics.order_count.toLocaleString()}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
            }
          />
          <MetricCard
            title={t('dashboard.qtySold')}
            value={metrics.qty_sold.toLocaleString()}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            }
          />
          <MetricCard
            title={t('dashboard.avgOrderValue')}
            value={formatCompactCurrency(metrics.avg_order_value)}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            }
          />
        </div>
      )}


      {/* GMV Trend Chart with Fiscal Week/Month Toggle */}
      {gmvTrends && (trendData && trendData.length > 0) && (
        <SoftCard>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-primary">{t('dashboard.salesTrend')}</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setTrendView('weekly')}
                className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                  trendView === 'weekly'
                    ? 'bg-accent-green text-white'
                    : 'bg-background text-secondary hover:bg-secondary/10'
                }`}
              >
                {t('dashboard.fiscalWeekly')}
              </button>
              <button
                onClick={() => setTrendView('monthly')}
                className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                  trendView === 'monthly'
                    ? 'bg-accent-green text-white'
                    : 'bg-background text-secondary hover:bg-secondary/10'
                }`}
              >
                {t('dashboard.fiscalMonthly')}
              </button>
            </div>
          </div>
          <div className="h-[300px] min-h-[300px] w-full">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="period" tick={{ fontSize: 12 }} stroke="#64748B" />
                <YAxis tickFormatter={(value) => formatCompactCurrency(value)} tick={{ fontSize: 12 }} stroke="#64748B" />
                <Tooltip
                  formatter={(value) => [formatCurrency(Number(value)), 'GMV']}
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    border: 'none',
                    borderRadius: '12px',
                    boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.1)',
                  }}
                />
                <Bar dataKey="gmv" fill="#10B981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SoftCard>
      )}

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Product Performance Table */}
        <div>
          <h2 className="text-lg font-semibold text-primary mb-4">{t('dashboard.topProducts')}</h2>
          <DataTable
            columns={productColumns}
            data={productPerformance}
            keyExtractor={(row) => row.product_id}
            emptyMessage={t('common.noData')}
            pageSize={5}
          />
        </div>

        {/* Category Pie Chart */}
        <SoftCard>
          <h2 className="text-lg font-semibold text-primary mb-4">{t('dashboard.bySubCategory') || t('dashboard.byCategory')}</h2>
          {categoryGmv.length > 0 ? (
            <div className="h-[300px] min-h-[300px] w-full">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={categoryGmv as unknown as Array<{ category: string; gmv: number }>}
                    dataKey="gmv"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ name, percent }) => `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`}
                    labelLine={false}
                  >
                    {categoryGmv.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => [formatCurrency(Number(value)), 'GMV']}
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      border: 'none',
                      borderRadius: '12px',
                      boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.1)',
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-secondary">
              {t('common.noData')}
            </div>
          )}
        </SoftCard>
      </div>

      {/* Store GMV Table */}
      <div>
        <h2 className="text-lg font-semibold text-primary mb-4">{t('dashboard.byStore')}</h2>
        <DataTable
          columns={storeColumns}
          data={storeGmv}
          keyExtractor={(row) => row.store_id}
          emptyMessage={t('common.noData')}
          pageSize={10}
        />
      </div>
    </div>
  );
}
