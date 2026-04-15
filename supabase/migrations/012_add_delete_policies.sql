-- ============================================
-- ADD DELETE POLICIES FOR EXPENSES AND CREDIT NOTES
-- Fixes issue where delete operations return success but don't actually delete
-- ============================================

-- Add DELETE policy for expenses (admin/manager only)
CREATE POLICY "expenses_delete" ON public.expenses
  FOR DELETE USING (public.get_user_role() IN ('admin', 'manager'));

-- Add DELETE policy for credit_notes (admin/manager only)
CREATE POLICY "credit_notes_delete" ON public.credit_notes
  FOR DELETE USING (public.get_user_role() IN ('admin', 'manager'));

-- Verify policies exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'expenses' AND policyname = 'expenses_delete'
  ) THEN
    RAISE NOTICE 'expenses_delete policy created successfully';
  ELSE
    RAISE WARNING 'expenses_delete policy was not created';
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'credit_notes' AND policyname = 'credit_notes_delete'
  ) THEN
    RAISE NOTICE 'credit_notes_delete policy created successfully';
  ELSE
    RAISE WARNING 'credit_notes_delete policy was not created';
  END IF;
END $$;
