-- ============================================================================
-- Sub-Category Migration Verification Script
-- ============================================================================
-- Purpose: Verify the sub-category standardization migration was successful
-- Requirements: 5.1, 5.2, 5.3, 5.5
--
-- Instructions:
-- Run this script AFTER running the migration (017_standardize_subcategory_values.sql)
-- to verify all changes were applied correctly
--
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'POST-MIGRATION VERIFICATION';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE '';
END $$;

-- ============================================================================
-- Verification 1: Check for any remaining old values (should be 0)
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE 'Verification 1: Check for remaining old values (should be 0)';
  RAISE NOTICE '----------------------------------------------------------------------';
END $$;

SELECT COUNT(*) as old_values_remaining
FROM public.products 
WHERE sub_category IN ('Wet And Dry Vacuum', 'Mite Remover', 'Small Appliance', 'Air Purifier');

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE 'Expected: 0';
  RAISE NOTICE 'If > 0: Migration did not complete successfully!';
  RAISE NOTICE '';
END $$;

-- ============================================================================
-- Verification 2: Count products with new standardized values
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE 'Verification 2: Products with new standardized values';
  RAISE NOTICE '----------------------------------------------------------------------';
END $$;

SELECT 
  sub_category,
  COUNT(*) as product_count
FROM public.products
WHERE sub_category IN ('Wet & Dry', 'Mite Removal', 'Small Appliances', 'Purifier')
GROUP BY sub_category
ORDER BY sub_category;

DO $$
BEGIN
  RAISE NOTICE '';
END $$;

-- ============================================================================
-- Verification 3: All distinct sub_category values (should match dropdown)
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE 'Verification 3: All distinct sub_category values';
  RAISE NOTICE '----------------------------------------------------------------------';
  RAISE NOTICE 'These should match the dropdown options in product-categories.ts';
  RAISE NOTICE '';
END $$;

SELECT DISTINCT sub_category 
FROM public.products 
WHERE sub_category IS NOT NULL
ORDER BY sub_category;

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE 'Expected values:';
  RAISE NOTICE '  - Accessory';
  RAISE NOTICE '  - Beauty';
  RAISE NOTICE '  - Mite Removal';
  RAISE NOTICE '  - Others';
  RAISE NOTICE '  - Purifier';
  RAISE NOTICE '  - Robovac';
  RAISE NOTICE '  - Small Appliances';
  RAISE NOTICE '  - Steam Cleaner';
  RAISE NOTICE '  - Stick Vacuum';
  RAISE NOTICE '  - Wet & Dry';
  RAISE NOTICE '';
END $$;

-- ============================================================================
-- Verification 4: Total product count (should be unchanged)
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE 'Verification 4: Total product count';
  RAISE NOTICE '----------------------------------------------------------------------';
END $$;

SELECT COUNT(*) as total_products FROM public.products;

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE 'Compare this with pre-migration count - should be identical';
  RAISE NOTICE '';
END $$;

-- ============================================================================
-- Verification 5: Sample products with new values
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE 'Verification 5: Sample products with updated values';
  RAISE NOTICE '----------------------------------------------------------------------';
END $$;

(SELECT 
  id,
  sku,
  name,
  sub_category,
  'Updated from: Wet And Dry Vacuum' as note
FROM public.products 
WHERE sub_category = 'Wet & Dry'
LIMIT 3)

UNION ALL

(SELECT 
  id,
  sku,
  name,
  sub_category,
  'Updated from: Mite Remover' as note
FROM public.products 
WHERE sub_category = 'Mite Removal'
LIMIT 3)

UNION ALL

(SELECT 
  id,
  sku,
  name,
  sub_category,
  'Updated from: Small Appliance' as note
FROM public.products 
WHERE sub_category = 'Small Appliances'
LIMIT 3)

UNION ALL

(SELECT 
  id,
  sku,
  name,
  sub_category,
  'Updated from: Air Purifier' as note
FROM public.products 
WHERE sub_category = 'Purifier'
LIMIT 3);

DO $$
BEGIN
  RAISE NOTICE '';
END $$;

-- ============================================================================
-- Verification 6: Verify unchanged values still exist
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE 'Verification 6: Verify unchanged sub-categories still exist';
  RAISE NOTICE '----------------------------------------------------------------------';
END $$;

SELECT 
  sub_category,
  COUNT(*) as product_count
