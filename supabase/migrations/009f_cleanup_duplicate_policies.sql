-- Cleanup duplicate and conflicting RLS policies
-- This migration removes old policies that conflict with the new multi-store policies

-- ============================================
-- 1. CLEANUP SALES TABLE POLICIES
-- ============================================

-- Drop old/duplicate policies that might conflict
DROP POLICY IF EXISTS "Staff can create sales for own store" ON public.sales;
DROP POLICY IF EXISTS "Staff can view sales from own store" ON public.sales;
DROP POLICY IF EXISTS "Admin and manager can view all sales" ON public.sales;
DROP POLICY IF EXISTS "Admin and manager can update sales" ON public.sales;
DROP POLICY IF EXISTS "Admin can delete sales" ON public.sales;

-- Verify only the new multi-store policies remain
-- Expected policies: sales_select, sales_insert, sales_update, sales_delete

-- ============================================
-- 2. CLEANUP INVENTORY TABLE POLICIES
-- ============================================

-- Drop old/duplicate policies
DROP POLICY IF EXISTS "Staff can view inventory from own store" ON public.inventory;
DROP POLICY IF EXISTS "Admin and manager can view all inventory" ON public.inventory;
DROP POLICY IF EXISTS "Admin and manager can manage inventory" ON public.inventory;

-- ============================================
-- 3. CLEANUP STOCK_OPNAME TABLE POLICIES
-- ============================================

-- Drop old/duplicate policies
DROP POLICY IF EXISTS "Staff can view stock opname from own store" ON public.stock_opname;
DROP POLICY IF EXISTS "Staff can create stock opname for own store" ON public.stock_opname;
DROP POLICY IF EXISTS "Admin and manager can view all stock opname" ON public.stock_opname;
DROP POLICY IF EXISTS "Admin and manager can manage stock opname" ON public.stock_opname;

-- ============================================
-- 4. CLEANUP EXPENSES TABLE POLICIES (if any old ones exist)
-- ============================================

DROP POLICY IF EXISTS "Staff can view expenses from own store" ON public.expenses;
DROP POLICY IF EXISTS "Staff can create expenses for own store" ON public.expenses;
DROP POLICY IF EXISTS "Admin and manager can view all expenses" ON public.expenses;

-- ============================================
-- 5. VERIFICATION
-- ============================================

-- Check remaining policies on sales table
DO $$
DECLARE
  policy_count INTEGER;
  policy_name TEXT;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename = 'sales';
  
  RAISE NOTICE 'Sales table has % RLS policies', policy_count;
  
  -- List the policies
  FOR policy_name IN 
    SELECT policyname FROM pg_policies WHERE tablename = 'sales' ORDER BY cmd, policyname
  LOOP
    RAISE NOTICE '  - %', policy_name;
  END LOOP;
END $$;

-- ============================================
-- 6. COMMENTS
-- ============================================

COMMENT ON TABLE public.sales IS 'Sales transactions table with multi-store RLS policies';
COMMENT ON TABLE public.inventory IS 'Inventory table with multi-store RLS policies';
COMMENT ON TABLE public.stock_opname IS 'Stock opname table with multi-store RLS policies';
