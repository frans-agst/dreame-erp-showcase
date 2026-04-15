'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { getPurchaseOrderForExport } from '@/actions/purchase-orders';
import { Button } from '@/components/ui/Button';
import { SoftCard } from '@/components/ui/SoftCard';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { PurchaseOrder, POItem } from '@/types';

// Dynamically import PDF components to avoid SSR issues
const PDFDownloadLink = dynamic(
  () => import('@react-pdf/renderer').then((mod) => mod.PDFDownloadLink),
  { ssr: false, loading: () => <Button isLoading>Preparing PDF...</Button> }
);

const PDFViewer = dynamic(
  () => import('@react-pdf/renderer').then((mod) => mod.PDFViewer),
  { ssr: false, loading: () => <LoadingSpinner size="lg" /> }
);

// Import the PDF document component
import { PurchaseOrderPDF } from '@/lib/pdf/purchase-order';

interface POItemWithProduct extends Omit<POItem, 'product'> {
  product?: {
    sku: string;
    name: string;
  };
}

type POWithProducts = PurchaseOrder & { items: POItemWithProduct[] };

export default function ExportPurchaseOrderPage() {
  const params = useParams();
  const router = useRouter();
  const poId = params.id as string;

  const [po, setPO] = useState<POWithProducts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const fetchPO = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await getPurchaseOrderForExport(poId);
      if (response.success) {
        setPO(response.data as POWithProducts);
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
            <Link href={`/purchase-orders/${poId}`} className="text-secondary hover:text-primary">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-2xl font-semibold text-primary">Export {po.po_number}</h1>
          </div>
          <p className="text-secondary mt-1">Download or preview the purchase order as PDF</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => setShowPreview(!showPreview)}
          >
            {showPreview ? 'Hide Preview' : 'Show Preview'}
          </Button>
          <PDFDownloadLink
            document={<PurchaseOrderPDF po={po} />}
            fileName={`${po.po_number}.pdf`}
          >
            {({ loading: pdfLoading }) => (
              <Button isLoading={pdfLoading}>
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download PDF
              </Button>
            )}
          </PDFDownloadLink>
        </div>
      </div>

      {/* PO Summary */}
      <SoftCard>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div>
            <p className="text-sm text-secondary">PO Number</p>
            <p className="text-lg font-medium text-primary">{po.po_number}</p>
          </div>
          <div>
            <p className="text-sm text-secondary">Date</p>
            <p className="text-lg font-medium text-primary">
              {new Date(po.po_date).toLocaleDateString('id-ID', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>
          <div>
            <p className="text-sm text-secondary">Dealer</p>
            <p className="text-lg font-medium text-primary">{po.dealer_name}</p>
          </div>
          <div>
            <p className="text-sm text-secondary">Grand Total</p>
            <p className="text-lg font-medium text-accent-green">
              {new Intl.NumberFormat('id-ID', {
                style: 'currency',
                currency: 'IDR',
                minimumFractionDigits: 0,
              }).format(po.grand_total)}
            </p>
          </div>
        </div>
      </SoftCard>

      {/* PDF Preview */}
      {showPreview && (
        <SoftCard noPadding>
          <div className="h-[800px] w-full">
            <PDFViewer width="100%" height="100%" showToolbar={false}>
              <PurchaseOrderPDF po={po} />
            </PDFViewer>
          </div>
        </SoftCard>
      )}
    </div>
  );
}
