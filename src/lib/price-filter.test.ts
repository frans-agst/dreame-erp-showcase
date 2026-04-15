/**
 * Property-based tests for price filtering utilities
 * Feature: omnierp-retail-erp
 * 
 * **Validates: Requirements 1.3, 1.4, 1.5**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  filterProductsByRole,
  filterProductByRole,
  FullProduct,
  StaffProduct,
  DealerProduct,
} from './price-filter';

// Arbitrary generator for FullProduct with channel pricing
const fullProductArb = fc.record({
  id: fc.uuid(),
  sku: fc.string({ minLength: 3, maxLength: 20 }),
  name: fc.string({ minLength: 1, maxLength: 100 }),
  category: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: null }),
  sub_category: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: null }),
  price_retail: fc.float({ min: 1000, max: 100_000_000, noNaN: true }),
  price_buy: fc.float({ min: 500, max: 50_000_000, noNaN: true }),
  channel_pricing: fc.record({
    brandstore: fc.float({ min: 500, max: 50_000_000, noNaN: true }),
    retailer: fc.float({ min: 500, max: 50_000_000, noNaN: true }),
    modern_channel_1: fc.float({ min: 500, max: 50_000_000, noNaN: true }),
    modern_channel_2: fc.float({ min: 500, max: 50_000_000, noNaN: true }),
    modern_channel_3: fc.float({ min: 500, max: 50_000_000, noNaN: true }),
  }),
  is_active: fc.boolean(),
});

// Generator for array of products
const productsArrayArb = fc.array(fullProductArb, { minLength: 1, maxLength: 20 });

describe('Price Filter - Property-Based Tests', () => {
  /**
   * Property 1: Role-Based Pricing Visibility
   * 
   * *For any* Staff user querying products, the API response SHALL contain 
   * ONLY `channel_pricing.brandstore` (mapped to 'price') and SHALL NOT contain 
   * other pricing fields.
   * 
   * *For any* Dealer user querying products, the API response SHALL contain 
   * ONLY `channel_pricing.retailer` (mapped to 'price') and SHALL NOT contain 
   * other pricing fields.
   * 
   * **Validates: Requirements 1.3, 1.4, 1.5**
   */
  describe('Property 1: Role-Based Pricing Visibility', () => {
    it('Staff cannot see other prices - filtered products should only have brandstore price', () => {
      fc.assert(
        fc.property(productsArrayArb, (products) => {
          const filtered = filterProductsByRole(products, 'staff') as StaffProduct[];
          
          // Every filtered product should NOT have price_buy, price_retail, or channel_pricing
          return filtered.every((p) => {
            const hasNoPriceBuy = !('price_buy' in p);
            const hasNoPriceRetail = !('price_retail' in p);
            const hasNoChannelPricing = !('channel_pricing' in p);
            const hasPrice = 'price' in p; // brandstore is mapped to 'price'
            return hasNoPriceBuy && hasNoPriceRetail && hasNoChannelPricing && hasPrice;
          });
        }),
        { numRuns: 100 }
      );
    });

    it('Staff filtered price equals original channel_pricing.brandstore', () => {
      fc.assert(
        fc.property(productsArrayArb, (products) => {
          const filtered = filterProductsByRole(products, 'staff') as StaffProduct[];
          
          // Each filtered product's price should equal the original brandstore price
          return filtered.every((filteredProduct, index) => {
            const originalProduct = products[index];
            return filteredProduct.price === (originalProduct.channel_pricing?.brandstore || 0);
          });
        }),
        { numRuns: 100 }
      );
    });

    it('Dealer cannot see other prices - filtered products should only have retailer price', () => {
      fc.assert(
        fc.property(productsArrayArb, (products) => {
          const filtered = filterProductsByRole(products, 'dealer') as DealerProduct[];
          
          // Every filtered product should NOT have price_retail, price_buy, or channel_pricing
          return filtered.every((p) => {
            const hasNoPriceRetail = !('price_retail' in p);
            const hasNoPriceBuy = !('price_buy' in p);
            const hasNoChannelPricing = !('channel_pricing' in p);
            const hasPrice = 'price' in p; // retailer is mapped to 'price'
            return hasNoPriceRetail && hasNoPriceBuy && hasNoChannelPricing && hasPrice;
          });
        }),
        { numRuns: 100 }
      );
    });

    it('Dealer filtered price equals original channel_pricing.retailer', () => {
      fc.assert(
        fc.property(productsArrayArb, (products) => {
          const filtered = filterProductsByRole(products, 'dealer') as DealerProduct[];
          
          // Each filtered product's price should equal the original retailer price
          return filtered.every((filteredProduct, index) => {
            const originalProduct = products[index];
            return filteredProduct.price === (originalProduct.channel_pricing?.retailer || 0);
          });
        }),
        { numRuns: 100 }
      );
    });

    it('Manager/Admin can see all pricing fields', () => {
      fc.assert(
        fc.property(
          productsArrayArb,
          fc.constantFrom('manager', 'admin'),
          (products, role) => {
            const filtered = filterProductsByRole(products, role) as FullProduct[];
            
            // Manager/Admin should see all pricing fields
            return filtered.every((p, index) => {
              const original = products[index];
              return (
                p.price_retail === original.price_retail &&
                p.price_buy === original.price_buy &&
                JSON.stringify(p.channel_pricing) === JSON.stringify(original.channel_pricing)
              );
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Unknown role returns empty array for security', () => {
      fc.assert(
        fc.property(productsArrayArb, (products) => {
          // @ts-expect-error - Testing invalid role
          const filtered = filterProductsByRole(products, 'unknown_role');
          return filtered.length === 0;
        }),
        { numRuns: 50 }
      );
    });

    it('Staff and Dealer filtered products preserve non-pricing fields', () => {
      fc.assert(
        fc.property(
          productsArrayArb,
          fc.constantFrom('staff', 'dealer'),
          (products, role) => {
            const filtered = filterProductsByRole(products, role);
            
            // Non-pricing fields should be preserved
            return filtered.every((p, index) => {
              const original = products[index];
              return (
                p.id === original.id &&
                p.sku === original.sku &&
                p.name === original.name &&
                p.category === original.category &&
                p.sub_category === original.sub_category &&
                p.is_active === original.is_active
              );
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('filterProductByRole single product follows same rules as array filter', () => {
      fc.assert(
        fc.property(
          fullProductArb,
          fc.constantFrom('staff', 'dealer', 'manager', 'admin'),
          (product, role) => {
            const singleFiltered = filterProductByRole(product, role);
            const arrayFiltered = filterProductsByRole([product], role)[0];
            
            // Single filter should produce same result as array filter
            return JSON.stringify(singleFiltered) === JSON.stringify(arrayFiltered);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