FROM public.products
WHERE sub_category IN ('Robovac', 'Beauty', 'Stick Vacuum', 'Steam Cleaner', 'Others', 'Accessory')
GROUP BY sub_category
ORDER BY sub_category;

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE 'These values should be unchanged from pre-migration';
  RAISE NOTICE '';
END $$;

-- ============================================================================
-- Verification 7: Check updated_at timestamps
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE 'Verification 7: Recently updated products (should show migration timestamp)';
  RAISE NOTICE '----------------------------------------------------------------------';
END $$;

SELECT 
  sub_category,
  COUNT(*) as count,
  MAX(updated_at) as last_updated
FROM public.products
WHERE sub_category IN ('Wet & Dry', 'Mite Removal', 'Small Appliances', 'Purifier')
GROUP BY sub_category
ORDER BY sub_category;

DO $$
BEGIN
  RAISE NOTICE '';
END $$;

-- ============================================================================
-- FINAL VERIFICATION SUMMARY
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'VERIFICATION SUMMARY';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE '';
END $$;

DO $$
DECLARE
  old_values INTEGER;
  new_wet_dry INTEGER;
  new_mite INTEGER;
  new_appliances INTEGER;
  new_purifier INTEGER;
  total_products INTEGER;
  all_checks_passed BOOLEAN := TRUE;
BEGIN
  -- Check for old values
  SELECT COUNT(*) INTO old_values
  FROM public.products 
  WHERE sub_category IN ('Wet And Dry Vacuum', 'Mite Remover', 'Small Appliance', 'Air Purifier');
  
  -- Count new values
  SELECT COUNT(*) INTO new_wet_dry FROM public.products WHERE sub_category = 'Wet & Dry';
  SELECT COUNT(*) INTO new_mite FROM public.products WHERE sub_category = 'Mite Removal';
  SELECT COUNT(*) INTO new_appliances FROM public.products WHERE sub_category = 'Small Appliances';
  SELECT COUNT(*) INTO new_purifier FROM public.products WHERE sub_category = 'Purifier';
  
  -- Total products
  SELECT COUNT(*) INTO total_products FROM public.products;
  
  RAISE NOTICE '';
  RAISE NOTICE '=== VERIFICATION RESULTS ===';
  RAISE NOTICE '';
  
  -- Check 1: No old values remain
  IF old_values = 0 THEN
    RAISE NOTICE '✓ PASS: No old sub-category values remain';
  ELSE
    RAISE NOTICE '✗ FAIL: % products still have old sub-category values', old_values;
    all_checks_passed := FALSE;
  END IF;
  
  -- Check 2: New values exist
  IF new_wet_dry > 0 THEN
    RAISE NOTICE '✓ PASS: "Wet & Dry" products found: %', new_wet_dry;
  ELSE
    RAISE NOTICE '✗ FAIL: No "Wet & Dry" products found';
    all_checks_passed := FALSE;
  END IF;
  
  IF new_mite > 0 THEN
    RAISE NOTICE '✓ PASS: "Mite Removal" products found: %', new_mite;
  ELSE
    RAISE NOTICE '✗ FAIL: No "Mite Removal" products found';
    all_checks_passed := FALSE;
  END IF;
  
  IF new_appliances > 0 THEN
    RAISE NOTICE '✓ PASS: "Small Appliances" products found: %', new_appliances;
  ELSE
    RAISE NOTICE '✗ FAIL: No "Small Appliances" products found';
    all_checks_passed := FALSE;
  END IF;
  
  IF new_purifier > 0 THEN
    RAISE NOTICE '✓ PASS: "Purifier" products found: %', new_purifier;
  ELSE
    RAISE NOTICE '✗ FAIL: No "Purifier" products found';
    all_checks_passed := FALSE;
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE 'Total products in database: %', total_products;
  RAISE NOTICE '';
  
  -- Final result
  IF all_checks_passed THEN
    RAISE NOTICE '=== ✓ ALL CHECKS PASSED ===';
    RAISE NOTICE 'Migration completed successfully!';
  ELSE
    RAISE NOTICE '=== ✗ SOME CHECKS FAILED ===';
    RAISE NOTICE 'Please review the failures above';
  END IF;
  
  RAISE NOTICE '';
END $$;

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'END POST-MIGRATION VERIFICATION';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE '';
END $$;
