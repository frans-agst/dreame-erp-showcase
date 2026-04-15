-- ============================================================================
-- Check Product API Data
-- ============================================================================
-- Purpose: Check what data the getProducts API would return
-- This simulates what the frontend receives
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'PRODUCT API DATA CHECK';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'This shows what the getProducts() API returns to the frontend';
  RAISE NOTICE 'For staff users, only channel_pricing.brandstore should be visible as "price"';
  RAISE NOTICE '';
END $$;

-- ============================================================================
-- Show products with their channel_pricing (what API fetches from DB)
-- ============================================================================
SELECT 
  id,
  sku,
  name,
  sub_category,
  is_active,
  price_retail,
  price_buy,
  channel_pricing,
  (channel_pricing->>'brandstore')::numeric as brandstore_price_extracted
FROM public.products
WHERE is_active = true
  AND sub_category = 'Wet & Dry'
ORDER BY name
LIMIT 10;

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE 'Key observations:';
  RAISE NOTICE '1. channel_pricing column should be a JSON object';
  RAISE NOTICE '2. brandstore_price_extracted shows the brandstore price';
  RAISE NOTICE '3. For staff users, the API filters this to show only: {id, sku, name, category, sub_category, price: brandstore_value, is_active}';
  RAISE NOTICE '';
END $$;

-- ============================================================================
-- Check if any products have NULL or missing brandstore pricing
-- ============================================================================
DO $$
DECLARE
  total_active INTEGER;
  missing_brandstore INTEGER;
  zero_brandstore INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_active FROM public.products WHERE is_active = true;
  SELECT COUNT(*) INTO missing_brandstore 
  FROM public.products 
  WHERE is_active = true 
    AND (channel_pricing IS NULL OR (channel_pricing->>'brandstore') IS NULL);
  SELECT COUNT(*) INTO zero_brandstore 
  FROM public.products 
  WHERE is_active = true 
    AND (channel_pricing->>'brandstore')::numeric = 0;
  
  RAISE NOTICE '';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'SUMMARY';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'Total active products: %', total_active;
  RAISE NOTICE 'Products missing brandstore price: %', missing_brandstore;
  RAISE NOTICE 'Products with brandstore price = 0: %', zero_brandstore;
  RAISE NOTICE '';
  
  IF missing_brandstore > 0 OR zero_brandstore > 0 THEN
    RAISE WARNING 'ACTION REQUIRED: Run fix-product-pricing.sql to fix pricing issues';
  ELSE
    RAISE NOTICE '✓ All active products have valid brandstore pricing';
  END IF;
  
  RAISE NOTICE '';
END $$;
