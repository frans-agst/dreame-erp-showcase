// src/components/exports/TransactionExporter.tsx
// Component for exporting individual transactions
// Requirements: 5.1, 3.7

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { getTransactionById } from '@/actions/transactions';

interface TransactionExporterProps {
  transactionId: string;
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

/**
 * TransactionExporter component for exporting individual transactions as PDF
 * Requirements: 5.1, 3.7
 */
export function TransactionExporter({
  transactionId,
  variant = 'secondary',
  size = 'sm',
  showLabel = true,
}: TransactionExporterProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    
    try {
      console.log('Starting PDF export for transaction:', transactionId);
      
      // Get transaction data
      const result = await getTransactionById(transactionId);
      
      console.log('Transaction result:', result);
      
      if (!result.success || !result.data) {
        console.error('Failed to get transaction:', result.error);
        alert(result.error || 'Failed to get transaction');
        return;
      }

      const transaction = result.data;
      console.log('Transaction data:', transaction);

      // Import jsPDF dynamically (client-side only)
      console.log('Importing jsPDF...');
      const jsPDFModule = await import('jspdf');
      const { jsPDF } = jsPDFModule;
      console.log('jsPDF imported');
      
      console.log('Importing jspdf-autotable...');
      const autoTable = (await import('jspdf-autotable')).default;
      console.log('jspdf-autotable imported');

      // Create PDF
      console.log('Creating PDF document...');
      const doc = new jsPDF();
      
      // Add title
      doc.setFontSize(16);
      doc.text('Transaction Receipt', 14, 15);
      
      // Add transaction info
      doc.setFontSize(10);
      doc.text(`Transaction ID: ${transaction.id.substring(0, 8)}`, 14, 25);
      doc.text(`Date: ${new Date(transaction.transaction_date).toLocaleDateString('id-ID')}`, 14, 30);
      doc.text(`Store: ${transaction.store?.name || '-'}`, 14, 35);
      doc.text(`Staff: ${transaction.staff?.full_name || '-'}`, 14, 40);
      
      // Add items table
      console.log('Adding items table...');
      const tableData = transaction.items.map(item => [
        item.product?.sku || '-',
        item.product?.name || '-',
        item.quantity.toString(),
        `Rp ${item.unit_price.toLocaleString('id-ID')}`,
        `Rp ${item.line_discount.toLocaleString('id-ID')}`,
        `Rp ${item.line_total.toLocaleString('id-ID')}`
      ]);

      autoTable(doc, {
        startY: 50,
        head: [['SKU', 'Product', 'Qty', 'Unit Price', 'Discount', 'Total']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185] },
        styles: { fontSize: 9 }
      });

      // Add totals
      console.log('Adding totals...');
      const finalY = (doc as any).lastAutoTable.finalY || 100;
      doc.setFontSize(10);
      doc.text(`Subtotal: Rp ${transaction.total_before_discount.toLocaleString('id-ID')}`, 14, finalY + 10);
      doc.text(`Discount: Rp ${transaction.total_discount.toLocaleString('id-ID')}`, 14, finalY + 15);
      doc.setFontSize(12);
      doc.text(`Total: Rp ${transaction.total_after_discount.toLocaleString('id-ID')}`, 14, finalY + 22);

      // Download PDF
      const filename = `transaction-${transaction.id.substring(0, 8)}-${new Date(transaction.transaction_date).toISOString().split('T')[0]}.pdf`;
      console.log('Saving PDF as:', filename);
      doc.save(filename);
      console.log('PDF export completed successfully');

    } catch (error) {
      console.error('Export error:', error);
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      alert(`Failed to generate PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleExport}
      disabled={isExporting}
    >
      {showLabel ? (
        <span>
          {isExporting ? 'Exporting...' : 'Export PDF'}
        </span>
      ) : (
        <span className="text-xs">
          {isExporting ? '...' : 'PDF'}
        </span>
      )}
    </Button>
  );
}

/**
 * Batch transaction exporter for multiple transactions
 * Requirements: 3.1, 3.2, 3.4
 */
interface BatchTransactionExporterProps {
  transactionIds: string[];
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}

export function BatchTransactionExporter({
  transactionIds,
  variant = 'primary',
  size = 'md',
  label = 'Export Selected',
}: BatchTransactionExporterProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleBatchExport = async () => {
    if (transactionIds.length === 0) {
      alert('Please select at least one transaction to export');
      return;
    }

    setIsExporting(true);
    
    try {
      const { exportMultipleTransactions } = await import('@/actions/exports');
      const result = await exportMultipleTransactions(transactionIds);
      
      if (!result.success || !result.data) {
        alert(result.error || 'Failed to export transactions');
        return;
      }

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
    } catch (error) {
      console.error('Batch export error:', error);
      alert('An unexpected error occurred');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleBatchExport}
      disabled={isExporting || transactionIds.length === 0}
    >
      {isExporting ? (
        <>Exporting...</>
      ) : (
        <>
          {label} ({transactionIds.length})
        </>
      )}
    </Button>
  );
}
