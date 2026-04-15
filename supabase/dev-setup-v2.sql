-- ============================================
-- DREAME RETAIL ERP V2.0 - COMPLETE DEV SETUP
-- Run this ONCE in your DEV Supabase SQL Editor
-- This creates everything from scratch
-- ============================================

-- ============================================
-- PART 1: HELPER FUNCTIONS
-- ============================================

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Get user role from JWT
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::json->'app_metadata'->>'role',
    'staff'
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Get user store_id from JWT
CREATE OR REPLACE FUNCTION public.get_user_store_id()
RETURNS UUID AS $$
  SELECT (current_setting('request.jwt.claims', true)::json->'app_metadata'->>'store_id')::UUID;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Get user branch_id from JWT (legacy compatibility)
CREATE OR REPLACE FUNCTION public.get_user_branch_id()
RETURNS UUID AS $$
  SELECT (current_setting('request.jwt.claims', true)::json->'app_metadata'->>'branch_id')::UUID;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- ============================================
-- PART 2: ACCOUNTS TABLE (Parent Organization)
-- ============================================
CREATE TABLE public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  channel_type TEXT NOT NULL CHECK (channel_type IN ('Brandstore', 'Modern Channel', 'Retailer', 'Dealer', 'Hangon')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "accounts_select" ON public.accounts FOR SELECT TO authenticated USING (true);
CREATE POLICY "accounts_insert" ON public.accounts FOR INSERT WITH CHECK (public.get_user_role() IN ('admin', 'manager'));
CREATE POLICY "accounts_update" ON public.accounts FOR UPDATE USING (public.get_user_role() IN ('admin', 'manager'));
CREATE POLICY "accounts_delete" ON public.accounts FOR DELETE USING (public.get_user_role() = 'admin');

CREATE TRIGGER set_updated_at_accounts BEFORE UPDATE ON public.accounts FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================
-- PART 3: STORES TABLE
-- ============================================
CREATE TABLE public.stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  region TEXT,
  monthly_target DECIMAL(15,2) DEFAULT 0 CHECK (monthly_target >= 0),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_stores_account_id ON public.stores(account_id);
CREATE INDEX idx_stores_is_active ON public.stores(is_active);

CREATE POLICY "stores_select" ON public.stores FOR SELECT TO authenticated USING (true);
CREATE POLICY "stores_insert" ON public.stores FOR INSERT WITH CHECK (public.get_user_role() IN ('admin', 'manager'));
CREATE POLICY "stores_update" ON public.stores FOR UPDATE USING (public.get_user_role() IN ('admin', 'manager'));
CREATE POLICY "stores_delete" ON public.stores FOR DELETE USING (public.get_user_role() = 'admin');

CREATE TRIGGER set_updated_at_stores BEFORE UPDATE ON public.stores FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- ============================================
-- PART 4: PROFILES TABLE
-- ============================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'staff', 'dealer')),
  store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_profiles_role ON public.profiles(role);
CREATE INDEX idx_profiles_store_id ON public.profiles(store_id);
CREATE INDEX idx_profiles_is_active ON public.profiles(is_active);

CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (public.get_user_role() IN ('admin', 'manager') OR id = auth.uid());
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE USING (public.get_user_role() = 'admin' OR id = auth.uid());
CREATE POLICY "profiles_delete" ON public.profiles FOR DELETE USING (public.get_user_role() = 'admin');

CREATE TRIGGER set_updated_at_profiles BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================
-- PART 5: PRODUCTS TABLE (Dynamic Pricing)
-- ============================================
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT,
  sub_category TEXT,
  price_retail DECIMAL(15,2) NOT NULL CHECK (price_retail >= 0),
  price_buy DECIMAL(15,2) NOT NULL CHECK (price_buy >= 0),
  channel_pricing JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_products_sku ON public.products(sku);
CREATE INDEX idx_products_category ON public.products(category);
CREATE INDEX idx_products_is_active ON public.products(is_active);

CREATE POLICY "products_select" ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY "products_insert" ON public.products FOR INSERT WITH CHECK (public.get_user_role() IN ('admin', 'manager'));
CREATE POLICY "products_update" ON public.products FOR UPDATE USING (public.get_user_role() IN ('admin', 'manager'));
CREATE POLICY "products_delete" ON public.products FOR DELETE USING (public.get_user_role() = 'admin');

