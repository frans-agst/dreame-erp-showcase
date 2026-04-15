-- IMMEDIATE FIX: Check if the "brandstore" filter is the problem

-- Run this query to see what account names you have:
SELECT 
  a.id,
  a.name as account_name,
  a.channel_type,
  LOWER(a.name) as lowercase_name,
  LOWER(a.name) LIKE '%brandstore%' as matches_brandstore_filter,
  COUNT(st.id) as active_store_count
FROM accounts a
LEFT JOIN stores st ON st.account_id = a.id AND st.is_active = true
GROUP BY a.id, a.name, a.channel_type
ORDER BY a.name;

-- If the "matches_brandstore_filter" column shows FALSE for all accounts,
-- that's your problem! The client-side filter is removing all data.

-- To verify, check which stores are shown on the page:
SELECT 
  st.id,
  st.name as store_name,
  a.name as account_name,
  LOWER(a.name) LIKE '%brandstore%' as would_pass_filter,
  st.monthly_target,
  COALESCE(SUM(s.total_price), 0) as actual_sales
FROM stores st
LEFT JOIN accounts a ON st.account_id = a.id
LEFT JOIN sales s ON s.store_id = st.id 
  AND s.sale_date >= '2026-03-01'
  AND s.sale_date <= '2026-03-31'
WHERE st.is_active = true
GROUP BY st.id, st.name, a.name, st.monthly_target
ORDER BY st.name;
