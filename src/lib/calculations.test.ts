/**
 * Property-based tests for calculation utilities
 * Feature: dreame-retail-erp
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  calculateRunRate,
  calculateRunRatePct,
  calculateAchievementPct,
  getAchievementStatus,
  calculateAfterTax,
  calculateLineTotal,
  calculateFinalPrice,
  calculateDiscrepancy,
} from './calculations';

describe('Calculation Utilities', () => {
  /**
   * Feature: dreame-retail-erp, Property 3: Run Rate Calculation
   * *For any* branch with current_sales, days_elapsed_in_month, and total_days_in_month,
   * the run_rate SHALL equal `(current_sales / MAX(1, days_elapsed_in_month)) * total_days_in_month`
   * **Validates: Requirements 2.2, 2.3**
   */
  describe('Property 3: Run Rate Calculation', () => {
    it('should calculate run rate correctly for all valid inputs', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 1_000_000_000, noNaN: true }),
          fc.integer({ min: 0, max: 31 }),
          fc.integer({ min: 28, max: 31 }),
          (currentSales, daysElapsed, totalDays) => {
            const result = calculateRunRate(currentSales, daysElapsed, totalDays);
            const expected = (currentSales / Math.max(1, daysElapsed)) * totalDays;
            return Math.abs(result - expected) < 0.01;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should calculate run rate percentage correctly', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 1_000_000_000, noNaN: true }),
          fc.float({ min: 1, max: 1_000_000_000, noNaN: true }),
          (runRate, target) => {
            const result = calculateRunRatePct(runRate, target);
            const expected = (runRate / target) * 100;
            return Math.abs(result - expected) < 0.01;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return 0 when target is 0', () => {
      const result = calculateRunRatePct(1000, 0);
      expect(result).toBe(0);
    });
  });

  /**
   * Feature: dreame-retail-erp, Property 4: Achievement Status Badge
   * *For any* achievement_percentage value:
   * - If achievement_percentage < 50, status SHALL be 'red'
   * - If 50 <= achievement_percentage <= 80, status SHALL be 'yellow'
   * - If achievement_percentage > 80, status SHALL be 'green'
   * **Validates: Requirements 2.4, 2.5, 2.6**
   */
  describe('Property 4: Achievement Status Badge', () => {
    it('should return red for achievement < 50%', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: Math.fround(49.99), noNaN: true }),
          (pct) => {
            return getAchievementStatus(pct) === 'red';
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return yellow for achievement between 50% and 80%', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 50, max: 80, noNaN: true }),
          (pct) => {
            return getAchievementStatus(pct) === 'yellow';
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return green for achievement > 80%', () => {
      fc.assert(
        fc.property(
          fc.float({ min: Math.fround(80.01), max: 200, noNaN: true }),
          (pct) => {
            return getAchievementStatus(pct) === 'green';
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should calculate achievement percentage correctly', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 1_000_000_000, noNaN: true }),
          fc.float({ min: 1, max: 1_000_000_000, noNaN: true }),
          (sales, target) => {
            const result = calculateAchievementPct(sales, target);
            const expected = (sales / target) * 100;
            return Math.abs(result - expected) < 0.01;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: dreame-retail-erp, Property 7: Purchase Order Line Calculations
   * *For any* PO line item with before_tax price and quantity:
   * - after_tax SHALL equal `before_tax * 1.11` (11% VAT)
   * - line_total SHALL equal `after_tax * quantity`
   * **Validates: Requirements 4.4, 4.5**
   */
  describe('Property 7: Purchase Order Line Calculations', () => {
    it('should calculate after-tax with 11% VAT correctly', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 1_000_000_000, noNaN: true }),
          (beforeTax) => {
            const result = calculateAfterTax(beforeTax);
            const expected = beforeTax * 1.11;
            return Math.abs(result - expected) < 0.01;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should calculate line total correctly', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 1_000_000, noNaN: true }),
          fc.integer({ min: 1, max: 10000 }),
          (afterTax, qty) => {
            const result = calculateLineTotal(afterTax, qty);
            const expected = afterTax * qty;
            return Math.abs(result - expected) < 0.01;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain consistency: lineTotal = beforeTax * 1.11 * qty', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 1_000_000, noNaN: true }),
          fc.integer({ min: 1, max: 10000 }),
          (beforeTax, qty) => {
            const afterTax = calculateAfterTax(beforeTax);
            const lineTotal = calculateLineTotal(afterTax, qty);
            const expected = beforeTax * 1.11 * qty;
            return Math.abs(lineTotal - expected) < 0.01;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: dreame-retail-erp, Property 9: Sales Final Price Calculation
   * *For any* sale with price and discount, final_price SHALL equal `price - discount`
   * **Validates: Requirements 5.5**
   */
  describe('Property 9: Sales Final Price Calculation', () => {
    it('should calculate final price correctly', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 1_000_000_000, noNaN: true }),
          fc.float({ min: 0, max: 1_000_000_000, noNaN: true }),
          (price, discount) => {
            const result = calculateFinalPrice(price, discount);
            const expected = price - discount;
            return Math.abs(result - expected) < 0.01;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return original price when discount is 0', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 1_000_000_000, noNaN: true }),
          (price) => {
            const result = calculateFinalPrice(price, 0);
            return Math.abs(result - price) < 0.01;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: dreame-retail-erp, Property 14: Stock Opname Discrepancy Calculation
   * *For any* stock opname item with previous_qty and counted_qty,
   * discrepancy SHALL equal `counted_qty - previous_qty`
   * **Validates: Requirements 7.6**
   */
  describe('Property 14: Stock Opname Discrepancy Calculation', () => {
    it('should calculate discrepancy correctly', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 1_000_000 }),
          fc.integer({ min: 0, max: 1_000_000 }),
          (counted, previous) => {
            const result = calculateDiscrepancy(counted, previous);
            const expected = counted - previous;
            return result === expected;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return 0 when counted equals previous', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 1_000_000 }),
          (qty) => {
            const result = calculateDiscrepancy(qty, qty);
            return result === 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return positive for surplus (counted > previous)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 1_000_000 }),
          fc.integer({ min: 0, max: 999_999 }),
          (counted, previous) => {
            fc.pre(counted > previous);
            const result = calculateDiscrepancy(counted, previous);
            return result > 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return negative for shortage (counted < previous)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 999_999 }),
          fc.integer({ min: 1, max: 1_000_000 }),
          (counted, previous) => {
            fc.pre(counted < previous);
            const result = calculateDiscrepancy(counted, previous);
            return result < 0;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
