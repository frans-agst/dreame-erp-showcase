-- ============================================
-- DREAME RETAIL ERP - DEVELOPMENT DATABASE SETUP
-- Run this in your NEW Supabase project's SQL Editor
-- ============================================

-- ============================================
-- PART 1: SCHEMA (from 001_initial_schema.sql)
-- ============================================

-- 1. BRANCHES TABLE
CREATE TABLE public.branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  account TEXT,
  province TEXT,
  monthly_target DECIMAL(15,2) DEFAULT 0 CHECK (monthly_target >= 0),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

-- 2. PROFILES TABLE
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'staff')),
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. PRODUCTS TABLE
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  price DECIMAL(15,2) NOT NULL CHECK (price >= 0),
  category TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- 4. INVENTORY TABLE
CREATE TABLE public.inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(branch_id, product_id)
);
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

-- 5. SALES TABLE
CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  staff_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  price DECIMAL(15,2) NOT NULL CHECK (price >= 0),
  discount DECIMAL(15,2) DEFAULT 0 CHECK (discount >= 0),
  final_price DECIMAL(15,2) NOT NULL CHECK (final_price >= 0),
  gift TEXT,
  sale_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

-- 6. PURCHASE ORDERS TABLE
CREATE TABLE public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number TEXT UNIQUE NOT NULL,
  dealer_name TEXT NOT NULL,
  po_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'cancelled')),
  total_before_tax DECIMAL(15,2) NOT NULL CHECK (total_before_tax >= 0),
  total_after_tax DECIMAL(15,2) NOT NULL CHECK (total_after_tax >= 0),
  grand_total DECIMAL(15,2) NOT NULL CHECK (grand_total >= 0),
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

-- 7. PURCHASE ORDER ITEMS TABLE
CREATE TABLE public.purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  before_tax DECIMAL(15,2) NOT NULL CHECK (before_tax >= 0),
  after_tax DECIMAL(15,2) NOT NULL CHECK (after_tax >= 0),
  line_total DECIMAL(15,2) NOT NULL CHECK (line_total >= 0)
);
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;

-- 8. DAY OFF REQUESTS TABLE
CREATE TABLE public.day_off_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);
ALTER TABLE public.day_off_requests ENABLE ROW LEVEL SECURITY;

