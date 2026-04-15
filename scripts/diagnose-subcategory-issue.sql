-- ============================================================================
-- Sub-Category Differentiation Diagnostic Script
-- ============================================================================
-- Purpose: Analyze current sub-category values to identify differentiation issues
-- This script checks for:
--   1. Mismatched values between database and frontend dropdown
--   2. Case sensitivity issues
--   3. Whitespace or special character issues
--   4. Missing or NULL values
--
-- Instructions: Run this in Supabase SQL Editor to get a full report
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'SUB-CATEGORY DIFFERENTIATION DIAGNOSTIC REPORT';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE '';
END $$;

-- ============================================================================
-- Section 1: Current Sub-Category Values in Database
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE 'Section 1: All Distinct Sub-Category Values in Database';
  RAISE NOTICE '----------------------------------------------------------------------';
  RAISE NOTICE '';
END $$;

SELECT 
  sub_category,
  COUNT(*) as product_count,
  LENGTH(sub_category) as string_length,
  CASE 
    WHEN sub_category ~ '^\s' OR sub_category ~ '\s$' THEN 'Has leading/trailing spaces'
    ELSE 'Clean'
  END as whitespace_check
FROM public.products
WHERE sub_category IS NOT NULL
GROUP BY sub_category
ORDER BY sub_category;

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE 'Expected values from frontend (product-categories.ts):';
  RAISE NOTICE '  1. "Wet & Dry"';
  RAISE NOTICE '  2. "Robovac"';
  RAISE NOTICE '  3. "Beauty"';
  RAISE NOTICE '  4. "Stick Vacuum"';
  RAISE NOTICE '  5. "Purifier"';
  RAISE NOTICE '  6. "Mite Removal"';
  RAISE NOTICE '  7. "Small Appliances"';
  RAISE NOTICE '  8. "Others"';
  RAISE NOTICE '';
END $$;

-- ============================================================================
-- Section 2: Check for Old/Incorrect Values
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE 'Section 2: Check for Old/Incorrect Sub-Category Values';
  RAISE NOTICE '----------------------------------------------------------------------';
  RAISE NOTICE '';
END $$;

SELECT 
  sub_category,
  COUNT(*) as product_count,
  CASE 
    WHEN sub_category = 'Wet And Dry Vacuum' THEN 'Should be: "Wet & Dry"'
    WHEN sub_category = 'Mite Remover' THEN 'Should be: "Mite Removal"'
    WHEN sub_category = 'Small Appliance' THEN 'Should be: "Small Appliances"'
    WHEN sub_category = 'Air Purifier' THEN 'Should be: "Purifier"'
    WHEN sub_category = 'Steam Cleaner' THEN 'Not in dropdown - should be mapped'
    WHEN sub_category = 'Accessory' THEN 'Not in dropdown - should be mapped'
    WHEN sub_category NOT IN ('Wet & Dry', 'Robovac', 'Beauty', 'Stick Vacuum', 'Purifier', 'Mite Removal', 'Small Appliances', 'Others') 
      THEN 'UNKNOWN - Not in expected list'
    ELSE 'OK - Matches dropdown'
  END as status
FROM public.products
WHERE sub_category IS NOT NULL
GROUP BY sub_category
ORDER BY 
  CASE 
    WHEN sub_category IN ('Wet & Dry', 'Robovac', 'Beauty', 'Stick Vacuum', 'Purifier', 'Mite Removal', 'Small Appliances', 'Others') THEN 1
    ELSE 2
  END,
  sub_category;

-- ============================================================================
-- Section 3: Case Sensitivity Check
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE 'Section 3: Case Sensitivity Analysis';
  RAISE NOTICE '----------------------------------------------------------------------';
  RAISE NOTICE '';
END $$;

SELECT 
  sub_category as original_value,
  LOWER(sub_category) as lowercase,
  UPPER(sub_category) as uppercase,
  COUNT(*) as product_count
FROM public.products
WHERE sub_category IS NOT NULL
GROUP BY sub_category
ORDER BY sub_category;

