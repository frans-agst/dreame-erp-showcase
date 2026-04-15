/**
 * Fiscal Calendar Generator
 * 
 * Generates fiscal calendar data for 2024-2026 with Monday-Sunday week boundaries.
 * Can be used to:
 * - Generate seed data programmatically
 * - Export to CSV for import
 * - Validate fiscal calendar calculations
 * 
 * Requirements: 4.6
 */

export interface FiscalCalendarEntry {
  date: string;
  day_name: string;
  fiscal_week: number;
  fiscal_month: number;
  fiscal_year: number;
  quarter: number;
}

const DAY_NAMES_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const DAY_NAMES_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Get the first Monday of a given year
 * If Jan 1 is Monday, use it; otherwise find the Monday of the week containing Jan 1
 */
function getFirstMondayOfYear(year: number): Date {
  const jan1 = new Date(year, 0, 1);
  const dayOfWeek = jan1.getDay(); // 0 = Sunday, 1 = Monday, etc.
  
  if (dayOfWeek === 1) {
    // Jan 1 is Monday
    return jan1;
  }
  
  // Find the Monday of the week containing Jan 1
  // If Jan 1 is Sunday (0), go back 6 days
  // If Jan 1 is Tuesday (2), go back 1 day
  // etc.
  const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const firstMonday = new Date(jan1);
  firstMonday.setDate(jan1.getDate() - daysToSubtract);
  
  // If first Monday is in previous year and Jan 1 is after Thursday,
  // use the next Monday instead (ISO week rule)
  if (firstMonday.getFullYear() < year && dayOfWeek > 4) {
    firstMonday.setDate(firstMonday.getDate() + 7);
  }
  
  return firstMonday;
}

/**
 * Calculate fiscal week number for a given date
 * Week 1 starts on the first Monday of the year (or the Monday containing Jan 1)
 */
function calculateFiscalWeek(date: Date): number {
  const year = date.getFullYear();
  const firstMonday = getFirstMondayOfYear(year);
  
  // If date is before first Monday, it's week 1
  if (date < firstMonday) {
    return 1;
  }
  
  // Calculate days since first Monday
  const diffTime = date.getTime() - firstMonday.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  // Week number is floor(days / 7) + 1
  let weekNum = Math.floor(diffDays / 7) + 1;
  
  // Cap at 53 weeks
  if (weekNum > 53) {
    weekNum = 53;
  }
  
  return weekNum;
}

/**
 * Format date as YYYY-MM-DD string
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Generate fiscal calendar entries for a date range
 */
export function generateFiscalCalendar(
  startYear: number,
  endYear: number,
  language: 'id' | 'en' = 'id'
): FiscalCalendarEntry[] {
  const entries: FiscalCalendarEntry[] = [];
  const dayNames = language === 'id' ? DAY_NAMES_ID : DAY_NAMES_EN;
  
  const startDate = new Date(startYear, 0, 1);
  const endDate = new Date(endYear, 11, 31);
  
  const currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1; // 1-12
    const dayOfWeek = currentDate.getDay(); // 0-6
    const fiscalWeek = calculateFiscalWeek(currentDate);
    const quarter = Math.ceil(month / 3);
    
    entries.push({
      date: formatDate(currentDate),
      day_name: dayNames[dayOfWeek],
      fiscal_week: fiscalWeek,
      fiscal_month: month,
      fiscal_year: year,
      quarter: quarter,
    });
    
    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return entries;
}

/**
 * Export fiscal calendar to CSV format
 */
export function exportToCSV(entries: FiscalCalendarEntry[]): string {
  const headers = ['date', 'day_name', 'fiscal_week', 'fiscal_month', 'fiscal_year', 'quarter'];
  const rows = entries.map(entry => [
    entry.date,
    entry.day_name,
    entry.fiscal_week.toString(),
    entry.fiscal_month.toString(),
    entry.fiscal_year.toString(),
    entry.quarter.toString(),
  ]);
  
  return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
}

/**
 * Export fiscal calendar to SQL INSERT statements
 */
