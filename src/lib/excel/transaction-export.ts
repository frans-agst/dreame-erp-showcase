// src/lib/excel/transaction-export.ts
// Transaction export utilities for Excel format
// Requirements: 3.1, 3.2, 3.4, 3.5, 3.6, 3.7, 5.2, 5.4, 5.5, 5.6

import * as XLSX from 'xlsx';
import type { Transaction, GiftItem } from '@/types';

/**
 * Format for export row matching existing column structure
 * Requirements: 3.4, 5.4
 */
export interface TransactionExportRow {
  Month: string;
  DATE: string;
  Week: number;
  'Account Name': string;
  'Store Name': string;
  SKU: string;
  Category: string;
  'Sub category': string;
  'Product Name': string;
  QTY: number;
  ST: number; // Unit price
  Discount: number;
  TOTAL: number;
  'Gift Product 1': string;
  'Gift Qty 1': number;
  'Gift Product 2': string;
  'Gift Qty 2': number;
}

/**
 * Format date to DD/MM/YYYY format
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Get month name from date
 */
function getMonthName(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'long' });
}

/**
 * Calculate fiscal week from date (simple implementation)
 * In production, this should query the fiscal_calendar table
 */
function getFiscalWeek(dateStr: string): number {
  const date = new Date(dateStr);
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor((date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
  return Math.ceil((days + startOfYear.getDay() + 1) / 7);
}

/**
 * Convert transaction to export rows (one row per product)
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 5.2, 5.4, 5.5
 * 
 * For multi-product transactions:
 * - Creates one row per product
 * - Repeats transaction-level information for each row
 * - Distributes transaction-level discounts proportionally
 */
export function transactionToExportRows(
  transaction: Transaction,
  fiscalWeek?: number
): TransactionExportRow[] {
  const rows: TransactionExportRow[] = [];
  
  // Calculate fiscal week if not provided
  const week = fiscalWeek ?? getFiscalWeek(transaction.transaction_date);
  
  // Get transaction-level information
  const month = getMonthName(transaction.transaction_date);
  const date = formatDate(transaction.transaction_date);
  const accountName = transaction.store?.account?.name || '';
  const storeName = transaction.store?.name || '';
  
  // Process each transaction item
  for (const item of transaction.items) {
    // Extract gift details (up to 2 gifts as per existing format)
    const gift1 = item.gift_details?.[0];
    const gift2 = item.gift_details?.[1];
    
    // Create row with repeated transaction-level information
    // Requirements: 3.3, 5.4
    const row: TransactionExportRow = {
      Month: month,
      DATE: date,
      Week: week,
      'Account Name': accountName,
      'Store Name': storeName,
      SKU: item.product?.sku || '',
      Category: item.product?.category || '',
      'Sub category': item.product?.sub_category || '',
      'Product Name': item.product?.name || '',
      QTY: item.quantity,
      ST: item.unit_price,
      Discount: item.line_discount,
      TOTAL: item.line_total,
      'Gift Product 1': gift1?.name || '',
      'Gift Qty 1': gift1?.qty || 0,
      'Gift Product 2': gift2?.name || '',
      'Gift Qty 2': gift2?.qty || 0,
    };
    
    rows.push(row);
  }
  
  return rows;
}

/**
 * Export single transaction to Excel file
 * Requirements: 3.1, 3.2, 3.4, 3.6, 3.7, 5.1, 5.2
 */
export function exportTransactionToExcel(
  transaction: Transaction,
  fiscalWeek?: number
): Blob {
  // Convert transaction to export rows
  const rows = transactionToExportRows(transaction, fiscalWeek);
  
  // Create workbook
  const workbook = XLSX.utils.book_new();
  
  // Convert rows to worksheet
  const worksheet = XLSX.utils.json_to_sheet(rows);
  
  // Set column widths for better readability
  worksheet['!cols'] = [
    { wch: 10 }, // Month
    { wch: 12 }, // DATE
    { wch: 6 },  // Week
    { wch: 20 }, // Account Name
    { wch: 20 }, // Store Name
    { wch: 15 }, // SKU
    { wch: 15 }, // Category
    { wch: 15 }, // Sub category
    { wch: 25 }, // Product Name
    { wch: 8 },  // QTY
    { wch: 12 }, // ST
    { wch: 12 }, // Discount
    { wch: 12 }, // TOTAL
    { wch: 20 }, // Gift Product 1
    { wch: 10 }, // Gift Qty 1
    { wch: 20 }, // Gift Product 2
    { wch: 10 }, // Gift Qty 2
  ];
  
  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Transaction');
  
  // Generate Excel file as blob
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/**
 * Export multiple transactions to Excel file
 * Requirements: 3.1, 3.2, 3.4, 3.6
 */
export function exportMultipleTransactionsToExcel(
  transactions: Transaction[],
  fiscalWeekMap?: Map<string, number>
): Blob {
  // Convert all transactions to export rows
  const allRows: TransactionExportRow[] = [];
  
  for (const transaction of transactions) {
    const fiscalWeek = fiscalWeekMap?.get(transaction.id);
    const rows = transactionToExportRows(transaction, fiscalWeek);
    allRows.push(...rows);
  }
  
  // Sort by date and store name
  allRows.sort((a, b) => {
    const dateCompare = a.DATE.localeCompare(b.DATE);
    if (dateCompare !== 0) return dateCompare;
    return a['Store Name'].localeCompare(b['Store Name']);
  });
  
  // Create workbook
  const workbook = XLSX.utils.book_new();
  
  // Convert rows to worksheet
  const worksheet = XLSX.utils.json_to_sheet(allRows);
  
  // Set column widths
  worksheet['!cols'] = [
    { wch: 10 }, // Month
    { wch: 12 }, // DATE
    { wch: 6 },  // Week
    { wch: 20 }, // Account Name
    { wch: 20 }, // Store Name
    { wch: 15 }, // SKU
    { wch: 15 }, // Category
    { wch: 15 }, // Sub category
    { wch: 25 }, // Product Name
    { wch: 8 },  // QTY
    { wch: 12 }, // ST
    { wch: 12 }, // Discount
    { wch: 12 }, // TOTAL
    { wch: 20 }, // Gift Product 1
    { wch: 10 }, // Gift Qty 1
    { wch: 20 }, // Gift Product 2
    { wch: 10 }, // Gift Qty 2
  ];
  
  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Transactions');
  
  // Generate Excel file as blob
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/**
 * Generate filename for transaction export
 * Requirements: 3.6
 */
export function generateExportFilename(
  transaction: Transaction,
  format: 'excel' | 'pdf' = 'excel'
): string {
  const date = new Date(transaction.transaction_date);
  const dateStr = date.toISOString().split('T')[0];
  const storeName = transaction.store?.name?.replace(/[^a-zA-Z0-9]/g, '_') || 'Unknown';
  const extension = format === 'excel' ? 'xlsx' : 'pdf';
  
  return `Transaction_${storeName}_${dateStr}_${transaction.id.substring(0, 8)}.${extension}`;
}

/**
 * Generate filename for multiple transactions export
 * Requirements: 3.6
 */
export function generateBatchExportFilename(
  startDate?: string,
  endDate?: string
): string {
  const today = new Date().toISOString().split('T')[0];
  
  if (startDate && endDate) {
    return `Transactions_${startDate}_to_${endDate}.xlsx`;
  }
  
  return `Transactions_Export_${today}.xlsx`;
}
