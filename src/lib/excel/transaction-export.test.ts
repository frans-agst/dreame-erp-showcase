// src/lib/excel/transaction-export.test.ts
// Unit tests for transaction export functionality
// Requirements: 3.1, 3.2, 3.4, 3.5, 3.6, 5.2, 5.4, 5.5

import { describe, it, expect } from 'vitest';
import {
  transactionToExportRows,
  generateExportFilename,
  generateBatchExportFilename,
} from './transaction-export';
import type { Transaction } from '@/types';

describe('Transaction Export', () => {
  // Mock transaction data
  const mockTransaction: Transaction = {
    id: 'test-transaction-id-123',
    store_id: 'store-1',
    store: {
      id: 'store-1',
      name: 'Test Store',
      account: {
        id: 'account-1',
        name: 'Test Account',
        channel_type: 'Retailer',
        is_active: true,
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      },
      account_id: 'account-1',
      region: 'Jakarta',
      monthly_target: 100000000,
      is_active: true,
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
    },
    staff_id: 'staff-1',
    staff: {
      id: 'staff-1',
      email: 'staff@test.com',
      full_name: 'Test Staff',
      role: 'staff',
      store_id: 'store-1',
      is_active: true,
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
    },
    transaction_date: '2024-01-15',
    total_before_discount: 2000000,
    total_discount: 100000,
    total_after_discount: 1900000,
    inventory_source: 'in_store',
    customer_name: 'Test Customer',
    customer_phone: '081234567890',
    notes: 'Test notes',
    created_by: 'staff-1',
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z',
    items: [
      {
        id: 'item-1',
        transaction_id: 'test-transaction-id-123',
        product_id: 'product-1',
        product: {
          id: 'product-1',
          sku: 'SKU001',
          name: 'Product 1',
          category: 'Category A',
          sub_category: 'Sub A',
          price_retail: 1000000,
          price_buy: 800000,
          channel_pricing: {},
          is_active: true,
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
        quantity: 1,
        unit_price: 1000000,
        line_discount: 50000,
        line_total: 950000,
        gift_details: [
          { name: 'Gift 1', qty: 1 },
          { name: 'Gift 2', qty: 2 },
        ],
        created_at: '2024-01-15T10:00:00Z',
      },
      {
        id: 'item-2',
        transaction_id: 'test-transaction-id-123',
        product_id: 'product-2',
        product: {
          id: 'product-2',
          sku: 'SKU002',
          name: 'Product 2',
          category: 'Category B',
          sub_category: 'Sub B',
          price_retail: 1000000,
          price_buy: 800000,
          channel_pricing: {},
          is_active: true,
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
        quantity: 1,
        unit_price: 1000000,
        line_discount: 50000,
        line_total: 950000,
        gift_details: [],
        created_at: '2024-01-15T10:00:00Z',
      },
    ],
  };

  describe('transactionToExportRows', () => {
    it('should create one row per product in multi-product transaction', () => {
      // Requirements: 3.1, 3.2
      const rows = transactionToExportRows(mockTransaction, 3);
      
      expect(rows).toHaveLength(2);
      expect(rows[0]['Product Name']).toBe('Product 1');
      expect(rows[1]['Product Name']).toBe('Product 2');
    });

    it('should repeat transaction-level information for each row', () => {
      // Requirements: 3.3, 5.4
      const rows = transactionToExportRows(mockTransaction, 3);
      
      // Check that transaction-level info is repeated
      expect(rows[0]['Store Name']).toBe('Test Store');
      expect(rows[1]['Store Name']).toBe('Test Store');
      
      expect(rows[0]['Account Name']).toBe('Test Account');
      expect(rows[1]['Account Name']).toBe('Test Account');
      
      expect(rows[0].Week).toBe(3);
      expect(rows[1].Week).toBe(3);
    });

    it('should use existing column headers', () => {
      // Requirements: 3.4, 5.4
      const rows = transactionToExportRows(mockTransaction, 3);
      const row = rows[0];
      
      // Check all required column headers exist
      expect(row).toHaveProperty('Month');
      expect(row).toHaveProperty('DATE');
      expect(row).toHaveProperty('Week');
      expect(row).toHaveProperty('Account Name');
      expect(row).toHaveProperty('Store Name');
      expect(row).toHaveProperty('SKU');
      expect(row).toHaveProperty('Category');
      expect(row).toHaveProperty('Sub category');
      expect(row).toHaveProperty('Product Name');
      expect(row).toHaveProperty('QTY');
      expect(row).toHaveProperty('ST');
      expect(row).toHaveProperty('Discount');
      expect(row).toHaveProperty('TOTAL');
      expect(row).toHaveProperty('Gift Product 1');
      expect(row).toHaveProperty('Gift Qty 1');
      expect(row).toHaveProperty('Gift Product 2');
      expect(row).toHaveProperty('Gift Qty 2');
    });

    it('should include product-specific information', () => {
      // Requirements: 3.2
      const rows = transactionToExportRows(mockTransaction, 3);
      
      expect(rows[0].SKU).toBe('SKU001');
      expect(rows[0].Category).toBe('Category A');
      expect(rows[0]['Sub category']).toBe('Sub A');
      expect(rows[0].QTY).toBe(1);
      expect(rows[0].ST).toBe(1000000);
      expect(rows[0].Discount).toBe(50000);
      expect(rows[0].TOTAL).toBe(950000);
    });

    it('should handle gift details correctly', () => {
      // Requirements: 3.4
      const rows = transactionToExportRows(mockTransaction, 3);
      
      // First product has 2 gifts
      expect(rows[0]['Gift Product 1']).toBe('Gift 1');
      expect(rows[0]['Gift Qty 1']).toBe(1);
      expect(rows[0]['Gift Product 2']).toBe('Gift 2');
      expect(rows[0]['Gift Qty 2']).toBe(2);
      
      // Second product has no gifts
      expect(rows[1]['Gift Product 1']).toBe('');
      expect(rows[1]['Gift Qty 1']).toBe(0);
      expect(rows[1]['Gift Product 2']).toBe('');
      expect(rows[1]['Gift Qty 2']).toBe(0);
    });

    it('should handle line-level discounts', () => {
      // Requirements: 3.5, 5.5
      const rows = transactionToExportRows(mockTransaction, 3);
      
      // Each line has its own discount
      expect(rows[0].Discount).toBe(50000);
      expect(rows[1].Discount).toBe(50000);
      
      // Line totals should reflect discounts
      expect(rows[0].TOTAL).toBe(950000);
      expect(rows[1].TOTAL).toBe(950000);
    });
  });

  describe('generateExportFilename', () => {
    it('should generate filename with correct format for Excel', () => {
      // Requirements: 3.6
      const filename = generateExportFilename(mockTransaction, 'excel');
      
      expect(filename).toContain('Transaction_');
      expect(filename).toContain('Test_Store');
      expect(filename).toContain('2024-01-15');
      expect(filename).toMatch(/\.xlsx$/);
    });

    it('should generate filename with correct format for PDF', () => {
      // Requirements: 3.6, 3.7
      const filename = generateExportFilename(mockTransaction, 'pdf');
      
      expect(filename).toContain('Transaction_');
      expect(filename).toContain('Test_Store');
      expect(filename).toContain('2024-01-15');
      expect(filename).toMatch(/\.pdf$/);
    });

    it('should sanitize store name in filename', () => {
      // Requirements: 3.6
      const transactionWithSpecialChars = {
        ...mockTransaction,
        store: {
          ...mockTransaction.store!,
          name: 'Test Store & Co.',
        },
      };
      
      const filename = generateExportFilename(transactionWithSpecialChars, 'excel');
      
      // Special characters should be replaced with underscores
      expect(filename).toContain('Test_Store___Co_');
    });
  });

  describe('generateBatchExportFilename', () => {
    it('should generate filename with date range', () => {
      // Requirements: 3.6
      const filename = generateBatchExportFilename('2024-01-01', '2024-01-31');
      
      expect(filename).toBe('Transactions_2024-01-01_to_2024-01-31.xlsx');
    });

    it('should generate filename with current date when no range provided', () => {
      // Requirements: 3.6
      const filename = generateBatchExportFilename();
      
      expect(filename).toContain('Transactions_Export_');
      expect(filename).toMatch(/\.xlsx$/);
    });
  });

  describe('Single-product transaction (legacy compatibility)', () => {
    it('should handle single-product transaction as one row', () => {
      // Requirements: 5.6
      const singleProductTransaction: Transaction = {
        ...mockTransaction,
        items: [mockTransaction.items[0]],
      };
      
      const rows = transactionToExportRows(singleProductTransaction, 3);
      
      expect(rows).toHaveLength(1);
      expect(rows[0]['Product Name']).toBe('Product 1');
    });
  });
});
