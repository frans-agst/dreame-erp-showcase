'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { SoftCard } from '@/components/ui/SoftCard';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { getDealerPurchaseOrders, PaginatedDealerPOResult } from '@/actions/dealer';
import { PurchaseOrder } from '@/types';
import { useI18n } from '@/lib/i18n/context';

// Format number as currency
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

// Format date
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// Get status variant for badge
function getStatusVariant(status: string): 'red' | 'yellow' | 'green' {
  switch (status) {
    case 'confirmed':
      return 'green';
    case 'draft':
      return 'yellow';
    case 'cancelled':
      return 'red';
    default:
      return 'yellow';
  }
}

export default function DealerPurchaseOrdersPage() {
  const { t } = useI18n();
  const [data, setData] = useState<PaginatedDealerPOResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    async function loadOrders() {
      setLoading(true);
      try {
        const result = await getDealerPurchaseOrders({
          status: statusFilter || undefined,
          page,
          page_size: 10,
        });
        if (result.success) {
          setData(result.data);
        } else {
          setError(result.error);
        }
      } catch (err) {
        console.error('Error loading orders:', err);
        setError('Failed to load purchase orders');
      } finally {
        setLoading(false);
      }
    }

    loadOrders();
  }, [statusFilter, page]);

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setStatusFilter(e.target.value);
    setPage(1);
  };

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <SoftCard className="text-center p-8">
          <svg className="w-12 h-12 text-accent-red mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-secondary">{error}</p>
        </SoftCard>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-primary">{t('purchaseOrders.title')}</h1>
          <p className="text-secondary mt-1">{t('dealer.manageOrders')}</p>
        </div>
        <Link href="/dealer/purchase-orders/new">
          <Button>
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {t('common.new')} {t('purchaseOrders.title')}
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <SoftCard>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="w-full sm:w-48">
            <label className="block text-sm font-medium text-secondary mb-1">{t('common.status')}</label>
            <Select value={statusFilter} onChange={handleStatusChange}>
              <option value="">{t('common.all')} {t('common.status')}</option>
              <option value="draft">{t('purchaseOrders.draft')}</option>
              <option value="confirmed">{t('purchaseOrders.confirmed')}</option>
              <option value="cancelled">{t('purchaseOrders.cancelled')}</option>
            </Select>
          </div>
        </div>
      </SoftCard>

      {/* Orders Table */}
      <SoftCard>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : !data || data.data.length === 0 ? (
          <div className="text-center py-12">
            <svg className="w-12 h-12 text-secondary mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-secondary mb-4">{t('dealer.noPurchaseOrders')}</p>
            <Link href="/dealer/purchase-orders/new">
              <Button variant="secondary">{t('dealer.createYourFirstOrder')}</Button>
            </Link>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-sm font-medium text-secondary">{t('purchaseOrders.poNumber')}</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-secondary">{t('common.date')}</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-secondary">{t('dealer.items')}</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-secondary">{t('common.status')}</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-secondary">{t('common.total')}</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-secondary">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((order: PurchaseOrder) => (
                    <tr key={order.id} className="border-b border-border/50 hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                      <td className="py-3 px-4">
                        <span className="font-medium text-primary">{order.po_number}</span>
                      </td>
                      <td className="py-3 px-4 text-secondary">
                        {formatDate(order.po_date)}
                      </td>
                      <td className="py-3 px-4 text-secondary">
                        {order.items?.length || 0} {t('dealer.items')}
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge
                          status={getStatusVariant(order.status)}
                          label={t(`purchaseOrders.${order.status}`)}
                        />
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-primary">
                        {formatCurrency(order.grand_total)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link
                          href={`/dealer/purchase-orders/${order.id}`}
                          className="text-blue-600 hover:text-blue-700 font-medium text-sm"
                        >
                          {t('common.view')}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {data.total_pages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                <p className="text-sm text-secondary">
                  {t('auditLog.showing')} {((page - 1) * data.page_size) + 1} {t('auditLog.to')} {Math.min(page * data.page_size, data.total)} {t('auditLog.of')} {data.total}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    {t('common.previous')}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setPage(p => Math.min(data.total_pages, p + 1))}
                    disabled={page === data.total_pages}
                  >
                    {t('common.next')}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </SoftCard>
    </div>
  );
}
