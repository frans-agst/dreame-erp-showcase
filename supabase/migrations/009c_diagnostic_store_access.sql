-- Diagnostic queries to troubleshoot store access issues
-- Run these queries to understand what's happening with store assignments

-- 1. Check if get_user_store_ids function exists and its definition
SELECT 
  proname as function_name,
  pg_get_functiondef(oid) as function_definition
FROM pg_proc
WHERE proname = 'get_user_store_ids';

-- 2. Test get_user_store_ids with your user ID (replace 'your-user-id' with actual UUID)
-- SELECT get_user_store_ids('your-user-id');

-- 3. Check staff_stores table for assignments
SELECT 
  ss.staff_id,
  p.email,
  p.full_name,
  ss.store_id,
  s.name as store_name,
  ss.is_primary
FROM staff_stores ss
JOIN profiles p ON ss.staff_id = p.id
JOIN stores s ON ss.store_id = s.id
ORDER BY p.email, ss.is_primary DESC;

-- 4. Check stores table
SELECT 
  id,
  name,
  is_active,
  created_at
FROM stores
WHERE is_active = true
ORDER BY name;

-- 5. Check profiles table for store_id (legacy field)
SELECT 
  id,
  email,
  full_name,
  role,
  store_id
FROM profiles
WHERE role = 'staff'
ORDER BY email;

-- 6. Check RLS policies on staff_stores
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
WHERE tablename = 'staff_stores';

-- 7. Check RLS policies on stores
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'stores';
