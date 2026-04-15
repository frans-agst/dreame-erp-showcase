-- ============================================
-- DREAME RETAIL ERP V2.0 - DATA MIGRATION SCRIPT
-- Migration: Branches to Stores, Price columns, References
-- Date: 2026-01-30
-- 
-- This script migrates existing data from v1 schema to v2 schema:
-- 1. Migrates branches to stores with default account
-- 2. Updates all branch_id references to store_id
-- 3. Migrates price to price_retail
-- 4. Sets default price_buy values
-- ============================================

-- ============================================
-- PART 1: CREATE DEFAULT ACCOUNT FOR EXISTING BRANCHES
-- ============================================

-- Create a default "Legacy" account for migrating existing branches
INSERT INTO public.accounts (name, channel_type, is_active)
VALUES ('Legacy Branches', 'Retailer', true)
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- PART 2: MIGRATE BRANCHES TO STORES
-- ============================================

-- Insert existing branches as stores under the Legacy account
INSERT INTO public.stores (id, account_id, name, region, monthly_target, is_active, created_at, updated_at)
SELECT 
  b.id,  -- Keep the same ID for FK references
  (SELECT id FROM public.accounts WHERE name = 'Legacy Branches'),
  b.name,
  COALESCE(b.province, b.account) as region,  -- Use province or account as region
  b.monthly_target,
  b.is_active,
  b.created_at,
  b.updated_at
FROM public.branches b
WHERE NOT EXISTS (
  SELECT 1 FROM public.stores s WHERE s.id = b.id
)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- PART 3: UPDATE PROFILES - branch_id to store_id
-- ============================================

-- Update profiles to use store_id instead of branch_id
UPDATE public.profiles p
SET store_id = p.branch_id
WHERE p.branch_id IS NOT NULL 
  AND p.store_id IS NULL
  AND EXISTS (SELECT 1 FROM public.stores s WHERE s.id = p.branch_id);

-- ============================================
-- PART 4: UPDATE SALES - branch_id to store_id
-- ============================================

-- Update sales to use store_id instead of branch_id
UPDATE public.sales s
SET store_id = s.branch_id
WHERE s.branch_id IS NOT NULL 
  AND s.store_id IS NULL
  AND EXISTS (SELECT 1 FROM public.stores st WHERE st.id = s.branch_id);

-- ============================================
-- PART 5: UPDATE INVENTORY - branch_id to store_id
-- ============================================

-- Update inventory to use store_id instead of branch_id
UPDATE public.inventory i
SET store_id = i.branch_id
WHERE i.branch_id IS NOT NULL 
  AND i.store_id IS NULL
  AND EXISTS (SELECT 1 FROM public.stores s WHERE s.id = i.branch_id);

-- ============================================
-- PART 6: UPDATE STOCK OPNAME - branch_id to store_id
-- ============================================

-- Check if stock_opname has BOTH branch_id and store_id columns before updating
DO $$
DECLARE
  has_branch_id BOOLEAN;
  has_store_id BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'stock_opname' AND column_name = 'branch_id'
  ) INTO has_branch_id;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'stock_opname' AND column_name = 'store_id'
  ) INTO has_store_id;
  
  -- Only run migration if both columns exist (v1 to v2 migration scenario)
  IF has_branch_id AND has_store_id THEN
    EXECUTE '
      UPDATE public.stock_opname so
      SET store_id = so.branch_id
      WHERE so.branch_id IS NOT NULL 
        AND (so.store_id IS NULL OR so.store_id != so.branch_id)
        AND EXISTS (SELECT 1 FROM public.stores s WHERE s.id = so.branch_id)
    ';
    RAISE NOTICE 'Stock opname: migrated branch_id to store_id';
  ELSIF has_store_id AND NOT has_branch_id THEN
    RAISE NOTICE 'Stock opname: already using store_id (v2 schema), no migration needed';
  ELSE
    RAISE NOTICE 'Stock opname: table structure not recognized, skipping';
  END IF;
END $$;

-- ============================================
-- PART 7: UPDATE PURCHASE ORDERS - Add account_id
-- ============================================

-- For existing POs without account_id, assign to Legacy account
UPDATE public.purchase_orders po
SET account_id = (SELECT id FROM public.accounts WHERE name = 'Legacy Branches')
WHERE po.account_id IS NULL;

-- ============================================
-- PART 8: MIGRATE PRODUCT PRICES
-- ============================================

-- If price column exists and price_retail doesn't have data, migrate
DO $$
BEGIN
  -- Check if old 'price' column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'price'
  ) THEN
    -- Update price_retail from price where price_retail is 0 or NULL
    EXECUTE '
      UPDATE public.products 
      SET price_retail = price 
      WHERE (price_retail IS NULL OR price_retail = 0) 
        AND price IS NOT NULL AND price > 0
    ';
  END IF;
END $$;

-- Set default price_buy as 70% of price_retail where not set
UPDATE public.products 
SET price_buy = ROUND(price_retail * 0.70, 2)
WHERE (price_buy IS NULL OR price_buy = 0) 
  AND price_retail IS NOT NULL AND price_retail > 0;

-- Set default channel_pricing based on price_retail
UPDATE public.products 
SET channel_pricing = jsonb_build_object(
  'hartono', ROUND(price_retail * 0.85, 0),
  'ec', ROUND(price_retail * 0.82, 0),
  'best', ROUND(price_retail * 0.83, 0),
  'atria', ROUND(price_retail * 0.84, 0)
)
WHERE (channel_pricing IS NULL OR channel_pricing = '{}')
  AND price_retail IS NOT NULL AND price_retail > 0;

-- ============================================
-- PART 9: UPDATE SALES PRICE COLUMNS
-- ============================================

