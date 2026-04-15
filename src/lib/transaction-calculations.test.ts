// src/lib/transaction-calculations.test.ts
import { describe, it, expect } from 'vitest';
import {
  calculateLineTotal,
  calculateTransactionTotals,
  distributeTransactionDiscount,
  convertTransactionToUnifiedSales,
  validateTransactionCalculations,
  calculateAverageTransactionValue,
  calculateTransactionMetrics,
} from './transaction-calculations';
import type { TransactionItemInput, TransactionItem } from '@/types';

describe('Transaction Calculations', () => {
  describe('calculateLineTotal', () => {
    it('should calculate line total correctly', () => {
      const result = calculateLineTotal(2, 100.00, 10.00);
      
      expect(result.subtotal).toBe(200.00);
      expect(result.discount).toBe(10.00);
      expect(result.total).toBe(190.00);
    });

    it('should handle zero discount', () => {
      const result = calculateLineTotal(3, 50.00, 0);
      
      expect(result.subtotal).toBe(150.00);
      expect(result.discount).toBe(0);
      expect(result.total).toBe(150.00);
    });

    it('should cap discount at subtotal', () => {
      const result = calculateLineTotal(1, 100.00, 150.00); // Discount exceeds subtotal
      
      expect(result.subtotal).toBe(100.00);
      expect(result.discount).toBe(100.00); // Capped at subtotal
      expect(result.total).toBe(0);
    });
  });

  describe('calculateTransactionTotals', () => {
    const mockItems: TransactionItemInput[] = [
      {
        product_id: 'product-1',
        quantity: 2,
        unit_price: 100.00,
        line_discount: 10.00,
      },
      {
        product_id: 'product-2',
        quantity: 1,
        unit_price: 50.00,
        line_discount: 5.00,
      },
    ];

    it('should calculate transaction totals correctly', () => {
      const result = calculateTransactionTotals(mockItems, 20.00);
      
      expect(result.subtotal).toBe(250.00); // (2*100) + (1*50)
      expect(result.totalDiscount).toBe(35.00); // 10 + 5 + 20
      expect(result.total).toBe(215.00); // 250 - 35
      expect(result.itemCount).toBe(2);
      expect(result.totalQuantity).toBe(3);
    });

    it('should handle zero transaction discount', () => {
      const result = calculateTransactionTotals(mockItems, 0);
      
      expect(result.totalDiscount).toBe(15.00); // Only line discounts
      expect(result.total).toBe(235.00);
    });

    it('should ensure total is not negative', () => {
      const result = calculateTransactionTotals(mockItems, 300.00); // Excessive discount
      
      expect(result.total).toBe(0); // Should be capped at 0
    });
  });

  describe('distributeTransactionDiscount', () => {
    const mockItems: TransactionItem[] = [
      {
        id: 'item-1',
        transaction_id: 'trans-1',
        product_id: 'product-1',
        quantity: 2,
        unit_price: 100.00,
        line_discount: 0,
        line_total: 200.00,
        gift_details: [],
        created_at: '2024-01-01T00:00:00Z',
      },
      {
        id: 'item-2',
        transaction_id: 'trans-1',
        product_id: 'product-2',
        quantity: 1,
        unit_price: 100.00,
        line_discount: 0,
        line_total: 100.00,
        gift_details: [],
        created_at: '2024-01-01T00:00:00Z',
      },
    ];

    it('should distribute discount proportionally', () => {
      const result = distributeTransactionDiscount(mockItems, 30.00);
      
      expect(result).toHaveLength(2);
      
      // First item should get 2/3 of discount (200/300 * 30 = 20)
      expect(result[0].distributed_discount).toBe(20.00);
      expect(result[0].final_line_total).toBe(180.00);
      
      // Second item should get 1/3 of discount (100/300 * 30 = 10)
      expect(result[1].distributed_discount).toBe(10.00);
      expect(result[1].final_line_total).toBe(90.00);
    });

    it('should handle zero discount', () => {
      const result = distributeTransactionDiscount(mockItems, 0);
      
      result.forEach((item, index) => {
        expect(item.distributed_discount).toBe(0);
        expect(item.final_line_total).toBe(mockItems[index].line_total);
      });
    });

    it('should handle rounding by giving remainder to last item', () => {
      const result = distributeTransactionDiscount(mockItems, 10.01); // Odd cent
      
      const totalDistributed = result.reduce((sum, item) => sum + item.distributed_discount, 0);
      expect(totalDistributed).toBe(10.01);
    });

    it('should not make final totals negative', () => {
      const result = distributeTransactionDiscount(mockItems, 500.00); // Excessive discount
      
      result.forEach(item => {
        expect(item.final_line_total).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('convertTransactionToUnifiedSales', () => {
    const mockTransaction = {
      id: 'trans-1',
      transaction_date: '2024-01-15',
      store_id: 'store-1',
      store_name: 'Test Store',
      account_name: 'Test Account',
      staff_id: 'staff-1',
      staff_name: 'John Doe',
      customer_name: 'Customer Name',
      customer_phone: '+1234567890',
      total_discount: 30.00,
      inventory_source: 'in_store' as const,
      items: [
        {
          id: 'item-1',
          transaction_id: 'trans-1',
          product_id: 'product-1',
          product: {
            id: 'product-1',
            sku: 'SKU001',
            name: 'Product 1',
            category: 'Category A',
            sub_category: 'Sub A',
            price: 100,
            is_active: true,
          },
          quantity: 2,
          unit_price: 100.00,
          line_discount: 10.00,
          line_total: 190.00,
          gift_details: [],
          created_at: '2024-01-01T00:00:00Z',
        },
      ],
    };

    const fiscalInfo = {
      fiscal_week: 3,
      fiscal_year: 2024,
    };

    it('should convert transaction to unified sales format', () => {
      const result = convertTransactionToUnifiedSales(mockTransaction, fiscalInfo);
      
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'item-1',
        transaction_id: 'trans-1',
        sale_date: '2024-01-15',
        fiscal_week: 3,
        fiscal_year: 2024,
        store_id: 'store-1',
        store_name: 'Test Store',
        account_name: 'Test Account',
        staff_id: 'staff-1',
        staff_name: 'John Doe',
        product_id: 'product-1',
        sku: 'SKU001',
        product_name: 'Product 1',
        category: 'Category A',
        sub_category: 'Sub A',
        quantity: 2,
        unit_price: 100.00,
        customer_name: 'Customer Name',
        customer_phone: '+1234567890',
        inventory_source: 'in_store',
        source_type: 'transaction',
      });
    });

    it('should include distributed transaction discount in total discount', () => {
      const result = convertTransactionToUnifiedSales(mockTransaction, fiscalInfo);
      
      // Should include both line discount (10) and distributed transaction discount (30)
      expect(result[0].discount).toBe(40.00);
      expect(result[0].total_price).toBe(160.00); // 190 - 30 distributed
    });
  });

  describe('validateTransactionCalculations', () => {
    const mockItems: TransactionItemInput[] = [
      {
        product_id: 'product-1',
        quantity: 2,
        unit_price: 100.00,
        line_discount: 10.00,
      },
    ];

    it('should validate correct calculations', () => {
      const result = validateTransactionCalculations(mockItems, 190.00, 0);
      
      expect(result.isValid).toBe(true);
      expect(result.calculatedTotal).toBe(190.00);
      expect(result.difference).toBe(0);
    });

    it('should detect calculation errors', () => {
      const result = validateTransactionCalculations(mockItems, 200.00, 0); // Wrong expected total
      
      expect(result.isValid).toBe(false);
      expect(result.difference).toBe(10.00);
    });

    it('should allow small rounding differences', () => {
      const result = validateTransactionCalculations(mockItems, 190.005, 0); // 0.5 cent difference
      
      expect(result.isValid).toBe(true); // Should be valid due to rounding tolerance
    });
  });

  describe('calculateAverageTransactionValue', () => {
    it('should calculate average correctly', () => {
      const transactions = [
        { total_after_discount: 100.00 },
        { total_after_discount: 200.00 },
        { total_after_discount: 150.00 },
      ];
      
      const result = calculateAverageTransactionValue(transactions);
      expect(result).toBe(150.00);
    });

    it('should handle empty array', () => {
      const result = calculateAverageTransactionValue([]);
      expect(result).toBe(0);
    });
  });

  describe('calculateTransactionMetrics', () => {
    const mockTransactions = [
      {
        total_after_discount: 100.00,
        items: [{ quantity: 2 }, { quantity: 1 }],
      },
      {
        total_after_discount: 200.00,
        items: [{ quantity: 3 }],
      },
    ];

    it('should calculate all metrics correctly', () => {
      const result = calculateTransactionMetrics(mockTransactions);
      
      expect(result.totalTransactions).toBe(2);
      expect(result.totalRevenue).toBe(300.00);
      expect(result.totalItems).toBe(6); // 2+1+3
      expect(result.averageTransactionValue).toBe(150.00); // 300/2
      expect(result.averageItemsPerTransaction).toBe(3.00); // 6/2
    });

    it('should handle empty transactions', () => {
      const result = calculateTransactionMetrics([]);
      
      expect(result.totalTransactions).toBe(0);
      expect(result.totalRevenue).toBe(0);
      expect(result.totalItems).toBe(0);
      expect(result.averageTransactionValue).toBe(0);
      expect(result.averageItemsPerTransaction).toBe(0);
    });
  });
});