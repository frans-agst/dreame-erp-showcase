'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getPurchaseOrderById, updatePOStatus } from '@/actions/purchase-orders';
import { Button } from '@/components/ui/Button';
import { SoftCard } from '@/components/ui/SoftCard';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { PurchaseOrder, POStatus } from '@/types';

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
    <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium ${styles[status].bg} ${styles[status].text}`}>
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
    month: 'long',
    day: 'numeric',
  });
}

export default function PurchaseOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const poId = params.id as string;

  const [po, setPO] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchPO = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await getPurchaseOrderById(poId);
      if (response.success) {
        setPO(response.data);
      } else {
        setError(response.error);
      }
    } catch (err) {
      setError('Failed to load purchase order');
      console.error('Error fetching PO:', err);
    } finally {
      setLoading(false);
    }
  }, [poId]);

  useEffect(() => {
    fetchPO();
  }, [fetchPO]);

  const handleStatusChange = async (newStatus: POStatus) => {
    if (!po) return;
    
    setActionLoading(true);
    try {
      const response = await updatePOStatus(po.id, newStatus);
      if (response.success) {
        setPO(response.data);
      } else {
        setError(response.error);
      }
    } catch (err) {
      setError('Failed to update status');
      console.error('Error updating PO status:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleExportPDF = () => {
    // Navigate to PDF export page
    router.push(`/purchase-orders/${poId}/export`);
  };

  const handleExportExcel = async () => {
    if (!po) return;
    
    try {
      // Dynamically import the Excel export function
      const { exportPurchaseOrderToExcel } = await import('@/lib/excel/purchase-order');
      exportPurchaseOrderToExcel(po);
    } catch (err) {
      console.error('Error exporting to Excel:', err);
      setError('Failed to export to Excel');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !po) {
    return (
      <SoftCard className="bg-accent-redLight border border-accent-red/20">
        <p className="text-accent-red">{error || 'Purchase order not found'}</p>
        <Link href="/purchase-orders" className="mt-4 inline-block">
          <Button variant="secondary">Back to List</Button>
        </Link>
      </SoftCard>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <Link href="/purchase-orders" className="text-secondary hover:text-primary">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-2xl font-semibold text-primary">{po.po_number}</h1>
            <POStatusBadge status={po.status} />
          </div>
          <p className="text-secondary mt-1">Purchase Order Details</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={handleExportExcel}>
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export Excel
          </Button>
          <Button variant="secondary" onClick={handleExportPDF}>
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export PDF
          </Button>
          {po.status === 'draft' && (
            <>
              <Link href={`/purchase-orders/${po.id}/edit`}>
                <Button variant="secondary">Edit</Button>
              </Link>
              <Button
                variant="primary"
                isLoading={actionLoading}
                onClick={() => handleStatusChange('confirmed')}
              >
                Confirm
              </Button>
              <Button
                variant="danger"
                isLoading={actionLoading}
                onClick={() => handleStatusChange('cancelled')}
              >
                Cancel
              </Button>
            </>
          )}
        </div>
      </div>

      {/* PO Header Info */}
      <SoftCard>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <p className="text-sm text-secondary">PO Number</p>
            <p className="text-lg font-medium text-primary">{po.po_number}</p>
          </div>
          <div>
            <p className="text-sm text-secondary">Date</p>
            <p className="text-lg font-medium text-primary">{formatDate(po.po_date)}</p>
          </div>
          <div>
            <p className="text-sm text-secondary">Dealer</p>
            <p className="text-lg font-medium text-primary">{po.dealer_name}</p>
          </div>
        </div>
      </SoftCard>

      {/* Items Table */}
      <SoftCard noPadding>
        <div className="px-6 py-4 border-b border-secondary/10">
          <h2 className="text-lg font-semibold text-primary">Items</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-secondary/10">
                <th className="px-6 py-4 text-left text-xs font-semibold text-secondary uppercase tracking-wider">SKU</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-secondary uppercase tracking-wider">Product Name</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-secondary uppercase tracking-wider">Qty</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-secondary uppercase tracking-wider">Before Tax</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-secondary uppercase tracking-wider">After Tax</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-secondary uppercase tracking-wider">Line Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary/10">
              {po.items.map((item) => (
                <tr key={item.id} className="hover:bg-background/50">
                  <td className="px-6 py-4 text-sm text-primary">{item.product?.sku || '-'}</td>
                  <td className="px-6 py-4 text-sm text-primary">{item.product?.name || '-'}</td>
                  <td className="px-6 py-4 text-sm text-primary text-right">{item.quantity}</td>
                  <td className="px-6 py-4 text-sm text-primary text-right">{formatCurrency(item.before_tax)}</td>
                  <td className="px-6 py-4 text-sm text-primary text-right">{formatCurrency(item.after_tax)}</td>
                  <td className="px-6 py-4 text-sm text-primary text-right font-medium">{formatCurrency(item.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SoftCard>

      {/* Totals */}
      <SoftCard>
        <div className="flex flex-col items-end space-y-2">
          <div className="flex justify-between w-full max-w-xs">
            <span className="text-secondary">Total Before Tax:</span>
            <span className="font-medium text-primary">{formatCurrency(po.total_before_tax)}</span>
          </div>
          <div className="flex justify-between w-full max-w-xs">
            <span className="text-secondary">VAT (11%):</span>
            <span className="font-medium text-primary">{formatCurrency(po.total_after_tax - po.total_before_tax)}</span>
          </div>
          <div className="flex justify-between w-full max-w-xs pt-2 border-t border-secondary/20">
            <span className="text-lg font-semibold text-primary">Subtotal:</span>
            <span className="text-lg font-semibold text-accent-green">
              {formatCurrency(po.credit_note_amount && po.credit_note_amount > 0 
                ? po.grand_total + po.credit_note_amount 
                : po.grand_total)}
            </span>
          </div>
          {po.credit_note_amount && po.credit_note_amount > 0 && (
            <>
              <div className="flex justify-between w-full max-w-xs">
                <span className="text-secondary">Credit Note Discount:</span>
                <span className="font-medium text-green-600">-{formatCurrency(po.credit_note_amount)}</span>
              </div>
              <div className="flex justify-between w-full max-w-xs pt-2 border-t-2 border-primary/30">
                <span className="text-xl font-bold text-primary">Amount Due:</span>
                <span className="text-xl font-bold text-green-600">{formatCurrency(po.grand_total)}</span>
              </div>
            </>
          )}
          {(!po.credit_note_amount || po.credit_note_amount === 0) && (
            <div className="flex justify-between w-full max-w-xs pt-2 border-t-2 border-primary/30">
              <span className="text-xl font-bold text-primary">Amount Due:</span>
              <span className="text-xl font-bold text-green-600">{formatCurrency(po.grand_total)}</span>
            </div>
          )}
        </div>
      </SoftCard>
    </div>
  );
}
