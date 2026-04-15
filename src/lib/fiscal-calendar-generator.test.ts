import { describe, it, expect } from 'vitest';
import {
  generateFiscalCalendar,
  getFiscalWeekBoundaries,
  getFiscalMonthBoundaries,
  validateFiscalCalendar,
  exportToCSV,
  FiscalCalendarEntry,
} from './fiscal-calendar-generator';

describe('Fiscal Calendar Generator', () => {
  describe('generateFiscalCalendar', () => {
    it('should generate correct number of days for 2024-2026', () => {
      const calendar = generateFiscalCalendar(2024, 2026);
      // 2024 is leap year (366) + 2025 (365) + 2026 (365) = 1096 days
      expect(calendar.length).toBe(1096);
    });

    it('should generate correct number of days for a single year', () => {
      const calendar2024 = generateFiscalCalendar(2024, 2024);
      expect(calendar2024.length).toBe(366); // Leap year

      const calendar2025 = generateFiscalCalendar(2025, 2025);
      expect(calendar2025.length).toBe(365);
    });

    it('should have correct date format', () => {
      const calendar = generateFiscalCalendar(2024, 2024);
      expect(calendar[0].date).toBe('2024-01-01');
      expect(calendar[calendar.length - 1].date).toBe('2024-12-31');
    });

    it('should have Indonesian day names by default', () => {
      const calendar = generateFiscalCalendar(2024, 2024);
      const dayNames = new Set(calendar.map(e => e.day_name));
      expect(dayNames).toContain('Senin');
      expect(dayNames).toContain('Minggu');
    });

    it('should support English day names', () => {
      const calendar = generateFiscalCalendar(2024, 2024, 'en');
      const dayNames = new Set(calendar.map(e => e.day_name));
      expect(dayNames).toContain('Monday');
      expect(dayNames).toContain('Sunday');
    });

    it('should have fiscal weeks between 1 and 53', () => {
      const calendar = generateFiscalCalendar(2024, 2026);
      const weeks = calendar.map(e => e.fiscal_week);
      expect(Math.min(...weeks)).toBeGreaterThanOrEqual(1);
      expect(Math.max(...weeks)).toBeLessThanOrEqual(53);
    });

    it('should have fiscal months between 1 and 12', () => {
      const calendar = generateFiscalCalendar(2024, 2026);
      const months = calendar.map(e => e.fiscal_month);
      expect(Math.min(...months)).toBe(1);
      expect(Math.max(...months)).toBe(12);
    });

    it('should have quarters between 1 and 4', () => {
      const calendar = generateFiscalCalendar(2024, 2026);
      const quarters = calendar.map(e => e.quarter);
      expect(Math.min(...quarters)).toBe(1);
      expect(Math.max(...quarters)).toBe(4);
    });

    it('should have correct quarter for each month', () => {
      const calendar = generateFiscalCalendar(2024, 2024);
      
      // Q1: Jan, Feb, Mar
      const q1Entries = calendar.filter(e => e.fiscal_month <= 3);
      expect(q1Entries.every(e => e.quarter === 1)).toBe(true);
      
      // Q2: Apr, May, Jun
      const q2Entries = calendar.filter(e => e.fiscal_month >= 4 && e.fiscal_month <= 6);
      expect(q2Entries.every(e => e.quarter === 2)).toBe(true);
      
      // Q3: Jul, Aug, Sep
      const q3Entries = calendar.filter(e => e.fiscal_month >= 7 && e.fiscal_month <= 9);
      expect(q3Entries.every(e => e.quarter === 3)).toBe(true);
      
      // Q4: Oct, Nov, Dec
      const q4Entries = calendar.filter(e => e.fiscal_month >= 10);
      expect(q4Entries.every(e => e.quarter === 4)).toBe(true);
    });
  });

  describe('Week boundaries (Monday-Sunday)', () => {
    it('should have weeks starting on Monday', () => {
      const calendar = generateFiscalCalendar(2024, 2024);
      
      // Group by fiscal week
      const weekGroups = new Map<number, FiscalCalendarEntry[]>();
      for (const entry of calendar) {
        const key = entry.fiscal_week;
        if (!weekGroups.has(key)) {
          weekGroups.set(key, []);
        }
        weekGroups.get(key)!.push(entry);
      }
      
      // Check that full weeks (7 days) start on Monday
      for (const [weekNum, entries] of weekGroups) {
        if (entries.length === 7) {
          // First day should be Monday (Senin)
          expect(entries[0].day_name).toBe('Senin');
          // Last day should be Sunday (Minggu)
          expect(entries[6].day_name).toBe('Minggu');
        }
      }
    });

    it('should have most weeks with 7 days', () => {
      const calendar = generateFiscalCalendar(2024, 2024);
      
      // Group by fiscal week
      const weekGroups = new Map<number, number>();
      for (const entry of calendar) {
        const key = entry.fiscal_week;
        weekGroups.set(key, (weekGroups.get(key) || 0) + 1);
      }
      
      // Count weeks with 7 days
      const fullWeeks = Array.from(weekGroups.values()).filter(count => count === 7).length;
      // Most weeks should have 7 days (allow for partial weeks at year boundaries)
      expect(fullWeeks).toBeGreaterThan(48);
    });
  });

  describe('getFiscalWeekBoundaries', () => {
    it('should return correct boundaries for a week', () => {
      const calendar = generateFiscalCalendar(2024, 2024);
      const boundaries = getFiscalWeekBoundaries(2024, 10, calendar);
      
      expect(boundaries).not.toBeNull();
      expect(boundaries!.start).toBeDefined();
      expect(boundaries!.end).toBeDefined();
      
      // Start should be before or equal to end
      expect(new Date(boundaries!.start) <= new Date(boundaries!.end)).toBe(true);
    });

    it('should return null for invalid week', () => {
      const calendar = generateFiscalCalendar(2024, 2024);
      const boundaries = getFiscalWeekBoundaries(2024, 60, calendar);
      expect(boundaries).toBeNull();
    });
  });

  describe('getFiscalMonthBoundaries', () => {
    it('should return correct boundaries for January 2024', () => {
      const calendar = generateFiscalCalendar(2024, 2024);
      const boundaries = getFiscalMonthBoundaries(2024, 1, calendar);
      
      expect(boundaries).not.toBeNull();
      expect(boundaries!.start).toBe('2024-01-01');
      expect(boundaries!.end).toBe('2024-01-31');
      expect(boundaries!.totalDays).toBe(31);
    });

    it('should return correct boundaries for February 2024 (leap year)', () => {
      const calendar = generateFiscalCalendar(2024, 2024);
      const boundaries = getFiscalMonthBoundaries(2024, 2, calendar);
      
      expect(boundaries).not.toBeNull();
      expect(boundaries!.start).toBe('2024-02-01');
      expect(boundaries!.end).toBe('2024-02-29'); // Leap year
      expect(boundaries!.totalDays).toBe(29);
    });

    it('should return correct boundaries for February 2025 (non-leap year)', () => {
      const calendar = generateFiscalCalendar(2025, 2025);
      const boundaries = getFiscalMonthBoundaries(2025, 2, calendar);
      
      expect(boundaries).not.toBeNull();
      expect(boundaries!.totalDays).toBe(28);
    });
  });

  describe('validateFiscalCalendar', () => {
    it('should validate correct calendar', () => {
      const calendar = generateFiscalCalendar(2024, 2026);
      const result = validateFiscalCalendar(calendar);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect duplicate dates', () => {
      const calendar: FiscalCalendarEntry[] = [
        { date: '2024-01-01', day_name: 'Senin', fiscal_week: 1, fiscal_month: 1, fiscal_year: 2024, quarter: 1 },
        { date: '2024-01-01', day_name: 'Senin', fiscal_week: 1, fiscal_month: 1, fiscal_year: 2024, quarter: 1 },
      ];
      
      const result = validateFiscalCalendar(calendar);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Duplicate'))).toBe(true);
    });

    it('should detect invalid week numbers', () => {
      const calendar: FiscalCalendarEntry[] = [
        { date: '2024-01-01', day_name: 'Senin', fiscal_week: 0, fiscal_month: 1, fiscal_year: 2024, quarter: 1 },
      ];
      
      const result = validateFiscalCalendar(calendar);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('fiscal_week'))).toBe(true);
    });

    it('should detect quarter mismatch', () => {
      const calendar: FiscalCalendarEntry[] = [
        { date: '2024-01-01', day_name: 'Senin', fiscal_week: 1, fiscal_month: 1, fiscal_year: 2024, quarter: 2 },
      ];
      
      const result = validateFiscalCalendar(calendar);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Quarter mismatch'))).toBe(true);
    });
  });

  describe('exportToCSV', () => {
    it('should export to valid CSV format', () => {
      const calendar = generateFiscalCalendar(2024, 2024);
      const csv = exportToCSV(calendar);
      
      const lines = csv.split('\n');
      expect(lines[0]).toBe('date,day_name,fiscal_week,fiscal_month,fiscal_year,quarter');
      expect(lines.length).toBe(367); // Header + 366 days
    });
  });
});