CREATE TRIGGER set_updated_at_products BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================
-- PART 6: FISCAL CALENDAR TABLE
-- ============================================
CREATE TABLE public.fiscal_calendar (
  date DATE PRIMARY KEY,
  day_name TEXT NOT NULL,
  fiscal_week INTEGER NOT NULL CHECK (fiscal_week BETWEEN 1 AND 53),
  fiscal_month INTEGER NOT NULL CHECK (fiscal_month BETWEEN 1 AND 12),
  fiscal_year INTEGER NOT NULL,
  quarter INTEGER NOT NULL CHECK (quarter BETWEEN 1 AND 4)
);

CREATE INDEX idx_fiscal_calendar_week ON public.fiscal_calendar(fiscal_year, fiscal_week);
CREATE INDEX idx_fiscal_calendar_month ON public.fiscal_calendar(fiscal_year, fiscal_month);

-- ============================================
-- PART 7: INVENTORY TABLE
-- ============================================
CREATE TABLE public.inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  display_qty INTEGER DEFAULT 0 CHECK (display_qty >= 0),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id, product_id)
);

ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_inventory_store_id ON public.inventory(store_id);
CREATE INDEX idx_inventory_product_id ON public.inventory(product_id);

CREATE POLICY "inventory_select" ON public.inventory FOR SELECT USING (public.get_user_role() IN ('admin', 'manager') OR store_id = public.get_user_store_id());
CREATE POLICY "inventory_insert" ON public.inventory FOR INSERT WITH CHECK (public.get_user_role() IN ('admin', 'manager') OR store_id = public.get_user_store_id());
CREATE POLICY "inventory_update" ON public.inventory FOR UPDATE USING (public.get_user_role() IN ('admin', 'manager') OR store_id = public.get_user_store_id());
CREATE POLICY "inventory_delete" ON public.inventory FOR DELETE USING (public.get_user_role() = 'admin');

CREATE TRIGGER set_updated_at_inventory BEFORE UPDATE ON public.inventory FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- ============================================
-- PART 8: SALES TABLE
-- ============================================
CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE RESTRICT,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  staff_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  transaction_date DATE NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(15,2) NOT NULL CHECK (unit_price >= 0),
  discount DECIMAL(15,2) DEFAULT 0 CHECK (discount >= 0),
  total_price DECIMAL(15,2) NOT NULL CHECK (total_price >= 0),
  gift_details JSONB DEFAULT '[]',
  customer_name TEXT,
  customer_phone TEXT,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_sales_store_id ON public.sales(store_id);
CREATE INDEX idx_sales_product_id ON public.sales(product_id);
CREATE INDEX idx_sales_staff_id ON public.sales(staff_id);
CREATE INDEX idx_sales_transaction_date ON public.sales(transaction_date);
CREATE INDEX idx_sales_created_by ON public.sales(created_by);

CREATE POLICY "sales_select" ON public.sales FOR SELECT USING (public.get_user_role() IN ('admin', 'manager') OR store_id = public.get_user_store_id());
CREATE POLICY "sales_insert" ON public.sales FOR INSERT WITH CHECK (public.get_user_role() IN ('admin', 'manager', 'staff'));
CREATE POLICY "sales_update" ON public.sales FOR UPDATE USING (public.get_user_role() IN ('admin', 'manager') OR (store_id = public.get_user_store_id() AND created_by = auth.uid()));
CREATE POLICY "sales_delete" ON public.sales FOR DELETE USING (public.get_user_role() = 'admin');

CREATE TRIGGER set_updated_at_sales BEFORE UPDATE ON public.sales FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================
-- PART 9: PURCHASE ORDERS TABLE
-- ============================================
CREATE TABLE public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number TEXT UNIQUE NOT NULL,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected', 'completed')),
  price_source TEXT DEFAULT 'dealer',
  total_amount DECIMAL(15,2) DEFAULT 0 CHECK (total_amount >= 0),
  notes TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_purchase_orders_account_id ON public.purchase_orders(account_id);
