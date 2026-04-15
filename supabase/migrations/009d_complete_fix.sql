-- Complete fix for multi-store staff assignment issues
-- This migration fixes:
-- 1. get_user_store_ids function using wrong column (deleted_at -> is_active)
-- 2. Ensures stores table has correct structure

-- ============================================
-- 1. FIX GET_USER_STORE_IDS FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION public.get_user_store_ids(user_id UUID)
RETURNS UUID[] AS $$
DECLARE
  user_role TEXT;
  store_ids UUID[];
BEGIN
  -- Get user role
  SELECT role INTO user_role FROM public.profiles WHERE id = user_id;
  
  -- Admin, manager, and dealer see all active stores
  IF user_role IN ('admin', 'manager', 'dealer') THEN
    SELECT ARRAY_AGG(id) INTO store_ids 
    FROM public.stores 
    WHERE is_active = true;
    RETURN store_ids;
  END IF;
  
  -- Staff: get assigned stores from junction table
  SELECT ARRAY_AGG(store_id) INTO store_ids 
  FROM public.staff_stores 
  WHERE staff_id = user_id;
  
  -- Fallback to profiles.store_id for backward compatibility
  IF store_ids IS NULL OR array_length(store_ids, 1) IS NULL THEN
    SELECT ARRAY[store_id] INTO store_ids 
    FROM public.profiles 
    WHERE id = user_id AND store_id IS NOT NULL;
  END IF;
  
  RETURN COALESCE(store_ids, ARRAY[]::UUID[]);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.get_user_store_ids(UUID) IS 'Returns array of store IDs that a user has access to. Uses is_active column to filter stores.';

-- ============================================
-- 2. VERIFY STORES TABLE STRUCTURE
-- ============================================

-- The stores table should have these columns:
-- - id (UUID)
-- - account_id (UUID)
-- - name (TEXT)
-- - region (TEXT)
-- - monthly_target (DECIMAL)
-- - is_active (BOOLEAN)
-- - created_at (TIMESTAMPTZ)
-- - updated_at (TIMESTAMPTZ)

-- Verify the table exists and has correct structure
DO $$
BEGIN
  -- Check if stores table exists
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'stores') THEN
    RAISE EXCEPTION 'stores table does not exist!';
  END IF;
  
  -- Check if is_active column exists
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'stores' 
    AND column_name = 'is_active'
  ) THEN
    RAISE EXCEPTION 'stores table is missing is_active column!';
  END IF;
  
  RAISE NOTICE 'stores table structure verified successfully';
END $$;

-- ============================================
-- 3. DIAGNOSTIC QUERIES (COMMENTED OUT)
-- ============================================

-- Uncomment these to run diagnostics:

-- Check active stores
-- SELECT id, name, is_active FROM stores WHERE is_active = true;

-- Check staff assignments
-- SELECT ss.staff_id, p.email, ss.store_id, s.name, ss.is_primary
-- FROM staff_stores ss
-- JOIN profiles p ON ss.staff_id = p.id
-- JOIN stores s ON ss.store_id = s.id;

-- Test function with your user ID (replace 'your-user-id')
-- SELECT get_user_store_ids('your-user-id');
