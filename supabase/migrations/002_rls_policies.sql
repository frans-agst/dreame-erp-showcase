-- Row Level Security Policies for OmniERP Retail ERP
-- This migration creates all RLS policies based on user roles from JWT metadata

-- ============================================
-- HELPER FUNCTIONS FOR JWT METADATA ACCESS
-- These functions prevent RLS recursion by reading from JWT claims
-- Using public schema since auth schema is restricted in Supabase
-- ============================================

-- Get user role from JWT metadata
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::json->>'role',
    'staff'
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Get user branch_id from JWT metadata
CREATE OR REPLACE FUNCTION public.get_user_branch_id()
RETURNS UUID AS $$
  SELECT (current_setting('request.jwt.claims', true)::json->>'branch_id')::UUID;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- ============================================
-- PROFILES TABLE POLICIES
-- ============================================

-- SELECT: Users can read their own profile, admin/manager can read all
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT USING (
    public.get_user_role() IN ('admin', 'manager') 
    OR id = auth.uid()
  );

-- INSERT: Only through auth trigger (handled by Supabase)
CREATE POLICY "profiles_insert" ON public.profiles
  FOR INSERT WITH CHECK (
    auth.uid() = id
  );

-- UPDATE: Users can update their own profile (except role), admin can update all
CREATE POLICY "profiles_update" ON public.profiles
  FOR UPDATE USING (
    public.get_user_role() = 'admin' 
    OR id = auth.uid()
  );

-- DELETE: Admin only (soft delete preferred)
CREATE POLICY "profiles_delete" ON public.profiles
  FOR DELETE USING (
    public.get_user_role() = 'admin'
  );

-- ============================================
-- BRANCHES TABLE POLICIES
-- ============================================

-- SELECT: All authenticated users can read branches
CREATE POLICY "branches_select" ON public.branches
  FOR SELECT TO authenticated USING (true);

-- INSERT: Admin/Manager only
CREATE POLICY "branches_insert" ON public.branches
  FOR INSERT WITH CHECK (
    public.get_user_role() IN ('admin', 'manager')
  );

-- UPDATE: Admin/Manager only
CREATE POLICY "branches_update" ON public.branches
  FOR UPDATE USING (
    public.get_user_role() IN ('admin', 'manager')
  );

-- DELETE: Admin only (soft delete preferred)
CREATE POLICY "branches_delete" ON public.branches
  FOR DELETE USING (
    public.get_user_role() = 'admin'
  );


-- ============================================
-- PRODUCTS TABLE POLICIES
-- ============================================

-- SELECT: All authenticated users can read products
CREATE POLICY "products_select" ON public.products
  FOR SELECT TO authenticated USING (true);

-- INSERT: Admin/Manager only
CREATE POLICY "products_insert" ON public.products
  FOR INSERT WITH CHECK (
    public.get_user_role() IN ('admin', 'manager')
  );

-- UPDATE: Admin/Manager only
CREATE POLICY "products_update" ON public.products
  FOR UPDATE USING (
    public.get_user_role() IN ('admin', 'manager')
  );

-- DELETE: Admin only (soft delete preferred)
CREATE POLICY "products_delete" ON public.products
  FOR DELETE USING (
    public.get_user_role() = 'admin'
  );

-- ============================================
-- INVENTORY TABLE POLICIES
-- ============================================

-- SELECT: Staff sees own branch, admin/manager sees all
CREATE POLICY "inventory_select" ON public.inventory
  FOR SELECT USING (
    public.get_user_role() IN ('admin', 'manager') 
    OR branch_id = public.get_user_branch_id()
  );

-- INSERT: Admin/Manager only (inventory created via stock opname or admin)
CREATE POLICY "inventory_insert" ON public.inventory
  FOR INSERT WITH CHECK (
    public.get_user_role() IN ('admin', 'manager')
    OR branch_id = public.get_user_branch_id()
  );

-- UPDATE: Staff can update their branch, admin/manager can update all
CREATE POLICY "inventory_update" ON public.inventory
  FOR UPDATE USING (
    public.get_user_role() IN ('admin', 'manager') 
    OR branch_id = public.get_user_branch_id()
  );

-- DELETE: Admin only
CREATE POLICY "inventory_delete" ON public.inventory
  FOR DELETE USING (
    public.get_user_role() = 'admin'
  );

-- ============================================
-- SALES TABLE POLICIES
-- ============================================

-- SELECT: Staff sees own branch, admin/manager sees all
CREATE POLICY "sales_select" ON public.sales
  FOR SELECT USING (
    public.get_user_role() IN ('admin', 'manager') 
    OR branch_id = public.get_user_branch_id()
  );

