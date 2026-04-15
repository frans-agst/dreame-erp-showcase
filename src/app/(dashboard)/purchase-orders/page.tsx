'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { getPurchaseOrders, updatePOStatus, deletePurchaseOrder, POFilters, PaginatedPOResult } from '@/actions/purchase-orders';
import { DataTable, Column } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { SoftCard } from '@/components/ui/SoftCard';
import { PurchaseOrder, POStatus } from '@/types';
import { useI18n } from '@/lib/i18n/context';
import { ImportPOModal } from '@/components/purchase-orders/ImportPOModal';

// Status badge component for PO status
function POStatusBadge({ status }: { status: POStatus }) {
  const styles: Record<POStatus, { bg: string; text: string }> = {
    draft: { bg: 'bg-gray-100', text: 'text-gray-600' },
    confirmed: { bg: 'bg-accent-greenLight', text: 'text-accent-green' },
    cancelled: { bg: 'bg-accent-redLight', text: 'text-accent-red' },
  };

  const labels: Record<POStatus, string> = {
    draft: 'Draft',
    confirmed: 'Confirmed',
    cancelled: 'Cancelled',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${styles[status].bg} ${styles[status].text}`}>
      {labels[status]}
    </span>
  );
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

// Format date
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('id-ID', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function PurchaseOrdersPage() {
  const { t } = useI18n();
  const [result, setResult] = useState<PaginatedPOResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<POStatus | ''>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const fetchPurchaseOrders = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const filters: POFilters = {
        page: currentPage,
        page_size: 10,
      };

      if (statusFilter) {
        filters.status = statusFilter;
      }
      if (startDate) {
        filters.start_date = startDate;
      }
      if (endDate) {
        filters.end_date = endDate;
      }

      const response = await getPurchaseOrders(filters);

      if (response.success) {
        setResult(response.data);
      } else {
        setError(response.error);
      }
    } catch (err) {
      setError('Failed to load purchase orders');
      console.error('Error fetching purchase orders:', err);
    } finally {
      setLoading(false);
    }
  }, [currentPage, statusFilter, startDate, endDate]);

  useEffect(() => {
    fetchPurchaseOrders();
  }, [fetchPurchaseOrders]);

  const handleStatusChange = async (poId: string, newStatus: POStatus) => {
    setActionLoading(poId);
    try {
      const response = await updatePOStatus(poId, newStatus);
      if (response.success) {
        // Refresh the list
        await fetchPurchaseOrders();
      } else {
        setError(response.error);
      }
    } catch (err) {
      setError('Failed to update status');
      console.error('Error updating PO status:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleClearFilters = () => {
    setStatusFilter('');
    setStartDate('');
    setEndDate('');
    setCurrentPage(1);
  };

  const handleDelete = async (poId: string, poNumber: string) => {
    if (!confirm(`Are you sure you want to delete PO ${poNumber}? This action cannot be undone.`)) {
      return;
    }
    
    setActionLoading(poId);
    try {
      const response = await deletePurchaseOrder(poId);
      if (response.success) {
        await fetchPurchaseOrders();
      } else {
        setError(response.error);
      }
    } catch (err) {
      setError('Failed to delete purchase order');
      console.error('Error deleting PO:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleExportExcel = async () => {
    if (!result || !result.data.length) {
      setError('No purchase orders to export');
      return;
    }

    try {
      // Dynamically import the Excel export function
      const { exportPurchaseOrdersToExcel } = await import('@/lib/excel/purchase-order');
      exportPurchaseOrdersToExcel(result.data);
    } catch (err) {
      console.error('Error exporting to Excel:', err);
      setError('Failed to export to Excel');
    }
  };

  const columns: Column<PurchaseOrder>[] = [
    {
      key: 'po_number',
      header: t('purchaseOrders.poNumber'),
      sortable: true,
    },
    {
      key: 'po_date',
      header: t('common.date'),
      sortable: true,
      render: (row) => formatDate(row.po_date),
    },
    {
      key: 'dealer_name',
      header: t('purchaseOrders.dealer'),
      sortable: true,
    },
    {
      key: 'status',
      header: t('common.status'),
      sortable: true,
      render: (row) => <POStatusBadge status={row.status} />,
    },
    {
      key: 'confirmed_by',
      header: t('purchaseOrders.confirmedBy') || 'Confirmed By',
      render: (row) => row.confirmed_by_user?.full_name || '-',
    },
    {
      key: 'grand_total',
      header: t('purchaseOrders.grandTotal'),
      sortable: true,
      render: (row) => formatCurrency(row.grand_total),
    },
    {
      key: 'actions',
      header: t('common.actions'),
      render: (row) => (
        <div className="flex items-center gap-2">
          <Link href={`/purchase-orders/${row.id}`}>
            <Button variant="secondary" size="sm">
              {t('common.view')}
            </Button>
          </Link>
          {row.status === 'draft' && (
            <>
              <Link href={`/purchase-orders/${row.id}/edit`}>
                <Button variant="secondary" size="sm">
                  {t('common.edit')}
                </Button>
              </Link>
              <Button
                variant="primary"
                size="sm"
                isLoading={actionLoading === row.id}
                onClick={() => handleStatusChange(row.id, 'confirmed')}
              >
                {t('common.confirm')}
              </Button>
              <Button
                variant="danger"
                size="sm"
                isLoading={actionLoading === row.id}
                onClick={() => handleStatusChange(row.id, 'cancelled')}
              >
                {t('common.cancel')}
              </Button>
            </>
          )}
          <Button
            variant="danger"
            size="sm"
            isLoading={actionLoading === row.id}
            onClick={() => handleDelete(row.id, row.po_number)}
          >
            {t('common.delete')}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-primary">{t('purchaseOrders.title')}</h1>
          <p className="text-secondary mt-1">{t('purchaseOrders.manageOrders') || 'Manage purchase orders for vendors'}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={handleExportExcel} disabled={!result || !result.data.length}>
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export Excel
          </Button>
          <Button variant="secondary" onClick={() => setShowImportModal(true)}>
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Import Excel
          </Button>
          <Link href="/purchase-orders/new">
            <Button variant="primary">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {t('purchaseOrders.createPO')}
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <SoftCard>
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-secondary mb-1">{t('common.status')}</label>
            <Select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as POStatus | '');
                setCurrentPage(1);
              }}
            >
              <option value="">{t('common.all')} {t('common.status')}</option>
              <option value="draft">{t('purchaseOrders.draft')}</option>
              <option value="confirmed">{t('purchaseOrders.confirmed')}</option>
              <option value="cancelled">{t('purchaseOrders.cancelled')}</option>
            </Select>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-secondary mb-1">{t('form.startDate')}</label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-secondary mb-1">{t('form.endDate')}</label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
          <div className="flex items-end">
            <Button variant="secondary" onClick={handleClearFilters}>
              {t('common.clear')}
            </Button>
          </div>
        </div>
      </SoftCard>

      {/* Error Message */}
      {error && (
        <SoftCard className="bg-accent-redLight border border-accent-red/20">
          <p className="text-accent-red">{error}</p>
        </SoftCard>
      )}

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={result?.data || []}
        keyExtractor={(row) => row.id}
        loading={loading}
        emptyMessage={t('common.noData')}
        pageSize={10}
      />

      {/* Server-side Pagination */}
      {result && result.total_pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-secondary">
            {t('common.page') || 'Page'} {result.page} / {result.total_pages} ({result.total} {t('common.total').toLowerCase()})
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              {t('common.previous')}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={currentPage === result.total_pages}
              onClick={() => setCurrentPage((p) => Math.min(result.total_pages, p + 1))}
            >
              {t('common.next')}
            </Button>
          </div>
        </div>
      )}
      {showImportModal && (
        <ImportPOModal
          onClose={() => setShowImportModal(false)}
          onImported={() => { fetchPurchaseOrders(); }}
        />
      )}
    </div>
  );
}
