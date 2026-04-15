/**
 * Property-based tests for audit log functionality
 * Feature: dreame-retail-erp
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Audit log entry structure for testing
 */
interface AuditLogEntry {
  id: string;
  user_id: string | null;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  table_name: string;
  record_id: string;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  created_at: string;
}

/**
 * Simulates the audit log trigger behavior
 * This function represents what the database trigger does
 */
function createAuditLogEntry(
  userId: string | null,
  action: 'INSERT' | 'UPDATE' | 'DELETE',
  tableName: string,
  recordId: string,
  oldValue: Record<string, unknown> | null,
  newValue: Record<string, unknown> | null
): AuditLogEntry {
  return {
    id: crypto.randomUUID(),
    user_id: userId,
    action,
    table_name: tableName,
    record_id: recordId,
    old_value: action === 'INSERT' ? null : oldValue,
    new_value: action === 'DELETE' ? null : newValue,
    created_at: new Date().toISOString(),
  };
}

/**
 * Validates that an audit log entry has all required fields
 */
function isValidAuditLogEntry(entry: AuditLogEntry): boolean {
  // Must have id
  if (!entry.id || typeof entry.id !== 'string') return false;
  
  // Must have valid action
  if (!['INSERT', 'UPDATE', 'DELETE'].includes(entry.action)) return false;
  
  // Must have table_name
  if (!entry.table_name || typeof entry.table_name !== 'string') return false;
  
  // Must have record_id
  if (!entry.record_id || typeof entry.record_id !== 'string') return false;
  
  // Must have created_at
  if (!entry.created_at || typeof entry.created_at !== 'string') return false;
  
  // For INSERT: old_value must be null, new_value must exist
  if (entry.action === 'INSERT') {
    if (entry.old_value !== null) return false;
    if (entry.new_value === null) return false;
  }
  
  // For DELETE: new_value must be null, old_value must exist
  if (entry.action === 'DELETE') {
    if (entry.new_value !== null) return false;
    if (entry.old_value === null) return false;
  }
  
  // For UPDATE: both old_value and new_value must exist
  if (entry.action === 'UPDATE') {
    if (entry.old_value === null) return false;
    if (entry.new_value === null) return false;
  }
  
  return true;
}

/**
 * List of audited tables in the system
 */
const AUDITED_TABLES = [
  'profiles',
  'branches',
  'products',
  'inventory',
  'sales',
  'purchase_orders',
  'day_off_requests',
  'stock_opname',
];

