import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer';
import { WeeklySalesReport, GiftItem } from '@/types';

// Create styles
const styles = StyleSheet.create({
  page: {
    padding: 20,
    fontSize: 7,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 3,
    color: '#1A1A1A',
  },
  subtitle: {
    fontSize: 9,
    color: '#64748B',
    marginBottom: 2,
  },
  filterInfo: {
    fontSize: 8,
    color: '#64748B',
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  table: {
    marginBottom: 10,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingVertical: 4,
    paddingHorizontal: 1,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingVertical: 3,
    paddingHorizontal: 1,
  },
  tableRowAlt: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingVertical: 3,
    paddingHorizontal: 1,
    backgroundColor: '#FAFAFA',
  },
  tableHeaderCell: {
    fontSize: 6,
    fontWeight: 'bold',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  tableCell: {
    fontSize: 6,
    color: '#1A1A1A',
  },
  // Column widths - adjusted for new columns including discount
  colMonth: { width: '6%' },
  colDate: { width: '7%' },
  colWeek: { width: '6%' },
  colAccount: { width: '9%' },
  colStore: { width: '9%' },
  colSku: { width: '7%' },
  colCategory: { width: '7%' },
  colSubCategory: { width: '7%' },
  colProduct: { width: '9%' },
  colQty: { width: '4%', textAlign: 'right' },
  colST: { width: '6%', textAlign: 'right' },
  colDiscount: { width: '6%', textAlign: 'right' },
  colTotal: { width: '6%', textAlign: 'right' },
  colGift1: { width: '5%' },
  colGift2: { width: '4%' },
  totalsSection: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 2,
    borderTopColor: '#1A1A1A',
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 4,
  },
  totalsLabel: {
    fontSize: 9,
    color: '#64748B',
    width: 100,
  },
  totalsValue: {
    fontSize: 9,
    color: '#1A1A1A',
    fontWeight: 'bold',
    width: 80,
    textAlign: 'right',
  },
  totalsValueGreen: {
    fontSize: 9,
    color: '#10B981',
    fontWeight: 'bold',
    width: 80,
    textAlign: 'right',
  },
  footer: {
    position: 'absolute',
    bottom: 15,
    left: 20,
    right: 20,
    textAlign: 'center',
    fontSize: 6,
    color: '#9CA3AF',
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
    month: 'short',
    day: 'numeric',
  });
}

// Format month
function formatMonth(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('id-ID', {
    month: 'short',
    year: '2-digit',
  });
}

