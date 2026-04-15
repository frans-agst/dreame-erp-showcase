-- Migration: Create transactions table for multi-product sales system
-- This migration creates the main transactions table that will store transaction-level information
-- while maintaining backward compatibility with the existing sales table

-- Create transactions table
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE RESTRICT,
  staff_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  transaction_date DATE NOT NULL,
  total_before_discount DECIMAL(15,2) NOT NULL CHECK (total_before_discount >= 0),
  total_discount DECIMAL(15,2) DEFAULT 0 CHECK (total_discount >= 0),
  total_after_discount DECIMAL(15,2) NOT NULL CHECK (total_after_discount >= 0),
  inventory_source TEXT CHECK (inventory_source IN ('in_store', 'warehouse')) DEFAULT 'in_store',
  customer_name TEXT,
  customer_phone TEXT,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance optimization
CREATE INDEX idx_transactions_store_id ON public.transactions(store_id);
CREATE INDEX idx_transactions_staff_id ON public.transactions(staff_id);
CREATE INDEX idx_transactions_date ON public.transactions(transaction_date);
CREATE INDEX idx_transactions_created_by ON public.transactions(created_by);
CREATE INDEX idx_transactions_customer_name ON public.transactions(customer_name) WHERE customer_name IS NOT NULL;
CREATE INDEX idx_transactions_customer_phone ON public.transactions(customer_phone) WHERE customer_phone IS NOT NULL;

-- Add audit trigger for transactions table
CREATE TRIGGER audit_transactions
  AFTER INSERT OR UPDATE OR DELETE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- Add RLS policies for transactions table
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Policy for SELECT: Staff can view transactions from their assigned stores, Admin/Manager can view all
CREATE POLICY "transactions_select_policy" ON public.transactions
  FOR SELECT USING (
    CASE 
      WHEN auth.jwt() ->> 'role' IN ('admin', 'manager') THEN true
      ELSE store_id = ANY(get_user_store_ids(auth.uid()))
    END
  );

-- Policy for INSERT: Staff can create transactions for their assigned stores, Admin/Manager can create for all
CREATE POLICY "transactions_insert_policy" ON public.transactions
  FOR INSERT WITH CHECK (
    CASE 
      WHEN auth.jwt() ->> 'role' IN ('admin', 'manager') THEN true
      ELSE store_id = ANY(get_user_store_ids(auth.uid()))
    END
  );

-- Policy for UPDATE: Staff can update transactions from their assigned stores, Admin/Manager can update all
CREATE POLICY "transactions_update_policy" ON public.transactions
  FOR UPDATE USING (
    CASE 
      WHEN auth.jwt() ->> 'role' IN ('admin', 'manager') THEN true
      ELSE store_id = ANY(get_user_store_ids(auth.uid()))
    END
  );

-- Policy for DELETE: Only Admin and Manager can delete transactions
CREATE POLICY "transactions_delete_policy" ON public.transactions
  FOR DELETE USING (
    auth.jwt() ->> 'role' IN ('admin', 'manager')
  );

-- Add updated_at trigger
CREATE TRIGGER set_updated_at_transactions
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();