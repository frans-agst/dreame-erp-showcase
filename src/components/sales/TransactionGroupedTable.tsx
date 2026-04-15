// src/components/sales/TransactionGroupedTable.tsx
// Component for displaying transaction-grouped weekly sales
// Requirements: 4.1, 4.2, 4.3, 4.5, 5.1

'use client';

import React, { useState } from 'react';
import { TransactionGroupItem, GiftItem } from '@/types';
import { TransactionExporter } from '@/components/exports/TransactionExporter';
import { deleteTransaction } from '@/actions/transactions';
import { useI18n } from '@/lib/i18n/context';

interface TransactionGroupedTableProps {
  transactions: TransactionGroupItem[];
  loading?: boolean;
  userRole?: string;
  onTransactionDeleted?: () => void;
}

// Format number as currency
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

// Format date for display
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('id-ID', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// Format gift details for display
function formatGiftProducts(giftDetails: GiftItem[] | null | undefined, legacyGift: string | null | undefined): string {
  if (giftDetails && giftDetails.length > 0) {
    return giftDetails.map(g => `${g.name} (${g.qty})`).join(', ');
  }
  if (legacyGift && legacyGift.trim() !== '') {
    return legacyGift;
  }
  return '-';
}

export function TransactionGroupedTable({ transactions, loading, userRole, onTransactionDeleted }: TransactionGroupedTableProps) {
  const { t } = useI18n();
  // Start with all transactions collapsed
  const [expandedTransactions, setExpandedTransactions] = useState<Set<string>>(new Set());
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const isAdminOrManager = userRole === 'admin' || userRole === 'manager';
  const canDelete = isAdminOrManager || userRole === 'staff';

  const toggleTransaction = (key: string) => {
    setExpandedTransactions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  const handleDelete = async (transactionId: string) => {
    if (!confirm('Are you sure you want to delete this transaction? This action cannot be undone.')) {
      return;
    }

    console.log('Deleting transaction:', transactionId);
    setDeletingId(transactionId);
    try {
      const result = await deleteTransaction(transactionId, 'Deleted from weekly report');
      
      console.log('Delete result:', result);
      
      if (result.success) {
        alert('Transaction deleted successfully');
        console.log('Calling onTransactionDeleted callback');
        onTransactionDeleted?.();
      } else {
        alert(result.error || 'Failed to delete transaction');
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('An error occurred while deleting the transaction');
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8 text-secondary">
        {t('common.loading') || 'Loading...'}
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="text-center py-8 text-secondary">
        {t('weeklyReport.noData') || 'No data available'}
      </div>
    );
  }

  // Debug: log first transaction to see structure
  console.log('First transaction:', transactions[0]);

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-secondary/20">
        <thead className="bg-surface/50">
          <tr>
            <th className="px-3 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider w-8"></th>
            <th className="px-3 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">
              {t('common.date') || 'Date'}
            </th>
            <th className="px-3 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">
              {t('weeklyReport.week') || 'Week'}
            </th>
            <th className="px-3 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">
              {t('weeklyReport.accountName') || 'Account'}
            </th>
            <th className="px-3 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">
              {t('weeklyReport.storeName') || 'Store'}
            </th>
            <th className="px-3 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">
              {t('sidebar.staff') || 'Staff'}
            </th>
            <th className="px-3 py-3 text-right text-xs font-medium text-secondary uppercase tracking-wider">
              {t('weeklyReport.items') || 'Items'}
            </th>
            <th className="px-3 py-3 text-right text-xs font-medium text-secondary uppercase tracking-wider">
              {t('common.quantity') || 'QTY'}
            </th>
            <th className="px-3 py-3 text-right text-xs font-medium text-secondary uppercase tracking-wider">
              {t('common.discount') || 'Discount'}
            </th>
            <th className="px-3 py-3 text-right text-xs font-medium text-secondary uppercase tracking-wider">
              {t('weeklyReport.total') || 'Total'}
            </th>
            <th className="px-3 py-3 text-center text-xs font-medium text-secondary uppercase tracking-wider">
              Single-Export
            </th>
            {canDelete && (
              <th className="px-3 py-3 text-center text-xs font-medium text-secondary uppercase tracking-wider">
                Delete
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-secondary/10">
          {transactions.map((transaction) => {
            const key = transaction.transaction_id || `legacy-${transaction.items[0]?.id}`;
            const isExpanded = expandedTransactions.has(key);

            return (
              <React.Fragment key={key}>
                {/* Transaction Summary Row */}
                <tr className="hover:bg-surface/30 transition-colors">
                  <td className="px-3 py-4 whitespace-nowrap">
                    <button
                      onClick={() => toggleTransaction(key)}
                      className="text-accent-blue hover:text-accent-blueLight font-bold text-lg transition-transform"
                      style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
                      title={isExpanded ? 'Collapse' : 'Expand'}
                      type="button"
                    >
                      ▶
                    </button>
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-primary font-medium">
                    {formatDate(transaction.sale_date) || '-'}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-primary font-medium">
                    Week {transaction.fiscal_week || '-'}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-primary font-medium">
                    {transaction.account_name || '-'}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-primary font-medium">
                    {transaction.store_name || '-'}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-primary font-medium">
                    {transaction.staff_name || '-'}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-primary text-right font-semibold">
                    {transaction.item_count || 0}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-primary text-right font-semibold">
                    {transaction.total_quantity || 0}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-accent-red text-right font-medium">
                    {formatCurrency(transaction.total_discount || 0)}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-accent-green text-right font-semibold">
                    {formatCurrency(transaction.total_after_discount || 0)}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-center">
                    {transaction.transaction_id ? (
                      <TransactionExporter
                        transactionId={transaction.transaction_id}
                        variant="secondary"
                        size="sm"
                        showLabel={false}
                      />
                    ) : (
                      <span className="text-secondary">-</span>
                    )}
                  </td>
                  {canDelete && (
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-center">
                      {transaction.transaction_id ? (
                        <button
                          onClick={() => handleDelete(transaction.transaction_id!)}
                          disabled={deletingId === transaction.transaction_id}
                          className="text-accent-red hover:text-accent-red/80 disabled:opacity-50 text-xs px-2 py-1 rounded border border-accent-red hover:bg-accent-red/10 transition-colors"
                          type="button"
                        >
                          {deletingId === transaction.transaction_id ? 'Deleting...' : 'Delete'}
                        </button>
                      ) : (
                        <span className="text-secondary">-</span>
                      )}
                    </td>
                  )}
                </tr>

                {/* Expanded Transaction Details */}
                {isExpanded && (
                  <tr>
                    <td colSpan={canDelete ? 12 : 11} className="px-0 py-0 bg-surface/50">
                      <div className="px-6 py-4">
                        <h4 className="text-sm font-semibold text-primary mb-3">
                          {t('weeklyReport.transactionDetails') || 'Transaction Details'}
                        </h4>
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-secondary/20 rounded-lg">
                            <thead className="bg-surface/30">
                              <tr>
                                <th className="px-3 py-2 text-left text-xs font-medium text-secondary uppercase">
                                  {t('form.sku') || 'SKU'}
                                </th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-secondary uppercase">
                                  {t('weeklyReport.productName') || 'Product'}
                                </th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-secondary uppercase">
                                  {t('form.category') || 'Category'}
                                </th>
                                <th className="px-3 py-2 text-right text-xs font-medium text-secondary uppercase">
                                  {t('common.quantity') || 'QTY'}
                                </th>
                                <th className="px-3 py-2 text-right text-xs font-medium text-secondary uppercase">
                                  {t('weeklyReport.sellThru') || 'Unit Price'}
                                </th>
                                <th className="px-3 py-2 text-right text-xs font-medium text-secondary uppercase">
                                  {t('common.discount') || 'Discount'}
                                </th>
                                <th className="px-3 py-2 text-right text-xs font-medium text-secondary uppercase">
                                  {t('weeklyReport.total') || 'Total'}
                                </th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-secondary uppercase">
                                  {t('weeklyReport.giftProducts') || 'Gifts'}
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-secondary/10">
                              {transaction.items.map((item) => (
                                <tr key={item.id} className="hover:bg-surface/20">
                                  <td className="px-3 py-2 text-sm text-primary">{item.sku}</td>
                                  <td className="px-3 py-2 text-sm text-primary">{item.product_name}</td>
                                  <td className="px-3 py-2 text-sm text-primary">
                                    {item.category || '-'}
                                    {item.sub_category && ` / ${item.sub_category}`}
                                  </td>
                                  <td className="px-3 py-2 text-sm text-primary text-right">{item.quantity}</td>
                                  <td className="px-3 py-2 text-sm text-primary text-right">
                                    {formatCurrency(item.unit_price)}
                                  </td>
                                  <td className="px-3 py-2 text-sm text-accent-red text-right">
                                    {formatCurrency(item.discount)}
                                  </td>
                                  <td className="px-3 py-2 text-sm text-accent-green text-right font-semibold">
                                    {formatCurrency(item.total_price)}
                                  </td>
                                  <td className="px-3 py-2 text-sm text-primary">
                                    {formatGiftProducts(item.gift_details, item.gift)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