CREATE INDEX idx_purchase_orders_store_id ON public.purchase_orders(store_id);
CREATE INDEX idx_purchase_orders_status ON public.purchase_orders(status);
CREATE INDEX idx_purchase_orders_created_by ON public.purchase_orders(created_by);

CREATE POLICY "purchase_orders_select" ON public.purchase_orders FOR SELECT USING (public.get_user_role() IN ('admin', 'manager') OR created_by = auth.uid());
CREATE POLICY "purchase_orders_insert" ON public.purchase_orders FOR INSERT WITH CHECK (public.get_user_role() IN ('admin', 'manager', 'dealer'));
CREATE POLICY "purchase_orders_update" ON public.purchase_orders FOR UPDATE USING (public.get_user_role() IN ('admin', 'manager') OR (created_by = auth.uid() AND status = 'draft'));
CREATE POLICY "purchase_orders_delete" ON public.purchase_orders FOR DELETE USING (public.get_user_role() = 'admin');

CREATE TRIGGER set_updated_at_purchase_orders BEFORE UPDATE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================
-- PART 10: PURCHASE ORDER ITEMS TABLE
-- ============================================
CREATE TABLE public.purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(15,2) NOT NULL CHECK (unit_price >= 0),
  total_price DECIMAL(15,2) NOT NULL CHECK (total_price >= 0)
);

ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_po_items_purchase_order_id ON public.purchase_order_items(purchase_order_id);
CREATE INDEX idx_po_items_product_id ON public.purchase_order_items(product_id);

CREATE POLICY "po_items_select" ON public.purchase_order_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.purchase_orders po WHERE po.id = purchase_order_id AND (public.get_user_role() IN ('admin', 'manager') OR po.created_by = auth.uid()))
);
CREATE POLICY "po_items_insert" ON public.purchase_order_items FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.purchase_orders po WHERE po.id = purchase_order_id AND (public.get_user_role() IN ('admin', 'manager', 'dealer') OR po.created_by = auth.uid()))
);
CREATE POLICY "po_items_update" ON public.purchase_order_items FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.purchase_orders po WHERE po.id = purchase_order_id AND (public.get_user_role() IN ('admin', 'manager') OR (po.created_by = auth.uid() AND po.status = 'draft')))
);
CREATE POLICY "po_items_delete" ON public.purchase_order_items FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.purchase_orders po WHERE po.id = purchase_order_id AND public.get_user_role() = 'admin')
);

-- ============================================
-- PART 11: DAY OFF REQUESTS TABLE
-- ============================================
CREATE TABLE public.day_off_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  request_date DATE NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.day_off_requests ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_day_off_staff_id ON public.day_off_requests(staff_id);
CREATE INDEX idx_day_off_store_id ON public.day_off_requests(store_id);
CREATE INDEX idx_day_off_request_date ON public.day_off_requests(request_date);

CREATE POLICY "day_off_select" ON public.day_off_requests FOR SELECT USING (public.get_user_role() IN ('admin', 'manager') OR staff_id = auth.uid());
CREATE POLICY "day_off_insert" ON public.day_off_requests FOR INSERT WITH CHECK (staff_id = auth.uid() OR public.get_user_role() IN ('admin', 'manager'));
CREATE POLICY "day_off_update" ON public.day_off_requests FOR UPDATE USING (public.get_user_role() IN ('admin', 'manager'));
CREATE POLICY "day_off_delete" ON public.day_off_requests FOR DELETE USING (public.get_user_role() = 'admin');

