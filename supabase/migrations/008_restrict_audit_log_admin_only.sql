-- Migration: Restrict audit log access to admin users only
-- Date: 2024-02-05
-- Description: Update audit log RLS policy to allow only admin users to view audit logs

-- Drop existing audit log select policy
DROP POLICY IF EXISTS "audit_log_select" ON public.audit_log;

-- Create new policy that only allows admin users
CREATE POLICY "audit_log_select" ON public.audit_log
  FOR SELECT USING (
    public.get_user_role() = 'admin'
  );

-- Add comment for documentation
COMMENT ON POLICY "audit_log_select" ON public.audit_log IS 'Allow only admin users to view audit log entries';