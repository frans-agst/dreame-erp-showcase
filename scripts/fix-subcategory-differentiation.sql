-- ============================================================================
-- Sub-Category Differentiation Fix Script
-- ============================================================================
-- Purpose: Quick fix for common sub-category differentiation issues
-- Run this AFTER running the diagnostic script to understand what needs fixing
--
-- This script combines multiple fixes:
--   1. Standardize old format values
--   2. Trim whitespace
--   3. Fix case sensitivity
--   4. Map extra values to valid options
--
-- Instructions:
--   1. First run: diagnose-subcategory-issue.sql
--   2. Review the diagnostic output
--   3. Uncomment the sections below that apply to your situation
--   4. Run this script
--   5. Verify with: verify-subcategory-migration.sql
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'SUB-CATEGORY DIFFERENTIATION FIX';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE '';
END $$;

-- ============================================================================
-- FIX 1: Standardize Old Format Values
-- ============================================================================
-- Uncomment this section if diagnostic shows old format values

BEGIN;

DO $$
BEGIN
  RAISE NOTICE 'Fix 1: Standardizing old format values...';
END $$;

-- Update "Wet And Dry Vacuum" to "Wet & Dry"
UPDATE public.products
SET sub_category = 'Wet & Dry',
    updated_at = NOW()
WHERE sub_category = 'Wet And Dry Vacuum';

-- Update "Mite Remover" to "Mite Removal"
UPDATE public.products
SET sub_category = 'Mite Removal',
    updated_at = NOW()
WHERE sub_category = 'Mite Remover';

-- Update "Small Appliance" to "Small Appliances"
UPDATE public.products
SET sub_category = 'Small Appliances',
    updated_at = NOW()
WHERE sub_category = 'Small Appliance';

-- Update "Air Purifier" to "Purifier"
UPDATE public.products
SET sub_category = 'Purifier',
    updated_at = NOW()
WHERE sub_category = 'Air Purifier';

COMMIT;

DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO updated_count
  FROM public.products
  WHERE sub_category IN ('Wet & Dry', 'Mite Removal', 'Small Appliances', 'Purifier')
    AND updated_at >= NOW() - INTERVAL '1 minute';
  
  RAISE NOTICE '✓ Updated % products with old format values', updated_count;
  RAISE NOTICE '';
END $$;

-- ============================================================================
-- FIX 2: Trim Whitespace
-- ============================================================================
-- Uncomment this section if diagnostic shows whitespace issues

-- BEGIN;

-- DO $$
-- BEGIN
--   RAISE NOTICE 'Fix 2: Trimming whitespace...';
-- END $$;

-- UPDATE public.products
-- SET sub_category = TRIM(sub_category),
--     updated_at = NOW()
-- WHERE sub_category IS NOT NULL 
--   AND sub_category != TRIM(sub_category);

-- COMMIT;

-- DO $$
-- DECLARE
--   updated_count INTEGER;
-- BEGIN
--   GET DIAGNOSTICS updated_count = ROW_COUNT;
--   RAISE NOTICE '✓ Trimmed whitespace from % products', updated_count;
--   RAISE NOTICE '';
-- END $$;

-- ============================================================================
-- FIX 3: Fix Case Sensitivity Issues
-- ============================================================================
-- Uncomment this section if diagnostic shows case sensitivity issues

-- BEGIN;

-- DO $$
-- BEGIN
--   RAISE NOTICE 'Fix 3: Fixing case sensitivity...';
-- END $$;

-- -- Fix "wet & dry" to "Wet & Dry"
-- UPDATE public.products
-- SET sub_category = 'Wet & Dry',
--     updated_at = NOW()
-- WHERE LOWER(sub_category) = 'wet & dry' AND sub_category != 'Wet & Dry';

-- -- Fix "robovac" to "Robovac"
-- UPDATE public.products
-- SET sub_category = 'Robovac',
--     updated_at = NOW()
-- WHERE LOWER(sub_category) = 'robovac' AND sub_category != 'Robovac';

-- -- Fix "beauty" to "Beauty"
-- UPDATE public.products
-- SET sub_category = 'Beauty',
--     updated_at = NOW()
-- WHERE LOWER(sub_category) = 'beauty' AND sub_category != 'Beauty';

-- -- Fix "stick vacuum" to "Stick Vacuum"
-- UPDATE public.products
-- SET sub_category = 'Stick Vacuum',
--     updated_at = NOW()
-- WHERE LOWER(sub_category) = 'stick vacuum' AND sub_category != 'Stick Vacuum';

-- -- Fix "purifier" to "Purifier"
-- UPDATE public.products
-- SET sub_category = 'Purifier',
--     updated_at = NOW()
-- WHERE LOWER(sub_category) = 'purifier' AND sub_category != 'Purifier';

