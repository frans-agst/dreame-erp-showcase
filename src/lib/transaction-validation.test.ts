// src/lib/transaction-validation.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateTransactionInput, getStockValidationInfo } from './transaction-validation';
import type { TransactionInput } from '@/types';

// Mock Supabase client
const mockSupabaseClient = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      in: vi.fn(() => ({
        data: [],
        error: null,
      })),
      eq: vi.fn(() => ({
        single: vi.fn(() => ({
          data: null,
          error: null,
        })),
        in: vi.fn(() => ({
          data: [],
          error: null,
        })),
      })),
    })),
  })),
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}));

describe('Transaction Validation', () => {
  const mockTransactionInput: TransactionInput = {
    store_id: '123e4567-e89b-12d3-a456-426614174000',
    staff_id: '123e4567-e89b-12d3-a456-426614174001',
    transaction_date: '2024-01-15',
    inventory_source: 'in_store',
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

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateTransactionInput', () => {
    it('should validate a correct transaction input', async () => {
      // Mock successful database responses
      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => ({
          in: vi.fn(() => ({
            data: [
              {
                id: '123e4567-e89b-12d3-a456-426614174002',
                name: 'Test Product',
                price: 100.00,
                is_active: true,
              },
            ],
            error: null,
          })),
          eq: vi.fn(() => ({
            single: vi.fn(() => ({
              data: { id: '123', name: 'Test Store', is_active: true },
              error: null,
            })),
            in: vi.fn(() => ({
              data: [
                {
                  product_id: '123e4567-e89b-12d3-a456-426614174002',
                  quantity: 10,
                  product: { name: 'Test Product' },
                },
              ],
              error: null,
            })),
          })),
        })),
      }));

      mockSupabaseClient.from = mockFrom;

      const result = await validateTransactionInput(mockTransactionInput);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject transaction with inactive product', async () => {
      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => ({
          in: vi.fn(() => ({
            data: [
              {
                id: '123e4567-e89b-12d3-a456-426614174002',
                name: 'Inactive Product',
                price: 100.00,
                is_active: false,
              },
            ],
            error: null,
          })),
          eq: vi.fn(() => ({
            single: vi.fn(() => ({
              data: { id: '123', name: 'Test Store', is_active: true },
              error: null,
            })),
            in: vi.fn(() => ({
              data: [],
              error: null,
            })),
          })),
        })),
      }));

      mockSupabaseClient.from = mockFrom;

      const result = await validateTransactionInput(mockTransactionInput);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'PRODUCT_INACTIVE',
          message: expect.stringContaining('not active'),
        })
      );
    });

    it('should reject transaction with price mismatch', async () => {
      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => ({
          in: vi.fn(() => ({
            data: [
              {
                id: '123e4567-e89b-12d3-a456-426614174002',
                name: 'Test Product',
                price: 150.00, // Different from input price
                is_active: true,
              },
            ],
            error: null,
          })),
          eq: vi.fn(() => ({
            single: vi.fn(() => ({
              data: { id: '123', name: 'Test Store', is_active: true },
              error: null,
            })),
            in: vi.fn(() => ({
              data: [
                {
                  product_id: '123e4567-e89b-12d3-a456-426614174002',
                  quantity: 10,
                  product: { name: 'Test Product' },
                },
              ],
              error: null,
            })),
          })),
        })),
      }));

      mockSupabaseClient.from = mockFrom;

      const result = await validateTransactionInput(mockTransactionInput);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'PRICE_MISMATCH',
          message: expect.stringContaining('does not match current price'),
        })
      );
    });

    it('should reject transaction with insufficient stock', async () => {
      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => ({
          in: vi.fn(() => ({
            data: [
              {
                id: '123e4567-e89b-12d3-a456-426614174002',
                name: 'Test Product',
                price: 100.00,
                is_active: true,
              },
            ],
            error: null,
          })),
          eq: vi.fn(() => ({
            single: vi.fn(() => ({
              data: { id: '123', name: 'Test Store', is_active: true },
              error: null,
            })),
            in: vi.fn(() => ({
              data: [
                {
                  product_id: '123e4567-e89b-12d3-a456-426614174002',
                  quantity: 1, // Less than requested quantity of 2
                  product: { name: 'Test Product' },
                },
              ],
              error: null,
            })),
          })),
        })),
      }));

      mockSupabaseClient.from = mockFrom;

      const result = await validateTransactionInput(mockTransactionInput);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'INSUFFICIENT_STOCK',
          message: expect.stringContaining('Insufficient stock'),
        })
      );
    });

    it('should skip stock validation for warehouse inventory', async () => {
      const warehouseTransaction = {
        ...mockTransactionInput,
        inventory_source: 'warehouse' as const,
      };

      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => ({
          in: vi.fn(() => ({
            data: [
              {
                id: '123e4567-e89b-12d3-a456-426614174002',
                name: 'Test Product',
                price: 100.00,
                is_active: true,
              },
            ],
            error: null,
          })),
          eq: vi.fn(() => ({
            single: vi.fn(() => ({
              data: { id: '123', name: 'Test Store', is_active: true },
              error: null,
            })),
          })),
        })),
      }));

      mockSupabaseClient.from = mockFrom;

      const result = await validateTransactionInput(warehouseTransaction);
      expect(result.isValid).toBe(true);
    });

    it('should validate customer information format', async () => {
      const invalidCustomerTransaction = {
        ...mockTransactionInput,
        customer_name: 'John123!', // Invalid characters
        customer_phone: 'invalid-phone!@#', // Invalid characters
      };

      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => ({
          in: vi.fn(() => ({
            data: [
              {
                id: '123e4567-e89b-12d3-a456-426614174002',
                name: 'Test Product',
                price: 100.00,
                is_active: true,
              },
            ],
            error: null,
          })),
          eq: vi.fn(() => ({
            single: vi.fn(() => ({
              data: { id: '123', name: 'Test Store', is_active: true },
              error: null,
            })),
            in: vi.fn(() => ({
              data: [
                {
                  product_id: '123e4567-e89b-12d3-a456-426614174002',
                  quantity: 10,
                  product: { name: 'Test Product' },
                },
              ],
              error: null,
            })),
          })),
        })),
      }));

      mockSupabaseClient.from = mockFrom;

      const result = await validateTransactionInput(invalidCustomerTransaction);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'INVALID_NAME_FORMAT',
        })
      );
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'INVALID_PHONE_FORMAT',
        })
      );
    });
  });

  describe('getStockValidationInfo', () => {
    it('should return stock validation information', async () => {
      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            in: vi.fn(() => ({
              data: [
                {
                  product_id: '123e4567-e89b-12d3-a456-426614174002',
                  quantity: 5,
                  product: { name: 'Test Product' },
                },
              ],
              error: null,
            })),
          })),
        })),
      }));

      mockSupabaseClient.from = mockFrom;

      const result = await getStockValidationInfo('store-id', mockTransactionInput.items);
      
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        product_id: '123e4567-e89b-12d3-a456-426614174002',
        product_name: 'Test Product',
        requested_quantity: 2,
        available_stock: 5,
        shortage: 0,
      });
    });

    it('should calculate shortage correctly', async () => {
      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            in: vi.fn(() => ({
              data: [
                {
                  product_id: '123e4567-e89b-12d3-a456-426614174002',
                  quantity: 1, // Less than requested
                  product: { name: 'Test Product' },
                },
              ],
              error: null,
            })),
          })),
        })),
      }));

      mockSupabaseClient.from = mockFrom;

      const result = await getStockValidationInfo('store-id', mockTransactionInput.items);
      
      expect(result[0].shortage).toBe(1); // 2 requested - 1 available = 1 shortage
    });
  });
});