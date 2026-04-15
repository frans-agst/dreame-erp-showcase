import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { InventoryItem } from '@/types';

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  header: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  subHeader: {
    fontSize: 12,
    marginBottom: 10,
    textAlign: 'center',
  },
  info: {
    fontSize: 10,
    marginBottom: 5,
  },
  table: {
    width: 'auto',
    borderStyle: 'solid',
    borderWidth: 1,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    marginTop: 20,
  },
  tableRow: {
    margin: 'auto',
    flexDirection: 'row',
  },
  tableColHeader: {
    borderStyle: 'solid',
    borderWidth: 1,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    backgroundColor: '#f0f0f0',
    padding: 5,
  },
  tableCol: {
    borderStyle: 'solid',
    borderWidth: 1,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    padding: 5,
  },
  tableCellHeader: {
    fontSize: 8,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  tableCell: {
    fontSize: 8,
    textAlign: 'center',
  },
  tableCellLeft: {
    fontSize: 8,
    textAlign: 'left',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 30,
    right: 30,
    textAlign: 'center',
    fontSize: 8,
    color: '#666',
  },
});

// Helper functions for week calculations
function getWeekNumber(date: Date): number {
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date.getTime() - startOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + startOfYear.getDay() + 1) / 7);
}

function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  const monday = new Date(d.setDate(diff));
  return monday.toISOString().split('T')[0];
}

function getWeekEnd(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? 0 : 7); // Adjust when day is Sunday
  const sunday = new Date(d.setDate(diff));
  return sunday.toISOString().split('T')[0];
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

interface InventoryReportProps {
  inventory: any[];
  storeName: string;
  accountName?: string;
  generatedAt: Date;
  fiscalWeek?: number;
  fiscalYear?: number;
  weekStartDate?: string;
  weekEndDate?: string;
  showStoreColumn?: boolean;
}

export const InventoryReport: React.FC<InventoryReportProps> = ({
  inventory,
  storeName,
  accountName,
  generatedAt,
  fiscalWeek,
  fiscalYear,
  weekStartDate,
  weekEndDate,
  showStoreColumn = false,
}) => {
  const displayName = accountName ? `${accountName} - ${storeName}` : storeName;
  
  // Format week information
  const weekInfo = fiscalWeek && fiscalYear ? 
    `Fiscal Week ${fiscalWeek}, FY${fiscalYear}` : 
    `Week ${getWeekNumber(generatedAt)} of ${generatedAt.getFullYear()}`;
  
  const weekPeriod = weekStartDate && weekEndDate ?
    `${formatDate(weekStartDate)} - ${formatDate(weekEndDate)}` :
    `${formatDate(getWeekStart(generatedAt))} - ${formatDate(getWeekEnd(generatedAt))}`;

  // Calculate column widths based on whether store column is shown
  const columnCount = showStoreColumn ? 8 : 7;
  const columnWidth = `${100 / columnCount}%`;
  
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.header}>Inventory Report</Text>
        <Text style={styles.subHeader}>{displayName}</Text>
        
        <Text style={styles.info}>Generated: {generatedAt.toLocaleString('id-ID')}</Text>
        <Text style={styles.info}>Report Period: {weekInfo}</Text>
        <Text style={styles.info}>Week Period: {weekPeriod}</Text>
        <Text style={styles.info}>Total Products: {inventory.length}</Text>
        <Text style={styles.info}>
          Low Stock Items: {inventory.filter(item => item.quantity >= 0 && item.quantity <= 9).length}
        </Text>

        <View style={styles.table}>
          {/* Header */}
          <View style={styles.tableRow}>
            <View style={[styles.tableColHeader, { width: columnWidth }]}>
              <Text style={styles.tableCellHeader}>SKU</Text>
            </View>
            <View style={[styles.tableColHeader, { width: columnWidth }]}>
              <Text style={styles.tableCellHeader}>Product Name</Text>
            </View>
            {showStoreColumn && (
              <View style={[styles.tableColHeader, { width: columnWidth }]}>
                <Text style={styles.tableCellHeader}>Store</Text>
              </View>
            )}
            <View style={[styles.tableColHeader, { width: columnWidth }]}>
              <Text style={styles.tableCellHeader}>Category</Text>
            </View>
            <View style={[styles.tableColHeader, { width: columnWidth }]}>
              <Text style={styles.tableCellHeader}>Sub Category</Text>
            </View>
            <View style={[styles.tableColHeader, { width: columnWidth }]}>
              <Text style={styles.tableCellHeader}>Stock</Text>
            </View>
            <View style={[styles.tableColHeader, { width: columnWidth }]}>
              <Text style={styles.tableCellHeader}>Display</Text>
            </View>
            <View style={[styles.tableColHeader, { width: columnWidth }]}>
              <Text style={styles.tableCellHeader}>Status</Text>
            </View>
          </View>

          {/* Data rows - limit to first 50 items for PDF */}
          {inventory.slice(0, 50).map((item, index) => {
            const isLowStock = item.quantity >= 0 && item.quantity <= 9;
            const status = item.quantity === 0 ? 'Out of Stock' : 
                          isLowStock ? 'Low Stock' : 'Normal';
            
            return (
              <View style={styles.tableRow} key={index}>
                <View style={[styles.tableCol, { width: columnWidth }]}>
                  <Text style={styles.tableCell}>{item.product?.sku || '-'}</Text>
                </View>
                <View style={[styles.tableCol, { width: columnWidth }]}>
                  <Text style={styles.tableCellLeft}>{item.product?.name || '-'}</Text>
                </View>
                {showStoreColumn && (
                  <View style={[styles.tableCol, { width: columnWidth }]}>
                    <Text style={styles.tableCellLeft}>
                      {item.store ? (item.store.account ? `${item.store.account.name} - ${item.store.name}` : item.store.name) : '-'}
                    </Text>
                  </View>
                )}
                <View style={[styles.tableCol, { width: columnWidth }]}>
                  <Text style={styles.tableCell}>{item.product?.category || '-'}</Text>
                </View>
                <View style={[styles.tableCol, { width: columnWidth }]}>
                  <Text style={styles.tableCell}>{item.product?.sub_category || '-'}</Text>
                </View>
                <View style={[styles.tableCol, { width: columnWidth }]}>
                  <Text style={styles.tableCell}>{item.quantity}</Text>
                </View>
                <View style={[styles.tableCol, { width: columnWidth }]}>
                  <Text style={styles.tableCell}>{item.display_qty}</Text>
                </View>
                <View style={[styles.tableCol, { width: columnWidth }]}>
                  <Text style={styles.tableCell}>{status}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {inventory.length > 50 && (
          <Text style={{ marginTop: 10, fontSize: 8, fontStyle: 'italic' }}>
            * Showing first 50 items. Export to Excel for complete data.
          </Text>
        )}

        <Text style={styles.footer}>
          Generated by Dreame Retail ERP - {new Date().toLocaleDateString('id-ID')}
        </Text>
      </Page>
    </Document>
  );
};