-- Migration: Rename branch_id to store_id across all tables
-- This migration completes the V2 schema transition by removing all branch references

-- ============================================================================
-- 0. DROP ALL EXISTING RLS POLICIES THAT REFERENCE branch_id
-- ============================================================================

-- Inventory policies
DROP POLICY IF EXISTS "inventory_select" ON inventory;
DROP POLICY IF EXISTS "inventory_insert" ON inventory;
DROP POLICY IF EXISTS "inventory_update" ON inventory;
DROP POLICY IF EXISTS "Staff can view own branch inventory" ON inventory;
DROP POLICY IF EXISTS "Staff can update own branch inventory" ON inventory;
DROP POLICY IF EXISTS "Staff can insert own branch inventory" ON inventory;

-- Sales policies
DROP POLICY IF EXISTS "sales_select" ON sales;
DROP POLICY IF EXISTS "sales_insert" ON sales;
DROP POLICY IF EXISTS "Staff can view own branch sales" ON sales;
DROP POLICY IF EXISTS "Staff can create sales for own branch" ON sales;

-- Stock opname policies
DROP POLICY IF EXISTS "stock_opname_select" ON stock_opname;
DROP POLICY IF EXISTS "stock_opname_insert" ON stock_opname;
DROP POLICY IF EXISTS "Staff can view own branch stock opname" ON stock_opname;
DROP POLICY IF EXISTS "Staff can create stock opname for own branch" ON stock_opname;

-- Stock opname items policies
DROP POLICY IF EXISTS "stock_opname_items_select" ON stock_opname_items;
DROP POLICY IF EXISTS "stock_opname_items_insert" ON stock_opname_items;
DROP POLICY IF EXISTS "Staff can view stock opname items" ON stock_opname_items;
DROP POLICY IF EXISTS "Staff can create stock opname items" ON stock_opname_items;

-- Profiles policies that might reference branch_id
DROP POLICY IF EXISTS "profiles_select" ON profiles;
DROP POLICY IF EXISTS "profiles_update" ON profiles;

-- ============================================================================
-- 1. PROFILES TABLE: Rename branch_id to store_id
-- ============================================================================

-- Add store_id column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'profiles' AND column_name = 'store_id') THEN
    ALTER TABLE profiles ADD COLUMN store_id UUID REFERENCES stores(id);
  END IF;
END $$;

-- Copy data from branch_id to store_id (if branch_id exists and store_id is null)
UPDATE profiles 
SET store_id = branch_id 
WHERE store_id IS NULL AND branch_id IS NOT NULL;

-- Drop branch_id column from profiles
ALTER TABLE profiles DROP COLUMN IF EXISTS branch_id CASCADE;

-- ============================================================================
-- 2. INVENTORY TABLE: Rename branch_id to store_id
-- ============================================================================

-- Drop existing constraints first
ALTER TABLE inventory DROP CONSTRAINT IF EXISTS inventory_branch_id_fkey CASCADE;
ALTER TABLE inventory DROP CONSTRAINT IF EXISTS inventory_branch_id_product_id_key CASCADE;

-- Add store_id column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'inventory' AND column_name = 'store_id') THEN
    ALTER TABLE inventory ADD COLUMN store_id UUID;
  END IF;
END $$;

-- Copy data from branch_id to store_id
UPDATE inventory 
SET store_id = branch_id 
WHERE store_id IS NULL AND branch_id IS NOT NULL;

-- Drop branch_id column
ALTER TABLE inventory DROP COLUMN IF EXISTS branch_id CASCADE;

-- Add foreign key constraint for store_id
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                 WHERE constraint_name = 'inventory_store_id_fkey') THEN
    ALTER TABLE inventory 
    ADD CONSTRAINT inventory_store_id_fkey 
    FOREIGN KEY (store_id) REFERENCES stores(id);
  END IF;
END $$;

-- Add unique constraint for store_id + product_id
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                 WHERE constraint_name = 'inventory_store_id_product_id_key') THEN
    ALTER TABLE inventory 
    ADD CONSTRAINT inventory_store_id_product_id_key 
    UNIQUE (store_id, product_id);
  END IF;
END $$;

-- Make store_id NOT NULL (only if column exists and has no nulls)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'inventory' AND column_name = 'store_id' AND is_nullable = 'YES') THEN
    IF NOT EXISTS (SELECT 1 FROM inventory WHERE store_id IS NULL) THEN
      ALTER TABLE inventory ALTER COLUMN store_id SET NOT NULL;
    END IF;
  END IF;
END $$;

-- ============================================================================
-- 3. SALES TABLE: Rename branch_id to store_id
-- ============================================================================

-- Drop existing constraints
ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_branch_id_fkey CASCADE;

-- Add store_id column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'sales' AND column_name = 'store_id') THEN
    ALTER TABLE sales ADD COLUMN store_id UUID;
  END IF;
END $$;

-- Copy data from branch_id to store_id
UPDATE sales 
SET store_id = branch_id 
WHERE store_id IS NULL AND branch_id IS NOT NULL;

-- Drop branch_id column
ALTER TABLE sales DROP COLUMN IF EXISTS branch_id CASCADE;

-- Add foreign key constraint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                 WHERE constraint_name = 'sales_store_id_fkey') THEN
    ALTER TABLE sales 
    ADD CONSTRAINT sales_store_id_fkey 
    FOREIGN KEY (store_id) REFERENCES stores(id);
  END IF;
END $$;

