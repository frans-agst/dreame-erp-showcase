'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { getInventoryForStore, getInventoryForMultipleStores } from '@/actions/inventory';
import { getStores } from '@/actions/master-data';
import { SoftCard } from '@/components/ui/SoftCard';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { MultiSelect } from '@/components/ui/MultiSelect';
import { useI18n } from '@/lib/i18n/context';
import { InventoryItem, Store } from '@/types';
import * as XLSX from 'xlsx';

/**
 * Check if a quantity is considered low stock (0-9 units)
 */
export function isLowStock(quantity: number): boolean {
  return quantity >= 0 && quantity <= 9;
}

/**
 * Filter out products with zero total stock
 * Used for hiding zero-stock product columns in inventory matrix display
 */
export function filterZeroStockProducts<T extends { totalStock: number }>(products: T[]): T[] {
  return products.filter(product => product.totalStock > 0);
}

// Helper functions for week calculations
function getWeekNumber(date: Date): number {
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date.getTime() - startOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + startOfYear.getDay() + 1) / 7);
}

function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  const monday = new Date(d.setDate(diff));
  return monday.toISOString().split('T')[0];
}

function getWeekEnd(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? 0 : 7); // Adjust when day is Sunday
  const sunday = new Date(d.setDate(diff));
  return sunday.toISOString().split('T')[0];
}

