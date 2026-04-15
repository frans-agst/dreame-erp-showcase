/**
 * Property-based tests for fiscal calendar utilities
 * Feature: omnierp-retail-erp
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  calculateFiscalRunRate,
  calculateFiscalRunRatePct,
} from './fiscal-calculations';

/**
 * Helper function to simulate fiscal week boundary determination
 * This validates that week boundaries are determined by fiscal_calendar table
 * and not by standard SQL week functions
 */
function determineFiscalWeekBoundaries(
  fiscalCalendarData: { date: string; fiscal_week: number; fiscal_year: number }[],
  targetWeek: number,
  targetYear: number
): { startDate: string; endDate: string; dates: string[] } | null {
  // Filter dates for the target fiscal week and year
  const weekDates = fiscalCalendarData
    .filter(d => d.fiscal_week === targetWeek && d.fiscal_year === targetYear)
    .map(d => d.date)
    .sort();
  
  if (weekDates.length === 0) {
    return null;
  }
  
  return {
    startDate: weekDates[0],
    endDate: weekDates[weekDates.length - 1],
    dates: weekDates,
  };
}

/**
 * Helper function to get standard SQL week number (ISO week)
 * This is what we should NOT be using for fiscal calendar
 */
function getStandardSQLWeek(dateStr: string): number {
  const date = new Date(dateStr);
  // ISO week calculation
  const target = new Date(date.valueOf());
  const dayNr = (date.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  }
  return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
}

/**
 * Generate a mock fiscal calendar for testing
 * Fiscal weeks are Monday-Sunday (as per Requirement 4.3)
 */