CREATE TRIGGER set_updated_at_day_off BEFORE UPDATE ON public.day_off_requests FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================
-- PART 12: STOCK OPNAME TABLES
-- ============================================
CREATE TABLE public.stock_opname (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  opname_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved')),
  notes TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.stock_opname ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_stock_opname_store_id ON public.stock_opname(store_id);
CREATE INDEX idx_stock_opname_date ON public.stock_opname(opname_date);

CREATE POLICY "stock_opname_select" ON public.stock_opname FOR SELECT USING (public.get_user_role() IN ('admin', 'manager') OR store_id = public.get_user_store_id());
CREATE POLICY "stock_opname_insert" ON public.stock_opname FOR INSERT WITH CHECK (public.get_user_role() IN ('admin', 'manager', 'staff'));
CREATE POLICY "stock_opname_update" ON public.stock_opname FOR UPDATE USING (public.get_user_role() IN ('admin', 'manager') OR (store_id = public.get_user_store_id() AND status = 'draft'));
CREATE POLICY "stock_opname_delete" ON public.stock_opname FOR DELETE USING (public.get_user_role() = 'admin');

CREATE TRIGGER set_updated_at_stock_opname BEFORE UPDATE ON public.stock_opname FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE public.stock_opname_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_opname_id UUID NOT NULL REFERENCES public.stock_opname(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  system_qty INTEGER NOT NULL DEFAULT 0,
  actual_qty INTEGER NOT NULL DEFAULT 0,
  difference INTEGER GENERATED ALWAYS AS (actual_qty - system_qty) STORED,
  notes TEXT
);

ALTER TABLE public.stock_opname_items ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_stock_opname_items_opname_id ON public.stock_opname_items(stock_opname_id);

CREATE POLICY "stock_opname_items_select" ON public.stock_opname_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.stock_opname so WHERE so.id = stock_opname_id AND (public.get_user_role() IN ('admin', 'manager') OR so.store_id = public.get_user_store_id()))
);
CREATE POLICY "stock_opname_items_insert" ON public.stock_opname_items FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.stock_opname so WHERE so.id = stock_opname_id AND (public.get_user_role() IN ('admin', 'manager', 'staff')))
);
CREATE POLICY "stock_opname_items_update" ON public.stock_opname_items FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.stock_opname so WHERE so.id = stock_opname_id AND (public.get_user_role() IN ('admin', 'manager') OR (so.store_id = public.get_user_store_id() AND so.status = 'draft')))
);
CREATE POLICY "stock_opname_items_delete" ON public.stock_opname_items FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.stock_opname so WHERE so.id = stock_opname_id AND public.get_user_role() = 'admin')
);


-- ============================================
-- PART 13: AUDIT LOG TABLE
-- ============================================
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_data JSONB,
  new_data JSONB,
  changed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_audit_log_table_name ON public.audit_log(table_name);
CREATE INDEX idx_audit_log_record_id ON public.audit_log(record_id);
CREATE INDEX idx_audit_log_changed_at ON public.audit_log(changed_at);

CREATE POLICY "audit_log_select" ON public.audit_log FOR SELECT USING (public.get_user_role() IN ('admin', 'manager'));
CREATE POLICY "audit_log_insert" ON public.audit_log FOR INSERT WITH CHECK (true);

-- ============================================
-- PART 14: CREDIT NOTES TABLE (Dealer Rebates)
-- ============================================
CREATE TABLE public.credit_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount DECIMAL(15,2) NOT NULL CHECK (amount >= 0),
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'used', 'expired')),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at DATE
);

ALTER TABLE public.credit_notes ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_credit_notes_dealer_id ON public.credit_notes(dealer_id);
CREATE INDEX idx_credit_notes_status ON public.credit_notes(status);

CREATE POLICY "credit_notes_select" ON public.credit_notes FOR SELECT USING (public.get_user_role() IN ('admin', 'manager') OR dealer_id = auth.uid());
CREATE POLICY "credit_notes_insert" ON public.credit_notes FOR INSERT WITH CHECK (public.get_user_role() IN ('admin', 'manager'));
CREATE POLICY "credit_notes_update" ON public.credit_notes FOR UPDATE USING (public.get_user_role() IN ('admin', 'manager'));

-- ============================================
-- PART 15: TRAINING MATERIALS TABLE
-- ============================================
CREATE TABLE public.training_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.training_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "training_select" ON public.training_materials FOR SELECT TO authenticated USING (true);
CREATE POLICY "training_insert" ON public.training_materials FOR INSERT WITH CHECK (public.get_user_role() IN ('admin', 'manager'));
CREATE POLICY "training_update" ON public.training_materials FOR UPDATE USING (public.get_user_role() IN ('admin', 'manager'));
CREATE POLICY "training_delete" ON public.training_materials FOR DELETE USING (public.get_user_role() = 'admin');

