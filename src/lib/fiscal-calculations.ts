/**
 * Pure utility functions for fiscal calculations
 * These are NOT server actions - they are pure functions that can be used anywhere
 */

/**
 * Calculate run rate using fiscal calendar
 * Formula: (currentSales / MAX(1, fiscalDaysElapsed)) * totalFiscalDaysInMonth
 */
export function calculateFiscalRunRate(
  currentSales: number,
  fiscalDaysElapsed: number,
  totalFiscalDaysInMonth: number
): number {
  if (totalFiscalDaysInMonth <= 0) return 0;
  const effectiveDays = Math.max(1, fiscalDaysElapsed);
  return (currentSales / effectiveDays) * totalFiscalDaysInMonth;
}

/**
 * Calculate run rate percentage against target
 */
export function calculateFiscalRunRatePct(
  runRate: number,
  target: number
): number {
  if (target <= 0) return 0;
  return (runRate / target) * 100;
}
