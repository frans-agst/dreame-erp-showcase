-- ============================================
-- FIX FISCAL CALENDAR FOR 2026
-- Ensures fiscal calendar has complete data for 2026
-- Addresses issue where Week 7+ might be missing
-- ============================================

-- Repopulate fiscal calendar for 2026 to ensure all weeks are present
-- This uses the existing populate_fiscal_calendar function from migration 006

DO $$
DECLARE
  week_count INT;
  date_count INT;
BEGIN
  -- Check current state
  SELECT COUNT(DISTINCT fiscal_week) INTO week_count
  FROM public.fiscal_calendar
  WHERE fiscal_year = 2026;
  
  SELECT COUNT(*) INTO date_count
  FROM public.fiscal_calendar
  WHERE fiscal_year = 2026;
  
  RAISE NOTICE 'Current 2026 fiscal calendar: % weeks, % days', week_count, date_count;
  
  -- Repopulate 2026 (function handles conflicts with ON CONFLICT DO UPDATE)
  PERFORM populate_fiscal_calendar(2026, 2026);
  
  -- Check after repopulation
  SELECT COUNT(DISTINCT fiscal_week) INTO week_count
  FROM public.fiscal_calendar
  WHERE fiscal_year = 2026;
  
  SELECT COUNT(*) INTO date_count
  FROM public.fiscal_calendar
  WHERE fiscal_year = 2026;
  
  RAISE NOTICE 'After repopulation: % weeks, % days (expected 365 days for 2026)', week_count, date_count;
  
  -- Verify February 9, 2026 has a fiscal week assigned
  IF EXISTS (
    SELECT 1 FROM public.fiscal_calendar 
    WHERE date = '2026-02-09'
  ) THEN
    RAISE NOTICE 'February 9, 2026 is in fiscal week %', 
      (SELECT fiscal_week FROM public.fiscal_calendar WHERE date = '2026-02-09');
  ELSE
    RAISE WARNING 'February 9, 2026 is NOT in fiscal calendar!';
  END IF;
END $$;

-- Show fiscal weeks for February 2026 for verification
SELECT 
  fiscal_week,
  MIN(date) as week_start,
  MAX(date) as week_end,
  COUNT(*) as days
FROM public.fiscal_calendar
WHERE fiscal_year = 2026 
  AND fiscal_month = 2
GROUP BY fiscal_week
ORDER BY fiscal_week;
