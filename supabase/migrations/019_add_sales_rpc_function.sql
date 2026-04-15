-- Migration: 019_add_sales_rpc_function.sql
-- Description: Add RPC function as fallback for sales queries to bypass caching

-- Create RPC function to fetch sales for a given month
CREATE OR REPLACE FUNCTION get_sales_for_month(
  start_date DATE,
  end_date DATE
)
RETURNS TABLE (
  store_id UUID,
  total_price DECIMAL,
  sale_date DATE
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.store_id, 
    s.total_price,
    s.sale_date
  FROM sales s
  WHERE s.sale_date >= start_date
    AND s.sale_date <= end_date
  ORDER BY s.sale_date DESC;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_sales_for_month(DATE, DATE) TO authenticated;

COMMENT ON FUNCTION get_sales_for_month IS 'Fetch sales data for a given date range, bypassing potential caching issues';
