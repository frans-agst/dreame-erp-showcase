-- ============================================
-- Add UPDATE Policy for Expenses Table
-- Migration: 016
-- Date: 2026-02-09
-- ============================================

-- Add UPDATE policy for expenses (admin/manager only)
CREATE POLICY "expenses_update" ON public.expenses
  FOR UPDATE 
  USING (public.get_user_role() IN ('admin', 'manager'))
  WITH CHECK (public.get_user_role() IN ('admin', 'manager'));

-- Verify the policy was created
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'expenses' AND policyname = 'expenses_update'
  ) THEN
    RAISE NOTICE 'expenses_update policy created successfully';
  ELSE
    RAISE WARNING 'expenses_update policy was not created';
  END IF;
END $$;
