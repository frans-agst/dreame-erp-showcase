-- Multi-Store Staff Assignment Migration
-- This migration creates the staff_stores junction table and supporting infrastructure
-- for many-to-many relationships between staff and stores

-- ============================================
-- 1. CREATE STAFF_STORES JUNCTION TABLE
-- ============================================

CREATE TABLE public.staff_stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Prevent duplicate assignments
  CONSTRAINT unique_staff_store UNIQUE (staff_id, store_id)
);

-- Enable RLS
ALTER TABLE public.staff_stores ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 2. CREATE INDEXES FOR PERFORMANCE
-- ============================================

-- Index for looking up all stores assigned to a staff member
CREATE INDEX idx_staff_stores_staff_id ON public.staff_stores(staff_id);

-- Index for looking up all staff assigned to a store
CREATE INDEX idx_staff_stores_store_id ON public.staff_stores(store_id);

-- Unique partial index to ensure each staff has exactly one primary store
CREATE UNIQUE INDEX idx_staff_primary_store 
  ON public.staff_stores (staff_id) 
  WHERE is_primary = true;

-- ============================================
-- 3. CREATE HELPER FUNCTION FOR STORE ACCESS
-- ============================================

CREATE OR REPLACE FUNCTION public.get_user_store_ids(user_id UUID)
RETURNS UUID[] AS $$
DECLARE
  user_role TEXT;
  store_ids UUID[];
BEGIN
  -- Get user role
  SELECT role INTO user_role FROM public.profiles WHERE id = user_id;
  
  -- Admin, manager, and dealer see all stores
  IF user_role IN ('admin', 'manager', 'dealer') THEN
    SELECT ARRAY_AGG(id) INTO store_ids FROM public.stores WHERE is_active = true;
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

-- ============================================
-- 4. MIGRATE EXISTING SINGLE-STORE ASSIGNMENTS
-- ============================================

-- Copy existing store assignments from profiles to staff_stores
INSERT INTO public.staff_stores (staff_id, store_id, is_primary, assigned_at)
SELECT 
  id as staff_id,
  store_id,
  true as is_primary,
  created_at as assigned_at
FROM public.profiles
WHERE role = 'staff' 
  AND store_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.staff_stores WHERE staff_id = profiles.id
  );

-- ============================================
-- 5. VERIFY MIGRATION
-- ============================================

-- Verification query to ensure all staff are migrated
DO $$
DECLARE
  missing_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO missing_count
  FROM public.profiles
  WHERE role = 'staff' 
    AND store_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.staff_stores WHERE staff_id = profiles.id
    );
  
  IF missing_count > 0 THEN
    RAISE EXCEPTION 'Migration incomplete: % staff members not migrated', missing_count;
  END IF;
  
  RAISE NOTICE 'Migration verification successful: All staff members migrated';
END $$;

-- ============================================
-- 6. CREATE RLS POLICIES FOR STAFF_STORES
-- ============================================

-- Staff can view their own assignments
CREATE POLICY "staff_view_own_assignments" ON public.staff_stores
  FOR SELECT
  USING (staff_id = auth.uid());

-- Admins can manage all assignments
CREATE POLICY "admin_manage_assignments" ON public.staff_stores
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================
-- 7. COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON TABLE public.staff_stores IS 'Junction table for many-to-many relationship between staff and stores';
COMMENT ON COLUMN public.staff_stores.staff_id IS 'Reference to the staff member (profiles table)';
COMMENT ON COLUMN public.staff_stores.store_id IS 'Reference to the store';
COMMENT ON COLUMN public.staff_stores.is_primary IS 'Indicates if this is the staff member''s primary store (exactly one per staff)';
COMMENT ON COLUMN public.staff_stores.assigned_at IS 'Timestamp when the store was assigned to the staff member';
COMMENT ON FUNCTION public.get_user_store_ids(UUID) IS 'Returns array of store IDs that a user has access to based on role and assignments';
