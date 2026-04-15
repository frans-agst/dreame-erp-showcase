// src/lib/validations/sales.test.ts
// Property-Based Test for Sales Required Field Validation
// Feature: dreame-retail-erp, Property 11: Sales Required Field Validation
// **Validates: Requirements 5.6, 10.1**

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { SaleInputSchema } from './sales';

// Arbitrary generators for property-based testing
const uuidArbitrary = fc.uuid();

// Valid sale input generator
const validSaleInputArbitrary = fc.record({
  store_id: uuidArbitrary,
  product_id: uuidArbitrary,
  staff_id: uuidArbitrary,
  quantity: fc.integer({ min: 1, max: 10000 }),
  price: fc.float({ min: Math.fround(0.01), max: Math.fround(1000000), noNaN: true }),
  discount: fc.float({ min: Math.fround(0), max: Math.fround(100), noNaN: true }),
}).filter((data) => data.discount <= data.price);

// Invalid quantity generator (zero or negative)
const invalidQuantityArbitrary = fc.integer({ min: -1000, max: 0 });

// Invalid price generator (zero or negative)
const invalidPriceArbitrary = fc.float({ min: Math.fround(-1000), max: Math.fround(0), noNaN: true });

describe('Sales Required Field Validation - Property 11', () => {
  /**
   * Property 11: Sales Required Field Validation
   * For any sale submission missing required fields (store_id, product_id, 
   * staff_id, quantity, price), the system SHALL reject the submission 
   * and return a validation error.
   */

  it('should accept all valid sale inputs', () => {
    fc.assert(
      fc.property(validSaleInputArbitrary, (saleInput) => {
        const result = SaleInputSchema.safeParse(saleInput);
        
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.store_id).toBe(saleInput.store_id);
          expect(result.data.product_id).toBe(saleInput.product_id);
          expect(result.data.staff_id).toBe(saleInput.staff_id);
          expect(result.data.quantity).toBe(saleInput.quantity);
        }
        
        return result.success;
      }),
      { numRuns: 100 }
    );
  });

  it('should reject sale inputs with missing store_id', () => {
    fc.assert(
      fc.property(
        uuidArbitrary,
        uuidArbitrary,
        fc.integer({ min: 1, max: 100 }),
        fc.float({ min: Math.fround(1), max: Math.fround(1000), noNaN: true }),
        (productId, staffId, quantity, price) => {
          const invalidInput = {
            // store_id is missing
            product_id: productId,
            staff_id: staffId,
            quantity,
            price,
            discount: 0,
          };

          const result = SaleInputSchema.safeParse(invalidInput);
          
          expect(result.success).toBe(false);
          return !result.success;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject sale inputs with missing product_id', () => {
    fc.assert(
      fc.property(
        uuidArbitrary,
        uuidArbitrary,
        fc.integer({ min: 1, max: 100 }),
        fc.float({ min: Math.fround(1), max: Math.fround(1000), noNaN: true }),
        (storeId, staffId, quantity, price) => {
          const invalidInput = {
            store_id: storeId,
            // product_id is missing
            staff_id: staffId,
            quantity,
            price,
            discount: 0,
          };

          const result = SaleInputSchema.safeParse(invalidInput);
          
          expect(result.success).toBe(false);
          return !result.success;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject sale inputs with missing staff_id', () => {
    fc.assert(
      fc.property(
        uuidArbitrary,
        uuidArbitrary,
        fc.integer({ min: 1, max: 100 }),
        fc.float({ min: Math.fround(1), max: Math.fround(1000), noNaN: true }),
        (storeId, productId, quantity, price) => {
          const invalidInput = {
            store_id: storeId,
            product_id: productId,
            // staff_id is missing
            quantity,
            price,
            discount: 0,
          };

          const result = SaleInputSchema.safeParse(invalidInput);
          
          expect(result.success).toBe(false);
          return !result.success;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject sale inputs with invalid quantity (zero or negative)', () => {
    fc.assert(
      fc.property(
        uuidArbitrary,
        uuidArbitrary,
        uuidArbitrary,
        invalidQuantityArbitrary,
        fc.float({ min: Math.fround(1), max: Math.fround(1000), noNaN: true }),
        (storeId, productId, staffId, invalidQuantity, price) => {
          const invalidInput = {
            store_id: storeId,
            product_id: productId,
            staff_id: staffId,
            quantity: invalidQuantity,
            price,
            discount: 0,
          };

          const result = SaleInputSchema.safeParse(invalidInput);
          
          expect(result.success).toBe(false);
          return !result.success;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject sale inputs with invalid price (zero or negative)', () => {
    fc.assert(
      fc.property(
        uuidArbitrary,
        uuidArbitrary,
        uuidArbitrary,
        fc.integer({ min: 1, max: 100 }),
        invalidPriceArbitrary,
        (storeId, productId, staffId, quantity, invalidPrice) => {
          const invalidInput = {
            store_id: storeId,
            product_id: productId,
            staff_id: staffId,
            quantity,
            price: invalidPrice,
            discount: 0,
          };

          const result = SaleInputSchema.safeParse(invalidInput);
          
          expect(result.success).toBe(false);
          return !result.success;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject sale inputs where discount exceeds total price (price * quantity)', () => {
    fc.assert(
      fc.property(
        uuidArbitrary,
        uuidArbitrary,
        uuidArbitrary,
        fc.integer({ min: 1, max: 100 }),
        fc.float({ min: Math.fround(1), max: Math.fround(1000), noNaN: true }),
        fc.float({ min: Math.fround(1), max: Math.fround(500), noNaN: true }),
        (storeId, productId, staffId, quantity, price, extraDiscount) => {
          // Ensure discount is greater than total price (price * quantity)
          const totalPrice = price * quantity;
          const discount = totalPrice + extraDiscount;
          
          const invalidInput = {
            store_id: storeId,
            product_id: productId,
            staff_id: staffId,
            quantity,
            price,
            discount,
          };

          const result = SaleInputSchema.safeParse(invalidInput);
          
          expect(result.success).toBe(false);
          if (!result.success) {
            const discountError = result.error.issues.find(
              (issue) => issue.path.includes('discount')
            );
            expect(discountError).toBeDefined();
          }
          return !result.success;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should accept sale inputs with discount equal to total price (100% discount)', () => {
    fc.assert(
      fc.property(
        uuidArbitrary,
        uuidArbitrary,
        uuidArbitrary,
        fc.integer({ min: 1, max: 100 }),
        fc.float({ min: Math.fround(1), max: Math.fround(1000), noNaN: true }),
        (storeId, productId, staffId, quantity, price) => {
          const totalPrice = price * quantity;
          const validInput = {
            store_id: storeId,
            product_id: productId,
            staff_id: staffId,
            quantity,
            price,
            discount: totalPrice, // discount equals total price (100% discount)
          };

          const result = SaleInputSchema.safeParse(validInput);
          
          expect(result.success).toBe(true);
          return result.success;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject sale inputs with invalid UUID format for store_id', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => !s.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)),
        uuidArbitrary,
        uuidArbitrary,
        fc.integer({ min: 1, max: 100 }),
        fc.float({ min: Math.fround(1), max: Math.fround(1000), noNaN: true }),
        (invalidStoreId, productId, staffId, quantity, price) => {
          const invalidInput = {
            store_id: invalidStoreId,
            product_id: productId,
            staff_id: staffId,
            quantity,
            price,
            discount: 0,
          };

          const result = SaleInputSchema.safeParse(invalidInput);
          
          expect(result.success).toBe(false);
          return !result.success;
        }
      ),
      { numRuns: 100 }
    );
  });
});
