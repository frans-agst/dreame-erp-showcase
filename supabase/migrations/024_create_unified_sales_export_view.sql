-- Migration: Create unified_sales_export view for export compatibility
-- This migration creates a unified view that combines transactions and legacy sales
-- ensuring proper column mapping for existing export format

-- Create unified view combining transactions and legacy sales
CREATE VIEW public.unified_sales_export AS
SELECT 
  -- Transaction items (new format)
  ti.id,
  t.id as transaction_id,
  t.transaction_date as sale_date,
  fc.fiscal_week,
  fc.fiscal_year,
  t.store_id,
  s.name as store_name,
  a.name as account_name,
  t.staff_id,
  p.full_name as staff_name,
  ti.product_id,
  pr.sku,
  pr.name as product_name,
  pr.category,
  pr.sub_category,
  ti.quantity,
  ti.unit_price,
  ti.line_discount as discount,
  ti.line_total as total_price,
  t.inventory_source,
  t.customer_name,
  t.customer_phone,
  ti.gift_details,
  NULL as gift, -- legacy field for backward compatibility
  'transaction' as source_type,
  ti.created_at
FROM public.transaction_items ti
JOIN public.transactions t ON ti.transaction_id = t.id
JOIN public.stores s ON t.store_id = s.id
JOIN public.accounts a ON s.account_id = a.id
JOIN public.profiles p ON t.staff_id = p.id
JOIN public.products pr ON ti.product_id = pr.id
LEFT JOIN public.fiscal_calendar fc ON t.transaction_date = fc.date

UNION ALL

SELECT 
  -- Legacy sales (existing format)
  ls.id,
  NULL as transaction_id,
  ls.sale_date,
  fc.fiscal_week,
  fc.fiscal_year,
  ls.store_id,
  s.name as store_name,
  a.name as account_name,
  ls.staff_id,
  p.full_name as staff_name,
  ls.product_id,
  pr.sku,
  pr.name as product_name,
  pr.category,
  pr.sub_category,
  ls.quantity,
  ls.unit_price,
  ls.discount,
  ls.total_price,
  COALESCE(ls.inventory_source, 'in_store') as inventory_source,
  ls.customer_name,
  ls.customer_phone,
  ls.gift_details,
  NULL as gift, -- legacy field handled in application
  'legacy' as source_type,
  ls.created_at
FROM public.sales ls
JOIN public.stores s ON ls.store_id = s.id
JOIN public.accounts a ON s.account_id = a.id
JOIN public.profiles p ON ls.staff_id = p.id
JOIN public.products pr ON ls.product_id = pr.id
LEFT JOIN public.fiscal_calendar fc ON ls.sale_date = fc.date;

-- Add RLS policy for the view
-- Views inherit RLS from their underlying tables, but we add explicit policy for clarity
ALTER VIEW public.unified_sales_export SET (security_invoker = true);

-- Create indexes on underlying tables to optimize view performance
-- (These may already exist, but we ensure they're present)
CREATE INDEX IF NOT EXISTS idx_sales_sale_date_store ON public.sales(sale_date, store_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date_store ON public.transactions(transaction_date, store_id);

-- Add comment explaining the view purpose
COMMENT ON VIEW public.unified_sales_export IS 'Unified view combining transaction items and legacy sales records for export compatibility. Maintains existing export format structure while supporting multi-product transactions.';