export function exportToSQL(entries: FiscalCalendarEntry[]): string {
  const header = `-- Fiscal Calendar Seed Data (${entries[0]?.fiscal_year}-${entries[entries.length - 1]?.fiscal_year})
-- Generated programmatically
-- Week boundaries: Monday-Sunday

INSERT INTO public.fiscal_calendar (date, day_name, fiscal_week, fiscal_month, fiscal_year, quarter)
VALUES`;

  const values = entries.map(entry => 
    `  ('${entry.date}', '${entry.day_name}', ${entry.fiscal_week}, ${entry.fiscal_month}, ${entry.fiscal_year}, ${entry.quarter})`
  );

  return `${header}\n${values.join(',\n')}\nON CONFLICT (date) DO UPDATE SET
  day_name = EXCLUDED.day_name,
  fiscal_week = EXCLUDED.fiscal_week,
  fiscal_month = EXCLUDED.fiscal_month,
  fiscal_year = EXCLUDED.fiscal_year,
  quarter = EXCLUDED.quarter;`;
}

/**
 * Get fiscal week boundaries (start and end dates) for a given week
 */
export function getFiscalWeekBoundaries(
  fiscalYear: number,
  fiscalWeek: number,
  entries?: FiscalCalendarEntry[]
): { start: string; end: string } | null {
  const calendar = entries || generateFiscalCalendar(fiscalYear, fiscalYear);
  
  const weekEntries = calendar.filter(
    e => e.fiscal_year === fiscalYear && e.fiscal_week === fiscalWeek
  );
  
  if (weekEntries.length === 0) {
    return null;
  }
  
  return {
    start: weekEntries[0].date,
    end: weekEntries[weekEntries.length - 1].date,
  };
}

/**
 * Get fiscal month boundaries (start and end dates) for a given month
 */
export function getFiscalMonthBoundaries(
  fiscalYear: number,
  fiscalMonth: number,
  entries?: FiscalCalendarEntry[]
): { start: string; end: string; totalDays: number } | null {
  const calendar = entries || generateFiscalCalendar(fiscalYear, fiscalYear);
  
  const monthEntries = calendar.filter(
    e => e.fiscal_year === fiscalYear && e.fiscal_month === fiscalMonth
  );
  
  if (monthEntries.length === 0) {
    return null;
  }
  
  return {
    start: monthEntries[0].date,
    end: monthEntries[monthEntries.length - 1].date,
    totalDays: monthEntries.length,
  };
}

/**
 * Validate fiscal calendar entries
 */
export function validateFiscalCalendar(entries: FiscalCalendarEntry[]): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  // Check for duplicate dates
  const dates = new Set<string>();
  for (const entry of entries) {
    if (dates.has(entry.date)) {
      errors.push(`Duplicate date: ${entry.date}`);
    }
    dates.add(entry.date);
  }
  
  // Check week numbers are valid (1-53)
  for (const entry of entries) {
    if (entry.fiscal_week < 1 || entry.fiscal_week > 53) {
      errors.push(`Invalid fiscal_week ${entry.fiscal_week} for date ${entry.date}`);
    }
  }
  
  // Check month numbers are valid (1-12)
  for (const entry of entries) {
    if (entry.fiscal_month < 1 || entry.fiscal_month > 12) {
      errors.push(`Invalid fiscal_month ${entry.fiscal_month} for date ${entry.date}`);
    }
  }
  
  // Check quarter numbers are valid (1-4)
  for (const entry of entries) {
    if (entry.quarter < 1 || entry.quarter > 4) {
      errors.push(`Invalid quarter ${entry.quarter} for date ${entry.date}`);
    }
  }
  
  // Check quarter matches month
  for (const entry of entries) {
    const expectedQuarter = Math.ceil(entry.fiscal_month / 3);
    if (entry.quarter !== expectedQuarter) {
      errors.push(`Quarter mismatch for date ${entry.date}: expected ${expectedQuarter}, got ${entry.quarter}`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

// Export default generator for 2024-2026
export const fiscalCalendar2024_2026 = generateFiscalCalendar(2024, 2026);
