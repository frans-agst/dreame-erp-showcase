'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { SoftCard } from '@/components/ui/SoftCard';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { PurchaseOrder } from '@/types';
import { createClient } from '@/lib/supabase/client';
import { pdf } from '@react-pdf/renderer';
import { DealerPurchaseOrderPDF } from '@/lib/pdf/dealer-purchase-order';

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
    month: 'long',
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

// Get status label
function getStatusLabel(status: string): string {
  switch (status) {
    case 'confirmed':
      return 'Confirmed';
    case 'draft':
      return 'Draft';
    case 'cancelled':
      return 'Cancelled';
    default:
      return status;
  }
}

export default function DealerPurchaseOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [order, setOrder] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    async function loadOrder() {
      try {
        const supabase = createClient();
        
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push('/login');
          return;
        }

        // Fetch PO (only if created by this user)
        const { data: po, error: poError } = await supabase
          .from('purchase_orders')
          .select('*')
          .eq('id', params.id)
          .eq('created_by', user.id)
          .single();

        if (poError || !po) {
          setError('Purchase order not found');
          return;
        }

        // Fetch items
        const { data: items } = await supabase
          .from('purchase_order_items')
          .select('*, product:products(sku, name)')
          .eq('po_id', params.id);

        // Fetch store info
        const { data: store } = await supabase
          .from('stores')
          .select('*, account:accounts(*)')
          .eq('id', po.store_id)
          .single();

        setOrder({
          ...po,
          store: store || undefined,
          items: items || [],
        });
      } catch (err) {
        console.error('Error loading order:', err);
        setError('Failed to load purchase order');
      } finally {
        setLoading(false);
      }
    }

    if (params.id) {
      loadOrder();
    }
  }, [params.id, router]);

  const handleExportPDF = async () => {
    if (!order) return;
    
    setIsExporting(true);
    try {
      const blob = await pdf(<DealerPurchaseOrderPDF po={order} />).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${order.po_number}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Failed to export PDF');
    } finally {
      setIsExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <SoftCard className="text-center p-8">
          <svg className="w-12 h-12 text-accent-red mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-secondary mb-4">{error || 'Purchase order not found'}</p>
          <Link href="/dealer/purchase-orders">
            <Button variant="secondary">Back to Orders</Button>
          </Link>
        </SoftCard>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-primary">{order.po_number}</h1>
            <StatusBadge
              status={getStatusVariant(order.status)}
              label={getStatusLabel(order.status)}
            />
          </div>
          <p className="text-secondary mt-1">Created on {formatDate(order.created_at)}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleExportPDF} isLoading={isExporting}>
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export PDF
          </Button>
          <Link href="/dealer/purchase-orders">
            <Button variant="secondary">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Orders
            </Button>
          </Link>
        </div>
      </div>

      {/* Order Details */}
      <SoftCard>
        <h2 className="text-lg font-semibold text-primary mb-4">Order Details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-secondary">PO Date</p>
            <p className="font-medium text-primary">{formatDate(order.po_date)}</p>
          </div>
          <div>
            <p className="text-sm text-secondary">Status</p>
            <StatusBadge
              status={getStatusVariant(order.status)}
              label={getStatusLabel(order.status)}
            />
          </div>
          {order.store && (
            <div>
              <p className="text-sm text-secondary">Store</p>
              <p className="font-medium text-primary">{order.store.name}</p>
            </div>
          )}
          {order.dealer_name && (
            <div>
              <p className="text-sm text-secondary">Account</p>
              <p className="font-medium text-primary">{order.dealer_name}</p>
            </div>
          )}
        </div>
      </SoftCard>

      {/* Items */}
      <SoftCard>
        <h2 className="text-lg font-semibold text-primary mb-4">Items</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 text-sm font-medium text-secondary">Product</th>
                <th className="text-center py-3 px-4 text-sm font-medium text-secondary">Qty</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-secondary">Unit Price</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-secondary">After Tax</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-secondary">Line Total</th>
              </tr>
            </thead>
            <tbody>
              {order.items?.map((item, index) => (
                <tr key={item.id || index} className="border-b border-border/50">
                  <td className="py-3 px-4">
                    <p className="font-medium text-primary">{item.product?.name || 'Unknown Product'}</p>
                    <p className="text-sm text-secondary">{item.product?.sku}</p>
                  </td>
                  <td className="py-3 px-4 text-center text-primary">{item.quantity}</td>
                  <td className="py-3 px-4 text-right text-secondary">{formatCurrency(item.before_tax)}</td>
                  <td className="py-3 px-4 text-right text-secondary">{formatCurrency(item.after_tax)}</td>
                  <td className="py-3 px-4 text-right font-medium text-primary">{formatCurrency(item.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SoftCard>

      {/* Totals */}
      <SoftCard>
        <h2 className="text-lg font-semibold text-primary mb-4">Summary</h2>
        <div className="flex flex-col items-end space-y-2">
          <div className="flex justify-between w-full max-w-sm">
            <span className="text-secondary">Total Before Tax:</span>
            <span className="font-medium text-primary">{formatCurrency(order.total_before_tax)}</span>
          </div>
          <div className="flex justify-between w-full max-w-sm">
            <span className="text-secondary">VAT (11%):</span>
            <span className="font-medium text-primary">{formatCurrency(order.total_after_tax - order.total_before_tax)}</span>
          </div>
          <div className="flex justify-between w-full max-w-sm pt-2 border-t border-secondary/20">
            <span className="text-lg font-semibold text-primary">Subtotal:</span>
            <span className="text-lg font-semibold text-blue-600">
              {formatCurrency(order.credit_note_amount && order.credit_note_amount > 0 
                ? order.grand_total + order.credit_note_amount 
                : order.grand_total)}
            </span>
          </div>
          {order.credit_note_amount && order.credit_note_amount > 0 && (
            <>
              <div className="flex justify-between w-full max-w-sm">
                <span className="text-secondary">Credit Note Discount:</span>
                <span className="font-medium text-green-600">-{formatCurrency(order.credit_note_amount)}</span>
              </div>
              <div className="flex justify-between w-full max-w-sm pt-2 border-t-2 border-primary/30">
                <span className="text-xl font-bold text-primary">Amount Due:</span>
                <span className="text-xl font-bold text-green-600">{formatCurrency(order.grand_total)}</span>
              </div>
            </>
          )}
          {(!order.credit_note_amount || order.credit_note_amount === 0) && (
            <div className="flex justify-between w-full max-w-sm pt-2 border-t-2 border-primary/30">
              <span className="text-xl font-bold text-primary">Amount Due:</span>
              <span className="text-xl font-bold text-green-600">{formatCurrency(order.grand_total)}</span>
            </div>
          )}
        </div>
      </SoftCard>

      {/* Status Info */}
      {order.status === 'draft' && (
        <SoftCard className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <p className="font-medium text-yellow-800 dark:text-yellow-200">Order Pending</p>
              <p className="text-sm text-yellow-700 dark:text-yellow-300">This order is awaiting confirmation from the admin team.</p>
            </div>
          </div>
        </SoftCard>
      )}

      {order.status === 'confirmed' && (
        <SoftCard className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="font-medium text-green-800 dark:text-green-200">Order Confirmed</p>
              <p className="text-sm text-green-700 dark:text-green-300">This order has been confirmed and is being processed.</p>
            </div>
          </div>
        </SoftCard>
      )}

      {order.status === 'cancelled' && (
        <SoftCard className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="font-medium text-red-800 dark:text-red-200">Order Cancelled</p>
              <p className="text-sm text-red-700 dark:text-red-300">This order has been cancelled.</p>
            </div>
          </div>
        </SoftCard>
      )}
    </div>
  );
}
