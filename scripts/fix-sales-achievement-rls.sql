-- Fix for Sales Achievement RLS Issue
-- This script ensures that admin/manager/dealer users can see all sales data
-- for the sales achievement report

-- ============================================
-- ISSUE DIAGNOSIS
-- ============================================
-- The getSalesAchievement function queries sales data which is subject to RLS.
-- If the user's role or store assignments aren't properly set, RLS filters out all sales.
-- This causes the achievement report to show Rp 0 for all stores.

-- ============================================
-- SOLUTION 1: Verify RLS Policies
-- ============================================

-- Check current sales SELECT policy
SELECT policyname, qual 
FROM pg_policies 
WHERE tablename = 'sales' AND cmd = 'SELECT';

-- The policy should allow admin/manager/dealer to see ALL sales
-- Current policy from migration 010:
-- CREATE POLICY "sales_select" ON public.sales
--   FOR SELECT USING (
--     public.get_user_role() IN ('admin', 'manager', 'dealer') 
--     OR store_id = ANY(public.get_user_store_ids(auth.uid()))
--   );

-- ============================================
-- SOLUTION 2: Create a Bypass Function for Achievement
-- ============================================

-- Create a function that bypasses RLS for sales achievement calculation
-- This function runs with SECURITY DEFINER, allowing it to see all sales
CREATE OR REPLACE FUNCTION public.get_sales_achievement_data(
  start_date DATE,
  end_date DATE
)
RETURNS TABLE (
  store_id UUID,
  total_sales DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.store_id,
    COALESCE(SUM(s.total_price), 0)::DECIMAL as total_sales
  FROM public.sales s
  WHERE s.sale_date >= start_date
    AND s.sale_date <= end_date
    AND s.store_id IS NOT NULL
  GROUP BY s.store_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.get_sales_achievement_data(DATE, DATE) IS 
  'Returns aggregated sales by store for a date range. Bypasses RLS for achievement calculations.';

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_sales_achievement_data(DATE, DATE) TO authenticated;

-- ============================================
-- SOLUTION 3: Verify get_user_role Function
-- ============================================

-- Ensure get_user_role function works correctly
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
DECLARE
  user_role TEXT;
BEGIN
  -- Get role from profiles table
  SELECT role INTO user_role 
  FROM public.profiles 
  WHERE id = auth.uid();
  
  -- Fallback to auth.jwt() if not in profiles
  IF user_role IS NULL THEN
    user_role := COALESCE(
      auth.jwt()->>'role',
      (auth.jwt()->'user_metadata'->>'role'),
      (auth.jwt()->'app_metadata'->>'role'),
      'staff'
    );
  END IF;
  
  RETURN COALESCE(user_role, 'staff');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.get_user_role() IS 
  'Returns the role of the current user from profiles table or JWT metadata';

-- ============================================
-- SOLUTION 4: Verify User Roles in Production
-- ============================================

-- Check if admin users have correct roles
-- Run this to see all users and their roles:
-- SELECT id, email, role FROM profiles ORDER BY role, email;

-- If admin users don't have 'admin' role, update them:
-- UPDATE profiles SET role = 'admin' WHERE email = 'admin@example.com';

-- ============================================
-- SOLUTION 5: Alternative - Modify RLS Policy
-- ============================================

-- If the above doesn't work, we can modify the RLS policy to be more permissive
-- for the sales_select policy

-- Drop and recreate the sales_select policy with better role checking
DROP POLICY IF EXISTS "sales_select" ON public.sales;

CREATE POLICY "sales_select" ON public.sales
  FOR SELECT USING (
    -- Check role from multiple sources
    (
      -- From profiles table
      EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'manager', 'dealer')
      )
    )
    OR
    -- From JWT metadata
    (
      COALESCE(
        auth.jwt()->>'role',
        auth.jwt()->'user_metadata'->>'role',
        auth.jwt()->'app_metadata'->>'role'
      ) IN ('admin', 'manager', 'dealer')
    )
    OR
    -- Staff can see their assigned stores
    store_id = ANY(public.get_user_store_ids(auth.uid()))
  );

COMMENT ON POLICY "sales_select" ON public.sales IS 
  'Admin/Manager/Dealer see all sales. Staff see sales from assigned stores. Checks role from multiple sources.';

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- After applying the fix, run these queries to verify:

-- 1. Check your role
-- SELECT 
--   auth.uid() as user_id,
--   auth.email() as email,
--   p.role as profile_role,
--   auth.jwt()->>'role' as jwt_role,
--   public.get_user_role() as computed_role
-- FROM profiles p
-- WHERE p.id = auth.uid();

-- 2. Test the new function
-- SELECT * FROM public.get_sales_achievement_data('2026-03-01', '2026-03-31');

-- 3. Test direct sales query
-- SELECT store_id, COUNT(*), SUM(total_price)
-- FROM sales
-- WHERE sale_date >= '2026-03-01' AND sale_date <= '2026-03-31'
-- GROUP BY store_id;

-- ============================================
-- DEPLOYMENT NOTES
-- ============================================

-- After running this script in production:
-- 1. Verify your user role is set correctly in the profiles table
-- 2. Test the sales achievement page
-- 3. If still showing Rp 0, check the browser console for errors
-- 4. Run the diagnostic queries above to identify the issue