-- Make store_id NOT NULL
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'sales' AND column_name = 'store_id' AND is_nullable = 'YES') THEN
    IF NOT EXISTS (SELECT 1 FROM sales WHERE store_id IS NULL) THEN
      ALTER TABLE sales ALTER COLUMN store_id SET NOT NULL;
    END IF;
  END IF;
END $$;

-- ============================================================================
-- 4. STOCK_OPNAME TABLE: Rename branch_id to store_id
-- ============================================================================

-- Drop existing constraints
ALTER TABLE stock_opname DROP CONSTRAINT IF EXISTS stock_opname_branch_id_fkey CASCADE;

-- Add store_id column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'stock_opname' AND column_name = 'store_id') THEN
    ALTER TABLE stock_opname ADD COLUMN store_id UUID;
  END IF;
END $$;

-- Copy data from branch_id to store_id
UPDATE stock_opname 
SET store_id = branch_id 
WHERE store_id IS NULL AND branch_id IS NOT NULL;

-- Drop branch_id column
ALTER TABLE stock_opname DROP COLUMN IF EXISTS branch_id CASCADE;

-- Add foreign key constraint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                 WHERE constraint_name = 'stock_opname_store_id_fkey') THEN
    ALTER TABLE stock_opname 
    ADD CONSTRAINT stock_opname_store_id_fkey 
    FOREIGN KEY (store_id) REFERENCES stores(id);
  END IF;
END $$;

-- Make store_id NOT NULL
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'stock_opname' AND column_name = 'store_id' AND is_nullable = 'YES') THEN
    IF NOT EXISTS (SELECT 1 FROM stock_opname WHERE store_id IS NULL) THEN
      ALTER TABLE stock_opname ALTER COLUMN store_id SET NOT NULL;
    END IF;
  END IF;
END $$;

-- ============================================================================
-- 5. UPDATE FUNCTIONS: Replace user_branch_id with user_store_id
-- ============================================================================

-- Drop old function
DROP FUNCTION IF EXISTS user_branch_id();

-- Create new user_store_id function
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

-- ============================================================================
-- 6. UPDATE decrement_inventory FUNCTION
-- ============================================================================

-- Drop old function
DROP FUNCTION IF EXISTS decrement_inventory(UUID, UUID, INTEGER);

-- Create updated function using store_id
CREATE OR REPLACE FUNCTION decrement_inventory(
  p_store_id UUID,
  p_product_id UUID,
  p_qty INTEGER
)
RETURNS INTEGER AS $$
DECLARE
  v_current_qty INTEGER;
  v_new_qty INTEGER;
BEGIN
  -- Lock the row and get current quantity
  SELECT quantity INTO v_current_qty
  FROM inventory
  WHERE store_id = p_store_id AND product_id = p_product_id
  FOR UPDATE;

  -- Check if inventory record exists
  IF v_current_qty IS NULL THEN
    RAISE EXCEPTION 'No inventory record found for store % and product %', p_store_id, p_product_id;
  END IF;

  -- Check if sufficient stock
  IF v_current_qty < p_qty THEN
    RAISE EXCEPTION 'Insufficient stock. Available: %, Requested: %', v_current_qty, p_qty;
  END IF;

  -- Calculate new quantity
  v_new_qty := v_current_qty - p_qty;

  -- Update inventory
  UPDATE inventory
  SET quantity = v_new_qty, updated_at = NOW()
  WHERE store_id = p_store_id AND product_id = p_product_id;

  RETURN v_new_qty;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION decrement_inventory(UUID, UUID, INTEGER) TO authenticated;

-- ============================================================================
-- 7. CREATE NEW RLS POLICIES USING store_id
-- ============================================================================

-- Profiles policies
CREATE POLICY "profiles_select" ON profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "profiles_update" ON profiles
  FOR UPDATE USING (
    id = auth.uid() OR 
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
  );

-- Inventory policies
CREATE POLICY "Staff can view own store inventory" ON inventory
  FOR SELECT USING (
    store_id = user_store_id() OR 
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
  );

CREATE POLICY "Staff can update own store inventory" ON inventory
  FOR UPDATE USING (
    store_id = user_store_id() OR 
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
  );

CREATE POLICY "Staff can insert own store inventory" ON inventory
  FOR INSERT WITH CHECK (
    store_id = user_store_id() OR 
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
  );

-- Sales policies
CREATE POLICY "Staff can view own store sales" ON sales
  FOR SELECT USING (
    store_id = user_store_id() OR 
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
  );

CREATE POLICY "Staff can create sales for own store" ON sales
  FOR INSERT WITH CHECK (
    store_id = user_store_id() OR 
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
  );

-- Stock opname policies
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

-- ============================================================================
-- 8. CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_inventory_store_id ON inventory(store_id);
CREATE INDEX IF NOT EXISTS idx_sales_store_id ON sales(store_id);
CREATE INDEX IF NOT EXISTS idx_stock_opname_store_id ON stock_opname(store_id);
CREATE INDEX IF NOT EXISTS idx_profiles_store_id ON profiles(store_id);

-- ============================================================================
-- 9. COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON COLUMN profiles.store_id IS 'Reference to the store this user belongs to';
COMMENT ON COLUMN inventory.store_id IS 'Reference to the store for this inventory record';
COMMENT ON COLUMN sales.store_id IS 'Reference to the store where this sale occurred';
COMMENT ON COLUMN stock_opname.store_id IS 'Reference to the store for this stock opname';
COMMENT ON FUNCTION user_store_id() IS 'Returns the store_id of the current authenticated user';
COMMENT ON FUNCTION decrement_inventory(UUID, UUID, INTEGER) IS 'Decrements inventory quantity for a store-product combination. Raises exception if insufficient stock.';