-- ============================================================================
-- Section 4: Special Characters and Encoding Check
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE 'Section 4: Special Characters Check';
  RAISE NOTICE '----------------------------------------------------------------------';
  RAISE NOTICE '';
END $$;

SELECT 
  sub_category,
  COUNT(*) as product_count,
  CASE 
    WHEN sub_category ~ '&' THEN 'Contains &'
    WHEN sub_category ~ '-' THEN 'Contains -'
    WHEN sub_category ~ '_' THEN 'Contains _'
    WHEN sub_category ~ '\s{2,}' THEN 'Contains multiple spaces'
    ELSE 'No special chars'
  END as special_char_check,
  encode(sub_category::bytea, 'hex') as hex_encoding
FROM public.products
WHERE sub_category IS NOT NULL
GROUP BY sub_category
ORDER BY sub_category;

-- ============================================================================
-- Section 5: Products with NULL or Empty Sub-Category
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE 'Section 5: Products with Missing Sub-Category';
  RAISE NOTICE '----------------------------------------------------------------------';
  RAISE NOTICE '';
END $$;

SELECT 
  COUNT(*) as null_subcategory_count,
  ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM public.products), 2) as percentage
FROM public.products
WHERE sub_category IS NULL OR sub_category = '';

-- Show sample products with NULL sub_category
SELECT 
  id,
  sku,
  name,
  category,
  sub_category
FROM public.products
WHERE sub_category IS NULL OR sub_category = ''
LIMIT 10;

-- ============================================================================
-- Section 6: Comparison with Frontend Dropdown
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE 'Section 6: Matching Status with Frontend Dropdown';
  RAISE NOTICE '----------------------------------------------------------------------';
  RAISE NOTICE '';
END $$;

WITH expected_values AS (
  SELECT unnest(ARRAY[
    'Wet & Dry',
    'Robovac',
    'Beauty',
    'Stick Vacuum',
    'Purifier',
    'Mite Removal',
    'Small Appliances',
    'Others'
  ]) as expected_subcategory
),
actual_values AS (
  SELECT DISTINCT sub_category as actual_subcategory
  FROM public.products
  WHERE sub_category IS NOT NULL
)
SELECT 
  COALESCE(e.expected_subcategory, a.actual_subcategory) as subcategory,
  CASE 
    WHEN e.expected_subcategory IS NOT NULL AND a.actual_subcategory IS NOT NULL THEN '✓ Match'
    WHEN e.expected_subcategory IS NOT NULL AND a.actual_subcategory IS NULL THEN '✗ Missing in DB'
    WHEN e.expected_subcategory IS NULL AND a.actual_subcategory IS NOT NULL THEN '⚠ Extra in DB'
  END as status,
  (SELECT COUNT(*) FROM public.products WHERE sub_category = COALESCE(e.expected_subcategory, a.actual_subcategory)) as product_count
FROM expected_values e
FULL OUTER JOIN actual_values a ON e.expected_subcategory = a.actual_subcategory
ORDER BY status, subcategory;

-- ============================================================================
-- Section 7: Recent Products and Their Sub-Categories
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE 'Section 7: Recently Updated Products (Last 20)';
  RAISE NOTICE '----------------------------------------------------------------------';
  RAISE NOTICE '';
END $$;

SELECT 
  id,
  sku,
  name,
  sub_category,
  updated_at,
  CASE 
    WHEN sub_category IN ('Wet & Dry', 'Robovac', 'Beauty', 'Stick Vacuum', 'Purifier', 'Mite Removal', 'Small Appliances', 'Others') 
      THEN '✓ Valid'
    ELSE '✗ Invalid'
  END as validation_status
FROM public.products
ORDER BY updated_at DESC NULLS LAST
LIMIT 20;

