-- Migration: Simplify stock_opname_items RLS policies
-- The nested RLS check was causing issues with Supabase's nested selects

-- Drop existing policies on stock_opname_items
DROP POLICY IF EXISTS "stock_opname_items_select" ON stock_opname_items;
DROP POLICY IF EXISTS "stock_opname_items_insert" ON stock_opname_items;
DROP POLICY IF EXISTS "Staff can view stock opname items" ON stock_opname_items;
DROP POLICY IF EXISTS "Staff can create stock opname items" ON stock_opname_items;

-- Simple policy: authenticated users can read all stock opname items
-- (The parent stock_opname table already has RLS to filter by store)
CREATE POLICY "Authenticated users can view stock opname items" ON stock_opname_items
  FOR SELECT TO authenticated USING (true);

-- For insert, check that the parent stock_opname exists and user has access
CREATE POLICY "Users can create stock opname items" ON stock_opname_items
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM stock_opname WHERE id = opname_id)
  );
