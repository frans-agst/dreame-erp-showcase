/**
 * Property-based tests for Gift Inventory Invariant
 * Feature: dreame-retail-erp
 * 
 * Property 5: Gift Inventory Invariant
 * *For any* sale submission with gift_details, the inventory SHALL be decremented
 * ONLY for the main sold product. Gift items SHALL NOT affect inventory quantities.
 * **Validates: Requirements 8.7, 8.8**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { GiftItem } from '@/types';

// ============================================================================
// Pure functions to test the gift inventory invariant
// These functions represent the business logic that should be tested
// ============================================================================

/**
 * Calculate inventory changes for a sale
 * Returns a map of product_id -> quantity_change
 * 
 * CRITICAL: Only the main sold item should have inventory decremented.
 * Gift items should NOT affect inventory.
 */
export function calculateInventoryChanges(
  mainProductId: string,
  mainQuantity: number,
  giftDetails: GiftItem[]
): Map<string, number> {
  const changes = new Map<string, number>();
  
  // Only decrement inventory for the main sold item (Requirement 8.7)
  changes.set(mainProductId, -mainQuantity);
  
  // Gift items do NOT affect inventory (Requirement 8.8)
  // We explicitly do NOT add gift items to the changes map
  
  return changes;
}

/**
 * Validate that a sale's inventory changes follow the gift inventory invariant
 * Returns true if the invariant is satisfied
 */
export function validateGiftInventoryInvariant(
  mainProductId: string,
  mainQuantity: number,
  giftDetails: GiftItem[],
  inventoryChanges: Map<string, number>
): boolean {
  // Check 1: Main product should be decremented by exactly mainQuantity
  const mainChange = inventoryChanges.get(mainProductId);
  if (mainChange !== -mainQuantity) {
    return false;
  }
  
  // Check 2: No gift products should have inventory changes
  for (const gift of giftDetails) {
    if (inventoryChanges.has(gift.product_id) && gift.product_id !== mainProductId) {
      // Gift product has an inventory change - invariant violated!
      return false;
    }
  }
  
  // Check 3: Only the main product should have changes
  // (unless a gift happens to be the same as the main product, which is unusual)
  const changedProducts = Array.from(inventoryChanges.keys());
  const nonMainChanges = changedProducts.filter(id => id !== mainProductId);
  if (nonMainChanges.length > 0) {
    return false;
  }
  
  return true;
}

/**
 * Simulate applying inventory changes to a stock map
 * Returns the new stock levels
 */
export function applyInventoryChanges(
  currentStock: Map<string, number>,
  changes: Map<string, number>
): Map<string, number> {
  const newStock = new Map(currentStock);
  
  for (const [productId, change] of changes) {
    const current = newStock.get(productId) || 0;
    newStock.set(productId, current + change);
  }
  
  return newStock;
}

// ============================================================================
// Property-Based Tests
// ============================================================================