-- ============================================================================
-- Section 8: Summary and Recommendations
-- ============================================================================
DO $$
DECLARE
  total_products INTEGER;
  valid_subcategory_count INTEGER;
  invalid_subcategory_count INTEGER;
  null_subcategory_count INTEGER;
  old_format_count INTEGER;
  extra_values_count INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'DIAGNOSTIC SUMMARY';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE '';
  
  -- Get counts
  SELECT COUNT(*) INTO total_products FROM public.products;
  
  SELECT COUNT(*) INTO valid_subcategory_count 
  FROM public.products 
  WHERE sub_category IN ('Wet & Dry', 'Robovac', 'Beauty', 'Stick Vacuum', 'Purifier', 'Mite Removal', 'Small Appliances', 'Others');
  
  SELECT COUNT(*) INTO invalid_subcategory_count 
  FROM public.products 
  WHERE sub_category IS NOT NULL 
    AND sub_category NOT IN ('Wet & Dry', 'Robovac', 'Beauty', 'Stick Vacuum', 'Purifier', 'Mite Removal', 'Small Appliances', 'Others');
  
  SELECT COUNT(*) INTO null_subcategory_count 
  FROM public.products 
  WHERE sub_category IS NULL OR sub_category = '';
  
  SELECT COUNT(*) INTO old_format_count
  FROM public.products 
  WHERE sub_category IN ('Wet And Dry Vacuum', 'Mite Remover', 'Small Appliance', 'Air Purifier');
  
  SELECT COUNT(DISTINCT sub_category) INTO extra_values_count
  FROM public.products 
  WHERE sub_category IS NOT NULL 
    AND sub_category NOT IN ('Wet & Dry', 'Robovac', 'Beauty', 'Stick Vacuum', 'Purifier', 'Mite Removal', 'Small Appliances', 'Others');
  
  RAISE NOTICE 'Total Products: %', total_products;
  RAISE NOTICE 'Products with Valid Sub-Category: % (%.1f%%)', valid_subcategory_count, (valid_subcategory_count::FLOAT / total_products * 100);
  RAISE NOTICE 'Products with Invalid Sub-Category: % (%.1f%%)', invalid_subcategory_count, (invalid_subcategory_count::FLOAT / total_products * 100);
  RAISE NOTICE 'Products with NULL Sub-Category: % (%.1f%%)', null_subcategory_count, (null_subcategory_count::FLOAT / total_products * 100);
  RAISE NOTICE '';
  RAISE NOTICE 'Old Format Values Still Present: %', old_format_count;
  RAISE NOTICE 'Extra Sub-Category Values (not in dropdown): %', extra_values_count;
  RAISE NOTICE '';
  
  -- Recommendations
  RAISE NOTICE '=== RECOMMENDATIONS ===';
  RAISE NOTICE '';
  
  IF old_format_count > 0 THEN
    RAISE NOTICE '⚠ ACTION REQUIRED: Run migration script 017_standardize_subcategory_values.sql';
    RAISE NOTICE '   This will update % products with old format values', old_format_count;
    RAISE NOTICE '';
  END IF;
  
  IF extra_values_count > 0 THEN
    RAISE NOTICE '⚠ ACTION REQUIRED: % distinct sub-category values not in dropdown', extra_values_count;
    RAISE NOTICE '   Options:';
    RAISE NOTICE '   1. Add these values to product-categories.ts dropdown';
    RAISE NOTICE '   2. Map these values to existing dropdown options';
    RAISE NOTICE '   3. Update products to use valid sub-category values';
    RAISE NOTICE '';
  END IF;
  
  IF null_subcategory_count > 0 THEN
    RAISE NOTICE '⚠ WARNING: % products have NULL sub-category', null_subcategory_count;
    RAISE NOTICE '   Consider assigning sub-categories to these products';
    RAISE NOTICE '';
  END IF;
  
  IF old_format_count = 0 AND extra_values_count = 0 AND null_subcategory_count = 0 THEN
    RAISE NOTICE '✓ All sub-category values are valid and match the dropdown!';
    RAISE NOTICE '';
  END IF;
  
  RAISE NOTICE '';
END $$;

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'END DIAGNOSTIC REPORT';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE '';
END $$;
