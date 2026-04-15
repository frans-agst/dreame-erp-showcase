-- Update RLS Policies for Multi-Store Staff Assignment
-- This migration updates RLS policies to use the get_user_store_ids helper function
-- allowing staff to access data from all their assigned stores

-- ============================================
-- 1. UPDATE SALES TABLE RLS POLICIES
-- ============================================

-- Drop existing single-store policies
DROP POLICY IF EXISTS "sales_select" ON public.sales;
DROP POLICY IF EXISTS "sales_insert" ON public.sales;
DROP POLICY IF EXISTS "sales_update" ON public.sales;
DROP POLICY IF EXISTS "sales_delete" ON public.sales;

-- SELECT: Staff sees sales from assigned stores, admin/manager sees all
CREATE POLICY "sales_select" ON public.sales
  FOR SELECT USING (
    public.get_user_role() IN ('admin', 'manager', 'dealer') 
    OR store_id = ANY(public.get_user_store_ids(auth.uid()))
  );

-- INSERT: Staff can only insert for their assigned stores
CREATE POLICY "sales_insert" ON public.sales
  FOR INSERT WITH CHECK (
    store_id = ANY(public.get_user_store_ids(auth.uid()))
    OR public.get_user_role() IN ('admin', 'manager')
  );

-- UPDATE: Admin/Manager only (corrections)
CREATE POLICY "sales_update" ON public.sales
  FOR UPDATE USING (
    public.get_user_role() IN ('admin', 'manager')
  );

-- DELETE: Admin only
CREATE POLICY "sales_delete" ON public.sales
  FOR DELETE USING (
    public.get_user_role() = 'admin'
  );

-- ============================================
-- 2. UPDATE INVENTORY TABLE RLS POLICIES
-- ============================================

-- Drop existing single-store policies
DROP POLICY IF EXISTS "inventory_select" ON public.inventory;
DROP POLICY IF EXISTS "inventory_insert" ON public.inventory;
DROP POLICY IF EXISTS "inventory_update" ON public.inventory;
DROP POLICY IF EXISTS "inventory_delete" ON public.inventory;

-- SELECT: Staff sees inventory from assigned stores, admin/manager sees all
CREATE POLICY "inventory_select" ON public.inventory
  FOR SELECT USING (
    public.get_user_role() IN ('admin', 'manager', 'dealer') 
    OR store_id = ANY(public.get_user_store_ids(auth.uid()))
  );

-- INSERT: Admin/Manager only (inventory created via stock opname or admin)
CREATE POLICY "inventory_insert" ON public.inventory
  FOR INSERT WITH CHECK (
    public.get_user_role() IN ('admin', 'manager')
    OR store_id = ANY(public.get_user_store_ids(auth.uid()))
  );

-- UPDATE: Staff can update their assigned stores, admin/manager can update all
CREATE POLICY "inventory_update" ON public.inventory
  FOR UPDATE USING (
    public.get_user_role() IN ('admin', 'manager') 
    OR store_id = ANY(public.get_user_store_ids(auth.uid()))
  );

-- DELETE: Admin only
CREATE POLICY "inventory_delete" ON public.inventory
  FOR DELETE USING (
    public.get_user_role() = 'admin'
  );

-- ============================================
-- 3. UPDATE STOCK_OPNAME TABLE RLS POLICIES
-- ============================================

-- Drop existing single-store policies
DROP POLICY IF EXISTS "stock_opname_select" ON public.stock_opname;
DROP POLICY IF EXISTS "stock_opname_insert" ON public.stock_opname;
DROP POLICY IF EXISTS "stock_opname_update" ON public.stock_opname;
DROP POLICY IF EXISTS "stock_opname_delete" ON public.stock_opname;

-- SELECT: Staff sees opname from assigned stores, admin/manager sees all
CREATE POLICY "stock_opname_select" ON public.stock_opname
  FOR SELECT USING (
    public.get_user_role() IN ('admin', 'manager') 
    OR store_id = ANY(public.get_user_store_ids(auth.uid()))
  );

-- INSERT: Staff can create opname for their assigned stores
CREATE POLICY "stock_opname_insert" ON public.stock_opname
  FOR INSERT WITH CHECK (
    store_id = ANY(public.get_user_store_ids(auth.uid()))
    OR public.get_user_role() IN ('admin', 'manager')
  );

-- UPDATE: Admin/Manager only
CREATE POLICY "stock_opname_update" ON public.stock_opname
  FOR UPDATE USING (
    public.get_user_role() IN ('admin', 'manager')
  );

-- DELETE: Admin only
CREATE POLICY "stock_opname_delete" ON public.stock_opname
  FOR DELETE USING (
    public.get_user_role() = 'admin'
  );

-- ============================================
-- 4. UPDATE STOCK_OPNAME_ITEMS TABLE RLS POLICIES
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "stock_opname_items_select" ON public.stock_opname_items;
DROP POLICY IF EXISTS "stock_opname_items_insert" ON public.stock_opname_items;
DROP POLICY IF EXISTS "stock_opname_items_update" ON public.stock_opname_items;
DROP POLICY IF EXISTS "stock_opname_items_delete" ON public.stock_opname_items;

-- SELECT: Based on parent stock_opname access using multi-store logic
CREATE POLICY "stock_opname_items_select" ON public.stock_opname_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.stock_opname so
      WHERE so.id = opname_id
      AND (
        public.get_user_role() IN ('admin', 'manager')
        OR so.store_id = ANY(public.get_user_store_ids(auth.uid()))
      )
    )
  );

-- INSERT: Based on parent stock_opname access using multi-store logic
CREATE POLICY "stock_opname_items_insert" ON public.stock_opname_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.stock_opname so
      WHERE so.id = opname_id
      AND (
        public.get_user_role() IN ('admin', 'manager')
        OR so.store_id = ANY(public.get_user_store_ids(auth.uid()))
      )
    )
  );

-- UPDATE: Admin/Manager only
CREATE POLICY "stock_opname_items_update" ON public.stock_opname_items
  FOR UPDATE USING (
    public.get_user_role() IN ('admin', 'manager')
  );

-- DELETE: Admin only
CREATE POLICY "stock_opname_items_delete" ON public.stock_opname_items
  FOR DELETE USING (
    public.get_user_role() = 'admin'
  );

-- ============================================
-- 5. COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON POLICY "sales_select" ON public.sales IS 
  'Staff can view sales from all their assigned stores, admin/manager see all';

COMMENT ON POLICY "inventory_select" ON public.inventory IS 
  'Staff can view inventory from all their assigned stores, admin/manager see all';

COMMENT ON POLICY "stock_opname_select" ON public.stock_opname IS 
  'Staff can view stock opname from all their assigned stores, admin/manager see all';

COMMENT ON POLICY "stock_opname_items_select" ON public.stock_opname_items IS 
  'Access based on parent stock_opname with multi-store support';

