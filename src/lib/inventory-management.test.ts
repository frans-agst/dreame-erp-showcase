// src/lib/inventory-management.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  validateInventoryAvailability,
  updateInventoryForTransaction,
  restoreInventoryForTransaction,
  getInventoryLevels,
  validateAtomicInventoryOperation
} from './inventory-management';
import type { TransactionItemInput } from '@/types';

// Mock the Supabase client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => mockSupabaseClient)
}));

const mockSupabaseClient = {
  from: vi.fn(),
  rpc: vi.fn()
};

describe('Inventory Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockStoreId = '123e4567-e89b-12d3-a456-426614174000';
  const mockItems: TransactionItemInput[] = [
    {
      product_id: '123e4567-e89b-12d3-a456-426614174001',
      quantity: 2,
      unit_price: 100.00,
      line_discount: 0,
      gift_details: []
    },
    {
      product_id: '123e4567-e89b-12d3-a456-426614174002',
      quantity: 1,
      unit_price: 50.00,
      line_discount: 0,
      gift_details: []
    }
  ];

  const mockInventoryData = [
    {
      product_id: '123e4567-e89b-12d3-a456-426614174001',
      quantity: 5,
      product: { name: 'Product A' }
    },
    {
      product_id: '123e4567-e89b-12d3-a456-426614174002',
      quantity: 3,
      product: { name: 'Product B' }
    }
  ];

  describe('validateInventoryAvailability', () => {
    it('should validate sufficient inventory for in_store transactions', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: mockInventoryData,
              error: null
            })
          })
        })
      });
      mockSupabaseClient.from = mockFrom;

      const result = await validateInventoryAvailability(mockStoreId, mockItems, 'in_store');

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect insufficient inventory', async () => {
      const insufficientInventory = [
        {
          product_id: '123e4567-e89b-12d3-a456-426614174001',
          quantity: 1, // Less than requested (2)
          product: { name: 'Product A' }
        },
        {
          product_id: '123e4567-e89b-12d3-a456-426614174002',
          quantity: 3,
          product: { name: 'Product B' }
        }
      ];

      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: insufficientInventory,
              error: null
            })
          })
        })
      });
      mockSupabaseClient.from = mockFrom;

      const result = await validateInventoryAvailability(mockStoreId, mockItems, 'in_store');

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual({
        product_id: '123e4567-e89b-12d3-a456-426614174001',
        product_name: 'Product A',
        requested_quantity: 2,
        available_stock: 1,
        shortage: 1
      });
    });

    it('should skip validation for warehouse inventory', async () => {
      const result = await validateInventoryAvailability(mockStoreId, mockItems, 'warehouse');

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(mockSupabaseClient.from).not.toHaveBeenCalled();
    });

    it('should handle missing products in inventory', async () => {
      const partialInventory = [
        {
          product_id: '123e4567-e89b-12d3-a456-426614174001',
          quantity: 5,
          product: { name: 'Product A' }
        }
        // Missing second product
      ];

      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: partialInventory,
              error: null
            })
          })
        })
      });
      mockSupabaseClient.from = mockFrom;

      const result = await validateInventoryAvailability(mockStoreId, mockItems, 'in_store');

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual({
        product_id: '123e4567-e89b-12d3-a456-426614174002',
        product_name: 'Unknown Product',
        requested_quantity: 1,
        available_stock: 0,
        shortage: 1
      });
    });
  });

  describe('updateInventoryForTransaction', () => {
    it('should decrement inventory for in_store transactions', async () => {
      // Mock getting current inventory
      const mockFromSelect = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn()
                .mockResolvedValueOnce({ data: { quantity: 5 }, error: null })
                .mockResolvedValueOnce({ data: { quantity: 3 }, error: null })
            })
          })
        })
      });

      mockSupabaseClient.from = mockFromSelect;

      // Mock decrement_inventory RPC calls
      mockSupabaseClient.rpc
        .mockResolvedValueOnce({ data: 3, error: null }) // First product: 5 - 2 = 3
        .mockResolvedValueOnce({ data: 2, error: null }); // Second product: 3 - 1 = 2

      const result = await updateInventoryForTransaction(
        mockStoreId,
        mockItems,
        'in_store',
        'decrement'
      );

      expect(result.success).toBe(true);
      expect(result.updated_products).toHaveLength(2);
      expect(result.updated_products[0]).toEqual({
        product_id: mockItems[0].product_id,
        previous_stock: 5,
        new_stock: 3,
        quantity_changed: -2
      });
      expect(result.updated_products[1]).toEqual({
        product_id: mockItems[1].product_id,
        previous_stock: 3,
        new_stock: 2,
        quantity_changed: -1
      });

      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('decrement_inventory', {
        p_store_id: mockStoreId,
        p_product_id: mockItems[0].product_id,
        p_qty: mockItems[0].quantity
      });
    });

    it('should increment inventory for returns', async () => {
      // Mock getting current inventory
      const mockFromSelect = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn()
                .mockResolvedValueOnce({ data: { quantity: 3 }, error: null })
                .mockResolvedValueOnce({ data: { quantity: 2 }, error: null })
            })
          })
        })
      });

      // Mock update operations
      const mockFromUpdate = vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn()
              .mockResolvedValueOnce({ error: null })
              .mockResolvedValueOnce({ error: null })
          })
        })
      });

      mockSupabaseClient.from = vi.fn()
        .mockReturnValueOnce(mockFromSelect())
        .mockReturnValueOnce(mockFromUpdate())
        .mockReturnValueOnce(mockFromSelect())
        .mockReturnValueOnce(mockFromUpdate());

      const result = await updateInventoryForTransaction(
        mockStoreId,
        mockItems,
        'in_store',
        'increment'
      );

      expect(result.success).toBe(true);
      expect(result.updated_products).toHaveLength(2);
      expect(result.updated_products[0]).toEqual({
        product_id: mockItems[0].product_id,
        previous_stock: 3,
        new_stock: 5, // 3 + 2
        quantity_changed: 2
      });
    });

    it('should skip inventory updates for warehouse transactions', async () => {
      const result = await updateInventoryForTransaction(
        mockStoreId,
        mockItems,
        'warehouse',
        'decrement'
      );

      expect(result.success).toBe(true);
      expect(result.updated_products).toHaveLength(0);
      expect(mockSupabaseClient.from).not.toHaveBeenCalled();
    });

    it('should prevent negative stock on decrement', async () => {
      // Mock getting current inventory with insufficient stock
      const mockFromSelect = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { quantity: 1 }, error: null })
            })
          })
        })
      });

      mockSupabaseClient.from = mockFromSelect;

      const result = await updateInventoryForTransaction(
        mockStoreId,
        [{ ...mockItems[0], quantity: 2 }], // Request 2 but only 1 available
        'in_store',
        'decrement'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Insufficient stock');
    });
  });

  describe('restoreInventoryForTransaction', () => {
    it('should restore inventory for voided in_store transaction', async () => {
      const transactionId = '123e4567-e89b-12d3-a456-426614174003';
      const mockTransaction = {
        store_id: mockStoreId,
        inventory_source: 'in_store',
        items: [
          {
            product_id: mockItems[0].product_id,
            quantity: mockItems[0].quantity
          }
        ]
      };

      // Mock getting transaction details
      const mockFromSelect = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockTransaction,
              error: null
            })
          })
        })
      });

      // Mock inventory update operations
      const mockFromInventory = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { quantity: 3 }, error: null })
            })
          })
        })
      });

      const mockFromUpdate = vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null })
          })
        })
      });

      mockSupabaseClient.from = vi.fn()
        .mockReturnValueOnce(mockFromSelect())
        .mockReturnValueOnce(mockFromInventory())
        .mockReturnValueOnce(mockFromUpdate());

      const result = await restoreInventoryForTransaction(transactionId);

      expect(result.success).toBe(true);
      expect(result.updated_products).toHaveLength(1);
    });

    it('should skip restoration for warehouse transactions', async () => {
      const transactionId = '123e4567-e89b-12d3-a456-426614174003';
      const mockTransaction = {
        store_id: mockStoreId,
        inventory_source: 'warehouse',
        items: []
      };

      const mockFromSelect = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockTransaction,
              error: null
            })
          })
        })
      });

      mockSupabaseClient.from = mockFromSelect;

      const result = await restoreInventoryForTransaction(transactionId);

      expect(result.success).toBe(true);
      expect(result.updated_products).toHaveLength(0);
    });
  });

  describe('getInventoryLevels', () => {
    it('should retrieve current inventory levels', async () => {
      const productIds = [mockItems[0].product_id, mockItems[1].product_id];
      const mockInventoryWithProducts = [
        {
          product_id: mockItems[0].product_id,
          quantity: 5,
          product: { name: 'Product A', sku: 'SKU-A' }
        },
        {
          product_id: mockItems[1].product_id,
          quantity: 3,
          product: { name: 'Product B', sku: 'SKU-B' }
        }
      ];

      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: mockInventoryWithProducts,
              error: null
            })
          })
        })
      });
      mockSupabaseClient.from = mockFrom;

      const result = await getInventoryLevels(mockStoreId, productIds);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        product_id: mockItems[0].product_id,
        product_name: 'Product A',
        sku: 'SKU-A',
        current_stock: 5
      });
      expect(result[1]).toEqual({
        product_id: mockItems[1].product_id,
        product_name: 'Product B',
        sku: 'SKU-B',
        current_stock: 3
      });
    });
  });

  describe('validateAtomicInventoryOperation', () => {
    it('should validate complete atomic operation', async () => {
      // Mock inventory levels
      const mockInventoryWithProducts = [
        {
          product_id: mockItems[0].product_id,
          quantity: 5,
          product: { name: 'Product A', sku: 'SKU-A' }
        },
        {
          product_id: mockItems[1].product_id,
          quantity: 3,
          product: { name: 'Product B', sku: 'SKU-B' }
        }
      ];

      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: mockInventoryWithProducts,
              error: null
            })
          })
        })
      });
      mockSupabaseClient.from = mockFrom;

      const result = await validateAtomicInventoryOperation(
        mockStoreId,
        mockItems,
        'in_store'
      );

      expect(result.canProceed).toBe(true);
      expect(result.validationResult.isValid).toBe(true);
      expect(result.inventoryLevels).toHaveLength(2);
    });

    it('should prevent operation when validation fails', async () => {
      // Mock insufficient inventory
      const mockInventoryWithProducts = [
        {
          product_id: mockItems[0].product_id,
          quantity: 1, // Insufficient for requested quantity of 2
          product: { name: 'Product A', sku: 'SKU-A' }
        }
      ];

      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: mockInventoryWithProducts,
              error: null
            })
          })
        })
      });
      mockSupabaseClient.from = mockFrom;

      const result = await validateAtomicInventoryOperation(
        mockStoreId,
        mockItems,
        'in_store'
      );

      expect(result.canProceed).toBe(false);
      expect(result.validationResult.isValid).toBe(false);
      expect(result.validationResult.errors).toHaveLength(2); // One for insufficient stock, one for missing product
    });
  });
});