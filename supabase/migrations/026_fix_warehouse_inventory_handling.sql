-- Migration: Fix warehouse inventory handling in create_transaction_with_items
-- This migration updates the function to only decrement inventory for in-store sales

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
  v_inventory_source TEXT;
BEGIN
  -- Validate input
  IF p_transaction_data IS NULL OR array_length(p_items_data, 1) IS NULL THEN
    RAISE EXCEPTION 'Transaction data and items are required';
  END IF;

  -- Extract transaction-level discount and inventory source
  v_total_discount := COALESCE((p_transaction_data->>'total_discount')::DECIMAL(15,2), 0);
  v_inventory_source := COALESCE(p_transaction_data->>'inventory_source', 'in_store');

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
    v_inventory_source,
    p_transaction_data->>'customer_name',
    p_transaction_data->>'customer_phone',
    p_transaction_data->>'notes',
    auth.uid()
  ) RETURNING id INTO v_transaction_id;

  -- Create transaction items
  FOREACH v_item IN ARRAY p_items_data
  LOOP
    -- Calculate line total (after line discount)
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

    -- Add line total to calculated total (this is sum of line totals after line discounts)
    v_calculated_total := v_calculated_total + v_line_total;

    -- Update inventory (decrement stock) only for in-store inventory
    IF v_inventory_source = 'in_store' THEN
      PERFORM public.decrement_inventory(
        (p_transaction_data->>'store_id')::UUID,
        (v_item->>'product_id')::UUID,
        (v_item->>'quantity')::INTEGER
      );
    END IF;
  END LOOP;

  -- Validate that calculated total matches expected total_after_discount
  -- v_calculated_total is the sum of all line_total values (quantity * unit_price - line_discount)
  -- This should match total_after_discount (total_before_discount - total_discount)
  IF ABS(v_calculated_total - (p_transaction_data->>'total_after_discount')::DECIMAL(15,2)) > 0.01 THEN
    RAISE EXCEPTION 'Calculated total (%) does not match expected total_after_discount (%)', 
      v_calculated_total, (p_transaction_data->>'total_after_discount')::DECIMAL(15,2);
  END IF;

  RETURN v_transaction_id;
END;
$$;

-- Add comment explaining the fix
COMMENT ON FUNCTION public.create_transaction_with_items(JSONB, JSONB[]) IS 'Atomically creates a transaction with multiple items, validates totals, and updates inventory only for in-store sales';
