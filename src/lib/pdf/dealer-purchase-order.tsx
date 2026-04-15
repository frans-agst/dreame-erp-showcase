import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer';
import { PurchaseOrder, POItem } from '@/types';

// Create styles
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#1A1A1A',
  },
  subtitle: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 5,
  },
  infoSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  infoColumn: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 9,
    color: '#64748B',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  infoValue: {
    fontSize: 11,
    color: '#1A1A1A',
    fontWeight: 'bold',
  },
  table: {
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  tableHeaderCell: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  tableCell: {
    fontSize: 10,
    color: '#1A1A1A',
  },
  colNo: {
    width: '5%',
  },
  colSku: {
    width: '15%',
  },
  colName: {
    width: '30%',
  },
  colQty: {
    width: '10%',
    textAlign: 'right',
  },
  colBeforeTax: {
    width: '15%',
    textAlign: 'right',
  },
  colAfterTax: {
    width: '15%',
    textAlign: 'right',
  },
  colTotal: {
    width: '10%',
    textAlign: 'right',
  },
  totalsSection: {
    marginTop: 20,
    alignItems: 'flex-end',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 5,
    width: 250,
  },
  totalLabel: {
    fontSize: 10,
    color: '#64748B',
    width: 120,
  },
  totalValue: {
    fontSize: 10,
    color: '#1A1A1A',
    width: 130,
    textAlign: 'right',
  },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 2,
    borderTopColor: '#1A1A1A',
    width: 250,
  },
  grandTotalLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1A1A1A',
    width: 120,
  },
  grandTotalValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#10B981',
    width: 130,
    textAlign: 'right',
  },
  creditNoteRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 5,
    width: 250,
  },
  creditNoteLabel: {
    fontSize: 10,
    color: '#10B981',
    width: 120,
  },
  creditNoteValue: {
    fontSize: 10,
    color: '#10B981',
    width: 130,
    textAlign: 'right',
  },
  finalTotalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 2,
    borderTopColor: '#10B981',
    width: 250,
  },
  finalTotalLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#10B981',
    width: 120,
  },
  finalTotalValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#10B981',
    width: 130,
    textAlign: 'right',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 8,
    color: '#9CA3AF',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    fontSize: 9,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  statusDraft: {
    backgroundColor: '#F3F4F6',
    color: '#6B7280',
  },
  statusConfirmed: {
    backgroundColor: '#D1FAE5',
    color: '#10B981',
  },
  statusCancelled: {
    backgroundColor: '#FEE2E2',
    color: '#EF4444',
  },
});

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

interface POItemWithProduct extends Omit<POItem, 'product'> {
  product?: {
    sku: string;
    name: string;
  };
}

interface DealerPurchaseOrderPDFProps {
  po: PurchaseOrder & { items: POItemWithProduct[] };
}

export function DealerPurchaseOrderPDF({ po }: DealerPurchaseOrderPDFProps) {
  const getStatusStyle = () => {
    switch (po.status) {
      case 'confirmed':
        return styles.statusConfirmed;
      case 'cancelled':
        return styles.statusCancelled;
      default:
        return styles.statusDraft;
    }
  };

  const subtotal = po.credit_note_amount && po.credit_note_amount > 0 
    ? po.grand_total + po.credit_note_amount 
    : po.grand_total;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>DEALER PURCHASE ORDER</Text>
          <Text style={styles.subtitle}>OmniERP Indonesia</Text>
        </View>

        {/* PO Info */}
        <View style={styles.infoSection}>
          <View style={styles.infoColumn}>
            <Text style={styles.infoLabel}>PO Number</Text>
            <Text style={styles.infoValue}>{po.po_number}</Text>
          </View>
          <View style={styles.infoColumn}>
            <Text style={styles.infoLabel}>Date</Text>
            <Text style={styles.infoValue}>{formatDate(po.po_date)}</Text>
          </View>
          <View style={styles.infoColumn}>
            <Text style={styles.infoLabel}>Store</Text>
            <Text style={styles.infoValue}>{po.store?.name || '-'}</Text>
          </View>
          <View style={styles.infoColumn}>
            <Text style={styles.infoLabel}>Status</Text>
            <View style={[styles.statusBadge, getStatusStyle()]}>
              <Text>{po.status.toUpperCase()}</Text>
            </View>
          </View>
        </View>

        {/* Items Table */}
        <View style={styles.table}>
          {/* Table Header */}
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, styles.colNo]}>No</Text>
            <Text style={[styles.tableHeaderCell, styles.colSku]}>SKU</Text>
            <Text style={[styles.tableHeaderCell, styles.colName]}>Product Name</Text>
            <Text style={[styles.tableHeaderCell, styles.colQty]}>Qty</Text>
            <Text style={[styles.tableHeaderCell, styles.colBeforeTax]}>Before Tax</Text>
            <Text style={[styles.tableHeaderCell, styles.colAfterTax]}>After Tax</Text>
            <Text style={[styles.tableHeaderCell, styles.colTotal]}>Total</Text>
          </View>

          {/* Table Rows */}
          {po.items.map((item, index) => (
            <View key={item.id} style={styles.tableRow}>
              <Text style={[styles.tableCell, styles.colNo]}>{index + 1}</Text>
              <Text style={[styles.tableCell, styles.colSku]}>{item.product?.sku || '-'}</Text>
              <Text style={[styles.tableCell, styles.colName]}>{item.product?.name || '-'}</Text>
              <Text style={[styles.tableCell, styles.colQty]}>{item.quantity}</Text>
              <Text style={[styles.tableCell, styles.colBeforeTax]}>{formatCurrency(item.before_tax)}</Text>
              <Text style={[styles.tableCell, styles.colAfterTax]}>{formatCurrency(item.after_tax)}</Text>
              <Text style={[styles.tableCell, styles.colTotal]}>{formatCurrency(item.line_total)}</Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.totalsSection}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Before Tax:</Text>
            <Text style={styles.totalValue}>{formatCurrency(po.total_before_tax)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>VAT (11%):</Text>
            <Text style={styles.totalValue}>{formatCurrency(po.total_after_tax - po.total_before_tax)}</Text>
          </View>
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>Subtotal:</Text>
            <Text style={styles.grandTotalValue}>{formatCurrency(subtotal)}</Text>
          </View>
          
          {po.credit_note_amount && po.credit_note_amount > 0 && (
            <>
              <View style={styles.creditNoteRow}>
                <Text style={styles.creditNoteLabel}>Credit Note Discount:</Text>
                <Text style={styles.creditNoteValue}>-{formatCurrency(po.credit_note_amount)}</Text>
              </View>
              <View style={styles.finalTotalRow}>
                <Text style={styles.finalTotalLabel}>Amount Due:</Text>
                <Text style={styles.finalTotalValue}>{formatCurrency(po.grand_total)}</Text>
              </View>
            </>
          )}
          
          {(!po.credit_note_amount || po.credit_note_amount === 0) && (
            <View style={styles.finalTotalRow}>
              <Text style={styles.finalTotalLabel}>Amount Due:</Text>
              <Text style={styles.finalTotalValue}>{formatCurrency(po.grand_total)}</Text>
            </View>
          )}
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          Generated on {new Date().toLocaleDateString('id-ID', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })} | OmniERP Indonesia ERP System
        </Text>
      </Page>
    </Document>
  );
}
