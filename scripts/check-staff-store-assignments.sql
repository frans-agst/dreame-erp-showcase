-- Check Staff Store Assignments
-- This script helps diagnose why the store selector might not be showing

-- Step 1: Check staff profiles and their store assignments
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== STAFF PROFILES AND STORE ASSIGNMENTS ===';
  RAISE NOTICE '';
END $$;

SELECT 
  p.id,
  p.full_name,
  p.email,
  p.role,
  p.store_id as primary_store_id,
  s.name as primary_store_name,
  (
    SELECT COUNT(*)
    FROM staff_stores ssa
    WHERE ssa.staff_id = p.id
  ) as total_assignments
FROM profiles p
LEFT JOIN stores s ON s.id = p.store_id
WHERE p.role IN ('staff', 'manager')
  AND p.is_active = true
ORDER BY p.full_name;

-- Step 2: Check detailed store assignments
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== DETAILED STORE ASSIGNMENTS ===';
  RAISE NOTICE '';
END $$;

SELECT 
  p.full_name,
  p.email,
  s.name as store_name,
  ssa.is_primary,
  ssa.assigned_at
FROM staff_stores ssa
JOIN profiles p ON p.id = ssa.staff_id
JOIN stores s ON s.id = ssa.store_id
WHERE p.is_active = true
ORDER BY p.full_name, ssa.is_primary DESC, s.name;

-- Step 3: Check auth.users metadata for assigned_store_ids
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== AUTH USER METADATA (assigned_store_ids) ===';
  RAISE NOTICE 'This is what the StoreSelector component reads';
  RAISE NOTICE '';
END $$;

SELECT 
  u.id,
  u.email,
  u.raw_user_meta_data->>'full_name' as full_name,
  u.raw_app_meta_data->>'role' as role,
  u.raw_user_meta_data->>'assigned_store_ids' as assigned_store_ids,
  u.raw_user_meta_data->>'current_store_id' as current_store_id,
  u.raw_user_meta_data->>'primary_store_id' as primary_store_id
FROM auth.users u
WHERE u.raw_app_meta_data->>'role' IN ('staff', 'manager')
ORDER BY u.email;

-- Step 4: Identify staff who should have store selector but might not
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== STAFF WHO SHOULD HAVE STORE SELECTOR ===';
  RAISE NOTICE 'These staff have multiple store assignments';
  RAISE NOTICE '';
END $$;

SELECT 
  p.full_name,
  p.email,
  COUNT(ssa.store_id) as store_count,
  STRING_AGG(s.name, ', ' ORDER BY s.name) as assigned_stores
FROM profiles p
JOIN staff_stores ssa ON ssa.staff_id = p.id
JOIN stores s ON s.id = ssa.store_id
WHERE p.role IN ('staff', 'manager')
  AND p.is_active = true
GROUP BY p.id, p.full_name, p.email
HAVING COUNT(ssa.store_id) > 1
ORDER BY p.full_name;

-- Step 5: Check if metadata sync is needed
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== METADATA SYNC CHECK ===';
  RAISE NOTICE 'Comparing database assignments vs auth metadata';
  RAISE NOTICE '';
END $$;

WITH db_assignments AS (
  SELECT 
    p.id,
    p.email,
    ARRAY_AGG(ssa.store_id ORDER BY ssa.is_primary DESC, s.name) as store_ids
  FROM profiles p
  JOIN staff_stores ssa ON ssa.staff_id = p.id
  JOIN stores s ON s.id = ssa.store_id
  WHERE p.role IN ('staff', 'manager')
    AND p.is_active = true
  GROUP BY p.id, p.email
),
auth_metadata AS (
  SELECT 
    u.id,
    u.email,
    u.raw_user_meta_data->>'assigned_store_ids' as metadata_store_ids
  FROM auth.users u
  WHERE u.raw_app_meta_data->>'role' IN ('staff', 'manager')
)
SELECT 
  db.email,
  db.store_ids::text as db_store_ids,
  am.metadata_store_ids,
  CASE 
    WHEN am.metadata_store_ids IS NULL THEN 'MISSING - Needs sync'
    WHEN db.store_ids::text != am.metadata_store_ids THEN 'MISMATCH - Needs sync'
    ELSE 'OK'
  END as sync_status
FROM db_assignments db
LEFT JOIN auth_metadata am ON am.id = db.id
ORDER BY db.email;

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== DIAGNOSTIC COMPLETE ===';
  RAISE NOTICE '';
  RAISE NOTICE 'If staff have multiple assignments but metadata is MISSING or MISMATCH,';
  RAISE NOTICE 'the middleware should sync it automatically on next page load.';
  RAISE NOTICE 'If it does not sync, check that the middleware is running correctly.';
  RAISE NOTICE '';
  RAISE NOTICE 'To force a sync, the staff member can:';
  RAISE NOTICE '1. Log out and log back in';
  RAISE NOTICE '2. Or wait for the cache to expire (5 minutes)';
  RAISE NOTICE '';
END $$;
