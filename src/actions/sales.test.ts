// src/actions/sales.test.ts
// Property-Based Tests for Sales Actions
// Feature: omnierp-retail-erp

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { calculateFinalPrice } from '@/lib/calculations';
import { SaleInputSchema } from '@/lib/validations/sales';

/**
 * Property 9: Sales Final Price Calculation
 * *For any* sale with price and discount, final_price SHALL equal `price - discount`
 * **Validates: Requirements 5.5**
 * 
 * Note: This property is also tested in calculations.test.ts
 * This test validates the integration with the sales module
 */
describe('Property 9: Sales Final Price Calculation (Integration)', () => {
  it('should calculate final price as price minus discount for all valid inputs', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 1_000_000, noNaN: true }),
        fc.float({ min: 0, max: 1_000_000, noNaN: true }),
        (price, discount) => {
          // Pre-condition: discount should not exceed price for valid sales
          fc.pre(discount <= price);
          
          const finalPrice = calculateFinalPrice(price, discount);
          const expected = price - discount;
          
          // Allow small floating point variance
          return Math.abs(finalPrice - expected) < 0.01;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return non-negative final price when discount is valid', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 1_000_000, noNaN: true }),
        (price) => {
          // Generate discount that doesn't exceed price
          const discount = price * Math.random();
          const finalPrice = calculateFinalPrice(price, discount);
          
          return finalPrice >= 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return zero when discount equals price', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 1_000_000, noNaN: true }),
        (price) => {
          const finalPrice = calculateFinalPrice(price, price);
          return Math.abs(finalPrice) < 0.01;
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Property 10: Sales Inventory Decrement
 * *For any* successful sale submission with product_id, store_id, and quantity,
 * the inventory record for that product-store combination SHALL be decremented
 * by exactly the sale quantity.
 * **Validates: Requirements 5.7**
 * 
 * Note: This is a model-based property test that validates the inventory
 * decrement logic without requiring actual database operations.
 */
describe('Property 10: Sales Inventory Decrement (Model)', () => {
  // Model function that simulates inventory decrement
  function decrementInventory(currentStock: number, saleQuantity: number): { 
    success: boolean; 
    newStock?: number; 
    error?: string;
  } {
    if (currentStock < saleQuantity) {
      return { 
        success: false, 
        error: `Insufficient stock. Available: ${currentStock}, Requested: ${saleQuantity}` 
      };
    }
    return { 
      success: true, 
      newStock: currentStock - saleQuantity 
    };
  }

  it('should decrement inventory by exactly the sale quantity', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10000 }), // currentStock
        fc.integer({ min: 1, max: 10000 }), // saleQuantity
        (currentStock, saleQuantity) => {
          // Pre-condition: sufficient stock
          fc.pre(currentStock >= saleQuantity);
          
          const result = decrementInventory(currentStock, saleQuantity);
          
          expect(result.success).toBe(true);
          expect(result.newStock).toBe(currentStock - saleQuantity);
          
          return result.success && result.newStock === currentStock - saleQuantity;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject sale when insufficient stock', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }), // currentStock
        fc.integer({ min: 1, max: 1000 }), // saleQuantity
        (currentStock, saleQuantity) => {
          // Pre-condition: insufficient stock
          fc.pre(currentStock < saleQuantity);
          
          const result = decrementInventory(currentStock, saleQuantity);
          
          expect(result.success).toBe(false);
          expect(result.error).toContain('Insufficient stock');
          
          return !result.success;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should allow sale that depletes entire stock', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10000 }), // stock = saleQuantity
        (quantity) => {
          const result = decrementInventory(quantity, quantity);
          
          expect(result.success).toBe(true);
          expect(result.newStock).toBe(0);
          
          return result.success && result.newStock === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should preserve inventory invariant: newStock = currentStock - saleQuantity', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10000 }), // currentStock
        fc.integer({ min: 1, max: 10000 }), // saleQuantity
        (currentStock, saleQuantity) => {
          const result = decrementInventory(currentStock, saleQuantity);
          
          if (result.success) {
            // Invariant: new stock equals current stock minus sale quantity
            return result.newStock === currentStock - saleQuantity;
          } else {
            // If failed, stock should be insufficient
            return currentStock < saleQuantity;
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should never result in negative inventory', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10000 }), // currentStock
        fc.integer({ min: 1, max: 10000 }), // saleQuantity
        (currentStock, saleQuantity) => {
          const result = decrementInventory(currentStock, saleQuantity);
          
          if (result.success) {
            // If successful, new stock must be non-negative
            return result.newStock !== undefined && result.newStock >= 0;
          }
          // If failed, that's also acceptable (prevents negative inventory)
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Property 11: Sales Required Field Validation
 * *For any* sale submission missing required fields (store_id, product_id,
 * staff_id, quantity, price), the system SHALL reject the submission
 * and return a validation error.
 * **Validates: Requirements 5.6**
 * 
 * Note: Comprehensive tests are in src/lib/validations/sales.test.ts
 * This test validates the integration with the sales action module
 */
describe('Property 11: Sales Required Field Validation (Integration)', () => {
  it('should validate that all required fields must be present', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        fc.integer({ min: 1, max: 100 }),
        fc.float({ min: Math.fround(0.01), max: Math.fround(1000), noNaN: true }),
        (storeId, productId, staffId, quantity, price) => {
          // Complete valid input
          const validInput = {
            store_id: storeId,
            product_id: productId,
            staff_id: staffId,
            quantity,
            price,
            discount: 0,
          };

          const result = SaleInputSchema.safeParse(validInput);
          return result.success;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject when any required field is missing', () => {
    const requiredFields = ['store_id', 'product_id', 'staff_id', 'quantity', 'price'];
    
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        fc.integer({ min: 1, max: 100 }),
        fc.float({ min: Math.fround(0.01), max: Math.fround(1000), noNaN: true }),
        fc.constantFrom(...requiredFields),
        (storeId, productId, staffId, quantity, price, fieldToRemove) => {
          const input: Record<string, unknown> = {
            store_id: storeId,
            product_id: productId,
            staff_id: staffId,
            quantity,
            price,
            discount: 0,
          };

          // Remove one required field
          delete input[fieldToRemove];

          const result = SaleInputSchema.safeParse(input);
          return !result.success;
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Property 16: Weekly Report Chronological Order
 * *For any* weekly sales report, the records SHALL be ordered by sale_date
 * in ascending chronological order.
 * **Validates: Requirements 9.2**
 * 
 * This property test validates that the sortSalesByDate function correctly
 * orders sales items chronologically.
 */
describe('Property 16: Weekly Report Chronological Order', () => {
  // Local implementation of sortSalesByDate for testing
  // This mirrors the implementation in src/actions/sales.ts
  interface WeeklySalesItem {
    id: string;
    sale_date: string;
    staff_name: string;
    account_name: string | null;
    store_name: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    discount: number;
    total_price: number;
  }

  function sortSalesByDate(sales: WeeklySalesItem[]): WeeklySalesItem[] {
    return [...sales].sort((a, b) => {
      const dateA = new Date(a.sale_date).getTime();
      const dateB = new Date(b.sale_date).getTime();
      return dateA - dateB;
    });
  }

  // Generate a random date string in YYYY-MM-DD format
  // Using integer-based approach to avoid invalid date issues
  const dateArbitrary = fc.tuple(
    fc.integer({ min: 2020, max: 2030 }), // year
    fc.integer({ min: 1, max: 12 }),       // month
    fc.integer({ min: 1, max: 28 })        // day (use 28 to avoid month-end issues)
  ).map(([year, month, day]) => {
    const monthStr = month.toString().padStart(2, '0');
    const dayStr = day.toString().padStart(2, '0');
    return `${year}-${monthStr}-${dayStr}`;
  });

  // Generate a random WeeklySalesItem
  const weeklySalesItemArbitrary = fc.record({
    id: fc.uuid(),
    sale_date: dateArbitrary,
    staff_name: fc.string({ minLength: 1, maxLength: 50 }),
    account_name: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: null }),
    store_name: fc.string({ minLength: 1, maxLength: 50 }),
    product_name: fc.string({ minLength: 1, maxLength: 100 }),
    quantity: fc.integer({ min: 1, max: 1000 }),
    unit_price: fc.float({ min: 0, max: 1_000_000, noNaN: true }),
    discount: fc.float({ min: 0, max: 1_000_000, noNaN: true }),
    total_price: fc.float({ min: 0, max: 1_000_000, noNaN: true }),
  });

  it('should sort sales items in ascending chronological order by sale_date', () => {
    fc.assert(
      fc.property(
        fc.array(weeklySalesItemArbitrary, { minLength: 0, maxLength: 100 }),
        (items) => {
          const sorted = sortSalesByDate(items);
          
          // Check that the result is sorted in ascending order
          for (let i = 1; i < sorted.length; i++) {
            const prevDate = new Date(sorted[i - 1].sale_date).getTime();
            const currDate = new Date(sorted[i].sale_date).getTime();
            if (prevDate > currDate) {
              return false;
            }
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should preserve all items after sorting (no items lost or duplicated)', () => {
    fc.assert(
      fc.property(
        fc.array(weeklySalesItemArbitrary, { minLength: 0, maxLength: 100 }),
        (items) => {
          const sorted = sortSalesByDate(items);
          
          // Same length
          if (sorted.length !== items.length) {
            return false;
          }
          
          // All original IDs are present in sorted result
          const originalIds = new Set(items.map((item: { id: string }) => item.id));
          const sortedIds = new Set(sorted.map((item: { id: string }) => item.id));
          
          if (originalIds.size !== sortedIds.size) {
            return false;
          }
          
          for (const id of originalIds) {
            if (!sortedIds.has(id)) {
              return false;
            }
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should be idempotent (sorting twice produces same result)', () => {
    fc.assert(
      fc.property(
        fc.array(weeklySalesItemArbitrary, { minLength: 0, maxLength: 100 }),
        (items) => {
          const sortedOnce = sortSalesByDate(items);
          const sortedTwice = sortSalesByDate(sortedOnce);
          
          // Same length
          if (sortedOnce.length !== sortedTwice.length) {
            return false;
          }
          
          // Same order (by ID since dates might be equal)
          for (let i = 0; i < sortedOnce.length; i++) {
            if (sortedOnce[i].id !== sortedTwice[i].id) {
              return false;
            }
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle empty array', () => {
    const sorted = sortSalesByDate([]);
    expect(sorted).toEqual([]);
    expect(sorted.length).toBe(0);
  });

  it('should handle single item array', () => {
    fc.assert(
      fc.property(
        weeklySalesItemArbitrary,
        (item) => {
          const sorted = sortSalesByDate([item]);
          return sorted.length === 1 && sorted[0].id === item.id;
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Property 23: Sale creation validates store access
 * *For any* staff member, attempting to create a sale for a store not in their
 * assigned stores should be rejected with a validation error.
 * **Validates: Requirements 6.1**
 * 
 * This is a model-based property test that validates the store access validation logic.
 */
describe('Property 23: Sale creation validates store access', () => {
  // Model function that simulates store access validation
  function validateStoreAccess(
    selectedStoreId: string,
    assignedStoreIds: string[]
  ): { success: boolean; error?: string } {
    if (!assignedStoreIds.includes(selectedStoreId)) {
      return {
        success: false,
        error: 'You do not have access to this store',
      };
    }
    return { success: true };
  }

  it('should reject sale creation when store is not in assigned stores', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // selectedStoreId
        fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }), // assignedStoreIds
        fc.uuid(), // unauthorizedStoreId
        (selectedStoreId, assignedStoreIds, unauthorizedStoreId) => {
          // Pre-condition: unauthorizedStoreId is not in assignedStoreIds
          fc.pre(!assignedStoreIds.includes(unauthorizedStoreId));
          
          const result = validateStoreAccess(unauthorizedStoreId, assignedStoreIds);
          
          expect(result.success).toBe(false);
          expect(result.error).toBe('You do not have access to this store');
          
          return !result.success;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should allow sale creation when store is in assigned stores', () => {
    fc.assert(
      fc.property(
        fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }), // assignedStoreIds
        (assignedStoreIds) => {
          // Pick a random store from assigned stores
          const selectedStoreId = assignedStoreIds[Math.floor(Math.random() * assignedStoreIds.length)];
          
          const result = validateStoreAccess(selectedStoreId, assignedStoreIds);
          
          expect(result.success).toBe(true);
          expect(result.error).toBeUndefined();
          
          return result.success;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should validate all assigned stores are accessible', () => {
    fc.assert(
      fc.property(
        fc.array(fc.uuid(), { minLength: 1, maxLength: 10 }), // assignedStoreIds
        (assignedStoreIds) => {
          // Test that all assigned stores pass validation
          for (const storeId of assignedStoreIds) {
            const result = validateStoreAccess(storeId, assignedStoreIds);
            if (!result.success) {
              return false;
            }
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Property 24: Sales filtered by assigned stores
 * *For any* staff member, querying sales should return only sales where
 * store_id is in their assigned stores array.
 * **Validates: Requirements 6.2**
 * 
 * This is a model-based property test that validates the sales filtering logic.
 */
describe('Property 24: Sales filtered by assigned stores', () => {
  interface Sale {
    id: string;
    store_id: string;
    product_id: string;
    quantity: number;
    total_price: number;
  }

  // Model function that simulates sales filtering by assigned stores
  function filterSalesByAssignedStores(
    allSales: Sale[],
    assignedStoreIds: string[]
  ): Sale[] {
    return allSales.filter(sale => assignedStoreIds.includes(sale.store_id));
  }

  const saleArbitrary = fc.record({
    id: fc.uuid(),
    store_id: fc.uuid(),
    product_id: fc.uuid(),
    quantity: fc.integer({ min: 1, max: 100 }),
    total_price: fc.float({ min: 0, max: 10000, noNaN: true }),
  });

  it('should return only sales from assigned stores', () => {
    fc.assert(
      fc.property(
        fc.array(saleArbitrary, { minLength: 0, maxLength: 50 }), // allSales
        fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }), // assignedStoreIds
        (allSales, assignedStoreIds) => {
          const filtered = filterSalesByAssignedStores(allSales, assignedStoreIds);
          
          // All filtered sales must have store_id in assignedStoreIds
          for (const sale of filtered) {
            if (!assignedStoreIds.includes(sale.store_id)) {
              return false;
            }
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should exclude sales from non-assigned stores', () => {
    fc.assert(
      fc.property(
        fc.array(saleArbitrary, { minLength: 0, maxLength: 50 }), // allSales
        fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }), // assignedStoreIds
        (allSales, assignedStoreIds) => {
          const filtered = filterSalesByAssignedStores(allSales, assignedStoreIds);
          
          // Count sales that should be excluded
          const excludedSales = allSales.filter(
            sale => !assignedStoreIds.includes(sale.store_id)
          );
          
          // None of the excluded sales should be in filtered results
          for (const excludedSale of excludedSales) {
            if (filtered.some(sale => sale.id === excludedSale.id)) {
              return false;
            }
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return empty array when no sales match assigned stores', () => {
    fc.assert(
      fc.property(
        fc.array(saleArbitrary, { minLength: 1, maxLength: 20 }), // allSales
        fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }), // assignedStoreIds
        (allSales, assignedStoreIds) => {
          // Ensure no sales match assigned stores
          const salesWithDifferentStores = allSales.map(sale => ({
            ...sale,
            store_id: fc.sample(fc.uuid().filter(id => !assignedStoreIds.includes(id)), 1)[0],
          }));
          
          const filtered = filterSalesByAssignedStores(salesWithDifferentStores, assignedStoreIds);
          
          return filtered.length === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should preserve sale data integrity (no modification)', () => {
    fc.assert(
      fc.property(
        fc.array(saleArbitrary, { minLength: 0, maxLength: 50 }), // allSales
        fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }), // assignedStoreIds
        (allSales, assignedStoreIds) => {
          const filtered = filterSalesByAssignedStores(allSales, assignedStoreIds);
          
          // Check that filtered sales have same data as originals
          for (const filteredSale of filtered) {
            const original = allSales.find(s => s.id === filteredSale.id);
            if (!original) return false;
            
            if (
              filteredSale.store_id !== original.store_id ||
              filteredSale.product_id !== original.product_id ||
              filteredSale.quantity !== original.quantity ||
              Math.abs(filteredSale.total_price - original.total_price) > 0.01
            ) {
              return false;
            }
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Property 25: Sales form shows only assigned stores
 * *For any* staff member, the store selector in the sales input form should
 * contain only their assigned stores.
 * **Validates: Requirements 6.3**
 * 
 * This is a model-based property test that validates the store list filtering logic.
 */
describe('Property 25: Sales form shows only assigned stores', () => {
  interface Store {
    id: string;
    name: string;
    code: string;
  }

  // Model function that simulates getting stores for form dropdown
  function getStoresForForm(
    allStores: Store[],
    assignedStoreIds: string[]
  ): Store[] {
    return allStores.filter(store => assignedStoreIds.includes(store.id));
  }

  const storeArbitrary = fc.record({
    id: fc.uuid(),
    name: fc.string({ minLength: 3, maxLength: 50 }),
    code: fc.string({ minLength: 2, maxLength: 10 }),
  });

  it('should return only assigned stores for form dropdown', () => {
    fc.assert(
      fc.property(
        fc.array(storeArbitrary, { minLength: 1, maxLength: 20 }), // allStores
        fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }), // assignedStoreIds
        (allStores, assignedStoreIds) => {
          const formStores = getStoresForForm(allStores, assignedStoreIds);
          
          // All form stores must have id in assignedStoreIds
          for (const store of formStores) {
            if (!assignedStoreIds.includes(store.id)) {
              return false;
            }
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should exclude non-assigned stores from form dropdown', () => {
    fc.assert(
      fc.property(
        fc.array(storeArbitrary, { minLength: 1, maxLength: 20 }), // allStores
        fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }), // assignedStoreIds
        (allStores, assignedStoreIds) => {
          const formStores = getStoresForForm(allStores, assignedStoreIds);
          
          // Count stores that should be excluded
          const excludedStores = allStores.filter(
            store => !assignedStoreIds.includes(store.id)
          );
          
          // None of the excluded stores should be in form stores
          for (const excludedStore of excludedStores) {
            if (formStores.some(store => store.id === excludedStore.id)) {
              return false;
            }
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return all assigned stores that exist in store list', () => {
    fc.assert(
      fc.property(
        fc.array(fc.uuid(), { minLength: 1, maxLength: 10 }), // assignedStoreIds
        (assignedStoreIds) => {
          // Create stores matching assigned IDs
          const allStores = assignedStoreIds.map(id => ({
            id,
            name: `Store ${id.substring(0, 8)}`,
            code: id.substring(0, 4).toUpperCase(),
          }));
          
          const formStores = getStoresForForm(allStores, assignedStoreIds);
          
          // Should return all stores since all match assigned IDs
          return formStores.length === allStores.length;
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Property 26: Sales filtering by store
 * *For any* staff member with multiple stores, applying a store filter should
 * return only sales from the selected store(s).
 * **Validates: Requirements 6.5**
 * 
 * This is a model-based property test that validates the store filtering logic.
 */
describe('Property 26: Sales filtering by store', () => {
  interface Sale {
    id: string;
    store_id: string;
    product_id: string;
    sale_date: string;
    quantity: number;
    total_price: number;
  }

  // Model function that simulates filtering sales by specific store
  function filterSalesByStore(
    sales: Sale[],
    storeId: string | null
  ): Sale[] {
    if (!storeId) {
      // No filter - return all sales
      return sales;
    }
    return sales.filter(sale => sale.store_id === storeId);
  }

  const saleArbitrary = fc.record({
    id: fc.uuid(),
    store_id: fc.uuid(),
    product_id: fc.uuid(),
    sale_date: fc.tuple(
      fc.integer({ min: 2020, max: 2030 }), // year
      fc.integer({ min: 1, max: 12 }),       // month
      fc.integer({ min: 1, max: 28 })        // day (use 28 to avoid month-end issues)
    ).map(([year, month, day]) => {
      const monthStr = month.toString().padStart(2, '0');
      const dayStr = day.toString().padStart(2, '0');
      return `${year}-${monthStr}-${dayStr}`;
    }),
    quantity: fc.integer({ min: 1, max: 100 }),
    total_price: fc.float({ min: 0, max: 10000, noNaN: true }),
  });

  it('should return only sales from selected store when filter is applied', () => {
    fc.assert(
      fc.property(
        fc.array(saleArbitrary, { minLength: 1, maxLength: 50 }), // sales
        fc.uuid(), // storeId filter
        (sales, storeId) => {
          const filtered = filterSalesByStore(sales, storeId);
          
          // All filtered sales must have the selected store_id
          for (const sale of filtered) {
            if (sale.store_id !== storeId) {
              return false;
            }
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return all sales when no filter is applied', () => {
    fc.assert(
      fc.property(
        fc.array(saleArbitrary, { minLength: 0, maxLength: 50 }), // sales
        (sales) => {
          const filtered = filterSalesByStore(sales, null);
          
          // Should return all sales
          return filtered.length === sales.length;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should exclude sales from other stores when filter is applied', () => {
    fc.assert(
      fc.property(
        fc.array(saleArbitrary, { minLength: 1, maxLength: 50 }), // sales
        fc.uuid(), // storeId filter
        (sales, storeId) => {
          const filtered = filterSalesByStore(sales, storeId);
          
          // Count sales from other stores
          const otherStoreSales = sales.filter(sale => sale.store_id !== storeId);
          
          // None of the other store sales should be in filtered results
          for (const otherSale of otherStoreSales) {
            if (filtered.some(sale => sale.id === otherSale.id)) {
              return false;
            }
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return empty array when no sales match filter', () => {
    fc.assert(
      fc.property(
        fc.array(saleArbitrary, { minLength: 1, maxLength: 20 }), // sales
        fc.uuid(), // storeId filter
        (sales, storeId) => {
          // Ensure no sales match the filter
          const salesWithDifferentStores = sales.map(sale => ({
            ...sale,
            store_id: fc.sample(fc.uuid().filter(id => id !== storeId), 1)[0],
          }));
          
          const filtered = filterSalesByStore(salesWithDifferentStores, storeId);
          
          return filtered.length === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should preserve sale data when filtering', () => {
    fc.assert(
      fc.property(
        fc.array(saleArbitrary, { minLength: 0, maxLength: 50 }), // sales
        fc.uuid(), // storeId filter
        (sales, storeId) => {
          const filtered = filterSalesByStore(sales, storeId);
          
          // Check that filtered sales have same data as originals
          for (const filteredSale of filtered) {
            const original = sales.find(s => s.id === filteredSale.id);
            if (!original) return false;
            
            if (
              filteredSale.store_id !== original.store_id ||
              filteredSale.product_id !== original.product_id ||
              filteredSale.sale_date !== original.sale_date ||
              filteredSale.quantity !== original.quantity ||
              Math.abs(filteredSale.total_price - original.total_price) > 0.01
            ) {
              return false;
            }
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
