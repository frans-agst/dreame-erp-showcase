-- ============================================
-- OMNIERP RETAIL ERP V2.0 - FISCAL CALENDAR SEED DATA
-- Generates fiscal calendar for 2024-2026
-- Week boundaries: Monday-Sunday
-- Requirements: 4.6
-- ============================================

-- Drop existing function if exists to recreate with improvements
DROP FUNCTION IF EXISTS populate_fiscal_calendar(INT, INT);

-- ============================================
-- IMPROVED FISCAL CALENDAR POPULATION FUNCTION
-- ============================================
-- This function generates fiscal calendar data with:
-- - Monday as first day of week (ISO week standard)
-- - Proper fiscal week calculation
-- - Indonesian day names
-- - Quarter calculation based on fiscal month
-- ============================================

CREATE OR REPLACE FUNCTION populate_fiscal_calendar(start_year INT, end_year INT)
RETURNS void AS $$
DECLARE
  cur_date DATE;
  end_date DATE;
  week_num INT;
  month_num INT;
  year_num INT;
  first_monday DATE;
  days_since_first_monday INT;
  -- Indonesian day names (Sunday=0, Monday=1, ..., Saturday=6)
  day_names TEXT[] := ARRAY['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
BEGIN
  -- Start from January 1st of start_year
  cur_date := make_date(start_year, 1, 1);
  end_date := make_date(end_year, 12, 31);
  
  WHILE cur_date <= end_date LOOP
    year_num := EXTRACT(YEAR FROM cur_date)::INT;
    month_num := EXTRACT(MONTH FROM cur_date)::INT;
    
    -- Find the first Monday of the year
    -- If Jan 1 is Monday (DOW=1), use it; otherwise find next Monday
    first_monday := make_date(year_num, 1, 1);
    IF EXTRACT(DOW FROM first_monday)::INT != 1 THEN
      -- Move to next Monday
      first_monday := first_monday + ((8 - EXTRACT(DOW FROM first_monday)::INT) % 7)::INT;
      -- If first Monday is after Jan 4, go back one week (ISO week rule)
      IF first_monday > make_date(year_num, 1, 4) THEN
        first_monday := first_monday - 7;
      END IF;
    END IF;
    
    -- Calculate fiscal week number
    -- Days before first Monday belong to week 1
    IF cur_date < first_monday THEN
      week_num := 1;
    ELSE
      days_since_first_monday := cur_date - first_monday;
      week_num := (days_since_first_monday / 7) + 1;
    END IF;
    
    -- Handle year boundary - last days might be week 53 or week 1 of next year
    IF week_num > 53 THEN
      week_num := 53;
    END IF;
    IF week_num < 1 THEN
      week_num := 1;
    END IF;
    
    -- Insert into fiscal_calendar
    INSERT INTO public.fiscal_calendar (date, day_name, fiscal_week, fiscal_month, fiscal_year, quarter)
    VALUES (
      cur_date,
      day_names[EXTRACT(DOW FROM cur_date)::INT + 1],  -- DOW is 0-6, array is 1-indexed
      week_num,
      month_num,
      year_num,
      CEIL(month_num / 3.0)::INT
    )
    ON CONFLICT (date) DO UPDATE SET
      day_name = EXCLUDED.day_name,
      fiscal_week = EXCLUDED.fiscal_week,
      fiscal_month = EXCLUDED.fiscal_month,
      fiscal_year = EXCLUDED.fiscal_year,
      quarter = EXCLUDED.quarter;
    
    cur_date := cur_date + INTERVAL '1 day';
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- CLEAR EXISTING DATA AND REPOPULATE
-- ============================================

-- Clear existing fiscal calendar data for the years we're seeding
DELETE FROM public.fiscal_calendar 
WHERE fiscal_year BETWEEN 2024 AND 2026;

-- Populate fiscal calendar for 2024-2026
SELECT populate_fiscal_calendar(2024, 2026);

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Verify total days populated (should be ~1096 for 3 years including leap year)
DO $$
DECLARE
  total_days INT;
  expected_days INT := 1096; -- 2024 is leap year (366) + 2025 (365) + 2026 (365)
BEGIN
  SELECT COUNT(*) INTO total_days 
  FROM public.fiscal_calendar 
  WHERE fiscal_year BETWEEN 2024 AND 2026;
  
  IF total_days >= expected_days THEN
    RAISE NOTICE 'Fiscal calendar populated successfully: % days', total_days;
  ELSE
    RAISE WARNING 'Fiscal calendar may be incomplete: % days (expected %)', total_days, expected_days;
  END IF;
END $$;

-- ============================================
-- HELPER VIEWS FOR FISCAL CALENDAR
-- ============================================

-- Create view for fiscal week summary
CREATE OR REPLACE VIEW public.fiscal_week_summary AS
SELECT 
  fiscal_year,
  fiscal_week,
  MIN(date) as week_start,
  MAX(date) as week_end,
  COUNT(*) as days_in_week
FROM public.fiscal_calendar
GROUP BY fiscal_year, fiscal_week
ORDER BY fiscal_year, fiscal_week;

-- Create view for fiscal month summary
CREATE OR REPLACE VIEW public.fiscal_month_summary AS
SELECT 
  fiscal_year,
  fiscal_month,
  quarter,
  MIN(date) as month_start,
  MAX(date) as month_end,
  COUNT(*) as days_in_month
FROM public.fiscal_calendar
GROUP BY fiscal_year, fiscal_month, quarter
ORDER BY fiscal_year, fiscal_month;

-- ============================================
-- SAMPLE QUERIES FOR VERIFICATION
-- ============================================

-- Show first week of each year
-- SELECT * FROM public.fiscal_week_summary WHERE fiscal_week = 1;

-- Show week boundaries for current month
-- SELECT * FROM public.fiscal_week_summary 
-- WHERE fiscal_year = EXTRACT(YEAR FROM CURRENT_DATE)::INT
--   AND fiscal_week IN (
--     SELECT DISTINCT fiscal_week FROM public.fiscal_calendar 
--     WHERE fiscal_month = EXTRACT(MONTH FROM CURRENT_DATE)::INT
--   );

-- ============================================
-- FISCAL CALENDAR SEED COMPLETE
-- ============================================
