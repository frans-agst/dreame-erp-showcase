-- Audit Log Triggers for Dreame Retail ERP
-- This migration creates triggers to automatically log all data changes

-- ============================================
-- AUDIT LOG TRIGGER FUNCTION
-- ============================================

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
-- ATTACH TRIGGERS TO AUDITED TABLES
-- ============================================

-- Profiles audit trigger
CREATE TRIGGER audit_profiles
  AFTER INSERT OR UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- Branches audit trigger
CREATE TRIGGER audit_branches
  AFTER INSERT OR UPDATE OR DELETE ON public.branches
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- Products audit trigger
CREATE TRIGGER audit_products
  AFTER INSERT OR UPDATE OR DELETE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- Inventory audit trigger
CREATE TRIGGER audit_inventory
  AFTER INSERT OR UPDATE OR DELETE ON public.inventory
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- Sales audit trigger
CREATE TRIGGER audit_sales
  AFTER INSERT OR UPDATE OR DELETE ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- Purchase orders audit trigger
CREATE TRIGGER audit_purchase_orders
  AFTER INSERT OR UPDATE OR DELETE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- Day off requests audit trigger
CREATE TRIGGER audit_day_off_requests
  AFTER INSERT OR UPDATE OR DELETE ON public.day_off_requests
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- Stock opname audit trigger
CREATE TRIGGER audit_stock_opname
  AFTER INSERT OR UPDATE OR DELETE ON public.stock_opname
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
