'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { SoftCard } from '@/components/ui/SoftCard';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { FormSuccess } from '@/components/ui/FormSuccess';
import { FormError } from '@/components/ui/FormError';
import { calculateDiscrepancy } from '@/lib/calculations';
import {
  getProductsForOpname,
  getCurrentUserBranchForOpname,
  submitStockOpname,
  updateDisplayQuantities,
  getStockOpnameHistory,
  getStockOpnameItems,
  StockOpnameHistoryItem,
  StockOpnameHistoryItemDetail,
} from '@/actions/stock-opname';
import { Product } from '@/types';
import { useI18n } from '@/lib/i18n/context';
import { PRODUCT_SUB_CATEGORIES } from '@/lib/product-categories';

interface ProductWithInventory {
  product: Product & { display_qty?: number };
  current_qty: number;
}

interface CountedItem {
  product_id: string;
  counted_qty: number;
}

export default function StockOpnamePage() {
  const { t } = useI18n();
  const [products, setProducts] = useState<ProductWithInventory[]>([]);
  const [storeInfo, setStoreInfo] = useState<{ store_id: string | null; store_name: string | null }>({ store_id: null, store_name: null });
  const [history, setHistory] = useState<StockOpnameHistoryItem[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [countedItems, setCountedItems] = useState<Record<string, number>>({});
  const [displayItems, setDisplayItems] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [expandedHistoryIds, setExpandedHistoryIds] = useState<Set<string>>(new Set());
  const [historyItemsCache, setHistoryItemsCache] = useState<Record<string, StockOpnameHistoryItemDetail[]>>({});
  const [loadingHistoryItems, setLoadingHistoryItems] = useState<Set<string>>(new Set());
  const [historyPage, setHistoryPage] = useState(1);
  const [showAllProducts, setShowAllProducts] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubCategory, setSelectedSubCategory] = useState('');
  const HISTORY_PAGE_SIZE = 5;

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Get user's store
      const storeResult = await getCurrentUserBranchForOpname();
      if (!storeResult.success) {
        setError(storeResult.error);
        setLoading(false);
        return;
      }

      setStoreInfo({ 
        store_id: storeResult.data.store_id, 
        store_name: storeResult.data.store_name 
      });

      if (!storeResult.data.store_id) {
        setError('You are not assigned to a store');
        setLoading(false);
        return;
      }

      // Fetch products with inventory (only products with stock by default)
      const productsResult = await getProductsForOpname(storeResult.data.store_id, {
        includeZeroStock: showAllProducts,
        searchQuery: searchQuery || undefined,
      });
      if (productsResult.success) {
        let filteredProducts = productsResult.data;
        
        // Apply sub-category filter client-side
        if (selectedSubCategory) {
          filteredProducts = filteredProducts.filter(item => 
            (item.product as any).sub_category === selectedSubCategory
          );
        }
        
        setProducts(filteredProducts);
        // Initialize counted items with current quantities
        const initialCounted: Record<string, number> = {};
        const initialDisplay: Record<string, number> = {};
        filteredProducts.forEach((item) => {
          initialCounted[item.product.id] = item.current_qty;
          initialDisplay[item.product.id] = (item.product as any).display_qty || 0;
        });
        setCountedItems(initialCounted);
        setDisplayItems(initialDisplay);
      } else {
        setError(productsResult.error);
      }

      // Fetch history (paginated, without items)
      const historyResult = await getStockOpnameHistory(storeResult.data.store_id, historyPage, HISTORY_PAGE_SIZE);
      if (historyResult.success) {
        setHistory(historyResult.data.data);
        setHistoryTotal(historyResult.data.total);
      }
    } catch (err) {
      setError('Failed to load data');
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  }, [showAllProducts, searchQuery, selectedSubCategory, historyPage]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Lazy load history items when expanded
  const toggleHistoryExpand = async (id: string) => {
    const newSet = new Set(expandedHistoryIds);
    
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
      
      // Load items if not cached
      if (!historyItemsCache[id] && !loadingHistoryItems.has(id)) {
        setLoadingHistoryItems(prev => new Set(prev).add(id));
        
        const result = await getStockOpnameItems(id);
        if (result.success) {
          setHistoryItemsCache(prev => ({ ...prev, [id]: result.data }));
        }
        
        setLoadingHistoryItems(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    }
    
    setExpandedHistoryIds(newSet);
  };

  const handleCountChange = (productId: string, value: string) => {
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue) && numValue >= 0) {
      setCountedItems((prev) => ({ ...prev, [productId]: numValue }));
    } else if (value === '') {
      setCountedItems((prev) => ({ ...prev, [productId]: 0 }));
    }
  };

  const handleDisplayChange = (productId: string, value: string) => {
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue) && numValue >= 0) {
      setDisplayItems((prev) => ({ ...prev, [productId]: numValue }));
    } else if (value === '') {
      setDisplayItems((prev) => ({ ...prev, [productId]: 0 }));
    }
  };


  const getDiscrepancySummary = () => {
    let totalDiscrepancy = 0;
    let itemsWithDiscrepancy = 0;

    products.forEach((item) => {
      const counted = countedItems[item.product.id] ?? item.current_qty;
      const discrepancy = calculateDiscrepancy(counted, item.current_qty);
      if (discrepancy !== 0) {
        totalDiscrepancy += discrepancy;
        itemsWithDiscrepancy++;
      }
    });

    return { totalDiscrepancy, itemsWithDiscrepancy };
  };

  const handleSubmit = () => {
    setShowConfirmDialog(true);
  };

  const confirmSubmit = async () => {
    if (!storeInfo.store_id) return;

    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);
    setShowConfirmDialog(false);

    try {
      // Only submit items with discrepancy (counted_qty !== current_qty)
      const items = products
        .filter((item) => {
          const counted = countedItems[item.product.id] ?? item.current_qty;
          return counted !== item.current_qty;
        })
        .map((item) => ({
          product_id: item.product.id,
          counted_qty: countedItems[item.product.id] ?? item.current_qty,
        }));

      // If no items have discrepancy, check if there are display quantity changes
      if (items.length === 0) {
        const displayUpdates = products
          .filter((item) => {
            const currentDisplay = (item.product as any).display_qty || 0;
            const newDisplay = displayItems[item.product.id] ?? currentDisplay;
            return newDisplay !== currentDisplay;
          })
          .map((item) => ({
            product_id: item.product.id,
            display_qty: displayItems[item.product.id] ?? ((item.product as any).display_qty || 0),
          }));

        if (displayUpdates.length > 0) {
          const displayResult = await updateDisplayQuantities(storeInfo.store_id, displayUpdates);
          if (displayResult.success) {
            setSuccessMessage('Display quantities updated successfully!');
            await fetchData();
          } else {
            setError('Failed to update display quantities');
          }
        } else {
          setSuccessMessage('No changes were made.');
        }
        setSubmitting(false);
        return;
      }

      const result = await submitStockOpname(storeInfo.store_id, items);

      // Also update display quantities (separate from stock opname)
      const displayUpdates = products
        .filter((item) => {
          const currentDisplay = (item.product as any).display_qty || 0;
          const newDisplay = displayItems[item.product.id] ?? currentDisplay;
          return newDisplay !== currentDisplay;
        })
        .map((item) => ({
          product_id: item.product.id,
          display_qty: displayItems[item.product.id] ?? ((item.product as any).display_qty || 0),
        }));

      if (displayUpdates.length > 0) {
        await updateDisplayQuantities(storeInfo.store_id, displayUpdates);
      }

      if (result.success) {
        setSuccessMessage('Stock opname submitted successfully! Inventory has been updated.');
        // Refresh data
        await fetchData();
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('Failed to submit stock opname');
      console.error('Error submitting stock opname:', err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-primary">{t('inventory.stockOpname')}</h1>
          <p className="text-secondary mt-1">{t('inventory.countInventory')}</p>
        </div>
        <SoftCard className="flex items-center justify-center py-12">
          <LoadingSpinner size="lg" />
        </SoftCard>
      </div>
    );
  }

  if (error && !products.length) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-primary">{t('inventory.stockOpname')}</h1>
          <p className="text-secondary mt-1">{t('inventory.countInventory')}</p>
        </div>
        <SoftCard className="bg-accent-redLight border border-accent-red/20">
          <p className="text-accent-red">{error}</p>
        </SoftCard>
      </div>
    );
  }

  if (!products.length) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-primary">{t('inventory.stockOpname')}</h1>
          <p className="text-secondary mt-1">{t('inventory.countInventory')}</p>
        </div>
        <EmptyState
          title={t('common.noData')}
          description={t('inventory.addProducts')}
          icon={
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          }
        />
      </div>
    );
  }

  const { totalDiscrepancy, itemsWithDiscrepancy } = getDiscrepancySummary();


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-primary">{t('inventory.stockOpname')}</h1>
          <p className="text-secondary mt-1">
            {storeInfo.store_name ? `${t('form.branch')}: ${storeInfo.store_name}` : t('inventory.countInventory')}
          </p>
        </div>
      </div>

      {/* Success/Error Messages */}
      {successMessage && (
        <SoftCard className="bg-accent-greenLight border border-accent-green/20">
          <FormSuccess message={successMessage} />
        </SoftCard>
      )}
      {error && (
        <SoftCard className="bg-accent-redLight border border-accent-red/20">
          <FormError message={error} />
        </SoftCard>
      )}

      {/* Stock Count Form */}
      <SoftCard>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-primary">{t('inventory.countInventory')}</h2>
          <p className="text-sm text-secondary">{t('inventory.enterActualCount')}</p>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <div className="flex-1">
            <Input
              type="text"
              placeholder={t('inventory.searchProducts') || 'Search by SKU or name...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex-1">
            <Select
              value={selectedSubCategory}
              onChange={(e) => setSelectedSubCategory(e.target.value)}
            >
              <option value="">{t('inventory.allSubCategories') || 'All Sub Categories'}</option>
              {PRODUCT_SUB_CATEGORIES.map((subCat) => (
                <option key={subCat.value} value={subCat.value}>
                  {subCat.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-secondary cursor-pointer">
              <input
                type="checkbox"
                checked={showAllProducts}
                onChange={(e) => setShowAllProducts(e.target.checked)}
                className="rounded border-secondary/30"
              />
              {t('inventory.showAllProducts') || 'Show all products'}
            </label>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-secondary/10">
                <th className="px-4 py-3 text-left text-xs font-semibold text-secondary uppercase tracking-wider">
                  {t('sales.product')}
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-secondary uppercase tracking-wider">
                  {t('form.sku')}
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-secondary uppercase tracking-wider">
                  {t('form.subCategory') || 'Sub Category'}
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-secondary uppercase tracking-wider">
                  {t('inventory.systemQty')}
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-secondary uppercase tracking-wider">
                  {t('inventory.displayQty') || 'Display Qty'}
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-secondary uppercase tracking-wider">
                  {t('inventory.countedQty')}
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-secondary uppercase tracking-wider">
                  {t('inventory.discrepancy')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary/10">
              {products.map((item) => {
                const counted = countedItems[item.product.id] ?? item.current_qty;
                const discrepancy = calculateDiscrepancy(counted, item.current_qty);
                
                return (
                  <tr key={item.product.id} className="hover:bg-background/50 transition-colors duration-150">
                    <td className="px-4 py-3 text-sm font-medium text-primary">
                      {item.product.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-center text-secondary">
                      {item.product.sku}
                    </td>
                    <td className="px-4 py-3 text-sm text-center text-secondary">
                      {(item.product as any).sub_category || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-center text-secondary">
                      {item.current_qty}
                    </td>
                    <td className="px-4 py-3">
                      <Input
                        type="number"
                        min="0"
                        value={displayItems[item.product.id] ?? ((item.product as any).display_qty || 0)}
                        onChange={(e) => handleDisplayChange(item.product.id, e.target.value)}
                        className="w-24 mx-auto text-center"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Input
                        type="number"
                        min="0"
                        value={counted}
                        onChange={(e) => handleCountChange(item.product.id, e.target.value)}
                        className="w-24 mx-auto text-center"
                      />
                    </td>
                    <td className={`px-4 py-3 text-sm text-center font-semibold ${
                      discrepancy > 0 ? 'text-accent-green' :
                      discrepancy < 0 ? 'text-accent-red' :
                      'text-secondary'
                    }`}>
                      {discrepancy > 0 ? `+${discrepancy}` : discrepancy}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Summary and Submit */}
        <div className="mt-6 pt-4 border-t border-secondary/10">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="text-sm text-secondary">
              <span className="font-medium">{itemsWithDiscrepancy}</span> {t('inventory.itemsWithDiscrepancy')}
              {itemsWithDiscrepancy > 0 && (
                <span className={`ml-2 font-semibold ${totalDiscrepancy >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                  ({t('common.total')}: {totalDiscrepancy > 0 ? `+${totalDiscrepancy}` : totalDiscrepancy})
                </span>
              )}
            </div>
            <Button
              onClick={handleSubmit}
              isLoading={submitting}
              disabled={submitting}
            >
              {t('inventory.submitOpname')}
            </Button>
          </div>
        </div>
      </SoftCard>


      {/* History Section */}
      {history.length > 0 && (
        <SoftCard>
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-primary">{t('inventory.recentOpname')}</h2>
            <p className="text-sm text-secondary">{t('inventory.previousSubmissions')}</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-secondary/10">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-secondary uppercase tracking-wider w-8">
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-secondary uppercase tracking-wider">
                    {t('common.date')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-secondary uppercase tracking-wider">
                    {t('sidebar.staff')}
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-secondary uppercase tracking-wider">
                    {t('inventory.itemsCounted')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary/10">
                {history.map((item) => (
                  <React.Fragment key={item.id}>
                    <tr 
                      className="hover:bg-background/50 transition-colors duration-150 cursor-pointer"
                      onClick={() => toggleHistoryExpand(item.id)}
                    >
                      <td className="px-4 py-3 text-sm text-secondary">
                        <svg 
                          className={`w-4 h-4 transition-transform ${expandedHistoryIds.has(item.id) ? 'rotate-90' : ''}`} 
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </td>
                      <td className="px-4 py-3 text-sm text-primary">
                        {new Date(item.submitted_at).toLocaleString('id-ID', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </td>
                      <td className="px-4 py-3 text-sm text-secondary">
                        {item.staff?.full_name || 'Unknown'}
                      </td>
                      <td className="px-4 py-3 text-sm text-center text-secondary">
                        {item.items_count}
                      </td>
                    </tr>
                    {/* Expanded row with item details */}
                    {expandedHistoryIds.has(item.id) && (
                      <tr key={`${item.id}-details`}>
                        <td colSpan={4} className="px-4 py-3 bg-background/30">
                          <div className="pl-8">
                            {loadingHistoryItems.has(item.id) ? (
                              <div className="flex items-center justify-center py-4">
                                <LoadingSpinner size="sm" />
                              </div>
                            ) : historyItemsCache[item.id] && historyItemsCache[item.id].length > 0 ? (
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b border-secondary/10">
                                    <th className="px-2 py-2 text-left text-xs font-semibold text-secondary">{t('sales.product')}</th>
                                    <th className="px-2 py-2 text-center text-xs font-semibold text-secondary">{t('form.sku')}</th>
                                    <th className="px-2 py-2 text-center text-xs font-semibold text-secondary">{t('inventory.systemQty')}</th>
                                    <th className="px-2 py-2 text-center text-xs font-semibold text-secondary">{t('inventory.displayQty') || 'Display'}</th>
                                    <th className="px-2 py-2 text-center text-xs font-semibold text-secondary">{t('inventory.countedQty')}</th>
                                    <th className="px-2 py-2 text-center text-xs font-semibold text-secondary">{t('inventory.discrepancy')}</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {historyItemsCache[item.id].map((detail, idx) => (
                                    <tr key={idx} className="border-b border-secondary/5">
                                      <td className="px-2 py-2 text-primary">{detail.product_name}</td>
                                      <td className="px-2 py-2 text-center text-secondary">{detail.product_sku}</td>
                                      <td className="px-2 py-2 text-center text-secondary">{detail.previous_qty}</td>
                                      <td className="px-2 py-2 text-center text-secondary">-</td>
                                      <td className="px-2 py-2 text-center text-secondary">{detail.counted_qty}</td>
                                      <td className={`px-2 py-2 text-center font-semibold ${
                                        detail.discrepancy > 0 ? 'text-accent-green' :
                                        detail.discrepancy < 0 ? 'text-accent-red' :
                                        'text-secondary'
                                      }`}>
                                        {detail.discrepancy > 0 ? `+${detail.discrepancy}` : detail.discrepancy}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            ) : (
                              <p className="text-sm text-secondary py-2">{t('common.noData')}</p>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {historyTotal > HISTORY_PAGE_SIZE && (
            <div className="mt-4 pt-4 border-t border-secondary/10 flex items-center justify-between">
              <p className="text-sm text-secondary">
                {t('auditLog.showing')} {(historyPage - 1) * HISTORY_PAGE_SIZE + 1}-{Math.min(historyPage * HISTORY_PAGE_SIZE, historyTotal)} {t('auditLog.of')} {historyTotal}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                  disabled={historyPage === 1}
                >
                  {t('common.previous')}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setHistoryPage((p) => p + 1)}
                  disabled={historyPage * HISTORY_PAGE_SIZE >= historyTotal}
                >
                  {t('common.next')}
                </Button>
              </div>
            </div>
          )}
        </SoftCard>
      )}

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <SoftCard className="max-w-md w-full">
            <h3 className="text-lg font-semibold text-primary mb-2">{t('inventory.confirmOpname')}</h3>
            <p className="text-secondary mb-4">
              {t('inventory.confirmOpnameMessage')}
            </p>
            
            {itemsWithDiscrepancy > 0 && (
              <div className="bg-background rounded-xl p-4 mb-4">
                <p className="text-sm font-medium text-primary">{t('inventory.discrepancySummary')}:</p>
                <p className="text-sm text-secondary">
                  {itemsWithDiscrepancy} {t('inventory.itemsWithDiscrepancy')}
                </p>
                <p className={`text-sm font-semibold ${totalDiscrepancy >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                  {t('common.total')}: {totalDiscrepancy > 0 ? `+${totalDiscrepancy}` : totalDiscrepancy} {t('inventory.totalUnits')}
                </p>
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <Button
                variant="secondary"
                onClick={() => setShowConfirmDialog(false)}
                disabled={submitting}
              >
                {t('common.cancel')}
              </Button>
              <Button
                onClick={confirmSubmit}
                isLoading={submitting}
                disabled={submitting}
              >
                {t('common.confirm')}
              </Button>
            </div>
          </SoftCard>
        </div>
      )}
    </div>
  );
}
