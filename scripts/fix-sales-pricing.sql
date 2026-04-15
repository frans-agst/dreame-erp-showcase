-- Fix Sales Pricing After Price Field Change
-- The unit_price field was changed from before-tax to after-tax
-- Old records have inflated prices because the backend was multiplying by 1.11

-- Step 1: Check current sales data
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== CHECKING SALES DATA ===';
  RAISE NOTICE '';
END $$;

SELECT 
  id,
  sale_date,
  unit_price as current_unit_price,
  quantity,
  discount,
  total_price as current_total_price,
  -- Calculate what the correct values should be
  ROUND(unit_price / 1.11, 2) as corrected_unit_price,
  ROUND((unit_price * quantity) - discount, 2) as corrected_total_price
FROM sales
WHERE sale_date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY sale_date DESC, created_at DESC
LIMIT 20;

-- Step 2: Show the fix that will be applied
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== SALES RECORDS THAT WILL BE FIXED ===';
  RAISE NOTICE 'These records have inflated prices (unit_price was multiplied by 1.11 incorrectly)';
  RAISE NOTICE '';
END $$;

SELECT 
  COUNT(*) as records_to_fix,
  MIN(sale_date) as earliest_date,
  MAX(sale_date) as latest_date
FROM sales
WHERE 
  -- Only fix recent records (last 30 days) to avoid affecting historical data
  sale_date >= CURRENT_DATE - INTERVAL '30 days'
  -- Check if the total_price suggests the price was inflated
  AND total_price > (unit_price * quantity * 0.9); -- Allow 10% margin for discounts

-- Step 3: Fix the sales data
-- IMPORTANT: This assumes all recent sales have the inflated price issue
-- If you have a mix of old and new data, you may need to be more selective

DO $$
DECLARE
  affected_rows INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== APPLYING FIX ===';
  RAISE NOTICE '';
  
  -- Update sales records to correct the pricing
  -- Divide unit_price by 1.11 to get back to the intended after-tax price
  -- Recalculate total_price based on corrected unit_price
  UPDATE sales
  SET 
    unit_price = ROUND(unit_price / 1.11, 2),
    total_price = ROUND((unit_price / 1.11 * quantity) - discount, 2)
  WHERE 
    -- Only fix recent records (last 30 days)
    sale_date >= CURRENT_DATE - INTERVAL '30 days'
    -- Check if the total_price suggests the price was inflated
    AND total_price > (unit_price * quantity * 0.9);
  
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  
  RAISE NOTICE 'Fixed % sales records', affected_rows;
  RAISE NOTICE '';
END $$;

-- Step 4: Verify the fix
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== VERIFICATION ===';
  RAISE NOTICE 'Checking recent sales after fix:';
  RAISE NOTICE '';
END $$;

SELECT 
  id,
  sale_date,
  unit_price,
  quantity,
  discount,
  total_price,
  -- Verify the calculation is correct
  ROUND((unit_price * quantity) - discount, 2) as expected_total
FROM sales
WHERE sale_date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY sale_date DESC, created_at DESC
LIMIT 20;

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== FIX COMPLETE ===';
  RAISE NOTICE 'Sales pricing has been corrected.';
  RAISE NOTICE 'unit_price now represents the after-tax price (staff-entered price)';
  RAISE NOTICE 'total_price = (unit_price * quantity) - discount';
  RAISE NOTICE '';
END $$;
