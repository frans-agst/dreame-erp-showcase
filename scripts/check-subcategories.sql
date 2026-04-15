-- Quick check of all sub-categories in database
SELECT 
  sub_category,
  COUNT(*) as product_count
FROM public.products
WHERE sub_category IS NOT NULL
GROUP BY sub_category
ORDER BY sub_category;