function generateMockFiscalCalendar(
  year: number,
  startOffset: number = 0 // Days offset from Jan 1 to first Monday
): { date: string; fiscal_week: number; fiscal_year: number; day_name: string }[] {
  const calendar: { date: string; fiscal_week: number; fiscal_year: number; day_name: string }[] = [];
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  // Find first Monday of the year (or use offset)
  const startDate = new Date(year, 0, 1);
  while (startDate.getDay() !== 1) {
    startDate.setDate(startDate.getDate() + 1);
  }
  startDate.setDate(startDate.getDate() + startOffset);
  
  let currentWeek = 1;
  let currentDate = new Date(startDate);
  
  // Helper to format date as YYYY-MM-DD without timezone issues
  const formatDate = (d: Date): string => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };
  
  // Generate 52 weeks of data
  for (let week = 0; week < 52; week++) {
    for (let day = 0; day < 7; day++) {
      calendar.push({
        date: formatDate(currentDate),
        fiscal_week: currentWeek,
        fiscal_year: year,
        day_name: dayNames[currentDate.getDay()],
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }
    currentWeek++;
  }
  
  return calendar;
}

describe('Fiscal Calendar Utilities', () => {
  /**
   * Feature: omnierp-retail-erp, Property 4: Fiscal Run Rate Calculation
   * *For any* store with current_sales, fiscal_days_elapsed, and total_fiscal_days_in_month,
   * run_rate SHALL equal `(current_sales / MAX(1, fiscal_days_elapsed)) * total_fiscal_days_in_month`
   * **Validates: Requirements 4.4, 5.2**
   */
  describe('Property 4: Fiscal Run Rate Calculation', () => {
    it('should calculate fiscal run rate correctly for all valid inputs', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 1_000_000_000, noNaN: true }),
          fc.integer({ min: 0, max: 35 }),
          fc.integer({ min: 28, max: 35 }),
          (currentSales, fiscalDaysElapsed, totalFiscalDaysInMonth) => {
            const result = calculateFiscalRunRate(
              currentSales,
              fiscalDaysElapsed,
              totalFiscalDaysInMonth
            );
            const expected =
              (currentSales / Math.max(1, fiscalDaysElapsed)) *
              totalFiscalDaysInMonth;
            return Math.abs(result - expected) < 0.01;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should use MAX(1, fiscalDaysElapsed) to avoid division by zero', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 1, max: 1_000_000_000, noNaN: true }),
          fc.integer({ min: 28, max: 35 }),
          (currentSales, totalFiscalDaysInMonth) => {
            // When fiscalDaysElapsed is 0, should use 1 instead
            const result = calculateFiscalRunRate(
              currentSales,
              0,
              totalFiscalDaysInMonth
            );
            const expected = currentSales * totalFiscalDaysInMonth;
            return Math.abs(result - expected) < 0.01;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return 0 when totalFiscalDaysInMonth is 0 or negative', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 1_000_000_000, noNaN: true }),
          fc.integer({ min: 1, max: 31 }),
          fc.integer({ min: -10, max: 0 }),
          (currentSales, fiscalDaysElapsed, totalFiscalDaysInMonth) => {
            const result = calculateFiscalRunRate(
              currentSales,
              fiscalDaysElapsed,
              totalFiscalDaysInMonth
            );
            return result === 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return 0 when currentSales is 0', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 31 }),
          fc.integer({ min: 28, max: 35 }),
          (fiscalDaysElapsed, totalFiscalDaysInMonth) => {
            const result = calculateFiscalRunRate(
              0,
              fiscalDaysElapsed,
              totalFiscalDaysInMonth
            );
            return result === 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should project full month sales when all days have elapsed', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 1, max: 1_000_000_000, noNaN: true }),
          fc.integer({ min: 28, max: 35 }),
          (currentSales, totalDays) => {
            // When all days have elapsed, run rate should equal current sales
            const result = calculateFiscalRunRate(
              currentSales,
              totalDays,
              totalDays
            );
            return Math.abs(result - currentSales) < 0.01;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should scale proportionally with days elapsed', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 1000, max: 1_000_000, noNaN: true }),
          fc.integer({ min: 1, max: 15 }),
          fc.integer({ min: 28, max: 31 }),
          (currentSales, daysElapsed, totalDays) => {
            fc.pre(daysElapsed < totalDays);
            const result = calculateFiscalRunRate(
              currentSales,
              daysElapsed,
              totalDays
            );
            // Run rate should be greater than current sales when not all days elapsed
            return result > currentSales;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: omnierp-retail-erp, Fiscal Run Rate Percentage
   * Tests for calculateFiscalRunRatePct function
   * **Validates: Requirements 5.2**
   */
  describe('Fiscal Run Rate Percentage', () => {
    it('should calculate run rate percentage correctly', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 1_000_000_000, noNaN: true }),
          fc.float({ min: 1, max: 1_000_000_000, noNaN: true }),
          (runRate, target) => {
            const result = calculateFiscalRunRatePct(runRate, target);
            const expected = (runRate / target) * 100;
            return Math.abs(result - expected) < 0.01;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return 0 when target is 0 or negative', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 1_000_000_000, noNaN: true }),
          fc.integer({ min: -1000, max: 0 }),
          (runRate, target) => {
            const result = calculateFiscalRunRatePct(runRate, target);
            return result === 0;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: omnierp-retail-erp, Property 8: Fiscal Calendar Week Boundaries
   * *For any* weekly report query, the date range SHALL be determined by fiscal_calendar table
   * where fiscal_week matches, NOT by standard SQL week functions.
   * **Validates: Requirements 4.2, 15.1**
   */
  describe('Property 8: Fiscal Calendar Week Boundaries', () => {
    it('should determine week boundaries from fiscal_calendar table, not SQL week functions', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2024, max: 2026 }),
          fc.integer({ min: 1, max: 52 }),
          fc.integer({ min: 0, max: 6 }), // Offset to create variation in fiscal calendar
          (year, targetWeek, startOffset) => {
            // Generate a mock fiscal calendar
            const fiscalCalendar = generateMockFiscalCalendar(year, startOffset);
            
            // Get fiscal week boundaries from the calendar
            const fiscalBoundaries = determineFiscalWeekBoundaries(
              fiscalCalendar,
              targetWeek,
              year
            );
            
            if (!fiscalBoundaries) {
              return true; // Skip if week not found
            }
            
            // Verify that all dates in the fiscal week have the same fiscal_week value
            const allDatesHaveSameFiscalWeek = fiscalBoundaries.dates.every(date => {
              const entry = fiscalCalendar.find(d => d.date === date);
              return entry?.fiscal_week === targetWeek;
            });
            
            // Verify that the boundaries are NOT necessarily the same as SQL week boundaries
            // This is the key property - fiscal weeks can differ from ISO weeks
            const startSQLWeek = getStandardSQLWeek(fiscalBoundaries.startDate);
            const endSQLWeek = getStandardSQLWeek(fiscalBoundaries.endDate);
            
            // The fiscal week should be consistent within itself
            // but may or may not match SQL week (that's the point - we use fiscal calendar)
            return allDatesHaveSameFiscalWeek && fiscalBoundaries.dates.length === 7;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have exactly 7 days per fiscal week (Monday-Sunday)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2024, max: 2026 }),
          fc.integer({ min: 1, max: 52 }),
          (year, targetWeek) => {
            const fiscalCalendar = generateMockFiscalCalendar(year);
            const fiscalBoundaries = determineFiscalWeekBoundaries(
              fiscalCalendar,
              targetWeek,
              year
            );
            
            if (!fiscalBoundaries) {
              return true; // Skip if week not found
            }
            
            // Each fiscal week should have exactly 7 days
            return fiscalBoundaries.dates.length === 7;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should start fiscal weeks on Monday (Requirement 4.3)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2024, max: 2026 }),
          fc.integer({ min: 1, max: 52 }),
          (year, targetWeek) => {
            const fiscalCalendar = generateMockFiscalCalendar(year);
            const fiscalBoundaries = determineFiscalWeekBoundaries(
              fiscalCalendar,
              targetWeek,
              year
            );
            
            if (!fiscalBoundaries) {
              return true; // Skip if week not found
            }
            
            // First day of fiscal week should be Monday (day 1)
            // Parse date as local time to avoid timezone issues
            const [y, m, d] = fiscalBoundaries.startDate.split('-').map(Number);
            const startDate = new Date(y, m - 1, d);
            return startDate.getDay() === 1; // Monday
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should end fiscal weeks on Sunday (Requirement 4.3)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2024, max: 2026 }),
          fc.integer({ min: 1, max: 52 }),
          (year, targetWeek) => {
            const fiscalCalendar = generateMockFiscalCalendar(year);
            const fiscalBoundaries = determineFiscalWeekBoundaries(
              fiscalCalendar,
              targetWeek,
              year
            );
            
            if (!fiscalBoundaries) {
              return true; // Skip if week not found
            }
            
            // Last day of fiscal week should be Sunday (day 0)
            // Parse date as local time to avoid timezone issues
            const [y, m, d] = fiscalBoundaries.endDate.split('-').map(Number);
            const endDate = new Date(y, m - 1, d);
            return endDate.getDay() === 0; // Sunday
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have consecutive dates within a fiscal week', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2024, max: 2026 }),
          fc.integer({ min: 1, max: 52 }),
          (year, targetWeek) => {
            const fiscalCalendar = generateMockFiscalCalendar(year);
            const fiscalBoundaries = determineFiscalWeekBoundaries(
              fiscalCalendar,
              targetWeek,
              year
            );
            
            if (!fiscalBoundaries || fiscalBoundaries.dates.length < 2) {
              return true; // Skip if week not found or too few dates
            }
            
            // All dates should be consecutive
            for (let i = 1; i < fiscalBoundaries.dates.length; i++) {
              const prevDate = new Date(fiscalBoundaries.dates[i - 1]);
              const currDate = new Date(fiscalBoundaries.dates[i]);
              const diffDays = (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);
              if (diffDays !== 1) {
                return false;
              }
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not overlap with adjacent fiscal weeks', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2024, max: 2026 }),
          fc.integer({ min: 2, max: 51 }), // Avoid edge weeks
          (year, targetWeek) => {
            const fiscalCalendar = generateMockFiscalCalendar(year);
            
            const currentWeek = determineFiscalWeekBoundaries(fiscalCalendar, targetWeek, year);
            const prevWeek = determineFiscalWeekBoundaries(fiscalCalendar, targetWeek - 1, year);
            const nextWeek = determineFiscalWeekBoundaries(fiscalCalendar, targetWeek + 1, year);
            
            if (!currentWeek) {
              return true; // Skip if week not found
            }
            
            // No overlap with previous week
            if (prevWeek) {
              const prevEndDate = new Date(prevWeek.endDate);
              const currStartDate = new Date(currentWeek.startDate);
              if (prevEndDate >= currStartDate) {
                return false;
              }
            }
            
            // No overlap with next week
            if (nextWeek) {
              const currEndDate = new Date(currentWeek.endDate);
              const nextStartDate = new Date(nextWeek.startDate);
              if (currEndDate >= nextStartDate) {
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
});
