-- Migration: Standardize Sub-Category Values
-- Purpose: Fix data inconsistency where database sub-category values don't match frontend dropdown options
-- This causes filtering to fail on the sales input page
--
-- Changes:
--   "Wet And Dry Vacuum" → "Wet & Dry"
--   "Mite Remover" → "Mite Removal"
--   "Small Appliance" → "Small Appliances"
--   "Air Purifier" → "Purifier"
--
-- Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 5.5

-- ============================================================================
-- PRE-MIGRATION DATA AUDIT
-- ============================================================================
-- This section provides queries to audit the current state before migration
-- Run these queries manually before executing the migration to document the current state

-- Query 1: List all distinct sub_category values
-- Requirement: 5.5
DO $$
BEGIN
  RAISE NOTICE '=== PRE-MIGRATION AUDIT ===';
  RAISE NOTICE 'Distinct sub_category values in database:';
END $$;

SELECT DISTINCT sub_category 
FROM public.products 
WHERE sub_category IS NOT NULL
ORDER BY sub_category;

-- Query 2: Count products per sub_category
-- Requirement: 5.5
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE 'Product count per sub_category:';
END $$;

SELECT 
  sub_category,
  COUNT(*) as product_count
FROM public.products
WHERE sub_category IS NOT NULL
GROUP BY sub_category
ORDER BY sub_category;

-- Query 3: Identify products that will be affected by migration
DO $$
DECLARE
  wet_dry_before INTEGER;
  mite_before INTEGER;
  appliance_before INTEGER;
  purifier_before INTEGER;
  total_affected INTEGER;
BEGIN
  SELECT COUNT(*) INTO wet_dry_before FROM public.products WHERE sub_category = 'Wet And Dry Vacuum';
  SELECT COUNT(*) INTO mite_before FROM public.products WHERE sub_category = 'Mite Remover';
  SELECT COUNT(*) INTO appliance_before FROM public.products WHERE sub_category = 'Small Appliance';
  SELECT COUNT(*) INTO purifier_before FROM public.products WHERE sub_category = 'Air Purifier';
  
  total_affected := wet_dry_before + mite_before + appliance_before + purifier_before;
  
  RAISE NOTICE '';
  RAISE NOTICE 'Products to be updated:';
  RAISE NOTICE '  - "Wet And Dry Vacuum" → "Wet & Dry": % products', wet_dry_before;
  RAISE NOTICE '  - "Mite Remover" → "Mite Removal": % products', mite_before;
  RAISE NOTICE '  - "Small Appliance" → "Small Appliances": % products', appliance_before;
  RAISE NOTICE '  - "Air Purifier" → "Purifier": % products', purifier_before;
  RAISE NOTICE '  - TOTAL products affected: %', total_affected;
  RAISE NOTICE '';
END $$;

-- ============================================================================
-- MIGRATION EXECUTION
-- ============================================================================

-- Begin transaction for atomicity
BEGIN;

-- Update "Wet And Dry Vacuum" to "Wet & Dry"
-- Requirement: 1.2, 2.1
UPDATE public.products
SET sub_category = 'Wet & Dry',
    updated_at = NOW()
WHERE sub_category = 'Wet And Dry Vacuum';

-- Update "Mite Remover" to "Mite Removal"
-- Requirement: 1.3, 2.2
UPDATE public.products
SET sub_category = 'Mite Removal',
    updated_at = NOW()
WHERE sub_category = 'Mite Remover';

-- Update "Small Appliance" to "Small Appliances"
-- Requirement: 1.4, 2.3
UPDATE public.products
SET sub_category = 'Small Appliances',
    updated_at = NOW()
WHERE sub_category = 'Small Appliance';

-- Update "Air Purifier" to "Purifier"
-- Requirement: 1.5, 2.4
UPDATE public.products
SET sub_category = 'Purifier',
    updated_at = NOW()
WHERE sub_category = 'Air Purifier';

