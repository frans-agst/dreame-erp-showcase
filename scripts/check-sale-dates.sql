-- Check Sale Dates
-- This script checks if sale_date is being saved correctly

-- Check recent sales and their dates
SELECT 
  id,
  sale_date,
  created_at,
  product_id,
  quantity,
  unit_price,
  total_price,
  created_by
FROM sales
ORDER BY created_at DESC
LIMIT 20;

-- Check if any sales have different sale_date vs created_at date
SELECT 
  COUNT(*) as total_sales,
  COUNT(CASE WHEN DATE(sale_date) = DATE(created_at) THEN 1 END) as same_date_count,
  COUNT(CASE WHEN DATE(sale_date) != DATE(created_at) THEN 1 END) as different_date_count
FROM sales
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days';
