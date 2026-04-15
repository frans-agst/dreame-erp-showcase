/**
 * Property-based tests for channel pricing lookup
 * Feature: dreame-retail-erp
 * 
 * **Property 6: Channel Price Lookup**
 * **Validates: Requirements 3.4, 3.5, 7.4**
 */

import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import { getProductPrice, getAvailablePriceSources } from './price-filter';

// Arbitrary generator for FullProduct with new channel pricing model
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

// Generator for channel keys
const channelKeyArb = fc.constantFrom('brandstore', 'retailer', 'modern_channel_1', 'modern_channel_2', 'modern_channel_3');

describe('Channel Pricing - Property-Based Tests', () => {
  /**
   * Property 6: Channel Price Lookup
   * 
   * *For any* PO with price_source set to a channel key (e.g., "brandstore"), 
   * the line item price SHALL equal the value from `product.channel_pricing[price_source]`.
   * 
   * **Validates: Requirements 3.4, 3.5, 7.4**
   */
  describe('Property 6: Channel Price Lookup', () => {
    it('When channel key exists, getProductPrice returns exact channel price', () => {
      fc.assert(
        fc.property(
          fullProductArb,
          channelKeyArb,
          (product, channelKey) => {
            // Only test when the channel key exists in the product
            if (product.channel_pricing[channelKey] !== undefined) {
              const price = getProductPrice(product, 'manager', channelKey);
              return price === product.channel_pricing[channelKey];
            }
            return true; // Skip if channel key doesn't exist
          }
        ),
        { numRuns: 100 }
      );
    });

    it('When channel key does not exist, getProductPrice falls back to retailer price', () => {
      fc.assert(
        fc.property(
          fullProductArb,
          fc.string({ minLength: 15, maxLength: 20 }), // Random non-existent key
          (product, nonExistentKey) => {
            // Ensure the key doesn't exist
            if (product.channel_pricing[nonExistentKey] === undefined) {
              const price = getProductPrice(product, 'manager', nonExistentKey);
              return price === (product.channel_pricing?.retailer || 0);
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Manager without channel key defaults to retailer price', () => {
      fc.assert(
        fc.property(fullProductArb, (product) => {
          const price = getProductPrice(product, 'manager', undefined);
          // Without channel key, manager defaults to retailer price
          return price === (product.channel_pricing?.retailer || 0);
        }),
        { numRuns: 100 }
      );
    });

    it('Staff role always returns brandstore price regardless of channel key', () => {
      fc.assert(
        fc.property(
          fullProductArb,
          fc.option(channelKeyArb, { nil: undefined }),
          (product, channelKey) => {
            const price = getProductPrice(product, 'staff', channelKey);
            return price === (product.channel_pricing?.brandstore || 0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Dealer role always returns retailer price regardless of channel key', () => {
      fc.assert(
        fc.property(
          fullProductArb,
          fc.option(channelKeyArb, { nil: undefined }),
          (product, channelKey) => {
            const price = getProductPrice(product, 'dealer', channelKey);
            return price === (product.channel_pricing?.retailer || 0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('getAvailablePriceSources includes all channel keys from product', () => {
      fc.assert(
        fc.property(
          fullProductArb,
          fc.constantFrom('manager', 'admin'),
          (product, role) => {
            const sources = getAvailablePriceSources(product, role);
            
            // Should include all channel keys from product
            const channelKeys = Object.keys(product.channel_pricing);
            const hasAllChannelKeys = channelKeys.every(key => 
              sources.some(s => s.key === key)
            );
            
            return hasAllChannelKeys;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('getAvailablePriceSources returns empty for non-manager roles', () => {
      fc.assert(
        fc.property(
          fullProductArb,
          fc.constantFrom('staff', 'dealer'),
          (product, role) => {
            const sources = getAvailablePriceSources(product, role);
            return sources.length === 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Channel price lookup is deterministic - same inputs produce same outputs', () => {
      fc.assert(
        fc.property(
          fullProductArb,
          channelKeyArb,
          fc.constantFrom('staff', 'dealer', 'manager', 'admin'),
          (product, channelKey, role) => {
            const price1 = getProductPrice(product, role, channelKey);
            const price2 = getProductPrice(product, role, channelKey);
            return price1 === price2;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('All prices returned are non-negative numbers', () => {
      fc.assert(
        fc.property(
          fullProductArb,
          fc.option(channelKeyArb, { nil: undefined }),
          fc.constantFrom('staff', 'dealer', 'manager', 'admin'),
          (product, channelKey, role) => {
            const price = getProductPrice(product, role, channelKey);
            return typeof price === 'number' && price >= 0 && !isNaN(price);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
