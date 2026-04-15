-- Diagnostic queries to troubleshoot sales INSERT issues
-- Run these queries to understand why sales records might not be inserting

-- 1. Check if get_user_role function works
SELECT public.get_user_role();

-- 2. Check if get_user_store_ids function works (replace 'your-user-id' with actual UUID)
-- SELECT public.get_user_store_ids('your-user-id');

-- 3. Check RLS policies on sales table
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
WHERE tablename = 'sales'
ORDER BY cmd, policyname;

-- 4. Check if RLS is enabled on sales table
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename = 'sales';

-- 5. Test INSERT permission (this will show if RLS blocks it)
-- Replace values with actual test data
-- INSERT INTO sales (
--   store_id,
--   product_id,
--   staff_id,
--   quantity,
--   price,
--   discount,
--   final_price,
--   sale_date
-- ) VALUES (
--   'store-uuid-here',
--   'product-uuid-here',
--   'staff-uuid-here',
--   1,
--   1000000,
--   0,
--   1000000,
--   CURRENT_DATE
-- );

-- 6. Check if decrement_inventory function exists
SELECT 
  proname as function_name,
  pg_get_functiondef(oid) as function_definition
FROM pg_proc
WHERE proname = 'decrement_inventory';

-- 7. Check current user's role and store assignments
SELECT 
  p.id,
  p.email,
  p.role,
  p.store_id as profile_store_id,
  ARRAY_AGG(ss.store_id) as assigned_store_ids,
  ARRAY_AGG(ss.is_primary) as is_primary_flags
FROM profiles p
LEFT JOIN staff_stores ss ON p.id = ss.staff_id
WHERE p.email = 'your-email@example.com'  -- Replace with your email
GROUP BY p.id, p.email, p.role, p.store_id;

-- 8. Test get_user_store_ids with a specific user
-- SELECT public.get_user_store_ids((SELECT id FROM profiles WHERE email = 'your-email@example.com'));

-- 9. Check if there are any triggers on sales table that might be failing
SELECT 
  tgname as trigger_name,
  tgtype,
  tgenabled,
  pg_get_triggerdef(oid) as trigger_definition
FROM pg_trigger
WHERE tgrelid = 'sales'::regclass;
