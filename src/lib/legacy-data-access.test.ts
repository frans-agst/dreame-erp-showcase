// src/lib/legacy-data-access.test.ts
// Unit tests for legacy data access layer
// Requirements: 2.1, 2.2, 2.3

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn()
}));

import {
  getLegacySaleAsTransaction,
  getUnifiedSalesData,
  queryUnifiedSalesExport,
  isLegacySale,
  getAllSalesForReporting,
  getSalesDataStats
} from './legacy-data-access';
import { createClient } from '@/lib/supabase/server';

describe('Legacy Data Access Layer', () => {
  let mockSupabase: any;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Create mock Supabase client
    mockSupabase = {
      rpc: vi.fn(),
      from: vi.fn(() => mockSupabase),
      select: vi.fn(() => mockSupabase),
      eq: vi.fn(() => mockSupabase),
      gte: vi.fn(() => mockSupabase),
      lte: vi.fn(() => mockSupabase),
      order: vi.fn(() => mockSupabase),
      single: vi.fn()
    };

    vi.mocked(createClient).mockResolvedValue(mockSupabase);
  });

  describe('getLegacySaleAsTransaction', () => {
    it('should convert legacy sale to transaction format', async () => {
      const mockLegacyData = {
        transaction_id: null,
        transaction_date: '2024-01-15',
        store_id: 'store-1',
        store_name: 'Store A',
        account_name: 'Account A',
        staff_id: 'staff-1',
        staff_name: 'John Doe',
        total_before_discount: 100,
        total_discount: 10,
        total_after_discount: 90,
        inventory_source: 'in_store',
        customer_name: 'Customer A',
        customer_phone: '1234567890',
        items: [{
          id: 'item-1',
          product_id: 'prod-1',
          sku: 'SKU001',
          product_name: 'Product A',
          category: 'Category A',
          sub_category: 'Sub A',
          quantity: 2,
          unit_price: 50,
          line_discount: 10,
          line_total: 90,
          gift_details: []
        }]
      };

      mockSupabase.rpc.mockReturnValue(mockSupabase);
      mockSupabase.single.mockResolvedValue({
        data: mockLegacyData,
        error: null
      });

      const result = await getLegacySaleAsTransaction('sale-1');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('sale-1');
      expect(result?.transaction_date).toBe('2024-01-15');
      expect(result?.items).toHaveLength(1);
      expect(result?.items[0].product?.name).toBe('Product A');
      expect(mockSupabase.rpc).toHaveBeenCalledWith('legacy_sale_to_transaction_format', {
        p_sale_id: 'sale-1'
      });
    });

    it('should return null if legacy sale not found', async () => {
      mockSupabase.rpc.mockReturnValue(mockSupabase);
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'Not found' }
      });

      const result = await getLegacySaleAsTransaction('invalid-id');

      expect(result).toBeNull();
    });

    it('should handle empty items array', async () => {
      const mockLegacyData = {
        transaction_date: '2024-01-15',
        store_id: 'store-1',
        store_name: 'Store A',
        account_name: 'Account A',
        staff_id: 'staff-1',
        staff_name: 'John Doe',
        total_before_discount: 0,
        total_discount: 0,
        total_after_discount: 0,
        inventory_source: 'in_store',
        customer_name: null,
        customer_phone: null,
        items: []
      };

      mockSupabase.rpc.mockReturnValue(mockSupabase);
      mockSupabase.single.mockResolvedValue({
        data: mockLegacyData,
        error: null
      });

      const result = await getLegacySaleAsTransaction('sale-1');

      expect(result).not.toBeNull();
      expect(result?.items).toHaveLength(0);
    });
  });

  describe('getUnifiedSalesData', () => {
    it('should fetch unified sales data with all filters', async () => {
      const mockData = [
        {
          id: 'item-1',
          transaction_id: 'trans-1',
          sale_date: '2024-01-15',
          source_type: 'transaction'
        },
        {
          id: 'item-2',
          transaction_id: null,
          sale_date: '2024-01-16',
          source_type: 'legacy'
        }
      ];

      mockSupabase.rpc.mockResolvedValue({
        data: mockData,
        error: null
      });

      const result = await getUnifiedSalesData(
        '2024-01-01',
        '2024-01-31',
        'store-1',
        'staff-1'
      );

      expect(result).toHaveLength(2);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_unified_sales_data', {
        p_start_date: '2024-01-01',
        p_end_date: '2024-01-31',
        p_store_id: 'store-1',
        p_staff_id: 'staff-1'
      });
    });

    it('should handle optional filters', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [],
        error: null
      });

      await getUnifiedSalesData('2024-01-01', '2024-01-31');

      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_unified_sales_data', {
        p_start_date: '2024-01-01',
        p_end_date: '2024-01-31',
        p_store_id: null,
        p_staff_id: null
      });
    });

    it('should return empty array on error', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Database error' }
      });

      const result = await getUnifiedSalesData('2024-01-01', '2024-01-31');

      expect(result).toEqual([]);
    });
  });

  describe('queryUnifiedSalesExport', () => {
    it('should query unified sales export view with all filters', async () => {
      const mockData = [
        { id: 'item-1', source_type: 'transaction' },
        { id: 'item-2', source_type: 'legacy' }
      ];

      // Chain all methods properly
      mockSupabase.select.mockReturnValue(mockSupabase);
      mockSupabase.order.mockReturnValue(mockSupabase);
      mockSupabase.gte.mockReturnValue(mockSupabase);
      mockSupabase.lte.mockReturnValue(mockSupabase);
      mockSupabase.eq.mockReturnValue(mockSupabase);
      
      // Final eq call resolves with data
      mockSupabase.eq.mockResolvedValueOnce({
        data: mockData,
        error: null
      });

      const result = await queryUnifiedSalesExport({
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        storeId: 'store-1',
        staffId: 'staff-1',
        sourceType: 'transaction'
      });

      expect(result).toHaveLength(2);
      expect(mockSupabase.from).toHaveBeenCalledWith('unified_sales_export');
      expect(mockSupabase.gte).toHaveBeenCalledWith('sale_date', '2024-01-01');
      expect(mockSupabase.lte).toHaveBeenCalledWith('sale_date', '2024-01-31');
    });

    it('should work with no filters', async () => {
      mockSupabase.select.mockReturnValue(mockSupabase);
      mockSupabase.order.mockResolvedValue({
        data: [],
        error: null
      });

      const result = await queryUnifiedSalesExport({});

      expect(result).toEqual([]);
      expect(mockSupabase.from).toHaveBeenCalledWith('unified_sales_export');
    });
  });

  describe('isLegacySale', () => {
    it('should return true for legacy sale ID', async () => {
      // First call to sales table returns data
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'sale-1' },
        error: null
      });

      const result = await isLegacySale('sale-1');

      expect(result).toBe(true);
      expect(mockSupabase.from).toHaveBeenCalledWith('sales');
    });

    it('should return false for transaction ID', async () => {
      // First call to sales table returns error (not found)
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Not found' }
      });

      // Second call to transactions table returns data
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'trans-1' },
        error: null
      });

      const result = await isLegacySale('trans-1');

      expect(result).toBe(false);
      expect(mockSupabase.from).toHaveBeenCalledWith('sales');
      expect(mockSupabase.from).toHaveBeenCalledWith('transactions');
    });

    it('should throw error if ID not found in either table', async () => {
      // Both calls return error
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'Not found' }
      });

      await expect(isLegacySale('invalid-id')).rejects.toThrow();
    });
  });

  describe('getAllSalesForReporting', () => {
    it('should fetch all sales data for reporting', async () => {
      const mockData = [
        { id: 'item-1', store_id: 'store-1', source_type: 'transaction' },
        { id: 'item-2', store_id: 'store-1', source_type: 'legacy' }
      ];

      mockSupabase.select.mockReturnValue(mockSupabase);
      mockSupabase.gte.mockReturnValue(mockSupabase);
      mockSupabase.lte.mockReturnValue(mockSupabase);
      mockSupabase.order.mockReturnValue(mockSupabase);
      
      // Second order call resolves with data
      mockSupabase.order.mockResolvedValueOnce({
        data: mockData,
        error: null
      });

      const result = await getAllSalesForReporting('2024-01-01', '2024-01-31');

      expect(result).toHaveLength(2);
      expect(mockSupabase.from).toHaveBeenCalledWith('unified_sales_export');
    });

    it('should filter by account ID', async () => {
      const mockData = [
        { id: 'item-1', store_id: 'store-1' },
        { id: 'item-2', store_id: 'store-2' }
      ];

      mockSupabase.select.mockReturnValue(mockSupabase);
      mockSupabase.gte.mockReturnValue(mockSupabase);
      mockSupabase.lte.mockReturnValue(mockSupabase);
      mockSupabase.order.mockReturnValue(mockSupabase);
      
      // First order call resolves with data
      mockSupabase.order.mockResolvedValueOnce({
        data: mockData,
        error: null
      });

      // Mock stores query for account filter - need to reset from mock
      const storesQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: [{ id: 'store-1' }],
          error: null
        })
      };
      
      // Override from for the stores query
      mockSupabase.from.mockReturnValueOnce(storesQuery);

      const result = await getAllSalesForReporting('2024-01-01', '2024-01-31', {
        accountId: 'account-1'
      });

      expect(result).toHaveLength(1);
      expect(result[0].store_id).toBe('store-1');
    });
  });

  describe('getSalesDataStats', () => {
    it('should return correct stats for mixed data', async () => {
      const mockData = [
        { source_type: 'transaction' },
        { source_type: 'transaction' },
        { source_type: 'legacy' },
        { source_type: 'legacy' },
        { source_type: 'legacy' }
      ];

      mockSupabase.select.mockReturnValue(mockSupabase);
      mockSupabase.gte.mockReturnValue(mockSupabase);
      mockSupabase.lte.mockResolvedValue({
        data: mockData,
        error: null
      });

      const result = await getSalesDataStats('2024-01-01', '2024-01-31');

      expect(result.legacyCount).toBe(3);
      expect(result.transactionCount).toBe(2);
      expect(result.totalCount).toBe(5);
    });

    it('should return zeros on error', async () => {
      mockSupabase.select.mockReturnValue(mockSupabase);
      mockSupabase.gte.mockReturnValue(mockSupabase);
      mockSupabase.lte.mockResolvedValue({
        data: null,
        error: { message: 'Database error' }
      });

      const result = await getSalesDataStats('2024-01-01', '2024-01-31');

      expect(result).toEqual({
        legacyCount: 0,
        transactionCount: 0,
        totalCount: 0
      });
    });

    it('should handle empty data', async () => {
      mockSupabase.select.mockReturnValue(mockSupabase);
      mockSupabase.gte.mockReturnValue(mockSupabase);
      mockSupabase.lte.mockResolvedValue({
        data: [],
        error: null
      });

      const result = await getSalesDataStats('2024-01-01', '2024-01-31');

      expect(result).toEqual({
        legacyCount: 0,
        transactionCount: 0,
        totalCount: 0
      });
    });
  });
});
