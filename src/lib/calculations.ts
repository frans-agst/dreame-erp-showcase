/**
 * Calculation utilities for OmniERP Retail ERP
 * Contains all business logic calculations for sales, inventory, and purchase orders
 */

export type AchievementStatus = 'red' | 'yellow' | 'green';

/**
 * Calculate run rate projection for the month
 * Formula: (sales / MAX(1, daysElapsed)) * totalDays
 * @param sales - Current sales amount
 * @param daysElapsed - Days elapsed in current month
 * @param totalDays - Total days in the month
 * @returns Projected run rate for the month
 * @requirements 2.2
 */
export function calculateRunRate(
  sales: number,
  daysElapsed: number,
  totalDays: number
): number {
  const effectiveDays = Math.max(1, daysElapsed);
  return (sales / effectiveDays) * totalDays;
}

/**
 * Calculate run rate as percentage of target
 * Formula: (runRate / target) * 100
 * @param runRate - Calculated run rate
 * @param target - Monthly target
 * @returns Run rate percentage
 * @requirements 2.3
 */
export function calculateRunRatePct(runRate: number, target: number): number {
  if (target === 0) return 0;
  return (runRate / target) * 100;
}

/**
 * Calculate achievement percentage
 * Formula: (sales / target) * 100
 * @param sales - Current sales amount
 * @param target - Target amount
 * @returns Achievement percentage
 * @requirements 2.4, 2.5, 2.6
 */
export function calculateAchievementPct(sales: number, target: number): number {
  if (target === 0) return 0;
  return (sales / target) * 100;
}

/**
 * Get achievement status badge color based on percentage
 * - < 50%: red
 * - 50-80%: yellow
 * - > 80%: green
 * @param pct - Achievement percentage
 * @returns Status color
 * @requirements 2.4, 2.5, 2.6
 */
export function getAchievementStatus(pct: number): AchievementStatus {
  if (pct < 50) return 'red';
  if (pct <= 80) return 'yellow';
  return 'green';
}

/**
 * Calculate after-tax price with 11% VAT
 * Formula: beforeTax * 1.11
 * @param beforeTax - Price before tax
 * @returns Price after 11% VAT
 * @requirements 4.4
 */
export function calculateAfterTax(beforeTax: number): number {
  return beforeTax * 1.11;
}

/**
 * Calculate before-tax price from after-tax price (reverse calculation)
 * Formula: afterTax / 1.11
 * @param afterTax - Price after 11% VAT (inclusive)
 * @returns Price before tax
 * @requirements 4.4
 */
export function calculateBeforeTax(afterTax: number): number {
  return afterTax / 1.11;
}

/**
 * Calculate line total for purchase order
 * Formula: afterTax * qty
 * @param afterTax - After-tax unit price
 * @param qty - Quantity
 * @returns Line total
 * @requirements 4.5
 */
export function calculateLineTotal(afterTax: number, qty: number): number {
  return afterTax * qty;
}

/**
 * Calculate final price after discount
 * Formula: price - discount
 * @param price - Original price
 * @param discount - Discount amount
 * @returns Final price
 * @requirements 5.5
 */
export function calculateFinalPrice(price: number, discount: number): number {
  return price - discount;
}

/**
 * Calculate stock discrepancy
 * Formula: counted - previous
 * @param counted - Counted quantity from stock opname
 * @param previous - Previous system quantity
 * @returns Discrepancy (positive = surplus, negative = shortage)
 * @requirements 7.6
 */
export function calculateDiscrepancy(counted: number, previous: number): number {
  return counted - previous;
}
