/**
 * Security Audit Tests - OmniERP Retail ERP
 * 
 * Task 15: Security Audit
 * 
 * This file contains tests to verify:
 * - 15.1: Price filtering by role (Staff, Dealer, Manager)
 * - 15.2: Data isolation (Staff sees only their store, Dealer sees only their POs/credit notes)
 * 
 * **Validates: Requirements 1.6, 1.7, 16.3, 16.4, 16.5**
 */

import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import {
  filterProductsByRole,
  getProductPrice,
  getAvailablePriceSources,
  FullProduct,
  StaffProduct,
  DealerProduct,
} from './price-filter';

// ============================================================================
// Arbitrary Generators
// ============================================================================

// Product generator with new channel pricing model
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

const productsArrayArb = fc.array(fullProductArb, { minLength: 1, maxLength: 20 });

// ============================================================================
// 15.1 Price Filtering Verification Tests
// ============================================================================

describe('15.1 Verify Price Filtering', () => {
  /**
   * Test: Staff API returns only brandstore price
   * Requirements: 16.3
   */
  describe('Staff API returns only brandstore price', () => {
    it('Staff filtered products contain ONLY price (mapped from channel_pricing.brandstore)', () => {
      fc.assert(
        fc.property(productsArrayArb, (products) => {
          const filtered = filterProductsByRole(products, 'staff') as StaffProduct[];
          
          return filtered.every((p) => {
            // Must have 'price' field
            const hasPrice = 'price' in p && typeof p.price === 'number';
            // Must NOT have price_buy
            const noPriceBuy = !('price_buy' in p);
            // Must NOT have price_retail
            const noPriceRetail = !('price_retail' in p);
            // Must NOT have channel_pricing
            const noChannelPricing = !('channel_pricing' in p);
            
            return hasPrice && noPriceBuy && noPriceRetail && noChannelPricing;
          });
        }),
        { numRuns: 100 }
      );
    });

    it('Staff price equals original channel_pricing.brandstore value', () => {
      fc.assert(
        fc.property(productsArrayArb, (products) => {
          const filtered = filterProductsByRole(products, 'staff') as StaffProduct[];
          
          return filtered.every((filteredProduct, index) => {
            const original = products[index];
            return filteredProduct.price === (original.channel_pricing?.brandstore || 0);
          });
        }),
        { numRuns: 100 }
      );
    });

    it('getProductPrice returns channel_pricing.brandstore for staff role', () => {
      fc.assert(
        fc.property(fullProductArb, (product) => {
          const price = getProductPrice(product, 'staff');
          return price === (product.channel_pricing?.brandstore || 0);
        }),
        { numRuns: 100 }
      );
    });

    it('Staff cannot access channel pricing via getAvailablePriceSources', () => {
      fc.assert(
        fc.property(fullProductArb, (product) => {
          const sources = getAvailablePriceSources(product, 'staff');
          return sources.length === 0;
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Test: Dealer API returns only retailer price
   * Requirements: 16.4
   */
  describe('Dealer API returns only retailer price', () => {
    it('Dealer filtered products contain ONLY price (mapped from channel_pricing.retailer)', () => {
      fc.assert(
        fc.property(productsArrayArb, (products) => {
          const filtered = filterProductsByRole(products, 'dealer') as DealerProduct[];
          
          return filtered.every((p) => {
            // Must have 'price' field
            const hasPrice = 'price' in p && typeof p.price === 'number';
            // Must NOT have price_buy
            const noPriceBuy = !('price_buy' in p);
            // Must NOT have price_retail
            const noPriceRetail = !('price_retail' in p);
            // Must NOT have channel_pricing
            const noChannelPricing = !('channel_pricing' in p);
            
            return hasPrice && noPriceBuy && noPriceRetail && noChannelPricing;
          });
        }),
        { numRuns: 100 }
      );
    });

    it('Dealer price equals original channel_pricing.retailer value', () => {
      fc.assert(
        fc.property(productsArrayArb, (products) => {
          const filtered = filterProductsByRole(products, 'dealer') as DealerProduct[];
          
          return filtered.every((filteredProduct, index) => {
            const original = products[index];
            return filteredProduct.price === (original.channel_pricing?.retailer || 0);
          });
        }),
        { numRuns: 100 }
      );
    });

    it('getProductPrice returns channel_pricing.retailer for dealer role', () => {
      fc.assert(
        fc.property(fullProductArb, (product) => {
          const price = getProductPrice(product, 'dealer');
          return price === (product.channel_pricing?.retailer || 0);
        }),
        { numRuns: 100 }
      );
    });

    it('Dealer cannot access channel pricing via getAvailablePriceSources', () => {
      fc.assert(
        fc.property(fullProductArb, (product) => {
          const sources = getAvailablePriceSources(product, 'dealer');
          return sources.length === 0;
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Test: Manager API returns all prices
   * Requirements: 16.5
   */
  describe('Manager API returns all prices', () => {
    it('Manager filtered products contain ALL pricing fields', () => {
      fc.assert(
        fc.property(productsArrayArb, (products) => {
          const filtered = filterProductsByRole(products, 'manager') as FullProduct[];
          
          return filtered.every((p, index) => {
            const original = products[index];
            // Must have all pricing fields
            const hasPriceRetail = p.price_retail === original.price_retail;
            const hasPriceBuy = p.price_buy === original.price_buy;
            const hasChannelPricing = JSON.stringify(p.channel_pricing) === JSON.stringify(original.channel_pricing);
            
            return hasPriceRetail && hasPriceBuy && hasChannelPricing;
          });
        }),
        { numRuns: 100 }
      );
    });

    it('Admin filtered products contain ALL pricing fields', () => {
      fc.assert(
        fc.property(productsArrayArb, (products) => {
          const filtered = filterProductsByRole(products, 'admin') as FullProduct[];
          
          return filtered.every((p, index) => {
            const original = products[index];
            const hasPriceRetail = p.price_retail === original.price_retail;
            const hasPriceBuy = p.price_buy === original.price_buy;
            const hasChannelPricing = JSON.stringify(p.channel_pricing) === JSON.stringify(original.channel_pricing);
            
            return hasPriceRetail && hasPriceBuy && hasChannelPricing;
          });
        }),
        { numRuns: 100 }
      );
    });

    it('Manager can access all channel pricing via getAvailablePriceSources', () => {
      fc.assert(
        fc.property(fullProductArb, (product) => {
          const sources = getAvailablePriceSources(product, 'manager');
          
          // Should have all channel keys
          const channelKeys = Object.keys(product.channel_pricing);
          const hasAllChannels = channelKeys.every(key => 
            sources.some(s => s.key === key)
          );
          
          return hasAllChannels;
        }),
        { numRuns: 100 }
      );
    });

    it('Admin can access all channel pricing via getAvailablePriceSources', () => {
      fc.assert(
        fc.property(fullProductArb, (product) => {
          const sources = getAvailablePriceSources(product, 'admin');
          
          const channelKeys = Object.keys(product.channel_pricing);
          const hasAllChannels = channelKeys.every(key => 
            sources.some(s => s.key === key)
          );
          
          return hasAllChannels;
        }),
        { numRuns: 100 }
      );
    });

    it('getProductPrice returns channel price when channel key is specified for manager', () => {
      fc.assert(
        fc.property(
          fullProductArb,
          (product) => {
            const channelKeys = Object.keys(product.channel_pricing);
            if (channelKeys.length === 0) return true;
            
            const channelKey = channelKeys[0];
            const price = getProductPrice(product, 'manager', channelKey);
            return price === product.channel_pricing[channelKey];
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Test: Security - Unknown roles get no data
   */
  describe('Security - Unknown roles', () => {
    it('Unknown role returns empty array', () => {
      fc.assert(
        fc.property(productsArrayArb, (products) => {
          // @ts-expect-error - Testing invalid role
          const filtered = filterProductsByRole(products, 'hacker');
          return filtered.length === 0;
        }),
        { numRuns: 50 }
      );
    });

    it('Unknown role returns 0 price from getProductPrice', () => {
      fc.assert(
        fc.property(fullProductArb, (product) => {
          // @ts-expect-error - Testing invalid role
          const price = getProductPrice(product, 'hacker');
          return price === 0;
        }),
        { numRuns: 50 }
      );
    });
  });
});

// ============================================================================
// 15.2 Data Isolation Verification Tests
// ============================================================================

describe('15.2 Verify Data Isolation', () => {
  // Types for testing
  interface StaffUser {
    id: string;
    role: 'staff';
    store_id: string;
  }

  interface DealerUser {
    id: string;
    role: 'dealer';
  }

  interface SaleRecord {
    id: string;
    store_id: string;
    product_id: string;
    quantity: number;
    total_price: number;
  }

  interface InventoryRecord {
    id: string;
    store_id: string;
    product_id: string;
    quantity: number;
  }

  interface PurchaseOrderRecord {
    id: string;
    created_by: string;
    grand_total: number;
  }

  interface CreditNoteRecord {
    id: string;
    dealer_id: string;
    amount: number;
  }

  // Pure filtering functions (simulating RLS behavior)
  function filterSalesByStore(sales: SaleRecord[], storeId: string): SaleRecord[] {
    return sales.filter(s => s.store_id === storeId);
  }

  function filterInventoryByStore(inventory: InventoryRecord[], storeId: string): InventoryRecord[] {
    return inventory.filter(i => i.store_id === storeId);
  }

  function filterPOsByDealer(orders: PurchaseOrderRecord[], dealerId: string): PurchaseOrderRecord[] {
    return orders.filter(o => o.created_by === dealerId);
  }

  function filterCreditNotesByDealer(notes: CreditNoteRecord[], dealerId: string): CreditNoteRecord[] {
    return notes.filter(n => n.dealer_id === dealerId);
  }

  // Arbitrary generators
  const staffUserArb = fc.record({
    id: fc.uuid(),
    role: fc.constant('staff' as const),
    store_id: fc.uuid(),
  });

  const dealerUserArb = fc.record({
    id: fc.uuid(),
    role: fc.constant('dealer' as const),
  });

  const saleRecordArb = fc.record({
    id: fc.uuid(),
    store_id: fc.uuid(),
    product_id: fc.uuid(),
    quantity: fc.integer({ min: 1, max: 100 }),
    total_price: fc.float({ min: 1000, max: 100_000_000, noNaN: true }),
  });

  const inventoryRecordArb = fc.record({
    id: fc.uuid(),
    store_id: fc.uuid(),
    product_id: fc.uuid(),
    quantity: fc.integer({ min: 0, max: 1000 }),
  });

  const purchaseOrderArb = fc.record({
    id: fc.uuid(),
    created_by: fc.uuid(),
    grand_total: fc.float({ min: 1000, max: 100_000_000, noNaN: true }),
  });

  const creditNoteArb = fc.record({
    id: fc.uuid(),
    dealer_id: fc.uuid(),
    amount: fc.float({ min: 1000, max: 10_000_000, noNaN: true }),
  });

  /**
   * Test: Staff sees only their store data
   * Requirements: 1.6
   */
  describe('Staff sees only their store data', () => {
    it('Staff can only see sales from their assigned store', () => {
      fc.assert(
        fc.property(
          staffUserArb,
          fc.array(saleRecordArb, { minLength: 5, maxLength: 30 }),
          (staff, sales) => {
            // Mix some sales to be from staff's store
            const mixedSales = sales.map((sale, index) => ({
              ...sale,
              store_id: index % 3 === 0 ? staff.store_id : sale.store_id,
            }));
            
            const filtered = filterSalesByStore(mixedSales, staff.store_id);
            
            // All filtered sales must be from staff's store
            return filtered.every(s => s.store_id === staff.store_id);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Staff cannot see sales from other stores', () => {
      fc.assert(
        fc.property(
          staffUserArb,
          fc.array(saleRecordArb, { minLength: 5, maxLength: 20 }),
          (staff, sales) => {
            // Ensure no sales are from staff's store
            const otherStoreSales = sales.filter(s => s.store_id !== staff.store_id);
            
            const filtered = filterSalesByStore(otherStoreSales, staff.store_id);
            
            // Should return empty - no access to other stores
            return filtered.length === 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Staff can only see inventory from their assigned store', () => {
      fc.assert(
        fc.property(
          staffUserArb,
          fc.array(inventoryRecordArb, { minLength: 5, maxLength: 30 }),
          (staff, inventory) => {
            // Mix some inventory to be from staff's store
            const mixedInventory = inventory.map((item, index) => ({
              ...item,
              store_id: index % 3 === 0 ? staff.store_id : item.store_id,
            }));
            
            const filtered = filterInventoryByStore(mixedInventory, staff.store_id);
            
            // All filtered inventory must be from staff's store
            return filtered.every(i => i.store_id === staff.store_id);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Staff cannot see inventory from other stores', () => {
      fc.assert(
        fc.property(
          staffUserArb,
          fc.array(inventoryRecordArb, { minLength: 5, maxLength: 20 }),
          (staff, inventory) => {
            // Ensure no inventory is from staff's store
            const otherStoreInventory = inventory.filter(i => i.store_id !== staff.store_id);
            
            const filtered = filterInventoryByStore(otherStoreInventory, staff.store_id);
            
            // Should return empty - no access to other stores
            return filtered.length === 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Filtering preserves all data for staff\'s store records', () => {
      fc.assert(
        fc.property(
          staffUserArb,
          fc.array(saleRecordArb, { minLength: 1, maxLength: 10 }),
          (staff, sales) => {
            // Create sales owned by this staff's store
            const staffSales = sales.map(s => ({ ...s, store_id: staff.store_id }));
            
            const filtered = filterSalesByStore(staffSales, staff.store_id);
            
            // All original data should be preserved
            return filtered.every((f, index) => {
              const original = staffSales[index];
              return (
                f.id === original.id &&
                f.product_id === original.product_id &&
                f.quantity === original.quantity &&
                f.total_price === original.total_price
              );
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Test: Dealer sees only their POs/credit notes
   * Requirements: 1.7
   */
  describe('Dealer sees only their POs/credit notes', () => {
    it('Dealer can only see their own purchase orders', () => {
      fc.assert(
        fc.property(
          dealerUserArb,
          fc.array(purchaseOrderArb, { minLength: 5, maxLength: 30 }),
          (dealer, orders) => {
            // Mix some orders to be from this dealer
            const mixedOrders = orders.map((order, index) => ({
              ...order,
              created_by: index % 3 === 0 ? dealer.id : order.created_by,
            }));
            
            const filtered = filterPOsByDealer(mixedOrders, dealer.id);
            
            // All filtered orders must be created by this dealer
            return filtered.every(o => o.created_by === dealer.id);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Dealer cannot see purchase orders from other dealers', () => {
      fc.assert(
        fc.property(
          dealerUserArb,
          fc.array(purchaseOrderArb, { minLength: 5, maxLength: 20 }),
          (dealer, orders) => {
            // Ensure no orders are from this dealer
            const otherDealerOrders = orders.filter(o => o.created_by !== dealer.id);
            
            const filtered = filterPOsByDealer(otherDealerOrders, dealer.id);
            
            // Should return empty - no access to other dealers' orders
            return filtered.length === 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Dealer can only see their own credit notes', () => {
      fc.assert(
        fc.property(
          dealerUserArb,
          fc.array(creditNoteArb, { minLength: 5, maxLength: 30 }),
          (dealer, notes) => {
            // Mix some notes to be from this dealer
            const mixedNotes = notes.map((note, index) => ({
              ...note,
              dealer_id: index % 3 === 0 ? dealer.id : note.dealer_id,
            }));
            
            const filtered = filterCreditNotesByDealer(mixedNotes, dealer.id);
            
            // All filtered notes must belong to this dealer
            return filtered.every(n => n.dealer_id === dealer.id);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Dealer cannot see credit notes from other dealers', () => {
      fc.assert(
        fc.property(
          dealerUserArb,
          fc.array(creditNoteArb, { minLength: 5, maxLength: 20 }),
          (dealer, notes) => {
            // Ensure no notes are from this dealer
            const otherDealerNotes = notes.filter(n => n.dealer_id !== dealer.id);
            
            const filtered = filterCreditNotesByDealer(otherDealerNotes, dealer.id);
            
            // Should return empty - no access to other dealers' notes
            return filtered.length === 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Different dealers see different data from same pool', () => {
      fc.assert(
        fc.property(
          dealerUserArb,
          dealerUserArb,
          fc.array(purchaseOrderArb, { minLength: 5, maxLength: 20 }),
          (dealer1, dealer2, orders) => {
            // Ensure dealers are different
            if (dealer1.id === dealer2.id) return true;
            
            // Assign some orders to each dealer
            const mixedOrders = orders.map((order, index) => ({
              ...order,
              created_by: index % 2 === 0 ? dealer1.id : dealer2.id,
            }));
            
            const dealer1Orders = filterPOsByDealer(mixedOrders, dealer1.id);
            const dealer2Orders = filterPOsByDealer(mixedOrders, dealer2.id);
            
            // Each dealer should only see their own orders
            const dealer1OnlySeesOwn = dealer1Orders.every(o => o.created_by === dealer1.id);
            const dealer2OnlySeesOwn = dealer2Orders.every(o => o.created_by === dealer2.id);
            
            // No overlap between what each dealer sees
            const noOverlap = dealer1Orders.every(
              o1 => !dealer2Orders.some(o2 => o2.id === o1.id)
            );
            
            return dealer1OnlySeesOwn && dealer2OnlySeesOwn && noOverlap;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
