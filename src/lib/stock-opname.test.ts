/**
 * Property-based tests for stock opname utilities
 * Feature: omnierp-retail-erp
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { calculateDiscrepancy } from './calculations';

/**
 * Helper function to simulate inventory overwrite logic
 * This represents the pure transformation that happens during stock opname
 * @param currentInventory - Map of product_id to current quantity
 * @param countedItems - Array of counted items with product_id and counted_qty
 * @returns New inventory map after overwrite
 */
export function applyStockOpnameOverwrite(
  currentInventory: Record<string, number>,
  countedItems: Array<{ product_id: string; counted_qty: number }>
): Record<string, number> {
  const newInventory = { ...currentInventory };
  
  for (const item of countedItems) {
    newInventory[item.product_id] = item.counted_qty;
  }
  
  return newInventory;
}

/**
 * Calculate discrepancies for all items in a stock opname
 * @param currentInventory - Map of product_id to current quantity
 * @param countedItems - Array of counted items
 * @returns Array of items with discrepancy calculated
 */
export function calculateOpnameDiscrepancies(
  currentInventory: Record<string, number>,
  countedItems: Array<{ product_id: string; counted_qty: number }>
): Array<{ product_id: string; previous_qty: number; counted_qty: number; discrepancy: number }> {
  return countedItems.map((item) => {
    const previousQty = currentInventory[item.product_id] ?? 0;
    return {
      product_id: item.product_id,
      previous_qty: previousQty,
      counted_qty: item.counted_qty,
      discrepancy: calculateDiscrepancy(item.counted_qty, previousQty),
    };
  });
}

describe('Stock Opname Utilities', () => {
  // Arbitrary for counted items
  const countedItemArb = fc.record({
    product_id: fc.uuid(),
    counted_qty: fc.integer({ min: 0, max: 10_000 }),
  });

  // Arbitrary for inventory map
  const inventoryMapArb = fc.dictionary(
    fc.uuid(),
    fc.integer({ min: 0, max: 10_000 })
  );

  /**
   * Feature: omnierp-retail-erp, Property 13: Stock Opname Inventory Overwrite
   * *For any* completed stock opname with counted quantities, the inventory table
   * SHALL be updated such that each product's quantity equals the counted_qty from the opname.
   * **Validates: Requirements 7.4**
   */
  describe('Property 13: Stock Opname Inventory Overwrite', () => {
    it('should overwrite inventory with counted values for all counted items', () => {
      fc.assert(
        fc.property(
          inventoryMapArb,
          fc.array(countedItemArb, { minLength: 1, maxLength: 20 }),
          (currentInventory, countedItems) => {
            const newInventory = applyStockOpnameOverwrite(currentInventory, countedItems);
            
            // For each counted item, the new inventory should equal the counted quantity
            return countedItems.every(
              (item) => newInventory[item.product_id] === item.counted_qty
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve inventory for products not in the opname', () => {
      fc.assert(
        fc.property(
          inventoryMapArb,
          fc.array(countedItemArb, { minLength: 0, maxLength: 10 }),
          (currentInventory, countedItems) => {
            const countedProductIds = new Set(countedItems.map((item) => item.product_id));
            const newInventory = applyStockOpnameOverwrite(currentInventory, countedItems);
            
            // Products not in the opname should retain their original quantity
            return Object.entries(currentInventory).every(([productId, qty]) => {
              if (countedProductIds.has(productId)) {
                return true; // Skip counted items
              }
              return newInventory[productId] === qty;
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle new products not in current inventory', () => {
      fc.assert(
        fc.property(
          fc.constant({} as Record<string, number>), // Empty inventory
          fc.array(countedItemArb, { minLength: 1, maxLength: 10 }),
          (currentInventory, countedItems) => {
            const newInventory = applyStockOpnameOverwrite(currentInventory, countedItems);
            
            // All counted items should be in the new inventory
            return countedItems.every(
              (item) => newInventory[item.product_id] === item.counted_qty
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly overwrite to zero when counted is zero', () => {
      fc.assert(
        fc.property(
          fc.dictionary(fc.uuid(), fc.integer({ min: 1, max: 10_000 })),
          (currentInventory) => {
            const productIds = Object.keys(currentInventory);
            if (productIds.length === 0) return true;
            
            // Count all items as zero
            const countedItems = productIds.map((id) => ({
              product_id: id,
              counted_qty: 0,
            }));
            
            const newInventory = applyStockOpnameOverwrite(currentInventory, countedItems);
            
            // All products should now have zero quantity
            return productIds.every((id) => newInventory[id] === 0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: omnierp-retail-erp, Property 14: Stock Opname Discrepancy Calculation
   * *For any* stock opname item with previous_qty and counted_qty,
   * discrepancy SHALL equal `counted_qty - previous_qty`
   * **Validates: Requirements 7.6**
   */
  describe('Property 14: Stock Opname Discrepancy Calculation (Integration)', () => {
    it('should calculate discrepancies correctly for all items', () => {
      fc.assert(
        fc.property(
          inventoryMapArb,
          fc.array(countedItemArb, { minLength: 1, maxLength: 20 }),
          (currentInventory, countedItems) => {
            const results = calculateOpnameDiscrepancies(currentInventory, countedItems);
            
            return results.every((result) => {
              const expectedDiscrepancy = result.counted_qty - result.previous_qty;
              return result.discrepancy === expectedDiscrepancy;
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should use zero as previous quantity for new products', () => {
      fc.assert(
        fc.property(
          fc.constant({} as Record<string, number>),
          fc.array(countedItemArb, { minLength: 1, maxLength: 10 }),
          (currentInventory, countedItems) => {
            const results = calculateOpnameDiscrepancies(currentInventory, countedItems);
            
            return results.every((result) => {
              // Previous qty should be 0 for products not in inventory
              return result.previous_qty === 0 && result.discrepancy === result.counted_qty;
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should show zero discrepancy when counted equals previous', () => {
      fc.assert(
        fc.property(
          inventoryMapArb,
          (currentInventory) => {
            const productIds = Object.keys(currentInventory);
            if (productIds.length === 0) return true;
            
            // Count items with same values as current inventory
            const countedItems = productIds.map((id) => ({
              product_id: id,
              counted_qty: currentInventory[id],
            }));
            
            const results = calculateOpnameDiscrepancies(currentInventory, countedItems);
            
            // All discrepancies should be zero
            return results.every((result) => result.discrepancy === 0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
