-- ============================================================================
-- Fix Product Pricing Script
-- ============================================================================
-- Purpose: Ensure all products have channel_pricing with brandstore price
-- This fixes the issue where prices don't show on sales input page
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'FIX PRODUCT PRICING';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE '';
END $$;

-- ============================================================================
-- Step 1: Check current state
-- ============================================================================
DO $$
DECLARE
  total_products INTEGER;
  null_pricing INTEGER;
  missing_brandstore INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_products FROM public.products;
  SELECT COUNT(*) INTO null_pricing FROM public.products WHERE channel_pricing IS NULL;
  SELECT COUNT(*) INTO missing_brandstore 
  FROM public.products 
  WHERE channel_pricing IS NOT NULL AND (channel_pricing->>'brandstore') IS NULL;
  
  RAISE NOTICE 'Current State:';
  RAISE NOTICE '  Total products: %', total_products;
  RAISE NOTICE '  Products with NULL channel_pricing: %', null_pricing;
  RAISE NOTICE '  Products missing brandstore key: %', missing_brandstore;
  RAISE NOTICE '';
END $$;

-- ============================================================================
-- Step 2: Fix products with NULL channel_pricing
-- Use price_retail as fallback for brandstore price
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE 'Step 2: Fixing products with NULL channel_pricing...';
END $$;

UPDATE public.products
SET channel_pricing = jsonb_build_object(
  'brandstore', COALESCE(price_retail, 0),
  'retailer', COALESCE(price_retail, 0),
  'modern_channel_1', COALESCE(price_retail, 0),
  'modern_channel_2', COALESCE(price_retail, 0),
  'modern_channel_3', COALESCE(price_retail, 0)
),
updated_at = NOW()
WHERE channel_pricing IS NULL;

DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO updated_count 
  FROM public.products 
  WHERE channel_pricing IS NOT NULL;
  
  RAISE NOTICE '  Updated products with NULL channel_pricing';
  RAISE NOTICE '  Products now with channel_pricing: %', updated_count;
  RAISE NOTICE '';
END $$;

-- ============================================================================
-- Step 3: Fix products missing brandstore key in channel_pricing
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE 'Step 3: Fixing products missing brandstore key...';
END $$;

UPDATE public.products
SET channel_pricing = jsonb_set(
  channel_pricing,
  '{brandstore}',
  to_jsonb(COALESCE(price_retail, 0))
),
updated_at = NOW()
WHERE channel_pricing IS NOT NULL
  AND (channel_pricing->>'brandstore') IS NULL;

DO $$
DECLARE
  has_brandstore INTEGER;
BEGIN
  SELECT COUNT(*) INTO has_brandstore 
  FROM public.products 
  WHERE (channel_pricing->>'brandstore') IS NOT NULL;
  
  RAISE NOTICE '  Updated products missing brandstore key';
  RAISE NOTICE '  Products now with brandstore price: %', has_brandstore;
  RAISE NOTICE '';
END $$;

-- ============================================================================
-- Step 4: Fix products with brandstore = 0 (use price_retail as fallback)
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE 'Step 4: Fixing products with brandstore price = 0...';
END $$;

UPDATE public.products
SET channel_pricing = jsonb_set(
  channel_pricing,
  '{brandstore}',
  to_jsonb(COALESCE(price_retail, 0))
),
updated_at = NOW()
WHERE channel_pricing IS NOT NULL
  AND (channel_pricing->>'brandstore')::numeric = 0
  AND price_retail > 0;

DO $$
DECLARE
  valid_brandstore INTEGER;
BEGIN
  SELECT COUNT(*) INTO valid_brandstore 
  FROM public.products 
  WHERE (channel_pricing->>'brandstore')::numeric > 0;
  
  RAISE NOTICE '  Updated products with brandstore = 0';
  RAISE NOTICE '  Products now with valid brandstore price (> 0): %', valid_brandstore;
  RAISE NOTICE '';
END $$;

-- ============================================================================
-- Step 5: Verify all products now have brandstore pricing
-- ============================================================================
DO $$
DECLARE
  total_products INTEGER;
  has_brandstore INTEGER;
  valid_brandstore INTEGER;
  still_missing INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_products FROM public.products;
  SELECT COUNT(*) INTO has_brandstore 
  FROM public.products 
  WHERE (channel_pricing->>'brandstore') IS NOT NULL;
  SELECT COUNT(*) INTO valid_brandstore 
  FROM public.products 
  WHERE (channel_pricing->>'brandstore')::numeric > 0;
  SELECT COUNT(*) INTO still_missing 
  FROM public.products 
  WHERE channel_pricing IS NULL OR (channel_pricing->>'brandstore') IS NULL;
  
  RAISE NOTICE '';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'FINAL STATE:';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE '  Total products: %', total_products;
  RAISE NOTICE '  Products with brandstore key: %', has_brandstore;
  RAISE NOTICE '  Products with valid brandstore price (> 0): %', valid_brandstore;
  RAISE NOTICE '  Products still missing brandstore: %', still_missing;
  RAISE NOTICE '';
  
  IF still_missing > 0 THEN
    RAISE WARNING '  WARNING: % products still missing brandstore pricing!', still_missing;
  ELSE
    RAISE NOTICE '  ✓ SUCCESS: All products now have brandstore pricing';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'END FIX';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE '';
END $$;

-- ============================================================================
-- Step 6: Show sample of fixed products
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE 'Sample of products with brandstore pricing:';
  RAISE NOTICE '----------------------------------------------------------------------';
END $$;

SELECT 
  sku,
  name,
  sub_category,
  (channel_pricing->>'brandstore')::numeric as brandstore_price,
  price_retail
FROM public.products
WHERE (channel_pricing->>'brandstore')::numeric > 0
ORDER BY name
LIMIT 10;
