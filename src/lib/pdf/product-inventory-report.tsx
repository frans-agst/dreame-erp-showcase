import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer';

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
  // Column widths
  colMonth: { width: '7%' },
  colDate: { width: '8%' },
  colWeek: { width: '6%' },
  colAccount: { width: '12%' },
  colStore: { width: '12%' },
  colSku: { width: '10%' },
  colCategory: { width: '10%' },
  colSubCategory: { width: '10%' },
  colProduct: { width: '15%' },
  colDisplay: { width: '5%', textAlign: 'right' },
  colStock: { width: '5%', textAlign: 'right' },
  summarySection: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 2,
    borderTopColor: '#1A1A1A',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 9,
    color: '#64748B',
    width: 120,
  },
  summaryValue: {
    fontSize: 9,
    color: '#1A1A1A',
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

export interface ProductInventoryItem {
  account_name: string;
  store_name: string;
  sku: string;
  category: string;
  sub_category: string;
  product_name: string;
  display_qty: number;
  stock_qty: number;
}

export interface ProductInventoryReportData {
  date: string;
  fiscal_month: number;
  fiscal_week: number;
  fiscal_year: number;
  items: ProductInventoryItem[];
}

interface ProductInventoryReportPDFProps {
  data: ProductInventoryReportData;
}

export function ProductInventoryReportPDF({ data }: ProductInventoryReportPDFProps) {
  // Calculate totals
  const totalDisplay = data.items.reduce((sum, item) => sum + item.display_qty, 0);
  const totalStock = data.items.reduce((sum, item) => sum + item.stock_qty, 0);
  const uniqueStores = new Set(data.items.map(item => item.store_name)).size;
  const uniqueProducts = new Set(data.items.map(item => item.sku)).size;

  // Format date
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Product Inventory Report</Text>
          <Text style={styles.subtitle}>OmniERP Indonesia</Text>
        </View>

        {/* Filter Info */}
        <View style={styles.filterInfo}>
          <Text>
            Date: {formatDate(data.date)} | Fiscal Month: FM{data.fiscal_month} | Fiscal Week: W{data.fiscal_week} | Fiscal Year: FY{data.fiscal_year}
          </Text>
          <Text>
            Total Records: {data.items.length} | Stores: {uniqueStores} | Products: {uniqueProducts}
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
            <Text style={[styles.tableHeaderCell, styles.colSubCategory]}>Sub Category</Text>
            <Text style={[styles.tableHeaderCell, styles.colProduct]}>Product Name</Text>
            <Text style={[styles.tableHeaderCell, styles.colDisplay]}>Display</Text>
            <Text style={[styles.tableHeaderCell, styles.colStock]}>Stock</Text>
          </View>

          {/* Table Rows */}
          {data.items.map((item, index) => (
            <View key={`${item.store_name}-${item.sku}-${index}`} style={index % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
              <Text style={[styles.tableCell, styles.colMonth]}>FM{data.fiscal_month}</Text>
              <Text style={[styles.tableCell, styles.colDate]}>{formatDate(data.date)}</Text>
              <Text style={[styles.tableCell, styles.colWeek]}>W{data.fiscal_week}</Text>
              <Text style={[styles.tableCell, styles.colAccount]}>{item.account_name || '-'}</Text>
              <Text style={[styles.tableCell, styles.colStore]}>{item.store_name}</Text>
              <Text style={[styles.tableCell, styles.colSku]}>{item.sku}</Text>
              <Text style={[styles.tableCell, styles.colCategory]}>{item.category || '-'}</Text>
              <Text style={[styles.tableCell, styles.colSubCategory]}>{item.sub_category || '-'}</Text>
              <Text style={[styles.tableCell, styles.colProduct]}>{item.product_name}</Text>
              <Text style={[styles.tableCell, styles.colDisplay]}>{item.display_qty}</Text>
              <Text style={[styles.tableCell, styles.colStock]}>{item.stock_qty}</Text>
            </View>
          ))}
        </View>

        {/* Summary */}
        <View style={styles.summarySection}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Display:</Text>
            <Text style={styles.summaryValue}>{totalDisplay.toLocaleString('id-ID')}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Stock:</Text>
            <Text style={styles.summaryValue}>{totalStock.toLocaleString('id-ID')}</Text>
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
          })} | OmniERP Indonesia ERP System
        </Text>
      </Page>
    </Document>
  );
}
