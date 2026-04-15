'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { SoftCard } from '@/components/ui/SoftCard';
import { MetricCard } from '@/components/ui/MetricCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { getDealerDashboard, DealerDashboardData } from '@/actions/dealer';
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

export default function DealerDashboardPage() {
  const { t } = useI18n();
  const [data, setData] = useState<DealerDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDashboard() {
      try {
        const result = await getDealerDashboard();
        if (result.success) {
          setData(result.data);
        } else {
          setError(result.error);
        }
      } catch (err) {
        console.error('Error loading dashboard:', err);
        setError('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

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

  if (!data) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-primary">{t('dealer.dashboard')}</h1>
          <p className="text-secondary mt-1">{t('common.welcome')}</p>
        </div>
        <Link
          href="/dealer/purchase-orders/new"
          className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {t('purchaseOrders.createPO')}
        </Link>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title={`${t('dealer.totalPurchases')} (${t('dealer.ytd')})`}
          value={formatCurrency(data.total_purchases_ytd)}
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          }
        />
        <MetricCard
          title={`${t('dealer.totalPurchases')} (${t('dealer.mtd')})`}
          value={formatCurrency(data.total_purchases_mtd)}
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          }
        />
        <MetricCard
          title={t('dealer.availableCredit')}
          value={formatCurrency(data.available_credit)}
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          }
        />
        <MetricCard
          title={t('dealer.pendingOrders')}
          value={data.pending_pos.toString()}
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
      </div>

      {/* Recent Orders */}
      <SoftCard>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-primary">{t('dealer.recentOrders')}</h2>
          <Link
            href="/dealer/purchase-orders"
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            {t('common.view')} {t('common.all')} →
          </Link>
        </div>

        {data.recent_orders.length === 0 ? (
          <div className="text-center py-8">
            <svg className="w-12 h-12 text-secondary mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-secondary">{t('dealer.noOrders')}</p>
            <Link
              href="/dealer/purchase-orders/new"
              className="inline-block mt-4 text-blue-600 hover:text-blue-700 font-medium"
            >
              {t('dealer.createFirstOrder')} →
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-sm font-medium text-secondary">{t('purchaseOrders.poNumber')}</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-secondary">{t('common.date')}</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-secondary">{t('common.status')}</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-secondary">{t('common.total')}</th>
                </tr>
              </thead>
              <tbody>
                {data.recent_orders.map((order: PurchaseOrder) => (
                  <tr key={order.id} className="border-b border-border/50 hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                    <td className="py-3 px-4">
                      <Link
                        href={`/dealer/purchase-orders/${order.id}`}
                        className="text-blue-600 hover:text-blue-700 font-medium"
                      >
                        {order.po_number}
                      </Link>
                    </td>
                    <td className="py-3 px-4 text-secondary">
                      {formatDate(order.po_date)}
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SoftCard>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link href="/dealer/purchase-orders/new">
          <SoftCard className="hover:shadow-lg transition-shadow cursor-pointer">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-primary">{t('purchaseOrders.createPO')}</h3>
                <p className="text-sm text-secondary">{t('dealer.orderAtDealerPrices')}</p>
              </div>
            </div>
          </SoftCard>
        </Link>

        <Link href="/dealer/credit-notes">
          <SoftCard className="hover:shadow-lg transition-shadow cursor-pointer">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-primary">{t('dealer.viewCreditNotes')}</h3>
                <p className="text-sm text-secondary">{t('dealer.checkCredits')}</p>
              </div>
            </div>
          </SoftCard>
        </Link>
      </div>
    </div>
  );
}
