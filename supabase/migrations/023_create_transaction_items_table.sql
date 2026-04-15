-- Migration: Create transaction_items table for multi-product sales system
-- This migration creates the transaction_items table that will store individual products within transactions
-- with proper foreign key relationships and constraints

-- Create transaction_items table
CREATE TABLE public.transaction_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(15,2) NOT NULL CHECK (unit_price >= 0),
  line_discount DECIMAL(15,2) DEFAULT 0 CHECK (line_discount >= 0),
  line_total DECIMAL(15,2) NOT NULL CHECK (line_total >= 0),
  gift_details JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance optimization
CREATE INDEX idx_transaction_items_transaction_id ON public.transaction_items(transaction_id);
CREATE INDEX idx_transaction_items_product_id ON public.transaction_items(product_id);

-- Add audit trigger for transaction_items table
CREATE TRIGGER audit_transaction_items
  AFTER INSERT OR UPDATE OR DELETE ON public.transaction_items
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- Add RLS policies for transaction_items table
ALTER TABLE public.transaction_items ENABLE ROW LEVEL SECURITY;

-- Policy for SELECT: Staff can view transaction items from their assigned stores, Admin/Manager can view all
CREATE POLICY "transaction_items_select_policy" ON public.transaction_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = transaction_items.transaction_id
      AND (
        CASE 
          WHEN auth.jwt() ->> 'role' IN ('admin', 'manager') THEN true
          ELSE t.store_id = ANY(get_user_store_ids(auth.uid()))
        END
      )
    )
  );

-- Policy for INSERT: Staff can create transaction items for transactions in their assigned stores, Admin/Manager can create for all
CREATE POLICY "transaction_items_insert_policy" ON public.transaction_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = transaction_items.transaction_id
      AND (
        CASE 
          WHEN auth.jwt() ->> 'role' IN ('admin', 'manager') THEN true
          ELSE t.store_id = ANY(get_user_store_ids(auth.uid()))
        END
      )
    )
  );

-- Policy for UPDATE: Staff can update transaction items from their assigned stores, Admin/Manager can update all
CREATE POLICY "transaction_items_update_policy" ON public.transaction_items
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = transaction_items.transaction_id
      AND (
        CASE 
          WHEN auth.jwt() ->> 'role' IN ('admin', 'manager') THEN true
          ELSE t.store_id = ANY(get_user_store_ids(auth.uid()))
        END
      )
    )
  );

-- Policy for DELETE: Only Admin and Manager can delete transaction items
CREATE POLICY "transaction_items_delete_policy" ON public.transaction_items
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id = transaction_items.transaction_id
      AND auth.jwt() ->> 'role' IN ('admin', 'manager')
    )
  );

-- Add constraint to ensure line_total calculation is correct
-- This will be enforced at the application level, but we add a comment for documentation
COMMENT ON COLUMN public.transaction_items.line_total IS 'Should equal (quantity * unit_price) - line_discount. Enforced at application level.';