function formatDateForExcel(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

export default function InventoryPage() {
  const { t } = useI18n();
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [filteredInventory, setFilteredInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingStores, setLoadingStores] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [subCategoryFilter, setSubCategoryFilter] = useState('');
  const [storeFilter, setStoreFilter] = useState(''); // Store filter for filtering loaded inventory
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Fetch stores on component mount
  const fetchStores = useCallback(async () => {
    setLoadingStores(true);
    try {
      const result = await getStores(true); // only active stores
      if (result.success) {
        setStores(result.data);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('Failed to load stores');
      console.error('Error fetching stores:', err);
    } finally {
      setLoadingStores(false);
    }
  }, []);

  // Fetch inventory for selected stores
  const fetchInventory = useCallback(async () => {
    if (selectedStoreIds.length === 0) {
      setInventory([]);
      setFilteredInventory([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await getInventoryForMultipleStores(selectedStoreIds);

      if (result.success) {
        setInventory(result.data);
        setLastUpdated(new Date());
      } else {
        setError(result.error);
        setInventory([]);
      }
    } catch (err) {
      setError('Failed to load inventory data');
      console.error('Error fetching inventory:', err);
      setInventory([]);
    } finally {
      setLoading(false);
    }
  }, [selectedStoreIds]);

  useEffect(() => {
    fetchStores();
  }, [fetchStores]);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  // Get unique categories and sub-categories from inventory
  const categories = useMemo(() => {
    const cats = new Set<string>();
    inventory.forEach(item => {
      if (item.product?.category) cats.add(item.product.category);
    });
    return Array.from(cats).sort();
  }, [inventory]);

  const subCategories = useMemo(() => {
    const subs = new Set<string>();
    inventory.forEach(item => {
      if (item.product?.sub_category) subs.add(item.product.sub_category);
    });
    return Array.from(subs).sort();
  }, [inventory]);

  // Apply filters to inventory
  useEffect(() => {
    let result = inventory;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(item => 
        item.product?.name.toLowerCase().includes(query) ||
        item.product?.sku.toLowerCase().includes(query)
      );
    }

    // Store filter (only when multiple stores are selected)
    if (storeFilter && selectedStoreIds.length > 1) {
      result = result.filter(item => item.store_id === storeFilter);
    }

    // Category filter
    if (categoryFilter) {
      result = result.filter(item => item.product?.category === categoryFilter);
    }

    // Sub-category filter
    if (subCategoryFilter) {
      result = result.filter(item => item.product?.sub_category === subCategoryFilter);
    }

    // Low stock filter
    if (showLowStockOnly) {
      result = result.filter(item => isLowStock(item.quantity));
    }

    setFilteredInventory(result);
  }, [inventory, searchQuery, storeFilter, categoryFilter, subCategoryFilter, showLowStockOnly, selectedStoreIds.length]);

  // Stats
  const stats = useMemo(() => {
    const totalProducts = inventory.length;
    const lowStockCount = inventory.filter(item => isLowStock(item.quantity) && item.quantity > 0).length;
    const totalStock = inventory.reduce((sum, item) => sum + item.quantity, 0);
    
    return {
      totalProducts,
      lowStockCount,
      totalStock,
    };
  }, [inventory]);

  const handleClearFilters = () => {
    setSearchQuery('');
    setCategoryFilter('');
    setSubCategoryFilter('');
    setStoreFilter('');
    setShowLowStockOnly(false);
  };

  // Export functions
  const exportToExcel = async () => {
    if (selectedStoreIds.length === 0 || filteredInventory.length === 0) return;

    const selectedStores = stores.filter(s => selectedStoreIds.includes(s.id));
    const storeNames = selectedStores.map(store => 
      store.account ? `${store.account.name} - ${store.name}` : store.name
    ).join(', ');
    
    const reportTitle = selectedStoreIds.length === 1 ? 
      `Inventory Report - ${storeNames}` : 
      `Multi-Store Inventory Report (${selectedStoreIds.length} stores)`;

    // Get current fiscal period information
    let weekInfo = `Week ${getWeekNumber(new Date())} of ${new Date().getFullYear()}`;
    let weekPeriod = `${formatDateForExcel(getWeekStart(new Date()))} - ${formatDateForExcel(getWeekEnd(new Date()))}`;

    try {
      // Dynamic import for fiscal calendar
      const { getCurrentFiscalPeriod, getFiscalWeekInfo } = await import('@/lib/fiscal-calendar');
      const fiscalPeriod = await getCurrentFiscalPeriod();
      
      if (fiscalPeriod) {
        weekInfo = `Fiscal Week ${fiscalPeriod.fiscal_week}, FY${fiscalPeriod.fiscal_year}`;
        
        const weekData = await getFiscalWeekInfo(fiscalPeriod.fiscal_year, fiscalPeriod.fiscal_week);
        if (weekData) {
          weekPeriod = `${formatDateForExcel(weekData.startDate)} - ${formatDateForExcel(weekData.endDate)}`;
        }
      }
    } catch (error) {
      console.error('Error fetching fiscal period:', error);
      // Continue with regular week calculation
    }

    const data = filteredInventory.map(item => ({
      'SKU': item.product?.sku || '',
      'Product Name': item.product?.name || '',
      'Store': item.store ? (item.store.account ? `${item.store.account.name} - ${item.store.name}` : item.store.name) : '',
      'Category': item.product?.category || '',
      'Sub Category': item.product?.sub_category || '',
      'Stock': item.quantity,
      'Display': item.display_qty,
      'Status': isLowStock(item.quantity) ? 'Low Stock' : 'Normal'
    }));

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      [reportTitle],
      [`Generated: ${new Date().toLocaleString('id-ID')}`],
      [`Report Period: ${weekInfo}`],
      [`Week Period: ${weekPeriod}`],
      [`Total Products: ${filteredInventory.length}`],
      [`Selected Stores: ${storeNames}`],
      [], // Empty row
      ['SKU', 'Product Name', 'Store', 'Category', 'Sub Category', 'Stock', 'Display', 'Status'], // Headers - always include Store
      ...data.map(item => [
        item.SKU,
        item['Product Name'],
        item.Store,
        item.Category,
        item['Sub Category'],
        item.Stock,
        item.Display,
        item.Status
      ])
    ]);
    
    XLSX.utils.book_append_sheet(wb, ws, 'Inventory');

    const filename = selectedStoreIds.length === 1 ? 
      `inventory-${selectedStores[0].name.replace(/[^a-zA-Z0-9]/g, '_')}-${new Date().toISOString().split('T')[0]}.xlsx` :
      `multi-store-inventory-${new Date().toISOString().split('T')[0]}.xlsx`;

    XLSX.writeFile(wb, filename);
  };

  const exportToPDF = async () => {
    if (selectedStoreIds.length === 0 || filteredInventory.length === 0) return;

    const selectedStores = stores.filter(s => selectedStoreIds.includes(s.id));
    const storeNames = selectedStores.map(store => 
      store.account ? `${store.account.name} - ${store.name}` : store.name
    ).join(', ');

    const reportTitle = selectedStoreIds.length === 1 ? 
      selectedStores[0].name : 
      `Multi-Store Report (${selectedStoreIds.length} stores)`;

    // Get current fiscal period information
    let fiscalWeek: number | undefined;
    let fiscalYear: number | undefined;
    let weekStartDate: string | undefined;
    let weekEndDate: string | undefined;

    try {
      // Dynamic import for fiscal calendar
      const { getCurrentFiscalPeriod } = await import('@/lib/fiscal-calendar');
      const fiscalPeriod = await getCurrentFiscalPeriod();
      
      if (fiscalPeriod) {
        fiscalWeek = fiscalPeriod.fiscal_week;
        fiscalYear = fiscalPeriod.fiscal_year;
        
        // Get week start and end dates
        const { getFiscalWeekInfo } = await import('@/lib/fiscal-calendar');
        const weekInfo = await getFiscalWeekInfo(fiscalPeriod.fiscal_year, fiscalPeriod.fiscal_week);
        
        if (weekInfo) {
          weekStartDate = weekInfo.startDate;
          weekEndDate = weekInfo.endDate;
        }
      }
    } catch (error) {
      console.error('Error fetching fiscal period:', error);
      // Continue without fiscal information
    }

    // Dynamic import for PDF generation
    const { pdf } = await import('@react-pdf/renderer');
    const { InventoryReport } = await import('@/lib/pdf/inventory-report');
    
    const blob = await pdf(
      <InventoryReport
        inventory={filteredInventory}
        storeName={reportTitle}
        accountName={selectedStoreIds.length > 1 ? `Selected Stores: ${storeNames}` : selectedStores[0]?.account?.name}
        generatedAt={new Date()}
        fiscalWeek={fiscalWeek}
        fiscalYear={fiscalYear}
        weekStartDate={weekStartDate}
        weekEndDate={weekEndDate}
        showStoreColumn={true} // Always show store column
      />
    ).toBlob();
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    const filename = selectedStoreIds.length === 1 ? 
      `inventory-${selectedStores[0].name.replace(/[^a-zA-Z0-9]/g, '_')}-${new Date().toISOString().split('T')[0]}.pdf` :
      `multi-store-inventory-${new Date().toISOString().split('T')[0]}.pdf`;
    
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };


  if (loadingStores) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-primary">{t('inventory.title')}</h1>
          <p className="text-secondary mt-1">{t('inventory.viewStock')}</p>
        </div>
        <SoftCard className="flex items-center justify-center py-12">
          <LoadingSpinner size="lg" />
        </SoftCard>
      </div>
    );
  }

  if (error && !stores.length) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-primary">{t('inventory.title')}</h1>
          <p className="text-secondary mt-1">{t('inventory.viewStock')}</p>
        </div>
        <SoftCard className="bg-accent-redLight border border-accent-red/20">
          <p className="text-accent-red">{error}</p>
        </SoftCard>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-primary">{t('inventory.title')}</h1>
          <p className="text-secondary mt-1">{t('inventory.viewStock')}</p>
        </div>
        <div className="flex items-center gap-4">
          {lastUpdated && selectedStoreIds.length > 0 && (
            <span className="text-xs text-secondary">
              {t('common.lastUpdated') || 'Updated'}: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          {selectedStoreIds.length > 0 && (
            <Button
              variant="secondary"
              onClick={fetchInventory}
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
          )}
        </div>
      </div>

      {/* Store Selection */}
      <SoftCard>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-primary mb-2">{t('form.selectStore') || 'Select Stores'}</h2>
          <p className="text-sm text-secondary">{t('inventory.selectStoreToView') || 'Choose one or more stores to view their inventory'}</p>
        </div>
        <div className="max-w-md">
          <MultiSelect
            options={stores.map(store => ({
              value: store.id,
              label: store.account ? `${store.account.name} - ${store.name}` : store.name
            }))}
            value={selectedStoreIds}
            onChange={setSelectedStoreIds}
            placeholder={t('form.selectStore') || 'Select Stores'}
            className="w-full"
          />
        </div>
        {selectedStoreIds.length > 0 && (
          <div className="mt-3 text-sm text-secondary">
            {selectedStoreIds.length === 1 ? 
              '1 store selected' : 
              `${selectedStoreIds.length} stores selected`
            }
          </div>
        )}
      </SoftCard>

      {/* Show content only when stores are selected */}
      {selectedStoreIds.length > 0 && (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <SoftCard className="text-center">
              <div className="text-3xl font-bold text-primary">{stats.totalProducts}</div>
              <div className="text-sm text-secondary">{t('sidebar.products')}</div>
            </SoftCard>
            <SoftCard className="text-center">
              <div className="text-3xl font-bold text-primary">{stats.totalStock}</div>
              <div className="text-sm text-secondary">{t('inventory.totalStock') || 'Total Stock'}</div>
            </SoftCard>
            <SoftCard className="text-center cursor-pointer hover:bg-accent-redLight/50 transition-colors" onClick={() => setShowLowStockOnly(!showLowStockOnly)}>
              <div className="text-3xl font-bold text-accent-red">{stats.lowStockCount}</div>
              <div className="text-sm text-secondary">{t('inventory.lowStock')}</div>
            </SoftCard>
          </div>

          {/* Filters */}
          <SoftCard>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-secondary mb-1">{t('common.search')}</label>
                <Input
                  type="text"
                  placeholder={t('inventory.searchProducts') || 'Search by SKU or name...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              {selectedStoreIds.length > 1 && (
                <div className="flex-1">
                  <label className="block text-sm font-medium text-secondary mb-1">{t('form.store') || 'Store'}</label>
                  <Select
                    value={storeFilter}
                    onChange={(e) => setStoreFilter(e.target.value)}
                  >
                    <option value="">{t('common.all')} {t('form.store') || 'All Stores'}</option>
                    {stores
                      .filter(store => selectedStoreIds.includes(store.id))
                      .map(store => (
                        <option key={store.id} value={store.id}>
                          {store.account ? `${store.account.name} - ${store.name}` : store.name}
                        </option>
                      ))}
                  </Select>
                </div>
              )}
              <div className="flex-1">
                <label className="block text-sm font-medium text-secondary mb-1">{t('form.category')}</label>
                <Select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  <option value="">{t('common.all')} {t('form.category')}</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </Select>
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-secondary mb-1">{t('form.subCategory')}</label>
                <Select
                  value={subCategoryFilter}
                  onChange={(e) => setSubCategoryFilter(e.target.value)}
                >
                  <option value="">{t('common.all')} {t('form.subCategory')}</option>
                  {subCategories.map(sub => (
                    <option key={sub} value={sub}>{sub}</option>
                  ))}
                </Select>
              </div>
              <div className="flex items-end gap-2">
                <Button
                  variant={showLowStockOnly ? 'primary' : 'secondary'}
                  onClick={() => setShowLowStockOnly(!showLowStockOnly)}
                >
                  {t('inventory.lowStock')}
                </Button>
                <Button variant="secondary" onClick={handleClearFilters}>
                  {t('common.clear')}
                </Button>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <div className="text-sm text-secondary">
                {t('common.showing')} {filteredInventory.length} {t('sidebar.products')}
              </div>
              {filteredInventory.length > 0 && (
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={exportToExcel}>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Excel
                  </Button>
                  <Button variant="secondary" size="sm" onClick={exportToPDF}>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    PDF
                  </Button>
                </div>
              )}
            </div>
          </SoftCard>

          {/* Loading state for inventory */}
          {loading && (
            <SoftCard className="flex items-center justify-center py-12">
              <LoadingSpinner size="lg" />
            </SoftCard>
          )}

          {/* Error state for inventory */}
          {error && !loading && (
            <SoftCard className="bg-accent-redLight border border-accent-red/20">
              <p className="text-accent-red">{error}</p>
            </SoftCard>
          )}

          {/* Inventory Table */}
          {!loading && !error && (
            <>
              {filteredInventory.length === 0 ? (
                <SoftCard>
                  <EmptyState
                    title={t('common.noData')}
                    description={t('inventory.noMatchingProducts') || 'No products match your filters'}
                    icon={
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    }
                  />
                </SoftCard>
              ) : (
                <SoftCard noPadding>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-background/50">
                        <tr className="border-b border-secondary/10">
                          <th className="px-4 py-3 text-left text-xs font-semibold text-secondary uppercase tracking-wider">
                            {t('form.sku')}
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-secondary uppercase tracking-wider">
                            {t('sales.product')}
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-secondary uppercase tracking-wider">
                            {t('form.store') || 'Store'}
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-secondary uppercase tracking-wider">
                            {t('form.category')}
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-secondary uppercase tracking-wider">
                            {t('form.subCategory')}
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-secondary uppercase tracking-wider">
                            {t('inventory.stock') || 'Stock'}
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-secondary uppercase tracking-wider">
                            {t('inventory.display') || 'Display'}
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-secondary uppercase tracking-wider">
                            {t('common.status')}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-secondary/10">
                        {filteredInventory.map((item) => {
                          const lowStock = isLowStock(item.quantity);
                          
                          return (
                            <tr key={item.id} className="hover:bg-background/50 transition-colors duration-150">
                              <td className="px-4 py-3 text-sm font-medium text-primary">
                                {item.product?.sku || '-'}
                              </td>
                              <td className="px-4 py-3 text-sm text-primary">
                                {item.product?.name || '-'}
                              </td>
                              <td className="px-4 py-3 text-sm text-secondary">
                                {item.store ? (item.store.account ? `${item.store.account.name} - ${item.store.name}` : item.store.name) : '-'}
                              </td>
                              <td className="px-4 py-3 text-sm text-secondary">
                                {item.product?.category || '-'}
                              </td>
                              <td className="px-4 py-3 text-sm text-secondary">
                                {item.product?.sub_category || '-'}
                              </td>
                              <td className={`px-4 py-3 text-sm text-center font-semibold ${lowStock ? 'text-accent-red' : 'text-primary'}`}>
                                {item.quantity}
                              </td>
                              <td className="px-4 py-3 text-sm text-center text-secondary">
                                {item.display_qty}
                              </td>
                              <td className="px-4 py-3 text-center">
                                {lowStock && item.quantity > 0 ? (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-accent-redLight text-accent-red">
                                    {t('inventory.lowStock')}
                                  </span>
                                ) : item.quantity === 0 ? (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                    {t('inventory.outOfStock') || 'Out of Stock'}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-accent-greenLight text-accent-green">
                                    {t('inventory.normal') || 'Normal'}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </SoftCard>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
