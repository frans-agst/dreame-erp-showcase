-- Migration: Fix stock_opname_items RLS policies
-- Run this if the main migration partially completed

-- Drop existing policies on stock_opname_items
DROP POLICY IF EXISTS "stock_opname_items_select" ON stock_opname_items;
DROP POLICY IF EXISTS "stock_opname_items_insert" ON stock_opname_items;
DROP POLICY IF EXISTS "Staff can view stock opname items" ON stock_opname_items;
DROP POLICY IF EXISTS "Staff can create stock opname items" ON stock_opname_items;

-- Create user_store_id function if it doesn't exist
CREATE OR REPLACE FUNCTION user_store_id()
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT store_id 
    FROM profiles 
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Stock opname items policies (linked via opname_id to stock_opname)
CREATE POLICY "Staff can view stock opname items" ON stock_opname_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM stock_opname so 
      WHERE so.id = stock_opname_items.opname_id 
      AND (so.store_id = user_store_id() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager')))
    )
  );

CREATE POLICY "Staff can create stock opname items" ON stock_opname_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM stock_opname so 
      WHERE so.id = stock_opname_items.opname_id 
      AND (so.store_id = user_store_id() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager')))
    )
  );

-- Also ensure stock_opname has proper policies
DROP POLICY IF EXISTS "Staff can view own store stock opname" ON stock_opname;
DROP POLICY IF EXISTS "Staff can create stock opname for own store" ON stock_opname;

CREATE POLICY "Staff can view own store stock opname" ON stock_opname
  FOR SELECT USING (
    store_id = user_store_id() OR 
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
  );

CREATE POLICY "Staff can create stock opname for own store" ON stock_opname
  FOR INSERT WITH CHECK (
    store_id = user_store_id() OR 
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
  );
