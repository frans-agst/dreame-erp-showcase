-- QUICK FIX: Update User Role for Sales Achievement Access
-- Run this in your Supabase SQL Editor (Production)

-- ============================================
-- STEP 1: Check Current User
-- ============================================
-- First, let's see who you are and what role you have
SELECT 
  id,
  email,
  role,
  created_at
FROM profiles
WHERE id = auth.uid();

-- ============================================
-- STEP 2: Update Your Role to Admin
-- ============================================
-- Replace 'your-email@example.com' with your actual email
-- This will give you access to see all sales data

UPDATE profiles 
SET role = 'admin' 
WHERE email = 'your-email@example.com';

-- Or if you know your user ID:
-- UPDATE profiles SET role = 'admin' WHERE id = 'your-user-id-here';

-- ============================================
-- STEP 3: Verify the Update
-- ============================================
SELECT 
  id,
  email,
  role,
  updated_at
FROM profiles
WHERE email = 'your-email@example.com';

-- ============================================
-- STEP 4: Test Sales Query
-- ============================================
-- After updating your role, test if you can see sales:
SELECT 
  store_id,
  COUNT(*) as sale_count,
  SUM(total_price) as total_sales
FROM sales
WHERE sale_date >= '2026-03-01'
  AND sale_date <= '2026-03-31'
GROUP BY store_id
ORDER BY total_sales DESC;

-- ============================================
-- NEXT STEPS
-- ============================================
-- 1. After running this script, LOG OUT of your application
-- 2. LOG BACK IN (this refreshes your session token with the new role)
-- 3. Navigate to Sales Achievement page
-- 4. You should now see the sales data

-- ============================================
-- ALTERNATIVE: Update Multiple Admin Users
-- ============================================
-- If you have multiple admin users, update them all:

-- UPDATE profiles 
-- SET role = 'admin' 
-- WHERE email IN (
--   'admin1@example.com',
--   'admin2@example.com',
--   'manager@example.com'
-- );

-- ============================================
-- TROUBLESHOOTING
-- ============================================
-- If you still see Rp 0 after this:
-- 1. Make sure you logged out and back in
-- 2. Check browser console for errors (F12)
-- 3. Run the full diagnostic script: diagnose-sales-achievement.sql
-- 4. Check if sales data actually exists for the selected month
