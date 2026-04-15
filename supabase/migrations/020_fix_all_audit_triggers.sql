-- Migration: 020_fix_all_audit_triggers.sql
-- Description: Fix audit triggers after branch->store migration and add missing triggers
-- This ensures all tables have proper audit logging

-- ============================================================================
-- 1. DROP OLD AUDIT TRIGGER FOR BRANCHES (no longer exists)
-- ============================================================================

DROP TRIGGER IF EXISTS audit_branches ON public.branches;

-- ============================================================================
-- 2. ADD AUDIT TRIGGER FOR STORES TABLE
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'stores') THEN
    DROP TRIGGER IF EXISTS audit_stores ON public.stores;
    CREATE TRIGGER audit_stores
      AFTER INSERT OR UPDATE OR DELETE ON public.stores
      FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
    
    COMMENT ON TRIGGER audit_stores ON public.stores IS 'Logs all changes to stores table';
  END IF;
END $$;

-- ============================================================================
-- 3. ADD AUDIT TRIGGER FOR STAFF_STORES TABLE (if not exists)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'staff_stores') THEN
    DROP TRIGGER IF EXISTS audit_staff_stores ON public.staff_stores;
    CREATE TRIGGER audit_staff_stores
      AFTER INSERT OR UPDATE OR DELETE ON public.staff_stores
      FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
    
    COMMENT ON TRIGGER audit_staff_stores ON public.staff_stores IS 'Logs all changes to staff_stores table';
  END IF;
END $$;

-- ============================================================================
-- 4. ADD AUDIT TRIGGER FOR ACCOUNTS TABLE
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'accounts') THEN
    DROP TRIGGER IF EXISTS audit_accounts ON public.accounts;
    CREATE TRIGGER audit_accounts
      AFTER INSERT OR UPDATE OR DELETE ON public.accounts
      FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
    
    COMMENT ON TRIGGER audit_accounts ON public.accounts IS 'Logs all changes to accounts table';
  END IF;
END $$;

-- ============================================================================
-- 5. VERIFY EXISTING AUDIT TRIGGERS (recreate if missing)
-- ============================================================================

-- Profiles
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
    DROP TRIGGER IF EXISTS audit_profiles ON public.profiles;
    CREATE TRIGGER audit_profiles
      AFTER INSERT OR UPDATE OR DELETE ON public.profiles
      FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
  END IF;
END $$;

-- Products
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'products') THEN
    DROP TRIGGER IF EXISTS audit_products ON public.products;
    CREATE TRIGGER audit_products
      AFTER INSERT OR UPDATE OR DELETE ON public.products
      FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
  END IF;
END $$;

-- Inventory
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory') THEN
    DROP TRIGGER IF EXISTS audit_inventory ON public.inventory;
    CREATE TRIGGER audit_inventory
      AFTER INSERT OR UPDATE OR DELETE ON public.inventory
      FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
  END IF;
END $$;

-- Sales
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sales') THEN
    DROP TRIGGER IF EXISTS audit_sales ON public.sales;
    CREATE TRIGGER audit_sales
      AFTER INSERT OR UPDATE OR DELETE ON public.sales
      FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
  END IF;
END $$;

-- Purchase Orders
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'purchase_orders') THEN
    DROP TRIGGER IF EXISTS audit_purchase_orders ON public.purchase_orders;
    CREATE TRIGGER audit_purchase_orders
      AFTER INSERT OR UPDATE OR DELETE ON public.purchase_orders
      FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
  END IF;
END $$;

-- Day Off Requests
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'day_off_requests') THEN
    DROP TRIGGER IF EXISTS audit_day_off_requests ON public.day_off_requests;
    CREATE TRIGGER audit_day_off_requests
      AFTER INSERT OR UPDATE OR DELETE ON public.day_off_requests
      FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
  END IF;
END $$;

-- Stock Opname
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'stock_opname') THEN
    DROP TRIGGER IF EXISTS audit_stock_opname ON public.stock_opname;
    CREATE TRIGGER audit_stock_opname
      AFTER INSERT OR UPDATE OR DELETE ON public.stock_opname
      FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
  END IF;
END $$;

-- Expenses (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'expenses') THEN
    DROP TRIGGER IF EXISTS audit_expenses ON public.expenses;
    CREATE TRIGGER audit_expenses
      AFTER INSERT OR UPDATE OR DELETE ON public.expenses
      FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
  END IF;
END $$;

-- Training (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'training') THEN
    DROP TRIGGER IF EXISTS audit_training ON public.training;
    CREATE TRIGGER audit_training
      AFTER INSERT OR UPDATE OR DELETE ON public.training
      FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
  END IF;
END $$;

-- ============================================================================
-- 6. VERIFICATION QUERY
-- ============================================================================

-- Run this to verify all triggers are in place:
-- SELECT 
--   schemaname,
--   tablename,
--   array_agg(triggername ORDER BY triggername) as triggers
-- FROM pg_trigger t
-- JOIN pg_class c ON t.tgrelid = c.oid
-- JOIN pg_namespace n ON c.relnamespace = n.oid
-- WHERE n.nspname = 'public'
--   AND triggername LIKE 'audit_%'
--   AND NOT tgisinternal
-- GROUP BY schemaname, tablename
-- ORDER BY tablename;

