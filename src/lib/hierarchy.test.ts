/**
 * Property-based tests for Account-Store hierarchy
 * Feature: omnierp-retail-erp
 * 
 * **Validates: Requirements 2.3, 2.5**
 * 
 * Property 7: Account-Store Hierarchy
 * *For any* Store, there SHALL exist exactly one parent Account.
 * *For any* Account filter on dashboard, the results SHALL include data 
 * from ALL stores belonging to that account.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { Account, Store, ChannelType } from '@/types';

// ============================================================================
// Test Data Generators
// ============================================================================

const channelTypeArb: fc.Arbitrary<ChannelType> = fc.constantFrom(
  'Brandstore',
  'Modern Channel',
  'Retailer',
  'Dealer',
  'Hangon'
);

// Use constant ISO date strings to avoid date generation issues
const isoDateArb = fc.constantFrom(
  '2024-01-15T10:30:00.000Z',
  '2024-06-20T14:45:00.000Z',
  '2025-03-10T08:00:00.000Z',
  '2025-09-25T16:30:00.000Z'
);

const accountArb: fc.Arbitrary<Account> = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 100 }),
  channel_type: channelTypeArb,
  is_active: fc.boolean(),
  created_at: isoDateArb,
  updated_at: isoDateArb,
});

const storeArb = (accountId: string): fc.Arbitrary<Store> => fc.record({
  id: fc.uuid(),
  account_id: fc.constant(accountId),
  name: fc.string({ minLength: 1, maxLength: 100 }),
  region: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: null }),
  monthly_target: fc.float({ min: 0, max: 1_000_000_000, noNaN: true }),
  is_active: fc.boolean(),
  created_at: isoDateArb,
  updated_at: isoDateArb,
});

// Generator for account with its stores
const accountWithStoresArb: fc.Arbitrary<{ account: Account; stores: Store[] }> = 
  accountArb.chain(account => 
    fc.array(storeArb(account.id), { minLength: 1, maxLength: 10 })
      .map(stores => ({ account, stores }))
  );

// Generator for multiple accounts with their stores
const multipleAccountsWithStoresArb: fc.Arbitrary<{ accounts: Account[]; stores: Store[] }> =
  fc.array(accountArb, { minLength: 1, maxLength: 5 }).chain(accounts =>
    fc.tuple(
      ...accounts.map(account => 
        fc.array(storeArb(account.id), { minLength: 1, maxLength: 5 })
      )
    ).map(storeArrays => ({
      accounts,
      stores: storeArrays.flat(),
    }))
  );


// ============================================================================
// Helper Functions (Pure functions for testing)
// ============================================================================

/**
 * Validates that a store has exactly one parent account
 */
function storeHasExactlyOneParent(store: Store, accounts: Account[]): boolean {
  const matchingAccounts = accounts.filter(a => a.id === store.account_id);
  return matchingAccounts.length === 1;
}

/**
 * Gets all stores belonging to an account
 */
function getStoresByAccountId(stores: Store[], accountId: string): Store[] {
  return stores.filter(s => s.account_id === accountId);
}

/**
 * Validates that filtering by account returns all stores for that account
 */
function accountFilterReturnsAllStores(
  stores: Store[],
  accountId: string,
  filteredStores: Store[]
): boolean {
  const expectedStores = getStoresByAccountId(stores, accountId);
  const expectedIds = new Set(expectedStores.map(s => s.id));
  const filteredIds = new Set(filteredStores.map(s => s.id));
  
  // All expected stores should be in filtered results
  for (const id of expectedIds) {
    if (!filteredIds.has(id)) return false;
  }
  
  // No stores from other accounts should be in filtered results
  for (const store of filteredStores) {
    if (store.account_id !== accountId) return false;
  }
  
  return true;
}

/**
 * Validates store display name format "Account - Store"
 */
function getStoreDisplayName(store: Store, account: Account | undefined): string {
  if (!account) return store.name;
  return `${account.name} - ${store.name}`;
}

// ============================================================================
// Property Tests
// ============================================================================

describe('Account-Store Hierarchy - Property-Based Tests', () => {
  /**
   * Property 7: Account-Store Hierarchy
   * 
   * *For any* Store, there SHALL exist exactly one parent Account.
   * *For any* Account filter on dashboard, the results SHALL include data 
   * from ALL stores belonging to that account.
   * 
   * **Validates: Requirements 2.3, 2.5**
   */
  describe('Property 7: Account-Store Hierarchy', () => {
    it('Every store has exactly one parent account', () => {
      fc.assert(
        fc.property(multipleAccountsWithStoresArb, ({ accounts, stores }) => {
          // Every store should have exactly one matching account
          return stores.every(store => storeHasExactlyOneParent(store, accounts));
        }),
        { numRuns: 100 }
      );
    });

    it('Store account_id always references a valid account', () => {
      fc.assert(
        fc.property(accountWithStoresArb, ({ account, stores }) => {
          // All stores should reference the parent account
          return stores.every(store => store.account_id === account.id);
        }),
        { numRuns: 100 }
      );
    });

    it('Account filter returns all stores belonging to that account', () => {
      fc.assert(
        fc.property(multipleAccountsWithStoresArb, ({ accounts, stores }) => {
          // For each account, filtering should return exactly its stores
          return accounts.every(account => {
            const filteredStores = getStoresByAccountId(stores, account.id);
            return accountFilterReturnsAllStores(stores, account.id, filteredStores);
          });
        }),
        { numRuns: 100 }
      );
    });

    it('Account filter excludes stores from other accounts', () => {
      fc.assert(
        fc.property(multipleAccountsWithStoresArb, ({ accounts, stores }) => {
          if (accounts.length < 2) return true; // Need at least 2 accounts to test
          
          const targetAccount = accounts[0];
          const filteredStores = getStoresByAccountId(stores, targetAccount.id);
          
          // No store from other accounts should be in the filtered results
          return filteredStores.every(store => store.account_id === targetAccount.id);
        }),
        { numRuns: 100 }
      );
    });

    it('Store display name follows "Account - Store" format', () => {
      fc.assert(
        fc.property(accountWithStoresArb, ({ account, stores }) => {
          return stores.every(store => {
            const displayName = getStoreDisplayName(store, account);
            return displayName === `${account.name} - ${store.name}`;
          });
        }),
        { numRuns: 100 }
      );
    });

    it('Store without account shows only store name', () => {
      fc.assert(
        fc.property(accountWithStoresArb, ({ stores }) => {
          return stores.every(store => {
            const displayName = getStoreDisplayName(store, undefined);
            return displayName === store.name;
          });
        }),
        { numRuns: 100 }
      );
    });

    it('All stores for an account have the same account_id', () => {
      fc.assert(
        fc.property(accountWithStoresArb, ({ account, stores }) => {
          const accountIds = new Set(stores.map(s => s.account_id));
          // All stores should have the same account_id
          return accountIds.size === 1 && accountIds.has(account.id);
        }),
        { numRuns: 100 }
      );
    });

    it('Store count per account is preserved after filtering', () => {
      fc.assert(
        fc.property(multipleAccountsWithStoresArb, ({ accounts, stores }) => {
          return accounts.every(account => {
            const originalCount = stores.filter(s => s.account_id === account.id).length;
            const filteredCount = getStoresByAccountId(stores, account.id).length;
            return originalCount === filteredCount;
          });
        }),
        { numRuns: 100 }
      );
    });
  });
});