// Format week range
function formatWeekRange(startDate?: string, endDate?: string): string {
  if (!startDate || !endDate) return '';
  const start = new Date(startDate);
  const end = new Date(endDate);
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${start.toLocaleDateString('id-ID', options)} - ${end.toLocaleDateString('id-ID', options)}`;
}

// Format gift products - returns array of gift names
function formatGiftProducts(giftDetails: GiftItem[] | null | undefined, legacyGift: string | null | undefined): { gift1: string; gift2: string } {
  if (giftDetails && giftDetails.length > 0) {
    return {
      gift1: giftDetails[0] ? `${giftDetails[0].name}(${giftDetails[0].qty})` : '-',
      gift2: giftDetails[1] ? `${giftDetails[1].name}(${giftDetails[1].qty})` : '-',
    };
  }
  if (legacyGift && legacyGift.trim() !== '') {
    return { gift1: legacyGift, gift2: '-' };
  }
  return { gift1: '-', gift2: '-' };
}

interface WeeklySalesReportPDFProps {
  report: WeeklySalesReport;
  filters?: {
    fiscalWeek?: number;
    fiscalYear?: number;
    startDate?: string;
    endDate?: string;
    accountName?: string;
    storeName?: string;
    periodType?: 'week' | 'month' | 'year';
    // Legacy fields
    branchName?: string;
  };
}

export function WeeklySalesReportPDF({ report, filters }: WeeklySalesReportPDFProps) {
  const weekRange = formatWeekRange(filters?.startDate, filters?.endDate);
  
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Weekly Sales Report</Text>
          <Text style={styles.subtitle}>Dreame Indonesia</Text>
        </View>

        {/* Filter Info */}
        <View style={styles.filterInfo}>
          <Text>
            Fiscal Week: {filters?.fiscalWeek || report.fiscal_week} ({filters?.fiscalYear || report.fiscal_year})
            {weekRange ? ` | Period: ${weekRange}` : ''}
          </Text>
          <Text>
            {filters?.accountName ? `Account: ${filters.accountName}` : 'All Accounts'}
            {filters?.storeName ? ` | Store: ${filters.storeName}` : ''}
            {filters?.branchName ? ` | Branch: ${filters.branchName}` : ''}
            {' | '}Total Records: {report.items.length}
          </Text>
        </View>

        {/* Items Table */}
        <View style={styles.table}>
          {/* Table Header */}
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, styles.colMonth]}>Month</Text>
            <Text style={[styles.tableHeaderCell, styles.colDate]}>DATE</Text>
            <Text style={[styles.tableHeaderCell, styles.colWeek]}>Week</Text>
            <Text style={[styles.tableHeaderCell, styles.colAccount]}>Account Name</Text>
            <Text style={[styles.tableHeaderCell, styles.colStore]}>Store Name</Text>
            <Text style={[styles.tableHeaderCell, styles.colSku]}>SKU</Text>
            <Text style={[styles.tableHeaderCell, styles.colCategory]}>Category</Text>
            <Text style={[styles.tableHeaderCell, styles.colSubCategory]}>Sub category</Text>
            <Text style={[styles.tableHeaderCell, styles.colProduct]}>Product Name</Text>
            <Text style={[styles.tableHeaderCell, styles.colQty]}>QTY</Text>
            <Text style={[styles.tableHeaderCell, styles.colST]}>ST</Text>
            <Text style={[styles.tableHeaderCell, styles.colDiscount]}>Discount</Text>
            <Text style={[styles.tableHeaderCell, styles.colTotal]}>TOTAL</Text>
            <Text style={[styles.tableHeaderCell, styles.colGift1]}>Gift 1</Text>
            <Text style={[styles.tableHeaderCell, styles.colGift2]}>Gift 2</Text>
          </View>

          {/* Table Rows */}
          {report.items.map((item, index) => {
            const gifts = formatGiftProducts(item.gift_details, item.gift);
            const sellThru = item.unit_price; // unit_price is now after-tax price
            return (
              <View key={item.id} style={index % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                <Text style={[styles.tableCell, styles.colMonth]}>{formatMonth(item.sale_date)}</Text>
                <Text style={[styles.tableCell, styles.colDate]}>{formatDate(item.sale_date)}</Text>
                <Text style={[styles.tableCell, styles.colWeek]}>Week {item.fiscal_week}</Text>
                <Text style={[styles.tableCell, styles.colAccount]}>{item.account_name || '-'}</Text>
                <Text style={[styles.tableCell, styles.colStore]}>{item.store_name}</Text>
                <Text style={[styles.tableCell, styles.colSku]}>{item.sku}</Text>
                <Text style={[styles.tableCell, styles.colCategory]}>{item.category || '-'}</Text>
                <Text style={[styles.tableCell, styles.colSubCategory]}>{item.sub_category || '-'}</Text>
                <Text style={[styles.tableCell, styles.colProduct]}>{item.product_name}</Text>
                <Text style={[styles.tableCell, styles.colQty]}>{item.quantity}</Text>
                <Text style={[styles.tableCell, styles.colST]}>{formatCurrency(sellThru)}</Text>
                <Text style={[styles.tableCell, styles.colDiscount]}>{formatCurrency(item.discount)}</Text>
                <Text style={[styles.tableCell, styles.colTotal]}>{formatCurrency(item.total_price)}</Text>
                <Text style={[styles.tableCell, styles.colGift1]}>{gifts.gift1}</Text>
                <Text style={[styles.tableCell, styles.colGift2]}>{gifts.gift2}</Text>
              </View>
            );
          })}
        </View>

        {/* Totals */}
        <View style={styles.totalsSection}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Total Quantity:</Text>
            <Text style={styles.totalsValue}>{report.totals.total_quantity}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Total Discount:</Text>
            <Text style={styles.totalsValue}>{formatCurrency(report.totals.total_discount)}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Total Revenue:</Text>
            <Text style={styles.totalsValueGreen}>{formatCurrency(report.totals.total_revenue)}</Text>
          </View>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          Generated on {new Date().toLocaleDateString('id-ID', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })} | Dreame Indonesia ERP System
        </Text>
      </Page>
    </Document>
  );
}
