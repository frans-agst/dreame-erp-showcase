-- ============================================
-- OMNIERP RETAIL ERP V2.0 - MAJOR REFACTORING
-- Migration: Organization Hierarchy, Dynamic Pricing, Fiscal Calendar
-- Date: 2026-01-30
-- ============================================

-- ============================================
-- PART 1: CREATE ACCOUNTS TABLE (Parent Organization)
-- ============================================
CREATE TABLE IF NOT EXISTS public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  channel_type TEXT NOT NULL CHECK (channel_type IN ('Brandstore', 'Modern Channel', 'Retailer', 'Dealer', 'Hangon')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for accounts
CREATE POLICY "accounts_select" ON public.accounts
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "accounts_insert" ON public.accounts
  FOR INSERT WITH CHECK (public.get_user_role() IN ('admin', 'manager'));

CREATE POLICY "accounts_update" ON public.accounts
  FOR UPDATE USING (public.get_user_role() IN ('admin', 'manager'));

CREATE POLICY "accounts_delete" ON public.accounts
  FOR DELETE USING (public.get_user_role() = 'admin');

-- ============================================
-- PART 2: CREATE STORES TABLE (Replaces branches)
-- ============================================
CREATE TABLE IF NOT EXISTS public.stores (
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
CREATE INDEX IF NOT EXISTS idx_stores_account_id ON public.stores(account_id);
CREATE INDEX IF NOT EXISTS idx_stores_is_active ON public.stores(is_active);

-- RLS Policies for stores
CREATE POLICY "stores_select" ON public.stores
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "stores_insert" ON public.stores
  FOR INSERT WITH CHECK (public.get_user_role() IN ('admin', 'manager'));

CREATE POLICY "stores_update" ON public.stores
  FOR UPDATE USING (public.get_user_role() IN ('admin', 'manager'));

CREATE POLICY "stores_delete" ON public.stores
  FOR DELETE USING (public.get_user_role() = 'admin');

-- Trigger for updated_at
CREATE TRIGGER set_updated_at_stores
  BEFORE UPDATE ON public.stores
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_accounts
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- ============================================
-- PART 3: CREATE FISCAL CALENDAR TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.fiscal_calendar (
  date DATE PRIMARY KEY,
  day_name TEXT NOT NULL,
  fiscal_week INTEGER NOT NULL CHECK (fiscal_week BETWEEN 1 AND 53),
  fiscal_month INTEGER NOT NULL CHECK (fiscal_month BETWEEN 1 AND 12),
  fiscal_year INTEGER NOT NULL,
  quarter INTEGER NOT NULL CHECK (quarter BETWEEN 1 AND 4)
);

CREATE INDEX IF NOT EXISTS idx_fiscal_calendar_week ON public.fiscal_calendar(fiscal_year, fiscal_week);
CREATE INDEX IF NOT EXISTS idx_fiscal_calendar_month ON public.fiscal_calendar(fiscal_year, fiscal_month);
CREATE INDEX IF NOT EXISTS idx_fiscal_calendar_quarter ON public.fiscal_calendar(fiscal_year, quarter);

-- ============================================
-- PART 4: UPDATE PRODUCTS TABLE FOR DYNAMIC PRICING
-- ============================================

-- Rename price to price_retail if exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'price') THEN
    ALTER TABLE public.products RENAME COLUMN price TO price_retail;
  END IF;
END $$;

-- Add price_buy column
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS price_buy DECIMAL(15,2) DEFAULT 0 CHECK (price_buy >= 0);

-- Add channel_pricing JSONB column
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS channel_pricing JSONB DEFAULT '{}';

-- Add sub_category column
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sub_category TEXT;

-- Set default price_buy as 70% of retail (can be updated later)
UPDATE public.products SET price_buy = price_retail * 0.7 WHERE price_buy = 0 OR price_buy IS NULL;

-- ============================================
-- PART 5: CREATE CREDIT NOTES TABLE (Dealer Rebates)
-- ============================================
CREATE TABLE IF NOT EXISTS public.credit_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount DECIMAL(15,2) NOT NULL CHECK (amount >= 0),
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'used', 'expired')),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at DATE
);