describe('Gift Inventory Invariant (Property 5)', () => {
  // Arbitrary for GiftItem
  const giftItemArb = fc.record({
    product_id: fc.uuid(),
    name: fc.string({ minLength: 1, maxLength: 100 }),
    qty: fc.integer({ min: 1, max: 10 }),
  });

  // Arbitrary for a sale with gifts
  const saleWithGiftsArb = fc.record({
    mainProductId: fc.uuid(),
    mainQuantity: fc.integer({ min: 1, max: 100 }),
    giftDetails: fc.array(giftItemArb, { minLength: 0, maxLength: 5 }),
  });

  /**
   * Property: Main product inventory is decremented by exactly the sold quantity
   * **Validates: Requirement 8.7**
   */
  it('should decrement main product inventory by exactly the sold quantity', () => {
    fc.assert(
      fc.property(
        saleWithGiftsArb,
        ({ mainProductId, mainQuantity, giftDetails }) => {
          const changes = calculateInventoryChanges(mainProductId, mainQuantity, giftDetails);
          const mainChange = changes.get(mainProductId);
          
          // Main product should be decremented by exactly mainQuantity
          return mainChange === -mainQuantity;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Gift items do NOT affect inventory
   * **Validates: Requirement 8.8**
   */
  it('should NOT decrement inventory for gift items', () => {
    fc.assert(
      fc.property(
        saleWithGiftsArb,
        ({ mainProductId, mainQuantity, giftDetails }) => {
          const changes = calculateInventoryChanges(mainProductId, mainQuantity, giftDetails);
          
          // No gift product should have inventory changes (unless it's also the main product)
          for (const gift of giftDetails) {
            if (gift.product_id !== mainProductId) {
              if (changes.has(gift.product_id)) {
                return false; // Gift product has inventory change - FAIL
              }
            }
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Only the main product should have inventory changes
   * **Validates: Requirements 8.7, 8.8**
   */
  it('should only have inventory changes for the main product', () => {
    fc.assert(
      fc.property(
        saleWithGiftsArb,
        ({ mainProductId, mainQuantity, giftDetails }) => {
          const changes = calculateInventoryChanges(mainProductId, mainQuantity, giftDetails);
          
          // Should have exactly one entry (the main product)
          if (changes.size !== 1) {
            return false;
          }
          
          // That entry should be the main product
          return changes.has(mainProductId);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Gift inventory invariant validation should pass for correct implementations
   * **Validates: Requirements 8.7, 8.8**
   */
  it('should validate correct inventory changes', () => {
    fc.assert(
      fc.property(
        saleWithGiftsArb,
        ({ mainProductId, mainQuantity, giftDetails }) => {
          const changes = calculateInventoryChanges(mainProductId, mainQuantity, giftDetails);
          
          // The invariant should be satisfied
          return validateGiftInventoryInvariant(
            mainProductId,
            mainQuantity,
            giftDetails,
            changes
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Gift inventory invariant should detect violations
   * **Validates: Requirements 8.7, 8.8**
   */
  it('should detect invariant violations when gifts affect inventory', () => {
    fc.assert(
      fc.property(
        fc.record({
          mainProductId: fc.uuid(),
          mainQuantity: fc.integer({ min: 1, max: 100 }),
          giftDetails: fc.array(giftItemArb, { minLength: 1, maxLength: 5 }),
        }),
        ({ mainProductId, mainQuantity, giftDetails }) => {
          // Create INCORRECT inventory changes that also decrement gift items
          const incorrectChanges = new Map<string, number>();
          incorrectChanges.set(mainProductId, -mainQuantity);
          
          // Incorrectly decrement gift items too (this violates the invariant)
          for (const gift of giftDetails) {
            if (gift.product_id !== mainProductId) {
              incorrectChanges.set(gift.product_id, -gift.qty);
            }
          }
          
          // If there are gifts with different product IDs, the invariant should fail
          const hasDistinctGifts = giftDetails.some(g => g.product_id !== mainProductId);
          
          if (hasDistinctGifts) {
            // Invariant should be violated
            return !validateGiftInventoryInvariant(
              mainProductId,
              mainQuantity,
              giftDetails,
              incorrectChanges
            );
          }
          
          // If all gifts are the same as main product, invariant might still pass
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Stock levels after sale should only change for main product
   * **Validates: Requirements 8.7, 8.8**
   */
  it('should only change stock levels for the main product after a sale', () => {
    fc.assert(
      fc.property(
        fc.record({
          mainProductId: fc.uuid(),
          mainQuantity: fc.integer({ min: 1, max: 50 }),
          giftDetails: fc.array(giftItemArb, { minLength: 0, maxLength: 5 }),
          initialMainStock: fc.integer({ min: 100, max: 1000 }),
        }),
        ({ mainProductId, mainQuantity, giftDetails, initialMainStock }) => {
          // Set up initial stock
          const initialStock = new Map<string, number>();
          initialStock.set(mainProductId, initialMainStock);
          
          // Add stock for gift products
          for (const gift of giftDetails) {
            if (!initialStock.has(gift.product_id)) {
              initialStock.set(gift.product_id, 100); // Arbitrary initial stock
            }
          }
          
          // Calculate and apply changes
          const changes = calculateInventoryChanges(mainProductId, mainQuantity, giftDetails);
          const newStock = applyInventoryChanges(initialStock, changes);
          
          // Verify main product stock decreased
          const mainStockAfter = newStock.get(mainProductId) || 0;
          if (mainStockAfter !== initialMainStock - mainQuantity) {
            return false;
          }
          
          // Verify gift product stocks are unchanged
          for (const gift of giftDetails) {
            if (gift.product_id !== mainProductId) {
              const giftStockBefore = initialStock.get(gift.product_id) || 0;
              const giftStockAfter = newStock.get(gift.product_id) || 0;
              if (giftStockBefore !== giftStockAfter) {
                return false; // Gift stock changed - FAIL
              }
            }
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Edge case: Empty gift list should still decrement main product
   */
  it('should decrement main product even with no gifts', () => {
    fc.assert(
      fc.property(
        fc.record({
          mainProductId: fc.uuid(),
          mainQuantity: fc.integer({ min: 1, max: 100 }),
        }),
        ({ mainProductId, mainQuantity }) => {
          const changes = calculateInventoryChanges(mainProductId, mainQuantity, []);
          
          // Main product should still be decremented
          return changes.get(mainProductId) === -mainQuantity && changes.size === 1;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Edge case: Gift with same product ID as main should not double-decrement
   */
  it('should not double-decrement when gift is same as main product', () => {
    fc.assert(
      fc.property(
        fc.record({
          productId: fc.uuid(),
          mainQuantity: fc.integer({ min: 1, max: 50 }),
          giftQuantity: fc.integer({ min: 1, max: 10 }),
        }),
        ({ productId, mainQuantity, giftQuantity }) => {
          const giftDetails: GiftItem[] = [{
            product_id: productId,
            name: 'Same Product Gift',
            qty: giftQuantity,
          }];
          
          const changes = calculateInventoryChanges(productId, mainQuantity, giftDetails);
          
          // Should only decrement by mainQuantity, NOT mainQuantity + giftQuantity
          return changes.get(productId) === -mainQuantity;
        }
      ),
      { numRuns: 100 }
    );
  });
});
