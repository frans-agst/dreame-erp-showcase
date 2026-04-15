-- ============================================================================
-- Product Pricing Diagnostic Script
-- ============================================================================
-- Purpose: Diagnose why prices are not showing on sales input page
-- Check if channel_pricing field has brandstore prices
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'PRODUCT PRICING DIAGNOSTIC';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE '';
END $$;

-- ============================================================================
-- Check 1: Products with NULL channel_pricing
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE 'Check 1: Products with NULL channel_pricing';
  RAISE NOTICE '----------------------------------------------------------------------';
END $$;

SELECT 
  id,
  sku,
  name,
  sub_category,
  channel_pricing
FROM public.products
WHERE channel_pricing IS NULL
ORDER BY name;

DO $$
DECLARE
  null_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO null_count FROM public.products WHERE channel_pricing IS NULL;
  RAISE NOTICE '';
  RAISE NOTICE 'Products with NULL channel_pricing: %', null_count;
  RAISE NOTICE '';
END $$;

-- ============================================================================
-- Check 2: Products with channel_pricing but missing brandstore key
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE 'Check 2: Products with channel_pricing but missing brandstore key';
  RAISE NOTICE '----------------------------------------------------------------------';
END $$;

SELECT 
  id,
  sku,
  name,
  sub_category,
  channel_pricing
FROM public.products
WHERE channel_pricing IS NOT NULL
  AND (channel_pricing->>'brandstore') IS NULL
ORDER BY name;

DO $$
DECLARE
  missing_brandstore INTEGER;
BEGIN
  SELECT COUNT(*) INTO missing_brandstore 
  FROM public.products 
  WHERE channel_pricing IS NOT NULL
    AND (channel_pricing->>'brandstore') IS NULL;
  RAISE NOTICE '';
  RAISE NOTICE 'Products missing brandstore price: %', missing_brandstore;
  RAISE NOTICE '';
END $$;

-- ============================================================================
-- Check 3: Products with brandstore price = 0
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE 'Check 3: Products with brandstore price = 0';
  RAISE NOTICE '----------------------------------------------------------------------';
END $$;

SELECT 
  id,
  sku,
  name,
  sub_category,
  (channel_pricing->>'brandstore')::numeric as brandstore_price
FROM public.products
WHERE channel_pricing IS NOT NULL
  AND (channel_pricing->>'brandstore')::numeric = 0
ORDER BY name;

DO $$
DECLARE
  zero_price INTEGER;
BEGIN
  SELECT COUNT(*) INTO zero_price 
  FROM public.products 
  WHERE channel_pricing IS NOT NULL
    AND (channel_pricing->>'brandstore')::numeric = 0;
  RAISE NOTICE '';
  RAISE NOTICE 'Products with brandstore price = 0: %', zero_price;
  RAISE NOTICE '';
END $$;

-- ============================================================================
-- Check 4: Sample of products with valid brandstore prices
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE 'Check 4: Sample products with valid brandstore prices';
  RAISE NOTICE '----------------------------------------------------------------------';
END $$;

SELECT 
  id,
  sku,
  name,
  sub_category,
  (channel_pricing->>'brandstore')::numeric as brandstore_price,
  channel_pricing
FROM public.products
WHERE channel_pricing IS NOT NULL
  AND (channel_pricing->>'brandstore')::numeric > 0
ORDER BY name
LIMIT 10;

DO $$
DECLARE
  valid_price INTEGER;
BEGIN
  SELECT COUNT(*) INTO valid_price 
  FROM public.products 
  WHERE channel_pricing IS NOT NULL
    AND (channel_pricing->>'brandstore')::numeric > 0;
  RAISE NOTICE '';
  RAISE NOTICE 'Products with valid brandstore price (> 0): %', valid_price;
  RAISE NOTICE '';
END $$;

-- ============================================================================
-- Check 5: Check channel_pricing structure for all products
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE 'Check 5: Channel pricing structure overview';
  RAISE NOTICE '----------------------------------------------------------------------';
END $$;

SELECT 
  COUNT(*) as total_products,
  COUNT(CASE WHEN channel_pricing IS NULL THEN 1 END) as null_pricing,
  COUNT(CASE WHEN channel_pricing IS NOT NULL AND (channel_pricing->>'brandstore') IS NOT NULL THEN 1 END) as has_brandstore,
  COUNT(CASE WHEN channel_pricing IS NOT NULL AND (channel_pricing->>'retailer') IS NOT NULL THEN 1 END) as has_retailer,
  COUNT(CASE WHEN channel_pricing IS NOT NULL AND (channel_pricing->>'modern_channel_1') IS NOT NULL THEN 1 END) as has_modern_1,
  COUNT(CASE WHEN channel_pricing IS NOT NULL AND (channel_pricing->>'modern_channel_2') IS NOT NULL THEN 1 END) as has_modern_2,
  COUNT(CASE WHEN channel_pricing IS NOT NULL AND (channel_pricing->>'modern_channel_3') IS NOT NULL THEN 1 END) as has_modern_3
FROM public.products;

-- ============================================================================
-- Check 6: Products by sub-category with pricing status
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE 'Check 6: Products by sub-category with pricing status';
  RAISE NOTICE '----------------------------------------------------------------------';
END $$;

SELECT 
  sub_category,
  COUNT(*) as total,
  COUNT(CASE WHEN channel_pricing IS NULL THEN 1 END) as null_pricing,
  COUNT(CASE WHEN channel_pricing IS NOT NULL AND (channel_pricing->>'brandstore')::numeric > 0 THEN 1 END) as valid_brandstore
FROM public.products
WHERE sub_category IS NOT NULL
GROUP BY sub_category
ORDER BY sub_category;

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'END DIAGNOSTIC';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE '';
END $$;
