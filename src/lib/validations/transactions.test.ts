// src/lib/validations/transactions.test.ts
import { describe, it, expect } from 'vitest';
import {
  TransactionInputSchema,
  TransactionItemInputSchema,
  TransactionFilterSchema,
  TransactionUpdateSchema,
} from './transactions';

describe('Transaction Validation Schemas', () => {
  describe('TransactionItemInputSchema', () => {
    const validItem = {
      product_id: '123e4567-e89b-12d3-a456-426614174000',
      quantity: 2,
      unit_price: 100.00,
      line_discount: 10.00,
      gift_details: [],
    };

    it('should accept valid transaction item', () => {
      const result = TransactionItemInputSchema.safeParse(validItem);
      expect(result.success).toBe(true);
    });

    it('should reject item with invalid product_id', () => {
      const result = TransactionItemInputSchema.safeParse({
        ...validItem,
        product_id: 'invalid-uuid',
      });
      expect(result.success).toBe(false);
    });

    it('should reject item with zero quantity', () => {
      const result = TransactionItemInputSchema.safeParse({
        ...validItem,
        quantity: 0,
      });
      expect(result.success).toBe(false);
    });

    it('should reject item with negative unit price', () => {
      const result = TransactionItemInputSchema.safeParse({
        ...validItem,
        unit_price: -10,
      });
      expect(result.success).toBe(false);
    });

    it('should reject item where discount exceeds line total', () => {
      const result = TransactionItemInputSchema.safeParse({
        ...validItem,
        quantity: 1,
        unit_price: 100,
        line_discount: 150, // Exceeds 1 * 100
      });
      expect(result.success).toBe(false);
    });

    it('should default line_discount to 0', () => {
      const { line_discount, ...itemWithoutDiscount } = validItem;
      const result = TransactionItemInputSchema.safeParse(itemWithoutDiscount);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.line_discount).toBe(0);
      }
    });
  });

  describe('TransactionInputSchema', () => {
    const validTransaction = {
      store_id: '123e4567-e89b-12d3-a456-426614174000',
      staff_id: '123e4567-e89b-12d3-a456-426614174001',
      transaction_date: '2024-01-15',
      inventory_source: 'in_store' as const,
      customer_name: 'John Doe',
      customer_phone: '+1234567890',
      notes: 'Test transaction',
      items: [
        {
          product_id: '123e4567-e89b-12d3-a456-426614174002',
          quantity: 2,
          unit_price: 100.00,
          line_discount: 10.00,
          gift_details: [],
        },
      ],
    };

    it('should accept valid transaction', () => {
      const result = TransactionInputSchema.safeParse(validTransaction);
      expect(result.success).toBe(true);
    });

    it('should reject transaction with empty items array', () => {
      const result = TransactionInputSchema.safeParse({
        ...validTransaction,
        items: [],
      });
      expect(result.success).toBe(false);
    });

    it('should reject transaction with too many items', () => {
      const manyItems = Array(51).fill(validTransaction.items[0]);
      const result = TransactionInputSchema.safeParse({
        ...validTransaction,
        items: manyItems,
      });
      expect(result.success).toBe(false);
    });

    it('should reject transaction with duplicate products', () => {
      const result = TransactionInputSchema.safeParse({
        ...validTransaction,
        items: [
          validTransaction.items[0],
          validTransaction.items[0], // Duplicate
        ],
      });
      expect(result.success).toBe(false);
    });

    it('should reject transaction with invalid date format', () => {
      const result = TransactionInputSchema.safeParse({
        ...validTransaction,
        transaction_date: '15-01-2024', // Wrong format
      });
      expect(result.success).toBe(false);
    });

    it('should reject transaction with invalid inventory source', () => {
      const result = TransactionInputSchema.safeParse({
        ...validTransaction,
        inventory_source: 'invalid_source',
      });
      expect(result.success).toBe(false);
    });

    it('should default inventory_source to in_store', () => {
      const { inventory_source, ...transactionWithoutSource } = validTransaction;
      const result = TransactionInputSchema.safeParse(transactionWithoutSource);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.inventory_source).toBe('in_store');
      }
    });

    it('should accept transaction with long customer name up to limit', () => {
      const result = TransactionInputSchema.safeParse({
        ...validTransaction,
        customer_name: 'A'.repeat(100), // Exactly at limit
      });
      expect(result.success).toBe(true);
    });

    it('should reject transaction with customer name exceeding limit', () => {
      const result = TransactionInputSchema.safeParse({
        ...validTransaction,
        customer_name: 'A'.repeat(101), // Over limit
      });
      expect(result.success).toBe(false);
    });
  });

  describe('TransactionFilterSchema', () => {
    it('should accept valid filter', () => {
      const result = TransactionFilterSchema.safeParse({
        store_id: '123e4567-e89b-12d3-a456-426614174000',
        start_date: '2024-01-01',
        end_date: '2024-01-31',
        min_total: 100,
        max_total: 1000,
      });
      expect(result.success).toBe(true);
    });

    it('should reject filter where start_date is after end_date', () => {
      const result = TransactionFilterSchema.safeParse({
        start_date: '2024-01-31',
        end_date: '2024-01-01', // Before start date
      });
      expect(result.success).toBe(false);
    });

    it('should reject filter where min_total is greater than max_total', () => {
      const result = TransactionFilterSchema.safeParse({
        min_total: 1000,
        max_total: 100, // Less than min
      });
      expect(result.success).toBe(false);
    });

    it('should accept empty filter', () => {
      const result = TransactionFilterSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });

  describe('TransactionUpdateSchema', () => {
    it('should accept valid update', () => {
      const result = TransactionUpdateSchema.safeParse({
        customer_name: 'Updated Name',
        customer_phone: '+9876543210',
        notes: 'Updated notes',
      });
      expect(result.success).toBe(true);
    });

    it('should accept partial update', () => {
      const result = TransactionUpdateSchema.safeParse({
        customer_name: 'Updated Name',
      });
      expect(result.success).toBe(true);
    });

    it('should accept null values', () => {
      const result = TransactionUpdateSchema.safeParse({
        customer_name: null,
        customer_phone: null,
        notes: null,
      });
      expect(result.success).toBe(true);
    });

    it('should reject update with customer name exceeding limit', () => {
      const result = TransactionUpdateSchema.safeParse({
        customer_name: 'A'.repeat(101), // Over limit
      });
      expect(result.success).toBe(false);
    });
  });
});