-- Migration: 018_fix_audit_triggers.sql
-- Description: Add missing audit trigger for staff_stores table
-- Requirements: 1.1, 1.2, 1.3, 1.4

-- ============================================
-- ENSURE AUDIT LOG FUNCTION EXISTS
-- ============================================

-- Create the audit log function if it doesn't exist
-- This is a safety check in case migration 003 wasn't run
CREATE OR REPLACE FUNCTION public.log_audit_event()
RETURNS TRIGGER AS $$
DECLARE
  v_old_value JSONB;
  v_new_value JSONB;
  v_record_id UUID;
BEGIN
  -- Determine the record ID and values based on operation
  IF TG_OP = 'DELETE' THEN
    v_record_id := OLD.id;
    v_old_value := to_jsonb(OLD);
    v_new_value := NULL;
  ELSIF TG_OP = 'UPDATE' THEN
    v_record_id := NEW.id;
    v_old_value := to_jsonb(OLD);
    v_new_value := to_jsonb(NEW);
  ELSIF TG_OP = 'INSERT' THEN
    v_record_id := NEW.id;
    v_old_value := NULL;
    v_new_value := to_jsonb(NEW);
  END IF;

  -- Insert audit log entry
  INSERT INTO public.audit_log (
    user_id,
    action,
    table_name,
    record_id,
    old_value,
    new_value,
    created_at
  ) VALUES (
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    v_record_id,
    v_old_value,
    v_new_value,
    NOW()
  );

  -- Return appropriate value based on operation
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- ADD MISSING AUDIT TRIGGER FOR STAFF_STORES
-- ============================================

-- Drop trigger if it exists (for idempotency)
DROP TRIGGER IF EXISTS audit_staff_stores ON public.staff_stores;

-- Add audit trigger for staff_stores table
-- This trigger will log all INSERT, UPDATE, and DELETE operations
-- on the staff_stores table to maintain a complete audit trail
CREATE TRIGGER audit_staff_stores
  AFTER INSERT OR UPDATE OR DELETE ON public.staff_stores
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
