-- Migration: Fix transactions table DELETE policy to use get_user_role() function
-- Issue: DELETE policy was using auth.jwt() ->> 'role' directly instead of get_user_role()
-- This causes permission issues when admin/manager tries to delete transactions

-- Drop the existing DELETE policy
DROP POLICY IF EXISTS "transactions_delete_policy" ON public.transactions;

-- Recreate DELETE policy using get_user_role() helper function
-- This ensures consistency with other table policies
CREATE POLICY "transactions_delete_policy" ON public.transactions
  FOR DELETE USING (
    public.get_user_role() IN ('admin', 'manager')
  );

-- Also fix SELECT, INSERT, and UPDATE policies for consistency
DROP POLICY IF EXISTS "transactions_select_policy" ON public.transactions;
DROP POLICY IF EXISTS "transactions_insert_policy" ON public.transactions;
DROP POLICY IF EXISTS "transactions_update_policy" ON public.transactions;

-- Recreate SELECT policy
CREATE POLICY "transactions_select_policy" ON public.transactions
  FOR SELECT USING (
    CASE 
      WHEN public.get_user_role() IN ('admin', 'manager') THEN true
      ELSE store_id = ANY(get_user_store_ids(auth.uid()))
    END
  );

-- Recreate INSERT policy
CREATE POLICY "transactions_insert_policy" ON public.transactions
  FOR INSERT WITH CHECK (
    CASE 
      WHEN public.get_user_role() IN ('admin', 'manager') THEN true
      ELSE store_id = ANY(get_user_store_ids(auth.uid()))
    END
  );

-- Recreate UPDATE policy
CREATE POLICY "transactions_update_policy" ON public.transactions
  FOR UPDATE USING (
    CASE 
      WHEN public.get_user_role() IN ('admin', 'manager') THEN true
      ELSE store_id = ANY(get_user_store_ids(auth.uid()))
    END
  );