-- 9. STOCK OPNAME TABLE
CREATE TABLE public.stock_opname (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.stock_opname ENABLE ROW LEVEL SECURITY;

-- 10. STOCK OPNAME ITEMS TABLE
CREATE TABLE public.stock_opname_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opname_id UUID NOT NULL REFERENCES public.stock_opname(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  previous_qty INTEGER NOT NULL CHECK (previous_qty >= 0),
  counted_qty INTEGER NOT NULL CHECK (counted_qty >= 0),
  discrepancy INTEGER GENERATED ALWAYS AS (counted_qty - previous_qty) STORED
);
ALTER TABLE public.stock_opname_items ENABLE ROW LEVEL SECURITY;

-- 11. AUDIT LOG TABLE
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  old_value JSONB,
  new_value JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_profiles_role ON public.profiles(role);
CREATE INDEX idx_profiles_branch_id ON public.profiles(branch_id);
CREATE INDEX idx_profiles_is_active ON public.profiles(is_active);
CREATE INDEX idx_products_sku ON public.products(sku);
CREATE INDEX idx_products_category ON public.products(category);
CREATE INDEX idx_products_is_active ON public.products(is_active);
CREATE INDEX idx_inventory_branch_id ON public.inventory(branch_id);
CREATE INDEX idx_inventory_product_id ON public.inventory(product_id);
CREATE INDEX idx_sales_branch_id ON public.sales(branch_id);
CREATE INDEX idx_sales_product_id ON public.sales(product_id);
CREATE INDEX idx_sales_staff_id ON public.sales(staff_id);
CREATE INDEX idx_sales_sale_date ON public.sales(sale_date);
CREATE INDEX idx_sales_created_by ON public.sales(created_by);
CREATE INDEX idx_purchase_orders_status ON public.purchase_orders(status);
CREATE INDEX idx_purchase_orders_po_date ON public.purchase_orders(po_date);
CREATE INDEX idx_purchase_orders_created_by ON public.purchase_orders(created_by);
CREATE INDEX idx_day_off_requests_staff_id ON public.day_off_requests(staff_id);
CREATE INDEX idx_day_off_requests_status ON public.day_off_requests(status);
CREATE INDEX idx_stock_opname_branch_id ON public.stock_opname(branch_id);
CREATE INDEX idx_stock_opname_staff_id ON public.stock_opname(staff_id);
CREATE INDEX idx_audit_log_user_id ON public.audit_log(user_id);
CREATE INDEX idx_audit_log_table_name ON public.audit_log(table_name);
CREATE INDEX idx_audit_log_created_at ON public.audit_log(created_at);

-- ============================================
-- TRIGGERS
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_profiles BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at_branches BEFORE UPDATE ON public.branches FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at_products BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at_inventory BEFORE UPDATE ON public.inventory FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- ============================================
-- PART 2: RLS POLICIES (from 002_rls_policies.sql)
-- ============================================

-- Helper functions for JWT metadata
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::json->'app_metadata'->>'role',
    'staff'
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_user_branch_id()
RETURNS UUID AS $$
  SELECT (current_setting('request.jwt.claims', true)::json->'app_metadata'->>'branch_id')::UUID;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- PROFILES POLICIES
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (public.get_user_role() IN ('admin', 'manager') OR id = auth.uid());
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE USING (public.get_user_role() = 'admin' OR id = auth.uid());
CREATE POLICY "profiles_delete" ON public.profiles FOR DELETE USING (public.get_user_role() = 'admin');

-- BRANCHES POLICIES
CREATE POLICY "branches_select" ON public.branches FOR SELECT TO authenticated USING (true);
CREATE POLICY "branches_insert" ON public.branches FOR INSERT WITH CHECK (public.get_user_role() IN ('admin', 'manager'));
CREATE POLICY "branches_update" ON public.branches FOR UPDATE USING (public.get_user_role() IN ('admin', 'manager'));
CREATE POLICY "branches_delete" ON public.branches FOR DELETE USING (public.get_user_role() = 'admin');

-- PRODUCTS POLICIES
CREATE POLICY "products_select" ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY "products_insert" ON public.products FOR INSERT WITH CHECK (public.get_user_role() IN ('admin', 'manager'));
CREATE POLICY "products_update" ON public.products FOR UPDATE USING (public.get_user_role() IN ('admin', 'manager'));
CREATE POLICY "products_delete" ON public.products FOR DELETE USING (public.get_user_role() = 'admin');

-- INVENTORY POLICIES
CREATE POLICY "inventory_select" ON public.inventory FOR SELECT USING (public.get_user_role() IN ('admin', 'manager') OR branch_id = public.get_user_branch_id());
CREATE POLICY "inventory_insert" ON public.inventory FOR INSERT WITH CHECK (public.get_user_role() IN ('admin', 'manager') OR branch_id = public.get_user_branch_id());
CREATE POLICY "inventory_update" ON public.inventory FOR UPDATE USING (public.get_user_role() IN ('admin', 'manager') OR branch_id = public.get_user_branch_id());
CREATE POLICY "inventory_delete" ON public.inventory FOR DELETE USING (public.get_user_role() = 'admin');

-- SALES POLICIES
CREATE POLICY "sales_select" ON public.sales FOR SELECT USING (public.get_user_role() IN ('admin', 'manager') OR branch_id = public.get_user_branch_id());
CREATE POLICY "sales_insert" ON public.sales FOR INSERT WITH CHECK (branch_id = public.get_user_branch_id() OR public.get_user_role() IN ('admin', 'manager'));
CREATE POLICY "sales_update" ON public.sales FOR UPDATE USING (public.get_user_role() IN ('admin', 'manager'));
CREATE POLICY "sales_delete" ON public.sales FOR DELETE USING (public.get_user_role() = 'admin');

-- PURCHASE ORDERS POLICIES
CREATE POLICY "purchase_orders_select" ON public.purchase_orders FOR SELECT USING (public.get_user_role() IN ('admin', 'manager'));
CREATE POLICY "purchase_orders_insert" ON public.purchase_orders FOR INSERT WITH CHECK (public.get_user_role() IN ('admin', 'manager'));
CREATE POLICY "purchase_orders_update" ON public.purchase_orders FOR UPDATE USING (public.get_user_role() IN ('admin', 'manager'));
CREATE POLICY "purchase_orders_delete" ON public.purchase_orders FOR DELETE USING (public.get_user_role() = 'admin');

-- PURCHASE ORDER ITEMS POLICIES
CREATE POLICY "purchase_order_items_select" ON public.purchase_order_items FOR SELECT USING (public.get_user_role() IN ('admin', 'manager'));
CREATE POLICY "purchase_order_items_insert" ON public.purchase_order_items FOR INSERT WITH CHECK (public.get_user_role() IN ('admin', 'manager'));
CREATE POLICY "purchase_order_items_update" ON public.purchase_order_items FOR UPDATE USING (public.get_user_role() IN ('admin', 'manager'));
CREATE POLICY "purchase_order_items_delete" ON public.purchase_order_items FOR DELETE USING (public.get_user_role() = 'admin');

-- DAY OFF REQUESTS POLICIES
CREATE POLICY "day_off_requests_select" ON public.day_off_requests FOR SELECT USING (public.get_user_role() IN ('admin', 'manager') OR staff_id = auth.uid());
CREATE POLICY "day_off_requests_insert" ON public.day_off_requests FOR INSERT WITH CHECK (staff_id = auth.uid());
CREATE POLICY "day_off_requests_update" ON public.day_off_requests FOR UPDATE USING (public.get_user_role() IN ('admin', 'manager'));
CREATE POLICY "day_off_requests_delete" ON public.day_off_requests FOR DELETE USING (public.get_user_role() = 'admin');

-- STOCK OPNAME POLICIES
CREATE POLICY "stock_opname_select" ON public.stock_opname FOR SELECT USING (public.get_user_role() IN ('admin', 'manager') OR branch_id = public.get_user_branch_id());
CREATE POLICY "stock_opname_insert" ON public.stock_opname FOR INSERT WITH CHECK (branch_id = public.get_user_branch_id() OR public.get_user_role() IN ('admin', 'manager'));
CREATE POLICY "stock_opname_update" ON public.stock_opname FOR UPDATE USING (public.get_user_role() IN ('admin', 'manager'));
CREATE POLICY "stock_opname_delete" ON public.stock_opname FOR DELETE USING (public.get_user_role() = 'admin');

-- STOCK OPNAME ITEMS POLICIES
CREATE POLICY "stock_opname_items_select" ON public.stock_opname_items FOR SELECT USING (EXISTS (SELECT 1 FROM public.stock_opname so WHERE so.id = opname_id AND (public.get_user_role() IN ('admin', 'manager') OR so.branch_id = public.get_user_branch_id())));
CREATE POLICY "stock_opname_items_insert" ON public.stock_opname_items FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.stock_opname so WHERE so.id = opname_id AND (public.get_user_role() IN ('admin', 'manager') OR so.branch_id = public.get_user_branch_id())));
CREATE POLICY "stock_opname_items_update" ON public.stock_opname_items FOR UPDATE USING (public.get_user_role() IN ('admin', 'manager'));
CREATE POLICY "stock_opname_items_delete" ON public.stock_opname_items FOR DELETE USING (public.get_user_role() = 'admin');