-- ============================================
-- PART 16: EXPENSES TABLE
-- ============================================
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  expense_date DATE NOT NULL,
  fiscal_week INTEGER NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('POSM', 'ADS', 'Exhibition', 'Logistic Cost', 'Support Sellout', 'Brandstore Promotion', 'Branding Offline')),
  amount DECIMAL(15,2) NOT NULL CHECK (amount >= 0),
  evidence_url TEXT,
  remarks TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_expenses_account_id ON public.expenses(account_id);
CREATE INDEX idx_expenses_fiscal_week ON public.expenses(fiscal_week);

CREATE POLICY "expenses_select" ON public.expenses FOR SELECT USING (public.get_user_role() IN ('admin', 'manager'));
CREATE POLICY "expenses_insert" ON public.expenses FOR INSERT WITH CHECK (public.get_user_role() IN ('admin', 'manager'));

-- ============================================
-- PART 17: FISCAL CALENDAR SEED DATA (2024-2026)
-- Week starts on Monday, ends on Sunday
-- ============================================

-- Function to populate fiscal calendar
CREATE OR REPLACE FUNCTION populate_fiscal_calendar(start_year INT, end_year INT)
RETURNS void AS $
DECLARE
  cur_date DATE;
  end_date DATE;
  week_num INT;
  month_num INT;
  year_num INT;
  day_names TEXT[] := ARRAY['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
BEGIN
  cur_date := make_date(start_year, 1, 1);
  end_date := make_date(end_year, 12, 31);
  
  WHILE cur_date <= end_date LOOP
    -- Calculate fiscal week (Monday = start of week)
    week_num := CEIL((EXTRACT(DOY FROM cur_date)::INT + 
                      (EXTRACT(DOW FROM make_date(EXTRACT(YEAR FROM cur_date)::INT, 1, 1))::INT)) / 7.0)::INT;
    
    IF week_num > 53 THEN week_num := 53; END IF;
    IF week_num < 1 THEN week_num := 1; END IF;
    
    month_num := EXTRACT(MONTH FROM cur_date)::INT;
    year_num := EXTRACT(YEAR FROM cur_date)::INT;
    
    INSERT INTO public.fiscal_calendar (date, day_name, fiscal_week, fiscal_month, fiscal_year, quarter)
    VALUES (
      cur_date,
      day_names[EXTRACT(DOW FROM cur_date)::INT + 1],
      week_num,
      month_num,
      year_num,
      CEIL(month_num / 3.0)::INT
    )
    ON CONFLICT (date) DO NOTHING;
    
    cur_date := cur_date + INTERVAL '1 day';
  END LOOP;
END;
$ LANGUAGE plpgsql;

-- Populate fiscal calendar for 2024-2026
SELECT populate_fiscal_calendar(2024, 2026);

-- ============================================
-- PART 18: SAMPLE DATA (Accounts, Stores, Products)
-- ============================================

-- Insert sample accounts
INSERT INTO public.accounts (name, channel_type) VALUES
  ('Brandstore', 'Brandstore'),
  ('Hartono', 'Modern Channel'),
  ('Electronic City', 'Modern Channel'),
  ('Best Yamada Electric', 'Modern Channel'),
  ('Atria', 'Modern Channel'),
  ('Erafone', 'Retailer'),
  ('SH Mart', 'Retailer'),
  ('DGI', 'Dealer'),
  ('Hangon', 'Hangon')
ON CONFLICT (name) DO NOTHING;

-- Insert sample stores
INSERT INTO public.stores (account_id, name, region, monthly_target) 
SELECT 
  a.id,
  s.store_name,
  s.region,
  s.target
FROM (VALUES
  ('Brandstore', 'Dreame Brandstore Lippo Mall Kemang', 'Jakarta', 100000000),
  ('Brandstore', 'Dreame Brandstore PURI INDAH MALL 2', 'Jakarta', 100000000),
  ('Brandstore', 'Dreame Brandstore Supermal Karawaci', 'Tangerang', 80000000),
  ('Brandstore', 'Dreame Brandstore TSM Cibubur', 'Jakarta', 80000000),
  ('Hartono', 'Hartono Pondok Indah', 'Jakarta', 75000000),
  ('Electronic City', 'Electronic City SCBD', 'Jakarta', 75000000),
  ('Electronic City', 'Electronic City KARAWACI', 'Tangerang', 60000000),
  ('Electronic City', 'Electronic City Paskal 23 Bandung', 'Bandung', 60000000),
  ('Best Yamada Electric', 'Best Yamada Electric Senayan City', 'Jakarta', 70000000),
  ('Best Yamada Electric', 'Best Yamada Electric Grand Indonesia Mall', 'Jakarta', 70000000),
  ('Atria', 'ATRIA MOI', 'Jakarta', 50000000)
) AS s(account_name, store_name, region, target)
JOIN public.accounts a ON a.name = s.account_name
ON CONFLICT DO NOTHING;

-- Insert sample products with dynamic pricing
INSERT INTO public.products (sku, name, category, sub_category, price_retail, price_buy, channel_pricing) VALUES
  ('DRM-L10S-ULTRA', 'Dreame L10s Ultra', 'Robot Vacuum', 'Premium', 12999000, 9099300, '{"hartono": 11049150, "ec": 10659180, "best": 10789170, "atria": 10919160}'),
  ('DRM-L20-ULTRA', 'Dreame L20 Ultra', 'Robot Vacuum', 'Premium', 15999000, 11199300, '{"hartono": 13599150, "ec": 13119180, "best": 13279170, "atria": 13439160}'),
  ('DRM-X30-ULTRA', 'Dreame X30 Ultra', 'Robot Vacuum', 'Flagship', 19999000, 13999300, '{"hartono": 16999150, "ec": 16399180, "best": 16599170, "atria": 16799160}'),
  ('DRM-H12-PRO', 'Dreame H12 Pro', 'Wet & Dry Vacuum', 'Premium', 7999000, 5599300, '{"hartono": 6799150, "ec": 6559180, "best": 6639170, "atria": 6719160}'),
  ('DRM-H13-PRO', 'Dreame H13 Pro', 'Wet & Dry Vacuum', 'Premium', 9999000, 6999300, '{"hartono": 8499150, "ec": 8199180, "best": 8299170, "atria": 8399160}'),
  ('DRM-V16', 'Dreame V16', 'Cordless Vacuum', 'Mid-Range', 4999000, 3499300, '{"hartono": 4249150, "ec": 4099180, "best": 4149170, "atria": 4199160}'),
  ('DRM-R20', 'Dreame R20', 'Cordless Vacuum', 'Premium', 8999000, 6299300, '{"hartono": 7649150, "ec": 7379180, "best": 7469170, "atria": 7559160}'),
  ('DRM-HAIRGLORY', 'Dreame Hair Glory', 'Hair Dryer', 'Premium', 2999000, 2099300, '{"hartono": 2549150, "ec": 2459180, "best": 2489170, "atria": 2519160}'),
  ('DRM-POCKET', 'Dreame Pocket', 'Hair Dryer', 'Compact', 1499000, 1049300, '{"hartono": 1274150, "ec": 1229180, "best": 1244170, "atria": 1259160}'),
  ('DRM-AIRMOUSE', 'Dreame AirMouse', 'Hair Styler', 'Premium', 3499000, 2449300, '{"hartono": 2974150, "ec": 2869180, "best": 2904170, "atria": 2939160}')
ON CONFLICT (sku) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  sub_category = EXCLUDED.sub_category,
  price_retail = EXCLUDED.price_retail,
  price_buy = EXCLUDED.price_buy,
  channel_pricing = EXCLUDED.channel_pricing;

-- Insert sample training materials
INSERT INTO public.training_materials (title, url) VALUES
  ('Product Knowledge - Vacuum Series', 'https://drive.google.com/file/d/example1'),
  ('Product Knowledge - Robot Series', 'https://drive.google.com/file/d/example2'),
  ('Sales Techniques', 'https://drive.google.com/file/d/example3'),
  ('Customer Service Excellence', 'https://drive.google.com/file/d/example4')
ON CONFLICT DO NOTHING;

-- ============================================
-- DEV SETUP COMPLETE!
-- 
-- Next steps:
-- 1. Create a test user in Supabase Auth
-- 2. Set role in raw_app_meta_data: {"role": "admin", "store_id": "<store_uuid>"}
-- 3. Create matching profile in profiles table
-- ============================================
