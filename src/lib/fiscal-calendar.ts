'use server';

import { createClient } from '@/lib/supabase/server';
import { FiscalCalendar, FiscalPeriod } from '@/types';

/**
 * Get the fiscal calendar entry for a specific date
 */
export async function getFiscalDate(date: string): Promise<FiscalCalendar | null> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('fiscal_calendar')
    .select('*')
    .eq('date', date)
    .single();
  
  if (error) {
    console.error('Error fetching fiscal date:', error);
    return null;
  }
  
  return data as FiscalCalendar;
}

/**
 * Get the current fiscal period (today's fiscal week/month/year)
 */
export async function getCurrentFiscalPeriod(): Promise<FiscalPeriod | null> {
  const supabase = await createClient();
  const today = new Date().toISOString().split('T')[0];
  
  // Get today's fiscal info
  const { data: todayData, error: todayError } = await supabase
    .from('fiscal_calendar')
    .select('*')
    .eq('date', today)
    .single();
  
  if (todayError || !todayData) {
    console.error('Error fetching current fiscal period:', todayError);
    return null;
  }
  
  const fiscal = todayData as FiscalCalendar;
  
  // Get all days in the current fiscal month
  const { data: monthDays, error: monthError } = await supabase
    .from('fiscal_calendar')
    .select('date')
    .eq('fiscal_year', fiscal.fiscal_year)
    .eq('fiscal_month', fiscal.fiscal_month)
    .order('date', { ascending: true });
  
  if (monthError || !monthDays) {
    console.error('Error fetching fiscal month days:', monthError);
    return null;
  }
  
  // Calculate days elapsed (including today)
  const daysElapsed = monthDays.filter(d => d.date <= today).length;
  
  return {
    fiscal_week: fiscal.fiscal_week,
    fiscal_month: fiscal.fiscal_month,
    fiscal_year: fiscal.fiscal_year,
    quarter: fiscal.quarter,
    start_date: monthDays[0]?.date || today,
    end_date: monthDays[monthDays.length - 1]?.date || today,
    days_elapsed: daysElapsed,
    total_days: monthDays.length,
  };
}

/**
 * Get fiscal month information
 */
export async function getFiscalMonthInfo(
  fiscalYear: number,
  fiscalMonth: number
): Promise<{ totalDays: number; dates: string[]; startDate: string; endDate: string } | null> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('fiscal_calendar')
    .select('date')
    .eq('fiscal_year', fiscalYear)
    .eq('fiscal_month', fiscalMonth)
    .order('date', { ascending: true });
  
  if (error || !data || data.length === 0) {
    console.error('Error fetching fiscal month info:', error);
    return null;
  }
  
  return {
    totalDays: data.length,
    dates: data.map(d => d.date),
    startDate: data[0].date,
    endDate: data[data.length - 1].date,
  };
}

/**
 * Get fiscal week information
 */
export async function getFiscalWeekInfo(
  fiscalYear: number,
  fiscalWeek: number
): Promise<{ totalDays: number; dates: string[]; startDate: string; endDate: string } | null> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('fiscal_calendar')
    .select('date')
    .eq('fiscal_year', fiscalYear)
    .eq('fiscal_week', fiscalWeek)
    .order('date', { ascending: true });
  
  if (error || !data || data.length === 0) {
    console.error('Error fetching fiscal week info:', error);
    return null;
  }
  
  return {
    totalDays: data.length,
    dates: data.map(d => d.date),
    startDate: data[0].date,
    endDate: data[data.length - 1].date,
  };
}

/**
 * Get days elapsed in fiscal month up to a specific date
 */
export async function getFiscalDaysElapsed(
  fiscalYear: number,
  fiscalMonth: number,
  upToDate?: string
): Promise<number> {
  const supabase = await createClient();
  const targetDate = upToDate || new Date().toISOString().split('T')[0];
  
  const { data, error } = await supabase
    .from('fiscal_calendar')
    .select('date')
    .eq('fiscal_year', fiscalYear)
    .eq('fiscal_month', fiscalMonth)
    .lte('date', targetDate);
  
  if (error) {
    console.error('Error fetching fiscal days elapsed:', error);
    return 0;
  }
  
  return data?.length || 0;
}

/**
 * Get list of fiscal weeks for a year (for dropdown)
 */
export async function getFiscalWeeksForYear(
  fiscalYear: number
): Promise<{ week: number; startDate: string; endDate: string }[]> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('fiscal_calendar')
    .select('fiscal_week, date')
    .eq('fiscal_year', fiscalYear)
    .order('date', { ascending: true });
  
  if (error || !data) {
    console.error('Error fetching fiscal weeks:', error);
    return [];
  }
  
  // Group by week
  const weekMap = new Map<number, string[]>();
  data.forEach(d => {
    const dates = weekMap.get(d.fiscal_week) || [];
    dates.push(d.date);
    weekMap.set(d.fiscal_week, dates);
  });
  
  return Array.from(weekMap.entries()).map(([week, dates]) => ({
    week,
    startDate: dates[0],
    endDate: dates[dates.length - 1],
  }));
}

/**
 * Get list of fiscal months for a year (for dropdown)
 */
export async function getFiscalMonthsForYear(
  fiscalYear: number
): Promise<{ month: number; startDate: string; endDate: string; totalDays: number }[]> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('fiscal_calendar')
    .select('fiscal_month, date')
    .eq('fiscal_year', fiscalYear)
    .order('date', { ascending: true });
  
  if (error || !data) {
    console.error('Error fetching fiscal months:', error);
    return [];
  }
  
  // Group by month
  const monthMap = new Map<number, string[]>();
  data.forEach(d => {
    const dates = monthMap.get(d.fiscal_month) || [];
    dates.push(d.date);
    monthMap.set(d.fiscal_month, dates);
  });
  
  return Array.from(monthMap.entries()).map(([month, dates]) => ({
    month,
    startDate: dates[0],
    endDate: dates[dates.length - 1],
    totalDays: dates.length,
  }));
}