-- AUDIT LOG POLICIES
CREATE POLICY "audit_log_select" ON public.audit_log FOR SELECT USING (public.get_user_role() IN ('admin', 'manager'));
CREATE POLICY "audit_log_insert" ON public.audit_log FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "audit_log_update" ON public.audit_log FOR UPDATE USING (false);
CREATE POLICY "audit_log_delete" ON public.audit_log FOR DELETE USING (false);

-- ============================================
-- PART 3: SAMPLE DATA FOR DEVELOPMENT
-- ============================================

-- Sample branches
INSERT INTO public.branches (name, account, province, monthly_target) VALUES
  ('Jakarta Pusat', 'JKT-001', 'DKI Jakarta', 100000000),
  ('Bandung', 'BDG-001', 'Jawa Barat', 75000000),
  ('Surabaya', 'SBY-001', 'Jawa Timur', 80000000);

-- Sample products
INSERT INTO public.products (sku, name, price, category) VALUES
  ('DRM-V10', 'Dreame V10', 2500000, 'Vacuum'),
  ('DRM-V11', 'Dreame V11', 3500000, 'Vacuum'),
  ('DRM-V12', 'Dreame V12', 4500000, 'Vacuum'),
  ('DRM-L10P', 'Dreame L10 Pro', 5500000, 'Robot'),
  ('DRM-L20U', 'Dreame L20 Ultra', 12000000, 'Robot'),
  ('DRM-H12', 'Dreame H12', 4000000, 'Wet & Dry'),
  ('DRM-H13', 'Dreame H13 Pro', 6000000, 'Wet & Dry');

-- ============================================
-- DONE! Now create a test user:
-- 1. Go to Authentication > Users
-- 2. Click "Add user" 
-- 3. Create user with email/password
-- 4. Then run this SQL to set up their profile and role:
-- ============================================

-- AFTER creating a user in Auth, run this (replace the UUID and email):
-- INSERT INTO public.profiles (id, email, full_name, role, branch_id)
-- SELECT 
--   'YOUR-USER-UUID-HERE',
--   'your-email@example.com',
--   'Admin User',
--   'admin',
--   (SELECT id FROM public.branches WHERE name = 'Jakarta Pusat');

-- Then set their role in app_metadata:
-- UPDATE auth.users 
-- SET raw_app_meta_data = jsonb_set(
--   COALESCE(raw_app_meta_data, '{}'::jsonb),
--   '{role}',
--   '"admin"'
-- )
-- WHERE id = 'YOUR-USER-UUID-HERE';
