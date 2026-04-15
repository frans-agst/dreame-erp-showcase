// src/lib/audit-logging.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  logTransactionAudit,
  logTransactionItemsAudit,
  logTransactionCreationAudit,
  logTransactionModificationAudit,
  logTransactionDeletionAudit,
  getTransactionAuditTrail,
  getTransactionAuditSummary,
  cleanupOldAuditLogs
} from './audit-logging';
import type { Transaction, TransactionItem } from '@/types';

// Mock the Supabase client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => mockSupabaseClient)
}));

const mockSupabaseClient = {
  from: vi.fn()
};

describe('Audit Logging', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockTransaction: Transaction = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    store_id: '123e4567-e89b-12d3-a456-426614174001',
    staff_id: '123e4567-e89b-12d3-a456-426614174002',
    transaction_date: '2024-01-15',
    total_before_discount: 200.00,
    total_discount: 10.00,
    total_after_discount: 190.00,
    inventory_source: 'in_store',
    customer_name: 'John Doe',
    customer_phone: '1234567890',
    notes: 'Test transaction',
    created_by: '123e4567-e89b-12d3-a456-426614174003',
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z',
    items: [
      {
        id: '123e4567-e89b-12d3-a456-426614174004',
        transaction_id: '123e4567-e89b-12d3-a456-426614174000',
        product_id: '123e4567-e89b-12d3-a456-426614174005',
        quantity: 2,
        unit_price: 100.00,
        line_discount: 10.00,
        line_total: 190.00,
        gift_details: [],
        created_at: '2024-01-15T10:00:00Z'
      }
    ]
  };

  const mockUserId = '123e4567-e89b-12d3-a456-426614174003';

  describe('logTransactionAudit', () => {
    it('should log transaction creation audit', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        insert: vi.fn().mockResolvedValue({ error: null })
      });
      mockSupabaseClient.from = mockFrom;

      const result = await logTransactionAudit({
        transaction_id: mockTransaction.id,
        user_id: mockUserId,
        action: 'CREATE'
      }, mockTransaction);

      expect(result.success).toBe(true);
      expect(mockFrom).toHaveBeenCalledWith('audit_log');
      expect(mockFrom().insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: mockUserId,
          action: 'INSERT',
          table_name: 'transactions',
          record_id: mockTransaction.id,
          new_value: mockTransaction,
          metadata: expect.objectContaining({
            transaction_action: 'CREATE'
          })
        })
      );
    });

    it('should log transaction update audit', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        insert: vi.fn().mockResolvedValue({ error: null })
      });
      mockSupabaseClient.from = mockFrom;

      const updates = { customer_name: 'Jane Doe' };
      const previousData = { customer_name: 'John Doe' };

      const result = await logTransactionAudit({
        transaction_id: mockTransaction.id,
        user_id: mockUserId,
        action: 'UPDATE',
        reason: 'Customer name correction'
      }, updates, previousData);

      expect(result.success).toBe(true);
      expect(mockFrom().insert).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'UPDATE',
          old_value: previousData,
          new_value: updates,
          metadata: expect.objectContaining({
            transaction_action: 'UPDATE',
            reason: 'Customer name correction'
          })
        })
      );
    });

    it('should handle audit logging errors', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        insert: vi.fn().mockResolvedValue({ 
          error: { message: 'Database error' } 
        })
      });
      mockSupabaseClient.from = mockFrom;

      const result = await logTransactionAudit({
        transaction_id: mockTransaction.id,
        user_id: mockUserId,
        action: 'CREATE'
      }, mockTransaction);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
    });
  });

  describe('logTransactionItemsAudit', () => {
    it('should log transaction items creation audit', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        insert: vi.fn().mockResolvedValue({ error: null })
      });
      mockSupabaseClient.from = mockFrom;

      const result = await logTransactionItemsAudit(
        mockTransaction.id,
        mockUserId,
        'CREATE',
        mockTransaction.items
      );

      expect(result.success).toBe(true);
      expect(mockFrom().insert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            user_id: mockUserId,
            action: 'INSERT',
            table_name: 'transaction_items',
            record_id: mockTransaction.items[0].id,
            new_value: mockTransaction.items[0],
            metadata: expect.objectContaining({
              transaction_id: mockTransaction.id,
              transaction_action: 'CREATE'
            })
          })
        ])
      );
    });
  });

  describe('logTransactionCreationAudit', () => {
    it('should log comprehensive creation audit', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        insert: vi.fn().mockResolvedValue({ error: null })
      });
      mockSupabaseClient.from = mockFrom;

      const result = await logTransactionCreationAudit(
        mockTransaction,
        mockUserId,
        { creation_method: 'api' }
      );

      expect(result.success).toBe(true);
      // Should be called twice: once for transaction, once for items
      expect(mockFrom().insert).toHaveBeenCalledTimes(2);
    });
  });

  describe('logTransactionModificationAudit', () => {
    it('should log modification audit with change summary', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        insert: vi.fn().mockResolvedValue({ error: null })
      });
      mockSupabaseClient.from = mockFrom;

      const changes = { customer_name: 'Jane Doe', notes: 'Updated notes' };
      const previousData = { customer_name: 'John Doe', notes: 'Original notes' };

      const result = await logTransactionModificationAudit(
        mockTransaction.id,
        mockUserId,
        changes,
        previousData,
        'Data correction'
      );

      expect(result.success).toBe(true);
      expect(mockFrom().insert).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            fields_changed: ['customer_name', 'notes'],
            change_summary: expect.stringContaining('customer_name: "John Doe" → "Jane Doe"')
          })
        })
      );
    });
  });

  describe('logTransactionDeletionAudit', () => {
    it('should log deletion audit', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        insert: vi.fn().mockResolvedValue({ error: null })
      });
      mockSupabaseClient.from = mockFrom;

      const result = await logTransactionDeletionAudit(
        mockTransaction,
        mockUserId,
        'Admin deletion',
        false
      );

      expect(result.success).toBe(true);
      expect(mockFrom().insert).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'DELETE',
          old_value: mockTransaction,
          metadata: expect.objectContaining({
            transaction_action: 'DELETE',
            reason: 'Admin deletion',
            deletion_type: 'delete'
          })
        })
      );
    });

    it('should log void audit', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        insert: vi.fn().mockResolvedValue({ error: null })
      });
      mockSupabaseClient.from = mockFrom;

      const result = await logTransactionDeletionAudit(
        mockTransaction,
        mockUserId,
        'Customer request',
        true
      );

      expect(result.success).toBe(true);
      expect(mockFrom().insert).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            transaction_action: 'VOID',
            deletion_type: 'void'
          })
        })
      );
    });
  });

  describe('getTransactionAuditTrail', () => {
    it('should retrieve audit trail for transaction', async () => {
      const mockAuditLogs = [
        {
          id: '123e4567-e89b-12d3-a456-426614174006',
          user_id: mockUserId,
          action: 'INSERT',
          table_name: 'transactions',
          record_id: mockTransaction.id,
          old_value: null,
          new_value: mockTransaction,
          created_at: '2024-01-15T10:00:00Z',
          user: { id: mockUserId, full_name: 'Test User' }
        }
      ];

      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          or: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: mockAuditLogs,
              error: null
            })
          })
        })
      });
      mockSupabaseClient.from = mockFrom;

      const result = await getTransactionAuditTrail(mockTransaction.id);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockAuditLogs);
      expect(mockFrom().select().or).toHaveBeenCalledWith(
        expect.stringContaining(`record_id.eq.${mockTransaction.id}`)
      );
    });

    it('should handle audit trail retrieval errors', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          or: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database error' }
            })
          })
        })
      });
      mockSupabaseClient.from = mockFrom;

      const result = await getTransactionAuditTrail(mockTransaction.id);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
    });
  });

  describe('getTransactionAuditSummary', () => {
    it('should retrieve and summarize audit data', async () => {
      const mockAuditLogs = [
        {
          created_at: '2024-01-15T10:00:00Z',
          action: 'INSERT',
          user_id: mockUserId,
          metadata: { store_name: 'Test Store' },
          user: { full_name: 'Test User' }
        },
        {
          created_at: '2024-01-15T11:00:00Z',
          action: 'INSERT',
          user_id: mockUserId,
          metadata: { store_name: 'Test Store' },
          user: { full_name: 'Test User' }
        }
      ];

      // Create a mock that can be awaited and supports method chaining
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        // Make it thenable so it can be awaited
        then: vi.fn((resolve) => resolve({
          data: mockAuditLogs,
          error: null
        }))
      };

      const mockFrom = vi.fn().mockReturnValue(mockQuery);
      mockSupabaseClient.from = mockFrom;

      const filters = {
        start_date: '2024-01-15',
        end_date: '2024-01-15',
        action: 'INSERT'
      };

      const result = await getTransactionAuditSummary(filters);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1); // Should be grouped by date-action-user
      expect(result.data?.[0]).toEqual({
        date: '2024-01-15',
        action: 'INSERT',
        count: 2,
        user_name: 'Test User',
        store_name: 'Test Store'
      });
    });
  });

  describe('cleanupOldAuditLogs', () => {
    it('should cleanup old audit logs', async () => {
      const mockDeletedLogs = [
        { id: '123e4567-e89b-12d3-a456-426614174006' },
        { id: '123e4567-e89b-12d3-a456-426614174007' }
      ];

      const mockFrom = vi.fn().mockReturnValue({
        delete: vi.fn().mockReturnValue({
          lt: vi.fn().mockReturnValue({
            select: vi.fn().mockResolvedValue({
              data: mockDeletedLogs,
              error: null
            })
          })
        })
      });
      mockSupabaseClient.from = mockFrom;

      const result = await cleanupOldAuditLogs(30); // 30 days retention

      expect(result.success).toBe(true);
      expect(result.deletedCount).toBe(2);
      expect(mockFrom().delete().lt).toHaveBeenCalledWith(
        'created_at',
        expect.any(String)
      );
    });

    it('should handle cleanup errors', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        delete: vi.fn().mockReturnValue({
          lt: vi.fn().mockReturnValue({
            select: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Cleanup failed' }
            })
          })
        })
      });
      mockSupabaseClient.from = mockFrom;

      const result = await cleanupOldAuditLogs(30);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Cleanup failed');
    });
  });
});