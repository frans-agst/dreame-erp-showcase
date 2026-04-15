'use client';

import { useState, useEffect } from 'react';
import { SoftCard } from '@/components/ui/SoftCard';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { getTransactions, searchTransactions } from '@/actions/transactions';
import { exportTransactionExcel, exportTransactionPDF } from '@/actions/exports';
import { getStores, getStaff } from '@/actions/master-data';
import { useI18n } from '@/lib/i18n/context';
import type { Transaction, TransactionFilter } from '@/types';

interface TransactionListProps {
  onTransactionSelect?: (transaction: Transaction) => void;
  onExportTransaction?: (transactionId: string, format: 'pdf' | 'excel') => void;
}

export function TransactionList({ onTransactionSelect, onExportTransaction }: TransactionListProps) {
  const { t } = useI18n();
  
  // State management
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  
  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<TransactionFilter>({
    start_date: '',
    end_date: '',
    store_id: '',
    staff_id: '',
    min_total: undefined,
    max_total: undefined,
    inventory_source: undefined
  });

  // Load master data on mount
  useEffect(() => {
    async function loadMasterData() {
      try {
        const [storesRes, staffRes] = await Promise.all([
          getStores(true),
          getStaff(true)
        ]);

        if (storesRes.success) setStores(storesRes.data);
        if (staffRes.success) setStaffList(staffRes.data);
      } catch (error) {
        console.error('Error loading master data:', error);
      }
    }
    loadMasterData();
  }, []);

  // Load transactions
  useEffect(() => {
    loadTransactions();
  }, []);

  const loadTransactions = async () => {
    setIsLoading(true);
    try {
      const result = await getTransactions(filters);
      if (result.success && result.data) {
        setTransactions(result.data);
      }
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle search
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadTransactions();
      return;
    }

    setIsSearching(true);
    try {
      const result = await searchTransactions(searchQuery, filters);
      if (result.success && result.data) {
        setTransactions(result.data);
      }
    } catch (error) {
      console.error('Error searching transactions:', error);
    } finally {
      setIsSearching(false);
    }
  };

  // Handle filter change
  const handleFilterChange = (key: keyof TransactionFilter, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  // Apply filters
  const applyFilters = () => {
    if (searchQuery.trim()) {
      handleSearch();
    } else {
      loadTransactions();
    }
  };

  // Reset filters
  const resetFilters = () => {
    setSearchQuery('');
    setFilters({
      start_date: '',
      end_date: '',
      store_id: '',
      staff_id: '',
      min_total: undefined,
      max_total: undefined,
      inventory_source: undefined
    });
    setTimeout(() => loadTransactions(), 0);
  };

  // View transaction details
  const viewTransactionDetails = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setShowDetailModal(true);
    onTransactionSelect?.(transaction);
  };

  // Close detail modal
  const closeDetailModal = () => {
    setShowDetailModal(false);
    setSelectedTransaction(null);
  };

  // Handle export
  const handleExport = async (transactionId: string, format: 'pdf' | 'excel') => {
    try {
      if (format === 'excel') {
        const result = await exportTransactionExcel(transactionId);
        if (result.success && result.data) {
          // Create download link and trigger download
          const { blob, filename } = result.data;
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        } else {
          alert(result.error || 'Export failed');
        }
      } else {
        const result = await exportTransactionPDF(transactionId);
        if (result.success && result.data) {
          // Create download link and trigger download
          const { blob, filename } = result.data;
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        } else {
          alert(result.error || 'Export failed');
        }
      }
    } catch (error) {
      console.error('Export error:', error);
      alert('An error occurred during export');
    }
    
    // Also call the optional callback if provided
    onExportTransaction?.(transactionId, format);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <SoftCard>
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-primary">
            {t('sales.searchTransactions') || 'Search Transactions'}
          </h3>

          {/* Search Bar */}
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder={t('sales.searchPlaceholder') || 'Search by transaction ID, customer name, or phone...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="flex-1"
            />
            <Button
              onClick={handleSearch}
              isLoading={isSearching}
              disabled={isSearching}
            >
              {t('common.search') || 'Search'}
            </Button>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <FormField label={t('sales.startDate') || 'Start Date'} htmlFor="start_date">
              <Input
                id="start_date"
                type="date"
                value={filters.start_date || ''}
                onChange={(e) => handleFilterChange('start_date', e.target.value)}
              />
            </FormField>

            <FormField label={t('sales.endDate') || 'End Date'} htmlFor="end_date">
              <Input
                id="end_date"
                type="date"
                value={filters.end_date || ''}
                onChange={(e) => handleFilterChange('end_date', e.target.value)}
              />
            </FormField>

            <FormField label={t('form.store') || 'Store'} htmlFor="store_id">
              <Select
                id="store_id"
                value={filters.store_id || ''}
                onChange={(e) => handleFilterChange('store_id', e.target.value)}
              >
                <option value="">{t('common.all') || 'All Stores'}</option>
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label={t('sales.staff') || 'Staff'} htmlFor="staff_id">
              <Select
                id="staff_id"
                value={filters.staff_id || ''}
                onChange={(e) => handleFilterChange('staff_id', e.target.value)}
              >
                <option value="">{t('common.all') || 'All Staff'}</option>
                {staffList.map((staff) => (
                  <option key={staff.id} value={staff.id}>
                    {staff.full_name}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label={t('sales.minTotal') || 'Min Total'} htmlFor="min_total">
              <Input
                id="min_total"
                type="number"
                step="0.01"
                min="0"
                value={filters.min_total || ''}
                onChange={(e) => handleFilterChange('min_total', e.target.value ? parseFloat(e.target.value) : undefined)}
                placeholder="0"
              />
            </FormField>

            <FormField label={t('sales.maxTotal') || 'Max Total'} htmlFor="max_total">
              <Input
                id="max_total"
                type="number"
                step="0.01"
                min="0"
                value={filters.max_total || ''}
                onChange={(e) => handleFilterChange('max_total', e.target.value ? parseFloat(e.target.value) : undefined)}
                placeholder="0"
              />
            </FormField>
          </div>

          {/* Filter Actions */}
          <div className="flex gap-2">
            <Button onClick={applyFilters} variant="primary">
              {t('common.applyFilters') || 'Apply Filters'}
            </Button>
            <Button onClick={resetFilters} variant="secondary">
              {t('common.reset') || 'Reset'}
            </Button>
          </div>
        </div>
      </SoftCard>

      {/* Transaction List */}
      <SoftCard>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-primary">
              {t('sales.transactions') || 'Transactions'} ({transactions.length})
            </h3>
          </div>

          {transactions.length === 0 ? (
            <EmptyState
              title={t('sales.noTransactions') || 'No transactions found'}
              description={t('sales.noTransactionsDesc') || 'Try adjusting your search or filters'}
            />
          ) : (
            <div className="space-y-3">
              {transactions.map((transaction) => (
                <TransactionCard
                  key={transaction.id}
                  transaction={transaction}
                  onViewDetails={viewTransactionDetails}
                  onExport={handleExport}
                />
              ))}
            </div>
          )}
        </div>
      </SoftCard>

      {/* Transaction Detail Modal */}
      {showDetailModal && selectedTransaction && (
        <TransactionDetailModal
          transaction={selectedTransaction}
          onClose={closeDetailModal}
          onExport={handleExport}
        />
      )}
    </div>
  );
}

// Transaction Card Component
interface TransactionCardProps {
  transaction: Transaction;
  onViewDetails: (transaction: Transaction) => void;
  onExport: (transactionId: string, format: 'pdf' | 'excel') => void;
}

function TransactionCard({ transaction, onViewDetails, onExport }: TransactionCardProps) {
  const { t } = useI18n();
  
  return (
    <div className="border border-secondary/20 rounded-lg p-4 hover:border-accent-green/50 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-sm font-mono text-secondary">
              #{transaction.id.slice(0, 8)}
            </span>
            <span className="text-sm text-secondary">
              {new Date(transaction.transaction_date).toLocaleDateString('id-ID')}
            </span>
            <span className={`text-xs px-2 py-1 rounded ${
              transaction.inventory_source === 'in_store' 
                ? 'bg-accent-greenLight text-accent-green' 
                : 'bg-accent-blueLight text-accent-blue'
            }`}>
              {transaction.inventory_source === 'in_store' ? 'In Store' : 'Warehouse'}
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-secondary">{t('form.store') || 'Store'}:</span>
              <p className="text-primary font-medium">{transaction.store?.name || '-'}</p>
            </div>
            <div>
              <span className="text-secondary">{t('sales.staff') || 'Staff'}:</span>
              <p className="text-primary font-medium">{transaction.staff?.full_name || '-'}</p>
            </div>
            <div>
              <span className="text-secondary">{t('sales.items') || 'Items'}:</span>
              <p className="text-primary font-medium">{transaction.items?.length || 0}</p>
            </div>
            <div>
              <span className="text-secondary">{t('sales.total') || 'Total'}:</span>
              <p className="text-accent-green font-semibold">
                Rp {transaction.total_after_discount.toLocaleString('id-ID')}
              </p>
            </div>
          </div>

          {transaction.customer_name && (
            <div className="text-sm">
              <span className="text-secondary">{t('sales.customer') || 'Customer'}:</span>
              <span className="text-primary ml-2">
                {transaction.customer_name}
                {transaction.customer_phone && ` (${transaction.customer_phone})`}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 ml-4">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onViewDetails(transaction)}
          >
            {t('common.viewDetails') || 'View Details'}
          </Button>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onExport(transaction.id, 'pdf')}
              title="Export PDF"
            >
              PDF
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onExport(transaction.id, 'excel')}
              title="Export Excel"
            >
              Excel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Transaction Detail Modal Component
interface TransactionDetailModalProps {
  transaction: Transaction;
  onClose: () => void;
  onExport: (transactionId: string, format: 'pdf' | 'excel') => void;
}

function TransactionDetailModal({ transaction, onClose, onExport }: TransactionDetailModalProps) {
  const { t } = useI18n();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-background border-b border-secondary/20 p-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-primary">
            {t('sales.transactionDetails') || 'Transaction Details'}
          </h2>
          <Button variant="secondary" size="sm" onClick={onClose}>
            {t('common.close') || 'Close'}
          </Button>
        </div>

        <div className="p-6 space-y-6">
          {/* Transaction Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-secondary">{t('sales.transactionId') || 'Transaction ID'}</label>
              <p className="text-primary font-mono">{transaction.id}</p>
            </div>
            <div>
              <label className="text-sm text-secondary">{t('sales.transactionDate') || 'Date'}</label>
              <p className="text-primary">{new Date(transaction.transaction_date).toLocaleDateString('id-ID')}</p>
            </div>
            <div>
              <label className="text-sm text-secondary">{t('form.store') || 'Store'}</label>
              <p className="text-primary">{transaction.store?.name || '-'}</p>
            </div>
            <div>
              <label className="text-sm text-secondary">{t('sales.staff') || 'Staff'}</label>
              <p className="text-primary">{transaction.staff?.full_name || '-'}</p>
            </div>
            <div>
              <label className="text-sm text-secondary">Inventory Source</label>
              <p className="text-primary capitalize">{transaction.inventory_source.replace('_', ' ')}</p>
            </div>
            {transaction.customer_name && (
              <>
                <div>
                  <label className="text-sm text-secondary">{t('sales.customerName') || 'Customer Name'}</label>
                  <p className="text-primary">{transaction.customer_name}</p>
                </div>
                {transaction.customer_phone && (
                  <div>
                    <label className="text-sm text-secondary">{t('sales.customerPhone') || 'Customer Phone'}</label>
                    <p className="text-primary">{transaction.customer_phone}</p>
                  </div>
                )}
              </>
            )}
            {transaction.notes && (
              <div className="md:col-span-2">
                <label className="text-sm text-secondary">{t('sales.notes') || 'Notes'}</label>
                <p className="text-primary">{transaction.notes}</p>
              </div>
            )}
          </div>

          {/* Transaction Items */}
          <div>
            <h3 className="text-lg font-medium text-primary mb-4">
              {t('sales.items') || 'Items'}
            </h3>
            <div className="space-y-3">
              {transaction.items.map((item, index) => (
                <div key={item.id} className="border border-secondary/20 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-medium text-primary">
                          {index + 1}. {item.product?.name || 'Unknown Product'}
                        </span>
                        <span className="text-xs text-secondary">
                          ({item.product?.sku || '-'})
                        </span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div>
                          <span className="text-secondary">{t('common.quantity') || 'Quantity'}:</span>
                          <p className="text-primary font-medium">{item.quantity}</p>
                        </div>
                        <div>
                          <span className="text-secondary">{t('sales.unitPrice') || 'Unit Price'}:</span>
                          <p className="text-primary font-medium">Rp {item.unit_price.toLocaleString('id-ID')}</p>
                        </div>
                        <div>
                          <span className="text-secondary">{t('sales.discount') || 'Discount'}:</span>
                          <p className="text-primary font-medium">Rp {item.line_discount.toLocaleString('id-ID')}</p>
                        </div>
                        <div>
                          <span className="text-secondary">{t('sales.lineTotal') || 'Line Total'}:</span>
                          <p className="text-accent-green font-semibold">Rp {item.line_total.toLocaleString('id-ID')}</p>
                        </div>
                      </div>
                      {item.gift_details && item.gift_details.length > 0 && (
                        <div className="mt-2 text-sm">
                          <span className="text-secondary">{t('sales.gifts') || 'Gifts'}:</span>
                          <div className="ml-2 space-y-1">
                            {item.gift_details.map((gift, giftIndex) => (
                              <p key={giftIndex} className="text-primary">
                                • {gift.name} x {gift.qty}
                              </p>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Transaction Totals */}
          <div className="bg-accent-greenLight rounded-lg p-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-secondary">{t('sales.subtotal') || 'Subtotal'}</span>
                <span className="text-primary font-medium">
                  Rp {transaction.total_before_discount.toLocaleString('id-ID')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-secondary">{t('sales.totalDiscount') || 'Total Discount'}</span>
                <span className="text-primary font-medium">
                  Rp {transaction.total_discount.toLocaleString('id-ID')}
                </span>
              </div>
              <div className="flex justify-between text-lg font-semibold border-t border-secondary/20 pt-2">
                <span className="text-primary">{t('sales.total') || 'Total'}</span>
                <span className="text-accent-green">
                  Rp {transaction.total_after_discount.toLocaleString('id-ID')}
                </span>
              </div>
            </div>
          </div>

          {/* Export Actions */}
          <div className="flex gap-2 justify-end">
            <Button
              variant="secondary"
              onClick={() => onExport(transaction.id, 'pdf')}
            >
              {t('common.exportPdf') || 'Export PDF'}
            </Button>
            <Button
              variant="secondary"
              onClick={() => onExport(transaction.id, 'excel')}
            >
              {t('common.exportExcel') || 'Export Excel'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
