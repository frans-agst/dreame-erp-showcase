-- ============================================================================
-- Sub-Category Migration Testing Script
-- ============================================================================
-- Purpose: Test the sub-category standardization migration on development database
-- Requirements: 2.6, 5.5
--
-- Instructions:
-- 1. Run this script BEFORE running the migration (017_standardize_subcategory_values.sql)
-- 2. Save the output for comparison
-- 3. Run the migration
-- 4. Run this script AGAIN to verify changes
-- 5. Compare before/after results
--
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'PRE-MIGRATION DATA AUDIT';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE '';
END $$;

-- ============================================================================
-- Query 1: List all distinct sub_category values
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE 'Query 1: All distinct sub_category values in database';
  RAISE NOTICE '----------------------------------------------------------------------';
END $$;

SELECT DISTINCT sub_category 
FROM public.products 
WHERE sub_category IS NOT NULL
ORDER BY sub_category;

DO $$
BEGIN
  RAISE NOTICE '';
END $$;

-- ============================================================================
-- Query 2: Count products per sub_category
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE 'Query 2: Product count per sub_category';
  RAISE NOTICE '----------------------------------------------------------------------';
END $$;

SELECT 
  sub_category,
  COUNT(*) as product_count
FROM public.products
WHERE sub_category IS NOT NULL
GROUP BY sub_category
ORDER BY sub_category;

DO $$
BEGIN
  RAISE NOTICE '';
END $$;

-- ============================================================================
-- Query 3: Total product count (for verification)
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE 'Query 3: Total product count';
  RAISE NOTICE '----------------------------------------------------------------------';
END $$;

SELECT COUNT(*) as total_products FROM public.products;

DO $$
BEGIN
  RAISE NOTICE '';
END $$;

-- ============================================================================
-- Query 4: Identify products that will be affected by migration
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE 'Query 4: Products that will be affected by migration';
  RAISE NOTICE '----------------------------------------------------------------------';
END $$;

SELECT 
  'Wet And Dry Vacuum' as old_value,
  'Wet & Dry' as new_value,
  COUNT(*) as affected_count
FROM public.products 
WHERE sub_category = 'Wet And Dry Vacuum'

UNION ALL

SELECT 
  'Mite Remover' as old_value,
  'Mite Removal' as new_value,
  COUNT(*) as affected_count
FROM public.products 
WHERE sub_category = 'Mite Remover'

UNION ALL

SELECT 
  'Small Appliance' as old_value,
  'Small Appliances' as new_value,
  COUNT(*) as affected_count
FROM public.products 
WHERE sub_category = 'Small Appliance'

UNION ALL

SELECT 
  'Air Purifier' as old_value,
  'Purifier' as new_value,
  COUNT(*) as affected_count
FROM public.products 
WHERE sub_category = 'Air Purifier';

DO $$
BEGIN
  RAISE NOTICE '';
END $$;

-- ============================================================================
-- Query 5: Total affected products
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE 'Query 5: Total products that will be updated';
  RAISE NOTICE '----------------------------------------------------------------------';
END $$;

SELECT COUNT(*) as total_affected_products
FROM public.products 
WHERE sub_category IN ('Wet And Dry Vacuum', 'Mite Remover', 'Small Appliance', 'Air Purifier');

DO $$
BEGIN
  RAISE NOTICE '';
END $$;

-- ============================================================================
-- Query 6: Sample products that will be affected (first 5 of each type)
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE 'Query 6: Sample products that will be affected';
  RAISE NOTICE '----------------------------------------------------------------------';
END $$;

(SELECT 
  id,
  sku,
  name,
  sub_category,
  'Will change to: Wet & Dry' as note
FROM public.products 
WHERE sub_category = 'Wet And Dry Vacuum'
LIMIT 5)

UNION ALL

(SELECT 
  id,
  sku,
  name,
  sub_category,
  'Will change to: Mite Removal' as note
FROM public.products 
WHERE sub_category = 'Mite Remover'
LIMIT 5)

UNION ALL

(SELECT 
  id,
  sku,
  name,
  sub_category,
  'Will change to: Small Appliances' as note
FROM public.products 
WHERE sub_category = 'Small Appliance'
LIMIT 5)

UNION ALL

(SELECT 
  id,
  sku,
  name,
  sub_category,
  'Will change to: Purifier' as note
FROM public.products 
WHERE sub_category = 'Air Purifier'
LIMIT 5);

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'END PRE-MIGRATION AUDIT';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'NEXT STEPS:';
  RAISE NOTICE '1. Save this output for comparison';
  RAISE NOTICE '2. Run migration: 017_standardize_subcategory_values.sql';
  RAISE NOTICE '3. Run this script again to verify changes';
  RAISE NOTICE '';
END $$;
