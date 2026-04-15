/**
 * Script to generate fiscal calendar CSV file
 * 
 * Run with: npx tsx scripts/generate-fiscal-calendar-csv.ts
 */

import * as fs from 'fs';
import * as path from 'path';

interface FiscalCalendarEntry {
  date: string;
  day_name: string;
  fiscal_week: number;
  fiscal_month: number;
  fiscal_year: number;
  quarter: number;
}

const DAY_NAMES_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getFirstMondayOfYear(year: number): Date {
  const jan1 = new Date(year, 0, 1);
  const dayOfWeek = jan1.getDay();
  
  if (dayOfWeek === 1) {
    return jan1;
  }
  
  const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const firstMonday = new Date(jan1);
  firstMonday.setDate(jan1.getDate() - daysToSubtract);
  
  if (firstMonday.getFullYear() < year && dayOfWeek > 4) {
    firstMonday.setDate(firstMonday.getDate() + 7);
  }
  
  return firstMonday;
}

function calculateFiscalWeek(date: Date): number {
  const year = date.getFullYear();
  const firstMonday = getFirstMondayOfYear(year);
  
  if (date < firstMonday) {
    return 1;
  }
  
  const diffTime = date.getTime() - firstMonday.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  let weekNum = Math.floor(diffDays / 7) + 1;
  
  if (weekNum > 53) {
    weekNum = 53;
  }
  
  return weekNum;
}

function generateFiscalCalendar(startYear: number, endYear: number): FiscalCalendarEntry[] {
  const entries: FiscalCalendarEntry[] = [];
  
  const startDate = new Date(startYear, 0, 1);
  const endDate = new Date(endYear, 11, 31);
  
  const currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    const dayOfWeek = currentDate.getDay();
    const fiscalWeek = calculateFiscalWeek(currentDate);
    const quarter = Math.ceil(month / 3);
    
    entries.push({
      date: formatDate(currentDate),
      day_name: DAY_NAMES_ID[dayOfWeek],
      fiscal_week: fiscalWeek,
      fiscal_month: month,
      fiscal_year: year,
      quarter: quarter,
    });
    
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return entries;
}

function exportToCSV(entries: FiscalCalendarEntry[]): string {
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

// Generate and save
const calendar = generateFiscalCalendar(2024, 2026);
const csv = exportToCSV(calendar);

const outputPath = path.join(__dirname, '..', 'supabase', 'seed-data', 'fiscal-calendar-2024-2026.csv');

// Ensure directory exists
const dir = path.dirname(outputPath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

fs.writeFileSync(outputPath, csv);

console.log(`Generated fiscal calendar CSV with ${calendar.length} entries`);
console.log(`Output: ${outputPath}`);
console.log(`\nSample entries:`);
console.log(calendar.slice(0, 5).map(e => `  ${e.date} (${e.day_name}) - Week ${e.fiscal_week}, Month ${e.fiscal_month}, Q${e.quarter}`).join('\n'));