-- Commit transaction
COMMIT;

-- ============================================================================
-- POST-MIGRATION LOGGING AND VALIDATION
-- ============================================================================

-- Log results and verify migration success
-- Requirement: 2.6
DO $$
DECLARE
  wet_dry_count INTEGER;
  mite_count INTEGER;
  appliance_count INTEGER;
  purifier_count INTEGER;
  robovac_count INTEGER;
  beauty_count INTEGER;
  stick_count INTEGER;
  steam_count INTEGER;
  others_count INTEGER;
  total_products INTEGER;
  old_values_remaining INTEGER;
BEGIN
  -- Count products with new standardized values
  SELECT COUNT(*) INTO wet_dry_count FROM public.products WHERE sub_category = 'Wet & Dry';
  SELECT COUNT(*) INTO mite_count FROM public.products WHERE sub_category = 'Mite Removal';
  SELECT COUNT(*) INTO appliance_count FROM public.products WHERE sub_category = 'Small Appliances';
  SELECT COUNT(*) INTO purifier_count FROM public.products WHERE sub_category = 'Purifier';
  
  -- Count products with unchanged values (should still exist)
  SELECT COUNT(*) INTO robovac_count FROM public.products WHERE sub_category = 'Robovac';
  SELECT COUNT(*) INTO beauty_count FROM public.products WHERE sub_category = 'Beauty';
  SELECT COUNT(*) INTO stick_count FROM public.products WHERE sub_category = 'Stick Vacuum';
  SELECT COUNT(*) INTO steam_count FROM public.products WHERE sub_category = 'Steam Cleaner';
  SELECT COUNT(*) INTO others_count FROM public.products WHERE sub_category = 'Others';
  
  -- Count total products
  SELECT COUNT(*) INTO total_products FROM public.products;
  
  -- Check if any old values remain (should be 0)
  SELECT COUNT(*) INTO old_values_remaining 
  FROM public.products 
  WHERE sub_category IN ('Wet And Dry Vacuum', 'Mite Remover', 'Small Appliance', 'Air Purifier');
  
  RAISE NOTICE '';
  RAISE NOTICE '=== MIGRATION COMPLETE ===';
  RAISE NOTICE '';
  RAISE NOTICE 'Updated sub-category values:';
  RAISE NOTICE '  - Wet & Dry products: %', wet_dry_count;
  RAISE NOTICE '  - Mite Removal products: %', mite_count;
  RAISE NOTICE '  - Small Appliances products: %', appliance_count;
  RAISE NOTICE '  - Purifier products: %', purifier_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Unchanged sub-category values:';
  RAISE NOTICE '  - Robovac products: %', robovac_count;
  RAISE NOTICE '  - Beauty products: %', beauty_count;
  RAISE NOTICE '  - Stick Vacuum products: %', stick_count;
  RAISE NOTICE '  - Steam Cleaner products: %', steam_count;
  RAISE NOTICE '  - Others products: %', others_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Total products in database: %', total_products;
  RAISE NOTICE '';
  
  -- Validation check
  IF old_values_remaining > 0 THEN
    RAISE WARNING 'WARNING: % products still have old sub-category values!', old_values_remaining;
  ELSE
    RAISE NOTICE '✓ SUCCESS: All old sub-category values have been updated';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '=== END MIGRATION LOG ===';
END $$;

-- ============================================================================
-- POST-MIGRATION VERIFICATION QUERIES
-- ============================================================================
-- Run these queries after migration to verify success

-- Verify no old values remain
SELECT COUNT(*) as old_values_remaining
FROM public.products 
WHERE sub_category IN ('Wet And Dry Vacuum', 'Mite Remover', 'Small Appliance', 'Air Purifier');

-- List all current distinct sub_category values
SELECT DISTINCT sub_category 
FROM public.products 
WHERE sub_category IS NOT NULL
ORDER BY sub_category;
