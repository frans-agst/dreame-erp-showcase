-- Migration: Create database functions for transaction management
-- This migration implements atomic transaction operations and unified data access functions

-- Function 1: Create transaction with items atomically
CREATE OR REPLACE FUNCTION public.create_transaction_with_items(
  p_transaction_data JSONB,
  p_items_data JSONB[]
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_transaction_id UUID;
  v_item JSONB;
  v_line_total DECIMAL(15,2);
  v_calculated_total DECIMAL(15,2) := 0;
  v_total_discount DECIMAL(15,2);
BEGIN
  -- Validate input
  IF p_transaction_data IS NULL OR array_length(p_items_data, 1) IS NULL THEN
    RAISE EXCEPTION 'Transaction data and items are required';
  END IF;

  -- Extract transaction-level discount
  v_total_discount := COALESCE((p_transaction_data->>'total_discount')::DECIMAL(15,2), 0);

  -- Create the transaction record
  INSERT INTO public.transactions (
    store_id,
    staff_id,
    transaction_date,
    total_before_discount,
    total_discount,
    total_after_discount,
    inventory_source,
    customer_name,
    customer_phone,
    notes,
    created_by
  ) VALUES (
    (p_transaction_data->>'store_id')::UUID,
    (p_transaction_data->>'staff_id')::UUID,
    (p_transaction_data->>'transaction_date')::DATE,
    (p_transaction_data->>'total_before_discount')::DECIMAL(15,2),
    v_total_discount,
    (p_transaction_data->>'total_after_discount')::DECIMAL(15,2),
    COALESCE(p_transaction_data->>'inventory_source', 'in_store'),
    p_transaction_data->>'customer_name',
    p_transaction_data->>'customer_phone',
    p_transaction_data->>'notes',
    auth.uid()
  ) RETURNING id INTO v_transaction_id;

  -- Create transaction items
  FOREACH v_item IN ARRAY p_items_data
  LOOP
    -- Calculate line total
    v_line_total := (v_item->>'quantity')::INTEGER * (v_item->>'unit_price')::DECIMAL(15,2) - 
                    COALESCE((v_item->>'line_discount')::DECIMAL(15,2), 0);
    
    -- Validate line total is non-negative
    IF v_line_total < 0 THEN
      RAISE EXCEPTION 'Line total cannot be negative for product %', v_item->>'product_id';
    END IF;

    -- Insert transaction item
    INSERT INTO public.transaction_items (
      transaction_id,
      product_id,
      quantity,
      unit_price,
      line_discount,
      line_total,
      gift_details
    ) VALUES (
      v_transaction_id,
      (v_item->>'product_id')::UUID,
      (v_item->>'quantity')::INTEGER,
      (v_item->>'unit_price')::DECIMAL(15,2),
      COALESCE((v_item->>'line_discount')::DECIMAL(15,2), 0),
      v_line_total,
      COALESCE(v_item->'gift_details', '[]'::jsonb)
    );

    -- Add to calculated total
    v_calculated_total := v_calculated_total + v_line_total;

    -- Update inventory (decrement stock) only for in-store inventory
    IF COALESCE(p_transaction_data->>'inventory_source', 'in_store') = 'in_store' THEN
      PERFORM public.decrement_inventory(
        (p_transaction_data->>'store_id')::UUID,
        (v_item->>'product_id')::UUID,
        (v_item->>'quantity')::INTEGER
      );
    END IF;
  END LOOP;

  -- Validate that calculated total matches expected total
  IF ABS(v_calculated_total - (p_transaction_data->>'total_before_discount')::DECIMAL(15,2)) > 0.01 THEN
    RAISE EXCEPTION 'Calculated total (%) does not match expected total (%)', 
      v_calculated_total, (p_transaction_data->>'total_before_discount')::DECIMAL(15,2);
  END IF;

  RETURN v_transaction_id;
END;
$$;

-- Function 2: Get unified sales data for reporting
CREATE OR REPLACE FUNCTION public.get_unified_sales_data(
  p_start_date DATE,
  p_end_date DATE,
  p_store_id UUID DEFAULT NULL,
  p_staff_id UUID DEFAULT NULL
) RETURNS TABLE(
  id UUID,
  transaction_id UUID,
  sale_date DATE,
  fiscal_week INTEGER,
  fiscal_year INTEGER,
  store_id UUID,
  store_name TEXT,
  account_name TEXT,
  staff_id UUID,
  staff_name TEXT,
  product_id UUID,
  sku TEXT,
  product_name TEXT,
  category TEXT,
  sub_category TEXT,
  quantity INTEGER,
  unit_price DECIMAL(15,2),
  discount DECIMAL(15,2),
  total_price DECIMAL(15,2),
  inventory_source TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  gift_details JSONB,
  source_type TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    use.id,
    use.transaction_id,
    use.sale_date,
    use.fiscal_week,
    use.fiscal_year,
    use.store_id,
    use.store_name,
    use.account_name,
    use.staff_id,
    use.staff_name,
    use.product_id,
    use.sku,
    use.product_name,
    use.category,
    use.sub_category,
    use.quantity,
    use.unit_price,
    use.discount,
    use.total_price,
    use.inventory_source,
    use.customer_name,
    use.customer_phone,
    use.gift_details,
    use.source_type
  FROM public.unified_sales_export use
  WHERE use.sale_date >= p_start_date
    AND use.sale_date <= p_end_date
    AND (p_store_id IS NULL OR use.store_id = p_store_id)
    AND (p_staff_id IS NULL OR use.staff_id = p_staff_id)
  ORDER BY use.sale_date DESC, use.created_at DESC;
END;
$$;

-- Function 3: Convert legacy sale to transaction format
CREATE OR REPLACE FUNCTION public.legacy_sale_to_transaction_format(
  p_sale_id UUID
) RETURNS TABLE(
  transaction_id UUID,
  transaction_date DATE,
  store_id UUID,
  store_name TEXT,
  account_name TEXT,
  staff_id UUID,
  staff_name TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  total_before_discount DECIMAL(15,2),
  total_discount DECIMAL(15,2),
  total_after_discount DECIMAL(15,2),
  inventory_source TEXT,
  items JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    NULL::UUID as transaction_id, -- Legacy sales don't have transaction IDs
    s.sale_date as transaction_date,
    s.store_id,
    st.name as store_name,
    a.name as account_name,
    s.staff_id,
    p.full_name as staff_name,
    s.customer_name,
    s.customer_phone,
    s.total_price as total_before_discount,
    s.discount as total_discount,
    (s.total_price - s.discount) as total_after_discount,
    COALESCE(s.inventory_source, 'in_store') as inventory_source,
    jsonb_build_array(
      jsonb_build_object(
        'id', s.id,
        'product_id', s.product_id,
        'sku', pr.sku,
        'product_name', pr.name,
        'category', pr.category,
        'sub_category', pr.sub_category,
        'quantity', s.quantity,
        'unit_price', s.unit_price,
        'line_discount', s.discount,
        'line_total', s.total_price,
        'gift_details', s.gift_details
      )
    ) as items
  FROM public.sales s
  JOIN public.stores st ON s.store_id = st.id
  JOIN public.accounts a ON st.account_id = a.id
  JOIN public.profiles p ON s.staff_id = p.id
  JOIN public.products pr ON s.product_id = pr.id
  WHERE s.id = p_sale_id;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.create_transaction_with_items(JSONB, JSONB[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_unified_sales_data(DATE, DATE, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.legacy_sale_to_transaction_format(UUID) TO authenticated;

-- Add comments explaining the functions
COMMENT ON FUNCTION public.create_transaction_with_items(JSONB, JSONB[]) IS 'Atomically creates a transaction with multiple items, validates totals, and updates inventory';
COMMENT ON FUNCTION public.get_unified_sales_data(DATE, DATE, UUID, UUID) IS 'Returns unified sales data combining transactions and legacy sales for reporting';
COMMENT ON FUNCTION public.legacy_sale_to_transaction_format(UUID) IS 'Converts a legacy sales record to transaction format for compatibility';