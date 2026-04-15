-- Add inventory_source column to sales table
-- This tracks whether the sale was from in-store inventory or warehouse
-- in_store: deduct from inventory (default behavior)
-- warehouse: do not deduct from inventory

ALTER TABLE sales 
ADD COLUMN inventory_source TEXT CHECK (inventory_source IN ('in_store', 'warehouse')) DEFAULT 'in_store';

-- Add comment for documentation
COMMENT ON COLUMN sales.inventory_source IS 'Source of inventory for the sale: in_store (deduct from inventory) or warehouse (no deduction)';

-- Create index for filtering by inventory source
CREATE INDEX idx_sales_inventory_source ON sales(inventory_source);