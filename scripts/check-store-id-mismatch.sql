-- Check for store_id mismatch between sales and stores tables
-- This could cause sales to not be aggregated correctly

-- ============================================
-- 1. Check stores that have sales
-- ============================================
SELECT DISTINCT
  s.store_id,
  st.name as store_name,
  st.is_active,
  COUNT(*) as sale_count,
  SUM(s.total_price) as total_sales
FROM sales s
LEFT JOIN stores st ON s.store_id = st.id
WHERE s.sale_date >= '2026-03-01'
  AND s.sale_date <= '2026-03-31'
GROUP BY s.store_id, st.name, st.is_active
ORDER BY total_sales DESC;

-- ============================================
-- 2. Check if there are sales with NULL store_id
-- ============================================
SELECT 
  COUNT(*) as sales_with_null_store_id,
  SUM(total_price) as total_amount
FROM sales
WHERE sale_date >= '2026-03-01'
  AND sale_date <= '2026-03-31'
  AND store_id IS NULL;

-- ============================================
-- 3. Check if there are sales with store_id that don't exist in stores table
-- ============================================
SELECT 
  s.store_id,
  COUNT(*) as sale_count,
  SUM(s.total_price) as total_sales
FROM sales s
LEFT JOIN stores st ON s.store_id = st.id
WHERE s.sale_date >= '2026-03-01'
  AND s.sale_date <= '2026-03-31'
  AND st.id IS NULL
GROUP BY s.store_id;

-- ============================================
-- 4. Check active stores and their sales
-- ============================================
SELECT 
  st.id as store_id,
  st.name as store_name,
  st.is_active,
  st.account_id,
  a.name as account_name,
  COUNT(s.id) as sale_count,
  COALESCE(SUM(s.total_price), 0) as total_sales,
  st.monthly_target
FROM stores st
LEFT JOIN accounts a ON st.account_id = a.id
LEFT JOIN sales s ON s.store_id = st.id 
  AND s.sale_date >= '2026-03-01'
  AND s.sale_date <= '2026-03-31'
WHERE st.is_active = true
GROUP BY st.id, st.name, st.is_active, st.account_id, a.name, st.monthly_target
ORDER BY st.name;

-- ============================================
-- 5. Check if account names contain "brandstore"
-- ============================================
SELECT 
  a.id,
  a.name,
  a.channel_type,
  LOWER(a.name) LIKE '%brandstore%' as has_brandstore_in_name,
  COUNT(st.id) as store_count
FROM accounts a
LEFT JOIN stores st ON st.account_id = a.id AND st.is_active = true
GROUP BY a.id, a.name, a.channel_type
ORDER BY a.name;
