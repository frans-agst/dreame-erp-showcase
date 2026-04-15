-- Dreame Retail ERP Database Schema
-- This migration creates all tables with proper constraints and RLS enabled

-- ============================================
-- 1. BRANCHES TABLE
-- ============================================
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

-- Enable RLS
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 2. PROFILES TABLE (extends auth.users)
-- ============================================
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

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 3. PRODUCTS TABLE
-- ============================================
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

-- Enable RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;


-- ============================================
-- 4. INVENTORY TABLE (branch-product stock levels)
-- ============================================
CREATE TABLE public.inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(branch_id, product_id)
);

-- Enable RLS
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 5. SALES TABLE
-- ============================================
CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  staff_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  price DECIMAL(15,2) NOT NULL CHECK (price >= 0),
  discount DECIMAL(15,2) DEFAULT 0 CHECK (discount >= 0),
  final_price DECIMAL(15,2) NOT NULL CHECK (final_price >= 0),
  gift TEXT,
  sale_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 6. PURCHASE ORDERS TABLE
-- ============================================
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

-- Enable RLS
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 7. PURCHASE ORDER ITEMS TABLE
-- ============================================
CREATE TABLE public.purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  before_tax DECIMAL(15,2) NOT NULL CHECK (before_tax >= 0),
  after_tax DECIMAL(15,2) NOT NULL CHECK (after_tax >= 0),
  line_total DECIMAL(15,2) NOT NULL CHECK (line_total >= 0)
);

-- Enable RLS
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;


-- ============================================
-- 8. DAY OFF REQUESTS TABLE
-- ============================================
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

-- Enable RLS
ALTER TABLE public.day_off_requests ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 9. STOCK OPNAME TABLE
-- ============================================
CREATE TABLE public.stock_opname (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.stock_opname ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 10. STOCK OPNAME ITEMS TABLE
-- ============================================
CREATE TABLE public.stock_opname_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opname_id UUID NOT NULL REFERENCES public.stock_opname(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  previous_qty INTEGER NOT NULL CHECK (previous_qty >= 0),
  counted_qty INTEGER NOT NULL CHECK (counted_qty >= 0),
  discrepancy INTEGER GENERATED ALWAYS AS (counted_qty - previous_qty) STORED
);

-- Enable RLS
ALTER TABLE public.stock_opname_items ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 11. AUDIT LOG TABLE
-- ============================================
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

-- Enable RLS
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Profiles indexes
CREATE INDEX idx_profiles_role ON public.profiles(role);
CREATE INDEX idx_profiles_branch_id ON public.profiles(branch_id);
CREATE INDEX idx_profiles_is_active ON public.profiles(is_active);

-- Products indexes
CREATE INDEX idx_products_sku ON public.products(sku);
CREATE INDEX idx_products_category ON public.products(category);
CREATE INDEX idx_products_is_active ON public.products(is_active);

-- Inventory indexes
CREATE INDEX idx_inventory_branch_id ON public.inventory(branch_id);
CREATE INDEX idx_inventory_product_id ON public.inventory(product_id);

-- Sales indexes
CREATE INDEX idx_sales_branch_id ON public.sales(branch_id);
CREATE INDEX idx_sales_product_id ON public.sales(product_id);
CREATE INDEX idx_sales_staff_id ON public.sales(staff_id);
CREATE INDEX idx_sales_sale_date ON public.sales(sale_date);

-- Purchase orders indexes
CREATE INDEX idx_purchase_orders_status ON public.purchase_orders(status);
CREATE INDEX idx_purchase_orders_po_date ON public.purchase_orders(po_date);
CREATE INDEX idx_purchase_orders_created_by ON public.purchase_orders(created_by);

-- Day off requests indexes
CREATE INDEX idx_day_off_requests_staff_id ON public.day_off_requests(staff_id);
CREATE INDEX idx_day_off_requests_status ON public.day_off_requests(status);

-- Stock opname indexes
CREATE INDEX idx_stock_opname_branch_id ON public.stock_opname(branch_id);
CREATE INDEX idx_stock_opname_staff_id ON public.stock_opname(staff_id);

-- Audit log indexes
CREATE INDEX idx_audit_log_user_id ON public.audit_log(user_id);
CREATE INDEX idx_audit_log_table_name ON public.audit_log(table_name);
CREATE INDEX idx_audit_log_created_at ON public.audit_log(created_at);

-- ============================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to relevant tables
CREATE TRIGGER set_updated_at_profiles
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_branches
  BEFORE UPDATE ON public.branches
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_products
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_inventory
  BEFORE UPDATE ON public.inventory
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