ALTER TABLE public.credit_notes ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_credit_notes_dealer_id ON public.credit_notes(dealer_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_status ON public.credit_notes(status);

-- RLS: Dealer sees own, admin/manager sees all
CREATE POLICY "credit_notes_select" ON public.credit_notes
  FOR SELECT USING (
    public.get_user_role() IN ('admin', 'manager') 
    OR dealer_id = auth.uid()
  );

CREATE POLICY "credit_notes_insert" ON public.credit_notes
  FOR INSERT WITH CHECK (public.get_user_role() IN ('admin', 'manager'));

CREATE POLICY "credit_notes_update" ON public.credit_notes
  FOR UPDATE USING (public.get_user_role() IN ('admin', 'manager'));

-- ============================================
-- PART 6: CREATE TRAINING MATERIALS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.training_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.training_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "training_select" ON public.training_materials
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "training_insert" ON public.training_materials
  FOR INSERT WITH CHECK (public.get_user_role() IN ('admin', 'manager'));

CREATE POLICY "training_update" ON public.training_materials
  FOR UPDATE USING (public.get_user_role() IN ('admin', 'manager'));

CREATE POLICY "training_delete" ON public.training_materials
  FOR DELETE USING (public.get_user_role() = 'admin');


-- ============================================
-- PART 7: CREATE EXPENSES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.expenses (
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
CREATE INDEX IF NOT EXISTS idx_expenses_account_id ON public.expenses(account_id);
CREATE INDEX IF NOT EXISTS idx_expenses_fiscal_week ON public.expenses(fiscal_week);

CREATE POLICY "expenses_select" ON public.expenses
  FOR SELECT USING (public.get_user_role() IN ('admin', 'manager'));

CREATE POLICY "expenses_insert" ON public.expenses
  FOR INSERT WITH CHECK (public.get_user_role() IN ('admin', 'manager'));

-- ============================================
-- PART 8: UPDATE PROFILES TABLE
-- ============================================

-- Add dealer to role enum
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('admin', 'manager', 'staff', 'dealer'));

-- Add store_id column (will migrate from branch_id later)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_store_id ON public.profiles(store_id);

-- ============================================
-- PART 9: UPDATE SALES TABLE
-- ============================================

-- Add store_id column
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES public.stores(id) ON DELETE RESTRICT;

-- Rename price to unit_price if needed
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'price' AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'unit_price')) THEN
    ALTER TABLE public.sales RENAME COLUMN price TO unit_price;
  END IF;
END $$;

-- Rename final_price to total_price if needed
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'final_price' AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'total_price')) THEN
    ALTER TABLE public.sales RENAME COLUMN final_price TO total_price;
  END IF;
END $$;

-- Add gift_details JSONB column
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS gift_details JSONB DEFAULT '[]';

-- Add customer fields
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS customer_phone TEXT;

-- Add created_by if not exists
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sales_store_id ON public.sales(store_id);
CREATE INDEX IF NOT EXISTS idx_sales_created_by ON public.sales(created_by);


-- ============================================
-- PART 10: UPDATE PURCHASE ORDERS TABLE
-- ============================================

-- Add account_id column
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE RESTRICT;

-- Add store_id column (optional)
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL;

-- Add price_source column
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS price_source TEXT DEFAULT 'dealer';