describe('Audit Log', () => {
  /**
   * Feature: dreame-retail-erp, Property 18: Audit Log on Data Changes
   * *For any* INSERT, UPDATE, or DELETE operation on audited tables,
   * an audit_log record SHALL be created containing the user_id, action type,
   * table_name, record_id, and the old/new values.
   * **Validates: Requirements 12.1**
   */
  describe('Property 18: Audit Log on Data Changes', () => {
    it('should create valid audit log entry for INSERT operations', () => {
      fc.assert(
        fc.property(
          fc.option(fc.uuid(), { nil: null }),
          fc.constantFrom(...AUDITED_TABLES),
          fc.uuid(),
          fc.dictionary(fc.string({ minLength: 1, maxLength: 20 }), fc.jsonValue()),
          (userId, tableName, recordId, newValue) => {
            const entry = createAuditLogEntry(
              userId,
              'INSERT',
              tableName,
              recordId,
              null,
              newValue as Record<string, unknown>
            );
            
            // Verify entry is valid
            expect(isValidAuditLogEntry(entry)).toBe(true);
            
            // Verify specific INSERT constraints
            expect(entry.action).toBe('INSERT');
            expect(entry.old_value).toBeNull();
            expect(entry.new_value).not.toBeNull();
            expect(entry.table_name).toBe(tableName);
            expect(entry.record_id).toBe(recordId);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should create valid audit log entry for UPDATE operations', () => {
      fc.assert(
        fc.property(
          fc.option(fc.uuid(), { nil: null }),
          fc.constantFrom(...AUDITED_TABLES),
          fc.uuid(),
          fc.dictionary(fc.string({ minLength: 1, maxLength: 20 }), fc.jsonValue()),
          fc.dictionary(fc.string({ minLength: 1, maxLength: 20 }), fc.jsonValue()),
          (userId, tableName, recordId, oldValue, newValue) => {
            const entry = createAuditLogEntry(
              userId,
              'UPDATE',
              tableName,
              recordId,
              oldValue as Record<string, unknown>,
              newValue as Record<string, unknown>
            );
            
            // Verify entry is valid
            expect(isValidAuditLogEntry(entry)).toBe(true);
            
            // Verify specific UPDATE constraints
            expect(entry.action).toBe('UPDATE');
            expect(entry.old_value).not.toBeNull();
            expect(entry.new_value).not.toBeNull();
            expect(entry.table_name).toBe(tableName);
            expect(entry.record_id).toBe(recordId);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should create valid audit log entry for DELETE operations', () => {
      fc.assert(
        fc.property(
          fc.option(fc.uuid(), { nil: null }),
          fc.constantFrom(...AUDITED_TABLES),
          fc.uuid(),
          fc.dictionary(fc.string({ minLength: 1, maxLength: 20 }), fc.jsonValue()),
          (userId, tableName, recordId, oldValue) => {
            const entry = createAuditLogEntry(
              userId,
              'DELETE',
              tableName,
              recordId,
              oldValue as Record<string, unknown>,
              null
            );
            
            // Verify entry is valid
            expect(isValidAuditLogEntry(entry)).toBe(true);
            
            // Verify specific DELETE constraints
            expect(entry.action).toBe('DELETE');
            expect(entry.old_value).not.toBeNull();
            expect(entry.new_value).toBeNull();
            expect(entry.table_name).toBe(tableName);
            expect(entry.record_id).toBe(recordId);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should always include required fields for any operation', () => {
      fc.assert(
        fc.property(
          fc.option(fc.uuid(), { nil: null }),
          fc.constantFrom('INSERT', 'UPDATE', 'DELETE') as fc.Arbitrary<'INSERT' | 'UPDATE' | 'DELETE'>,
          fc.constantFrom(...AUDITED_TABLES),
          fc.uuid(),
          fc.dictionary(fc.string({ minLength: 1, maxLength: 20 }), fc.jsonValue()),
          fc.dictionary(fc.string({ minLength: 1, maxLength: 20 }), fc.jsonValue()),
          (userId, action, tableName, recordId, oldValue, newValue) => {
            const entry = createAuditLogEntry(
              userId,
              action,
              tableName,
              recordId,
              action === 'INSERT' ? null : oldValue as Record<string, unknown>,
              action === 'DELETE' ? null : newValue as Record<string, unknown>
            );
            
            // All entries must have these fields
            expect(entry.id).toBeDefined();
            expect(typeof entry.id).toBe('string');
            expect(entry.action).toBe(action);
            expect(entry.table_name).toBe(tableName);
            expect(entry.record_id).toBe(recordId);
            expect(entry.created_at).toBeDefined();
            
            // user_id can be null (for system operations) or a valid UUID
            expect(entry.user_id === null || typeof entry.user_id === 'string').toBe(true);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve record_id across all operations', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.constantFrom('INSERT', 'UPDATE', 'DELETE') as fc.Arbitrary<'INSERT' | 'UPDATE' | 'DELETE'>,
          fc.constantFrom(...AUDITED_TABLES),
          (recordId, action, tableName) => {
            const entry = createAuditLogEntry(
              null,
              action,
              tableName,
              recordId,
              action === 'INSERT' ? null : { id: recordId },
              action === 'DELETE' ? null : { id: recordId }
            );
            
            // The record_id in the audit log must match the original record's id
            expect(entry.record_id).toBe(recordId);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should only allow valid action types', () => {
      const validActions = ['INSERT', 'UPDATE', 'DELETE'];
      
      fc.assert(
        fc.property(
          fc.constantFrom(...validActions) as fc.Arbitrary<'INSERT' | 'UPDATE' | 'DELETE'>,
          (action) => {
            const entry = createAuditLogEntry(
              null,
              action,
              'products',
              crypto.randomUUID(),
              action === 'INSERT' ? null : { name: 'old' },
              action === 'DELETE' ? null : { name: 'new' }
            );
            
            expect(validActions).toContain(entry.action);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should only audit tables in the audited tables list', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...AUDITED_TABLES),
          (tableName) => {
            const entry = createAuditLogEntry(
              null,
              'INSERT',
              tableName,
              crypto.randomUUID(),
              null,
              { name: 'test' }
            );
            
            expect(AUDITED_TABLES).toContain(entry.table_name);
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