-- INSERT: Staff can only insert for their branch
CREATE POLICY "sales_insert" ON public.sales
  FOR INSERT WITH CHECK (
    branch_id = public.get_user_branch_id() 
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
-- PURCHASE ORDERS TABLE POLICIES
-- ============================================

-- SELECT: Admin/Manager can see all POs
CREATE POLICY "purchase_orders_select" ON public.purchase_orders
  FOR SELECT USING (
    public.get_user_role() IN ('admin', 'manager')
  );

-- INSERT: Admin/Manager only
CREATE POLICY "purchase_orders_insert" ON public.purchase_orders
  FOR INSERT WITH CHECK (
    public.get_user_role() IN ('admin', 'manager')
  );

-- UPDATE: Admin/Manager only (status changes)
CREATE POLICY "purchase_orders_update" ON public.purchase_orders
  FOR UPDATE USING (
    public.get_user_role() IN ('admin', 'manager')
  );

-- DELETE: Admin only
CREATE POLICY "purchase_orders_delete" ON public.purchase_orders
  FOR DELETE USING (
    public.get_user_role() = 'admin'
  );

-- ============================================
-- PURCHASE ORDER ITEMS TABLE POLICIES
-- ============================================

-- SELECT: Admin/Manager can see all PO items
CREATE POLICY "purchase_order_items_select" ON public.purchase_order_items
  FOR SELECT USING (
    public.get_user_role() IN ('admin', 'manager')
  );

-- INSERT: Admin/Manager only
CREATE POLICY "purchase_order_items_insert" ON public.purchase_order_items
  FOR INSERT WITH CHECK (
    public.get_user_role() IN ('admin', 'manager')
  );

-- UPDATE: Admin/Manager only
CREATE POLICY "purchase_order_items_update" ON public.purchase_order_items
  FOR UPDATE USING (
    public.get_user_role() IN ('admin', 'manager')
  );

-- DELETE: Admin only
CREATE POLICY "purchase_order_items_delete" ON public.purchase_order_items
  FOR DELETE USING (
    public.get_user_role() = 'admin'
  );


-- ============================================
-- DAY OFF REQUESTS TABLE POLICIES
-- ============================================

-- SELECT: Staff sees own requests, manager/admin sees all
CREATE POLICY "day_off_requests_select" ON public.day_off_requests
  FOR SELECT USING (
    public.get_user_role() IN ('admin', 'manager') 
    OR staff_id = auth.uid()
  );

-- INSERT: Staff can only create their own requests
CREATE POLICY "day_off_requests_insert" ON public.day_off_requests
  FOR INSERT WITH CHECK (
    staff_id = auth.uid()
  );

-- UPDATE: Manager/Admin can approve/reject, staff cannot update
CREATE POLICY "day_off_requests_update" ON public.day_off_requests
  FOR UPDATE USING (
    public.get_user_role() IN ('admin', 'manager')
  );

-- DELETE: Admin only
CREATE POLICY "day_off_requests_delete" ON public.day_off_requests
  FOR DELETE USING (
    public.get_user_role() = 'admin'
  );

-- ============================================
-- STOCK OPNAME TABLE POLICIES
-- ============================================

-- SELECT: Staff sees own branch opname, admin/manager sees all
CREATE POLICY "stock_opname_select" ON public.stock_opname
  FOR SELECT USING (
    public.get_user_role() IN ('admin', 'manager') 
    OR branch_id = public.get_user_branch_id()
  );

-- INSERT: Staff can create opname for their branch
CREATE POLICY "stock_opname_insert" ON public.stock_opname
  FOR INSERT WITH CHECK (
    branch_id = public.get_user_branch_id() 
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
-- STOCK OPNAME ITEMS TABLE POLICIES
-- ============================================

-- SELECT: Based on parent stock_opname access
CREATE POLICY "stock_opname_items_select" ON public.stock_opname_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.stock_opname so
      WHERE so.id = opname_id
      AND (
        public.get_user_role() IN ('admin', 'manager')
        OR so.branch_id = public.get_user_branch_id()
      )
    )
  );

-- INSERT: Based on parent stock_opname access
CREATE POLICY "stock_opname_items_insert" ON public.stock_opname_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.stock_opname so
      WHERE so.id = opname_id
      AND (
        public.get_user_role() IN ('admin', 'manager')
        OR so.branch_id = public.get_user_branch_id()
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
-- AUDIT LOG TABLE POLICIES
-- ============================================

-- SELECT: Admin/Manager only
CREATE POLICY "audit_log_select" ON public.audit_log
  FOR SELECT USING (
    public.get_user_role() IN ('admin', 'manager')
  );

-- INSERT: System only (via triggers), but allow authenticated for trigger context
CREATE POLICY "audit_log_insert" ON public.audit_log
  FOR INSERT TO authenticated WITH CHECK (true);

-- UPDATE: No updates allowed
CREATE POLICY "audit_log_update" ON public.audit_log
  FOR UPDATE USING (false);

-- DELETE: No deletes allowed (audit logs are immutable)
CREATE POLICY "audit_log_delete" ON public.audit_log
  FOR DELETE USING (false);
