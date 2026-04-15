-- Diagnostic script for Sales Achievement issue
-- Run this in your production Supabase SQL Editor to diagnose the problem

-- ============================================
-- 1. CHECK CURRENT USER AND ROLE
-- ============================================
SELECT 
  auth.uid() as current_user_id,
  auth.email() as current_email,
  p.role as user_role,
  p.store_id as primary_store_id
FROM profiles p
WHERE p.id = auth.uid();

-- ============================================
-- 2. CHECK USER'S ASSIGNED STORES
-- ============================================
SELECT 
  ss.staff_id,
  ss.store_id,
  s.name as store_name,
  ss.is_primary,
  s.is_active
FROM staff_stores ss
JOIN stores s ON ss.store_id = s.id
WHERE ss.staff_id = auth.uid();

-- ============================================
-- 3. TEST get_user_store_ids FUNCTION
-- ============================================
SELECT get_user_store_ids(auth.uid()) as assigned_store_ids;

-- ============================================
-- 4. CHECK SALES DATA FOR MARCH 2026
-- ============================================
-- This query mimics what getSalesAchievement does
SELECT 
  store_id,
  COUNT(*) as sale_count,
  SUM(total_price) as total_sales
FROM sales
WHERE sale_date >= '2026-03-01'
  AND sale_date <= '2026-03-31'
GROUP BY store_id
ORDER BY store_id;

-- ============================================
-- 5. CHECK ALL SALES (ADMIN VIEW)
-- ============================================
-- If you're admin, this should show all sales
SELECT 
  s.id,
  s.sale_date,
  s.store_id,
  st.name as store_name,
  s.total_price,
  s.created_by
FROM sales s
LEFT JOIN stores st ON s.store_id = st.id
WHERE s.sale_date >= '2026-03-01'
  AND s.sale_date <= '2026-03-31'
ORDER BY s.sale_date DESC
LIMIT 20;

-- ============================================
-- 6. CHECK RLS POLICIES ON SALES TABLE
-- ============================================
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'sales';

-- ============================================
-- 7. CHECK IF STORES ARE ACTIVE
-- ============================================
SELECT 
  id,
  name,
  account_id,
  is_active,
  monthly_target
FROM stores
ORDER BY name;

-- ============================================
-- 8. VERIFY SALES TABLE STRUCTURE
-- ============================================
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'sales'
  AND table_schema = 'public'
ORDER BY ordinal_position;