-- Rename price to unit_price if needed (handled in schema migration)
-- Rename final_price to total_price if needed (handled in schema migration)

-- Ensure unit_price is populated from price if exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sales' AND column_name = 'price'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sales' AND column_name = 'unit_price'
  ) THEN
    EXECUTE '
      UPDATE public.sales 
      SET unit_price = price 
      WHERE (unit_price IS NULL OR unit_price = 0) 
        AND price IS NOT NULL AND price > 0
    ';
  END IF;
END $$;

-- Ensure total_price is populated from final_price if exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sales' AND column_name = 'final_price'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sales' AND column_name = 'total_price'
  ) THEN
    EXECUTE '
      UPDATE public.sales 
      SET total_price = final_price 
      WHERE (total_price IS NULL OR total_price = 0) 
        AND final_price IS NOT NULL AND final_price > 0
    ';
  END IF;
END $$;

-- ============================================
-- PART 10: INITIALIZE GIFT DETAILS
-- ============================================

-- Set empty array for gift_details where NULL
UPDATE public.sales 
SET gift_details = '[]'::jsonb
WHERE gift_details IS NULL;

-- ============================================
-- PART 11: VERIFY MIGRATION
-- ============================================

-- Create a verification function to check migration status
CREATE OR REPLACE FUNCTION verify_data_migration()
RETURNS TABLE (
  check_name TEXT,
  status TEXT,
  details TEXT
) AS $$
BEGIN
  -- Check 1: All branches migrated to stores
  RETURN QUERY
  SELECT 
    'Branches to Stores Migration'::TEXT,
    CASE 
      WHEN (SELECT COUNT(*) FROM public.branches) = 0 
           OR (SELECT COUNT(*) FROM public.branches b WHERE EXISTS (SELECT 1 FROM public.stores s WHERE s.id = b.id)) = (SELECT COUNT(*) FROM public.branches)
      THEN 'PASSED'::TEXT
      ELSE 'FAILED'::TEXT
    END,
    format('Branches: %s, Migrated: %s', 
      (SELECT COUNT(*) FROM public.branches),
      (SELECT COUNT(*) FROM public.branches b WHERE EXISTS (SELECT 1 FROM public.stores s WHERE s.id = b.id))
    )::TEXT;

  -- Check 2: Profiles with store_id
  RETURN QUERY
  SELECT 
    'Profiles store_id Migration'::TEXT,
    CASE 
      WHEN (SELECT COUNT(*) FROM public.profiles WHERE branch_id IS NOT NULL AND store_id IS NULL) = 0
      THEN 'PASSED'::TEXT
      ELSE 'WARNING'::TEXT
    END,
    format('Profiles with branch_id but no store_id: %s', 
      (SELECT COUNT(*) FROM public.profiles WHERE branch_id IS NOT NULL AND store_id IS NULL)
    )::TEXT;

  -- Check 3: Products with pricing
  RETURN QUERY
  SELECT 
    'Products Pricing Migration'::TEXT,
    CASE 
      WHEN (SELECT COUNT(*) FROM public.products WHERE price_retail > 0 AND price_buy > 0) = (SELECT COUNT(*) FROM public.products WHERE is_active = true)
      THEN 'PASSED'::TEXT
      ELSE 'WARNING'::TEXT
    END,
    format('Products with both prices: %s / %s', 
      (SELECT COUNT(*) FROM public.products WHERE price_retail > 0 AND price_buy > 0),
      (SELECT COUNT(*) FROM public.products WHERE is_active = true)
    )::TEXT;

  -- Check 4: Sales with store_id
  RETURN QUERY
  SELECT 
    'Sales store_id Migration'::TEXT,
    CASE 
      WHEN (SELECT COUNT(*) FROM public.sales WHERE branch_id IS NOT NULL AND store_id IS NULL) = 0
      THEN 'PASSED'::TEXT
      ELSE 'WARNING'::TEXT
    END,
    format('Sales with branch_id but no store_id: %s', 
      (SELECT COUNT(*) FROM public.sales WHERE branch_id IS NOT NULL AND store_id IS NULL)
    )::TEXT;

  -- Check 5: Inventory with store_id
  RETURN QUERY
  SELECT 
    'Inventory store_id Migration'::TEXT,
    CASE 
      WHEN (SELECT COUNT(*) FROM public.inventory WHERE branch_id IS NOT NULL AND store_id IS NULL) = 0
      THEN 'PASSED'::TEXT
      ELSE 'WARNING'::TEXT
    END,
    format('Inventory with branch_id but no store_id: %s', 
      (SELECT COUNT(*) FROM public.inventory WHERE branch_id IS NOT NULL AND store_id IS NULL)
    )::TEXT;

  -- Check 6: Fiscal calendar populated
  RETURN QUERY
  SELECT 
    'Fiscal Calendar Data'::TEXT,
    CASE 
      WHEN (SELECT COUNT(*) FROM public.fiscal_calendar WHERE fiscal_year BETWEEN 2024 AND 2026) >= 1095  -- ~3 years of days
      THEN 'PASSED'::TEXT
      ELSE 'WARNING'::TEXT
    END,
    format('Fiscal calendar entries (2024-2026): %s', 
      (SELECT COUNT(*) FROM public.fiscal_calendar WHERE fiscal_year BETWEEN 2024 AND 2026)
    )::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Run verification
SELECT * FROM verify_data_migration();

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- 
-- Post-migration steps:
-- 1. Run: SELECT * FROM verify_data_migration();
-- 2. Review any WARNING status items
-- 3. Update JWT metadata for users with new store_id
-- 4. Test application with new schema
-- ============================================