CREATE INDEX IF NOT EXISTS idx_purchase_orders_account_id ON public.purchase_orders(account_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_store_id ON public.purchase_orders(store_id);

-- ============================================
-- PART 11: UPDATE INVENTORY TABLE
-- ============================================

-- Add store_id column
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE;

-- Add display_qty column
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS display_qty INTEGER DEFAULT 0 CHECK (display_qty >= 0);

CREATE INDEX IF NOT EXISTS idx_inventory_store_id ON public.inventory(store_id);

-- ============================================
-- PART 12: UPDATE RLS HELPER FUNCTIONS
-- ============================================

-- Update get_user_store_id function
CREATE OR REPLACE FUNCTION public.get_user_store_id()
RETURNS UUID AS $$
  SELECT (current_setting('request.jwt.claims', true)::json->'app_metadata'->>'store_id')::UUID;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Create get_user_account_id function
CREATE OR REPLACE FUNCTION public.get_user_account_id()
RETURNS UUID AS $$
  SELECT (current_setting('request.jwt.claims', true)::json->'app_metadata'->>'account_id')::UUID;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- ============================================
-- PART 13: UPDATE RLS POLICIES FOR STORES
-- ============================================

-- Update inventory policies to use store_id
DROP POLICY IF EXISTS "inventory_select" ON public.inventory;
CREATE POLICY "inventory_select" ON public.inventory
  FOR SELECT USING (
    public.get_user_role() IN ('admin', 'manager') 
    OR store_id = public.get_user_store_id()
    OR branch_id = public.get_user_branch_id()  -- Keep for backward compatibility
  );

-- Update sales policies to use store_id
DROP POLICY IF EXISTS "sales_select" ON public.sales;
CREATE POLICY "sales_select" ON public.sales
  FOR SELECT USING (
    public.get_user_role() IN ('admin', 'manager') 
    OR store_id = public.get_user_store_id()
    OR branch_id = public.get_user_branch_id()  -- Keep for backward compatibility
  );

-- Update purchase_orders policies for dealer access
DROP POLICY IF EXISTS "purchase_orders_select" ON public.purchase_orders;
CREATE POLICY "purchase_orders_select" ON public.purchase_orders
  FOR SELECT USING (
    public.get_user_role() IN ('admin', 'manager')
    OR created_by = auth.uid()
  );


-- ============================================
-- PART 14: SEED FISCAL CALENDAR DATA (2024-2026)
-- Week starts on Monday, ends on Sunday
-- ============================================

-- Function to populate fiscal calendar
CREATE OR REPLACE FUNCTION populate_fiscal_calendar(start_year INT, end_year INT)
RETURNS void AS $$
DECLARE
  cur_date DATE;
  end_date DATE;
  week_num INT;
  month_num INT;
  year_num INT;
  day_names TEXT[] := ARRAY['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
BEGIN
  -- Start from January 1st of start_year
  cur_date := make_date(start_year, 1, 1);
  end_date := make_date(end_year, 12, 31);
  
  WHILE cur_date <= end_date LOOP
    -- Calculate fiscal week (Monday = start of week)
    -- Week 1 starts on the first Monday of the year or Jan 1 if it's Monday
    week_num := CEIL((EXTRACT(DOY FROM cur_date)::INT + 
                      (EXTRACT(DOW FROM make_date(EXTRACT(YEAR FROM cur_date)::INT, 1, 1))::INT)) / 7.0)::INT;
    
    -- Ensure week_num is between 1 and 53
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
$$ LANGUAGE plpgsql;

-- Populate fiscal calendar for 2024-2026
SELECT populate_fiscal_calendar(2024, 2026);

-- ============================================
-- PART 15: SEED SAMPLE DATA FOR DEVELOPMENT
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
  ('Brandstore', 'OmniERP Brandstore Lippo Mall Kemang', 'Jakarta', 100000000),
  ('Brandstore', 'OmniERP Brandstore PURI INDAH MALL 2', 'Jakarta', 100000000),
  ('Brandstore', 'OmniERP Brandstore Supermal Karawaci', 'Tangerang', 80000000),
  ('Brandstore', 'OmniERP Brandstore TSM Cibubur', 'Jakarta', 80000000),
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

-- Update products with sample channel pricing
UPDATE public.products SET channel_pricing = jsonb_build_object(
  'hartono', price_retail * 0.85,
  'ec', price_retail * 0.82,
  'best', price_retail * 0.83,
  'atria', price_retail * 0.84
) WHERE channel_pricing = '{}' OR channel_pricing IS NULL;

-- Insert sample training materials
INSERT INTO public.training_materials (title, url) VALUES
  ('Product Knowledge - Vacuum Series', 'https://drive.google.com/file/d/example1'),
  ('Product Knowledge - Robot Series', 'https://drive.google.com/file/d/example2'),
  ('Sales Techniques', 'https://drive.google.com/file/d/example3'),
  ('Customer Service Excellence', 'https://drive.google.com/file/d/example4')
ON CONFLICT DO NOTHING;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
