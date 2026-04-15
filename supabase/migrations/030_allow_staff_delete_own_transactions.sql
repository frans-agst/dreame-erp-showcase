-- Migration 030: Allow staff to delete their own transactions
-- Staff can delete transactions they created (created_by = auth.uid())

DROP POLICY IF EXISTS "transactions_delete_policy" ON public.transactions;

CREATE POLICY "transactions_delete_policy" ON public.transactions
  FOR DELETE USING (
    public.get_user_role() IN ('admin', 'manager')
    OR (public.get_user_role() = 'staff' AND created_by = auth.uid())
  );
