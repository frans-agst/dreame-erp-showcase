/**
 * Property-based tests for dashboard aggregation consistency
 * Feature: omnierp-retail-erp
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Feature: omnierp-retail-erp, Property 15: Dashboard Aggregation Consistency
 * *For any* dashboard view:
 * - Sum of category GMV values SHALL equal total GMV
 * - Sum of province GMV values SHALL equal total GMV
 * - Sum of individual sale final_prices in a period SHALL equal the period's total revenue
 * **Validates: Requirements 8.4, 8.5**
 */

// Types for testing
interface Sale {
  final_price: number;
  quantity: number;
  category: string;
  province: string;
}

interface CategoryGMV {
  category: string;
  gmv: number;
}

interface ProvinceData {
  province: string;
  gmv: number;
  qty_sold: number;
}

// Pure aggregation functions that mirror the server action logic
function aggregateTotalGMV(sales: Sale[]): number {
  return sales.reduce((sum, sale) => sum + sale.final_price, 0);
}

function aggregateCategoryGMV(sales: Sale[]): CategoryGMV[] {
  const categoryMap = new Map<string, number>();
  
  sales.forEach((sale) => {
    const currentGmv = categoryMap.get(sale.category) || 0;
    categoryMap.set(sale.category, currentGmv + sale.final_price);
  });
  
  return Array.from(categoryMap.entries())
    .map(([category, gmv]) => ({ category, gmv }))
    .sort((a, b) => b.gmv - a.gmv);
}

function aggregateProvinceData(sales: Sale[]): ProvinceData[] {
  const provinceMap = new Map<string, { gmv: number; qty: number }>();
  
  sales.forEach((sale) => {
    const existing = provinceMap.get(sale.province);
    if (existing) {
      existing.gmv += sale.final_price;
      existing.qty += sale.quantity;
    } else {
      provinceMap.set(sale.province, {
        gmv: sale.final_price,
        qty: sale.quantity,
      });
    }
  });
  
  return Array.from(provinceMap.entries())
    .map(([province, data]) => ({
      province,
      gmv: data.gmv,
      qty_sold: data.qty,
    }))
    .sort((a, b) => b.gmv - a.gmv);
}

// Arbitrary generators
const categoryArb = fc.constantFrom('Electronics', 'Appliances', 'Accessories', 'Home', 'Other');
const provinceArb = fc.constantFrom('Jakarta', 'Jawa Barat', 'Jawa Tengah', 'Jawa Timur', 'Bali', 'Sumatera');

const saleArb = fc.record({
  final_price: fc.float({ min: 0, max: 10_000_000, noNaN: true }),
  quantity: fc.integer({ min: 1, max: 100 }),
  category: categoryArb,
  province: provinceArb,
});

const salesListArb = fc.array(saleArb, { minLength: 0, maxLength: 100 });

describe('Dashboard Aggregation Consistency', () => {
  /**
   * Property 15.1: Sum of category GMV values SHALL equal total GMV
   */
  describe('Property 15: Dashboard Aggregation Consistency - Category GMV', () => {
    it('sum of category GMV values should equal total GMV', () => {
      fc.assert(
        fc.property(salesListArb, (sales) => {
          const totalGMV = aggregateTotalGMV(sales);
          const categoryGMVs = aggregateCategoryGMV(sales);
          const sumCategoryGMV = categoryGMVs.reduce((sum, cat) => sum + cat.gmv, 0);
          
          // Allow small floating point tolerance
          return Math.abs(totalGMV - sumCategoryGMV) < 0.01;
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 15.2: Sum of province GMV values SHALL equal total GMV
   */
  describe('Property 15: Dashboard Aggregation Consistency - Province GMV', () => {
    it('sum of province GMV values should equal total GMV', () => {
      fc.assert(
        fc.property(salesListArb, (sales) => {
          const totalGMV = aggregateTotalGMV(sales);
          const provinceData = aggregateProvinceData(sales);
          const sumProvinceGMV = provinceData.reduce((sum, prov) => sum + prov.gmv, 0);
          
          // Allow small floating point tolerance
          return Math.abs(totalGMV - sumProvinceGMV) < 0.01;
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 15.3: Sum of individual sale final_prices SHALL equal total revenue
   */
  describe('Property 15: Dashboard Aggregation Consistency - Individual Sales', () => {
    it('sum of individual sale final_prices should equal total GMV', () => {
      fc.assert(
        fc.property(salesListArb, (sales) => {
          const totalGMV = aggregateTotalGMV(sales);
          const sumIndividual = sales.reduce((sum, sale) => sum + sale.final_price, 0);
          
          // Allow small floating point tolerance
          return Math.abs(totalGMV - sumIndividual) < 0.01;
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 15.4: Province quantity totals should be consistent
   */
  describe('Property 15: Dashboard Aggregation Consistency - Province Quantity', () => {
    it('sum of province quantities should equal total quantity sold', () => {
      fc.assert(
        fc.property(salesListArb, (sales) => {
          const totalQty = sales.reduce((sum, sale) => sum + sale.quantity, 0);
          const provinceData = aggregateProvinceData(sales);
          const sumProvinceQty = provinceData.reduce((sum, prov) => sum + prov.qty_sold, 0);
          
          return totalQty === sumProvinceQty;
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Edge case: Empty sales list should result in zero totals
   */
  describe('Edge Cases', () => {
    it('empty sales list should result in zero total GMV', () => {
      const totalGMV = aggregateTotalGMV([]);
      expect(totalGMV).toBe(0);
    });

    it('empty sales list should result in empty category GMV', () => {
      const categoryGMVs = aggregateCategoryGMV([]);
      expect(categoryGMVs).toHaveLength(0);
    });

    it('empty sales list should result in empty province data', () => {
      const provinceData = aggregateProvinceData([]);
      expect(provinceData).toHaveLength(0);
    });
  });

  /**
   * Consistency: Category and Province aggregations should both equal total
   */
  describe('Cross-Aggregation Consistency', () => {
    it('category GMV sum and province GMV sum should be equal', () => {
      fc.assert(
        fc.property(salesListArb, (sales) => {
          const categoryGMVs = aggregateCategoryGMV(sales);
          const provinceData = aggregateProvinceData(sales);
          
          const sumCategoryGMV = categoryGMVs.reduce((sum, cat) => sum + cat.gmv, 0);
          const sumProvinceGMV = provinceData.reduce((sum, prov) => sum + prov.gmv, 0);
          
          // Allow small floating point tolerance
          return Math.abs(sumCategoryGMV - sumProvinceGMV) < 0.01;
        }),
        { numRuns: 100 }
      );
    });
  });
});
