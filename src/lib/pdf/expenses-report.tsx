import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { Expense } from '@/actions/expenses';

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 10,
    color: '#666',
    marginBottom: 3,
  },
  table: {
    width: '100%',
    marginTop: 10,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    paddingVertical: 5,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#ccc',
    paddingVertical: 4,
  },
  colDate: { width: '12%', paddingHorizontal: 2 },
  colWeek: { width: '8%', paddingHorizontal: 2 },
  colAccount: { width: '20%', paddingHorizontal: 2 },
  colCategory: { width: '15%', paddingHorizontal: 2 },
  colAmount: { width: '15%', paddingHorizontal: 2, textAlign: 'right' },
  colRemarks: { width: '30%', paddingHorizontal: 2 },
  headerText: {
    fontWeight: 'bold',
    fontSize: 8,
  },
  cellText: {
    fontSize: 8,
  },
  totalRow: {
    flexDirection: 'row',
    borderTopWidth: 2,
    borderTopColor: '#000',
    paddingVertical: 6,
    marginTop: 5,
  },
  totalLabel: {
    width: '55%',
    fontWeight: 'bold',
    fontSize: 10,
    textAlign: 'right',
    paddingRight: 10,
  },
  totalAmount: {
    width: '15%',
    fontWeight: 'bold',
    fontSize: 10,
    textAlign: 'right',
  },
  summary: {
    marginTop: 20,
    padding: 10,
    backgroundColor: '#f9f9f9',
    borderRadius: 4,
  },
  summaryTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 30,
    right: 30,
    fontSize: 8,
    color: '#666',
    textAlign: 'center',
  },
});

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('id-ID', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

interface ExpensesReportPDFProps {
  expenses: Expense[];
  filters?: {
    accountName?: string;
    category?: string;
    startDate?: string;
    endDate?: string;
  };
}

export function ExpensesReportPDF({ expenses, filters }: ExpensesReportPDFProps) {
  const totalAmount = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

  // Group by category for summary
  const categoryTotals = new Map<string, number>();
  expenses.forEach((e) => {
    const current = categoryTotals.get(e.category) || 0;
    categoryTotals.set(e.category, current + Number(e.amount));
  });

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Expenses Report</Text>
          <Text style={styles.subtitle}>Generated: {new Date().toLocaleDateString('id-ID')}</Text>
          {filters?.accountName && <Text style={styles.subtitle}>Account: {filters.accountName}</Text>}
          {filters?.category && <Text style={styles.subtitle}>Category: {filters.category}</Text>}
          {filters?.startDate && filters?.endDate && (
            <Text style={styles.subtitle}>Period: {filters.startDate} - {filters.endDate}</Text>
          )}
        </View>

        {/* Table */}
        <View style={styles.table}>
          {/* Header Row */}
          <View style={styles.tableHeader}>
            <View style={styles.colDate}><Text style={styles.headerText}>Date</Text></View>
            <View style={styles.colWeek}><Text style={styles.headerText}>Week</Text></View>
            <View style={styles.colAccount}><Text style={styles.headerText}>Account</Text></View>
            <View style={styles.colCategory}><Text style={styles.headerText}>Category</Text></View>
            <View style={styles.colAmount}><Text style={styles.headerText}>Amount</Text></View>
            <View style={styles.colRemarks}><Text style={styles.headerText}>Remarks</Text></View>
          </View>

          {/* Data Rows */}
          {expenses.map((expense) => (
            <View key={expense.id} style={styles.tableRow}>
              <View style={styles.colDate}>
                <Text style={styles.cellText}>{formatDate(expense.expense_date)}</Text>
              </View>
              <View style={styles.colWeek}>
                <Text style={styles.cellText}>{expense.fiscal_week}</Text>
              </View>
              <View style={styles.colAccount}>
                <Text style={styles.cellText}>
                  {expense.account ? `${expense.account.channel_type} - ${expense.account.name}` : '-'}
                </Text>
              </View>
              <View style={styles.colCategory}>
                <Text style={styles.cellText}>{expense.category}</Text>
              </View>
              <View style={styles.colAmount}>
                <Text style={styles.cellText}>{formatCurrency(expense.amount)}</Text>
              </View>
              <View style={styles.colRemarks}>
                <Text style={styles.cellText}>{expense.remarks || '-'}</Text>
              </View>
            </View>
          ))}

          {/* Total Row */}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>TOTAL</Text>
            <Text style={styles.totalAmount}>{formatCurrency(totalAmount)}</Text>
          </View>
        </View>

        {/* Category Summary */}
        <View style={styles.summary}>
          <Text style={styles.summaryTitle}>Summary by Category</Text>
          {Array.from(categoryTotals.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([category, total]) => (
              <View key={category} style={styles.summaryRow}>
                <Text>{category}</Text>
                <Text>{formatCurrency(total)}</Text>
              </View>
            ))}
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          Dreame Retail ERP - Expenses Report - Page 1
        </Text>
      </Page>
    </Document>
  );
}
