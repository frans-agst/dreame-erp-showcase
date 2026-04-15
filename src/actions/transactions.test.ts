// src/actions/transactions.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  createTransaction, 
  getTransactions, 
  getTransactionById,
  updateTransaction,
  deleteTransaction,
  voidTransaction,
  searchTransactions
} from './transactions';
import type { TransactionInput, TransactionFilter, TransactionUpdate } from '@/types';

// Mock the dependencies
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => mockSupabaseClient)
}));

vi.mock('@/lib/transaction-validation', () => ({
  validateTransactionInput: vi.fn()
}));

vi.mock('@/lib/transaction-calculations', () => ({
  calculateTransactionTotals: vi.fn()
}));

vi.mock('@/lib/inventory-management', () => ({
  validateAtomicInventoryOperation: vi.fn(),
  restoreInventoryForTransaction: vi.fn()
}));

vi.mock('@/lib/audit-logging', () => ({
  logTransactionCreationAudit: vi.fn(),
  logTransactionModificationAudit: vi.fn(),
  logTransactionDeletionAudit: vi.fn()
}));

const mockSupabaseClient = {
  auth: {
    getUser: vi.fn()
  },
  from: vi.fn(),
  rpc: vi.fn()
};

describe('Transaction Server Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockTransactionInput: TransactionInput = {
    store_id: '123e4567-e89b-12d3-a456-426614174000',
    staff_id: '123e4567-e89b-12d3-a456-426614174001',
    transaction_date: '2024-01-15',
    inventory_source: 'in_store',
    customer_name: 'John Doe',
    customer_phone: '1234567890',
    notes: 'Test transaction',
    items: [
      {
        product_id: '123e4567-e89b-12d3-a456-426614174002',
        quantity: 2,
        unit_price: 100.00,
        line_discount: 10.00,
        gift_details: []
      }
    ]
  };

  const mockTransaction = {
    id: '123e4567-e89b-12d3-a456-426614174003',
    ...mockTransactionInput,
    total_before_discount: 200.00,
    total_discount: 10.00,
    total_after_discount: 190.00,
    created_by: '123e4567-e89b-12d3-a456-426614174004',
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z',
    items: [
      {
        id: '123e4567-e89b-12d3-a456-426614174005',
        transaction_id: '123e4567-e89b-12d3-a456-426614174003',
        product_id: '123e4567-e89b-12d3-a456-426614174002',
        quantity: 2,
        unit_price: 100.00,
        line_discount: 10.00,
        line_total: 190.00,
        gift_details: [],
        created_at: '2024-01-15T10:00:00Z'
      }
    ]
  };

  describe('createTransaction', () => {
    it('should create transaction successfully', async () => {
      // Mock authentication
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: '123e4567-e89b-12d3-a456-426614174004' } },
        error: null
      });

      // Mock validation
      const { validateTransactionInput } = await import('@/lib/transaction-validation');
      const { calculateTransactionTotals } = await import('@/lib/transaction-calculations');
      const { validateAtomicInventoryOperation } = await import('@/lib/inventory-management');
      
      vi.mocked(validateTransactionInput).mockResolvedValue({
        isValid: true,
        errors: []
      });

      vi.mocked(calculateTransactionTotals).mockReturnValue({
        subtotal: 200.00,
        totalDiscount: 10.00,
        total: 190.00,
        itemCount: 1,
        totalQuantity: 2
      });

      vi.mocked(validateAtomicInventoryOperation).mockResolvedValue({
        canProceed: true,
        validationResult: { isValid: true, errors: [] },
        inventoryLevels: []
      });

      // Mock database operations
      mockSupabaseClient.rpc.mockResolvedValue({
        data: mockTransaction.id,
        error: null
      });

      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockTransaction,
              error: null
            })
          })
        })
      });
      mockSupabaseClient.from = mockFrom;

      const result = await createTransaction(mockTransactionInput);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockTransaction);
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('create_transaction_with_items', {
        p_transaction_data: expect.objectContaining({
          store_id: mockTransactionInput.store_id,
          staff_id: mockTransactionInput.staff_id,
          transaction_date: mockTransactionInput.transaction_date
        }),
        p_items_data: expect.arrayContaining([
          expect.objectContaining({
            product_id: mockTransactionInput.items[0].product_id,
            quantity: mockTransactionInput.items[0].quantity
          })
        ])
      });
    });

    it('should reject transaction with insufficient inventory', async () => {
      // Mock authentication
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: '123e4567-e89b-12d3-a456-426614174004' } },
        error: null
      });

      // Mock validation
      const { validateTransactionInput } = await import('@/lib/transaction-validation');
      const { validateAtomicInventoryOperation } = await import('@/lib/inventory-management');
      
      vi.mocked(validateTransactionInput).mockResolvedValue({
        isValid: true,
        errors: []
      });

      vi.mocked(validateAtomicInventoryOperation).mockResolvedValue({
        canProceed: false,
        validationResult: {
          isValid: false,
          errors: [{
            product_id: mockTransactionInput.items[0].product_id,
            product_name: 'Test Product',
            requested_quantity: 2,
            available_stock: 1,
            shortage: 1
          }]
        },
        inventoryLevels: []
      });

      const result = await createTransaction(mockTransactionInput);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Insufficient inventory');
      expect(result.errors).toHaveLength(1);
      expect(result.errors?.[0].code).toBe('INSUFFICIENT_STOCK');
    });
  });

  describe('getTransactions', () => {
    it('should retrieve transactions with filters', async () => {
      const filters: TransactionFilter = {
        store_id: '123e4567-e89b-12d3-a456-426614174000',
        start_date: '2024-01-01',
        end_date: '2024-01-31'
      };

      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        ilike: vi.fn().mockReturnThis()
      };

      mockQuery.lte.mockResolvedValue({
        data: [mockTransaction],
        error: null
      });

      const mockFrom = vi.fn().mockReturnValue(mockQuery);
      mockSupabaseClient.from = mockFrom;

      const result = await getTransactions(filters);

      expect(result.success).toBe(true);
      expect(result.data).toEqual([mockTransaction]);
      expect(mockQuery.eq).toHaveBeenCalledWith('store_id', filters.store_id);
      expect(mockQuery.gte).toHaveBeenCalledWith('transaction_date', filters.start_date);
      expect(mockQuery.lte).toHaveBeenCalledWith('transaction_date', filters.end_date);
    });
  });

  describe('getTransactionById', () => {
    it('should retrieve single transaction by ID', async () => {
      const transactionId = mockTransaction.id;

      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockTransaction,
              error: null
            })
          })
        })
      });
      mockSupabaseClient.from = mockFrom;

      const result = await getTransactionById(transactionId);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockTransaction);
    });

    it('should handle transaction not found', async () => {
      const transactionId = 'non-existent-id';

      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116' }
            })
          })
        })
      });
      mockSupabaseClient.from = mockFrom;

      const result = await getTransactionById(transactionId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Transaction not found');
    });
  });

  describe('updateTransaction', () => {
    it('should update transaction metadata', async () => {
      const transactionId = mockTransaction.id;
      const updates: TransactionUpdate = {
        customer_name: 'Jane Doe',
        notes: 'Updated notes'
      };

      // Mock authentication
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: '123e4567-e89b-12d3-a456-426614174004' } },
        error: null
      });

      // Mock getting current transaction
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

      // Mock update operation
      const mockFromUpdate = vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { ...mockTransaction, ...updates },
                error: null
              })
            })
          })
        })
      });

      mockSupabaseClient.from = vi.fn()
        .mockReturnValueOnce(mockFromSelect())
        .mockReturnValueOnce(mockFromUpdate());

      const result = await updateTransaction(transactionId, updates);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ ...mockTransaction, ...updates });
    });
  });

  describe('voidTransaction', () => {
    it('should void transaction and restore inventory', async () => {
      const transactionId = mockTransaction.id;
      const reason = 'Customer requested void';

      // Mock authentication
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: '123e4567-e89b-12d3-a456-426614174004' } },
        error: null
      });

      // Mock getting transaction
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

      // Mock delete operation
      const mockFromDelete = vi.fn().mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            error: null
          })
        })
      });

      mockSupabaseClient.from = vi.fn()
        .mockReturnValueOnce(mockFromSelect())
        .mockReturnValueOnce(mockFromDelete());

      // Mock inventory restoration
      const { restoreInventoryForTransaction } = await import('@/lib/inventory-management');
      vi.mocked(restoreInventoryForTransaction).mockResolvedValue({
        success: true,
        updated_products: []
      });

      const result = await voidTransaction(transactionId, reason);

      expect(result.success).toBe(true);
      expect(restoreInventoryForTransaction).toHaveBeenCalledWith(transactionId);
    });

    it('should require void reason', async () => {
      const transactionId = mockTransaction.id;

      // Mock authentication
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: '123e4567-e89b-12d3-a456-426614174004' } },
        error: null
      });

      const result = await voidTransaction(transactionId, '');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Void reason is required');
    });
  });

  describe('searchTransactions', () => {
    it('should search transactions by query', async () => {
      const query = 'John Doe';
      const filters: Omit<TransactionFilter, 'customer_name' | 'customer_phone'> = {
        store_id: '123e4567-e89b-12d3-a456-426614174000'
      };

      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis()
      };

      mockQuery.eq.mockResolvedValue({
        data: [mockTransaction],
        error: null
      });

      const mockFrom = vi.fn().mockReturnValue(mockQuery);
      mockSupabaseClient.from = mockFrom;

      const result = await searchTransactions(query, filters);

      expect(result.success).toBe(true);
      expect(result.data).toEqual([mockTransaction]);
      expect(mockQuery.or).toHaveBeenCalledWith(
        expect.stringContaining('customer_name.ilike')
      );
    });

    it('should fallback to getTransactions for empty query', async () => {
      const query = '';
      
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis()
      };

      // Mock the second order call to return the final result
      mockQuery.order.mockReturnValueOnce(mockQuery).mockResolvedValueOnce({
        data: [mockTransaction],
        error: null
      });

      const mockFrom = vi.fn().mockReturnValue(mockQuery);
      mockSupabaseClient.from = mockFrom;

      const result = await searchTransactions(query);

      expect(result.success).toBe(true);
      expect(result.data).toEqual([mockTransaction]);
    });
  });
});