-- -- Fix "mite removal" to "Mite Removal"
-- UPDATE public.products
-- SET sub_category = 'Mite Removal',
--     updated_at = NOW()
-- WHERE LOWER(sub_category) = 'mite removal' AND sub_category != 'Mite Removal';

-- -- Fix "small appliances" to "Small Appliances"
-- UPDATE public.products
-- SET sub_category = 'Small Appliances',
--     updated_at = NOW()
-- WHERE LOWER(sub_category) = 'small appliances' AND sub_category != 'Small Appliances';

-- -- Fix "others" to "Others"
-- UPDATE public.products
-- SET sub_category = 'Others',
--     updated_at = NOW()
-- WHERE LOWER(sub_category) = 'others' AND sub_category != 'Others';

-- COMMIT;

-- DO $$
-- DECLARE
--   updated_count INTEGER;
-- BEGIN
--   GET DIAGNOSTICS updated_count = ROW_COUNT;
--   RAISE NOTICE '✓ Fixed case sensitivity for % products', updated_count;
--   RAISE NOTICE '';
-- END $$;

-- ============================================================================
-- FIX 4: Map Extra Values to Valid Options
-- ============================================================================
-- Uncomment and modify this section if diagnostic shows extra values
-- Decide which valid sub-category each extra value should map to

-- BEGIN;

-- DO $$
-- BEGIN
--   RAISE NOTICE 'Fix 4: Mapping extra values to valid options...';
-- END $$;

-- -- Example: Map "Steam Cleaner" to "Others"
-- UPDATE public.products
-- SET sub_category = 'Others',
--     updated_at = NOW()
-- WHERE sub_category = 'Steam Cleaner';

-- -- Example: Map "Accessory" to "Others"
-- UPDATE public.products
-- SET sub_category = 'Others',
--     updated_at = NOW()
-- WHERE sub_category = 'Accessory';

-- -- Add more mappings as needed based on diagnostic output

-- COMMIT;

-- DO $$
-- DECLARE
--   updated_count INTEGER;
-- BEGIN
--   GET DIAGNOSTICS updated_count = ROW_COUNT;
--   RAISE NOTICE '✓ Mapped % products with extra values', updated_count;
--   RAISE NOTICE '';
-- END $$;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'VERIFICATION';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE '';
END $$;

-- Check for remaining old values
DO $$
DECLARE
  old_values_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO old_values_count
  FROM public.products 
  WHERE sub_category IN ('Wet And Dry Vacuum', 'Mite Remover', 'Small Appliance', 'Air Purifier');
  
  IF old_values_count = 0 THEN
    RAISE NOTICE '✓ No old format values remain';
  ELSE
    RAISE NOTICE '✗ WARNING: % products still have old format values', old_values_count;
  END IF;
END $$;

-- Check for invalid values
DO $$
DECLARE
  invalid_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO invalid_count
  FROM public.products 
  WHERE sub_category IS NOT NULL
    AND sub_category NOT IN ('Wet & Dry', 'Robovac', 'Beauty', 'Stick Vacuum', 'Purifier', 'Mite Removal', 'Small Appliances', 'Others');
  
  IF invalid_count = 0 THEN
    RAISE NOTICE '✓ All sub-category values are valid';
  ELSE
    RAISE NOTICE '✗ WARNING: % products have invalid sub-category values', invalid_count;
    RAISE NOTICE '  Run diagnostic script to see which values are invalid';
  END IF;
END $$;

-- Show current distribution
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE 'Current sub-category distribution:';
END $$;

SELECT 
  sub_category,
  COUNT(*) as product_count,
  CASE 
    WHEN sub_category IN ('Wet & Dry', 'Robovac', 'Beauty', 'Stick Vacuum', 'Purifier', 'Mite Removal', 'Small Appliances', 'Others') 
      THEN '✓ Valid'
    ELSE '✗ Invalid'
  END as status
FROM public.products
WHERE sub_category IS NOT NULL
GROUP BY sub_category
ORDER BY 
  CASE 
    WHEN sub_category IN ('Wet & Dry', 'Robovac', 'Beauty', 'Stick Vacuum', 'Purifier', 'Mite Removal', 'Small Appliances', 'Others') 
      THEN 1
    ELSE 2
  END,
  sub_category;

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'FIX COMPLETE';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Review the verification results above';
  RAISE NOTICE '  2. If any issues remain, run: diagnose-subcategory-issue.sql';
  RAISE NOTICE '  3. Run full verification: verify-subcategory-migration.sql';
  RAISE NOTICE '  4. Test the sales input page to confirm filtering works';
  RAISE NOTICE '';
END $$;
