-- Migration: Create decrement_inventory function
-- Requirements: 5.7 - Automatically decrement inventory on sale

-- Function to decrement inventory for a branch-product combination
-- Returns the new quantity or raises an exception if insufficient stock
CREATE OR REPLACE FUNCTION public.decrement_inventory(
  p_branch_id UUID,
  p_product_id UUID,
  p_qty INTEGER
)
RETURNS INTEGER AS $$
DECLARE
  v_current_qty INTEGER;
  v_new_qty INTEGER;
  v_inventory_id UUID;
BEGIN
  -- Lock the row for update to prevent race conditions
  SELECT id, quantity INTO v_inventory_id, v_current_qty
  FROM public.inventory
  WHERE branch_id = p_branch_id AND product_id = p_product_id
  FOR UPDATE;

  -- If no inventory record exists, treat as zero stock
  IF v_inventory_id IS NULL THEN
    RAISE EXCEPTION 'Insufficient stock. Available: 0, Requested: %', p_qty
      USING ERRCODE = 'P0001';
  END IF;

  -- Check if sufficient stock
  IF v_current_qty < p_qty THEN
    RAISE EXCEPTION 'Insufficient stock. Available: %, Requested: %', v_current_qty, p_qty
      USING ERRCODE = 'P0001';
  END IF;

  -- Calculate new quantity
  v_new_qty := v_current_qty - p_qty;

  -- Update inventory
  UPDATE public.inventory
  SET quantity = v_new_qty, updated_at = NOW()
  WHERE id = v_inventory_id;

  RETURN v_new_qty;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.decrement_inventory(UUID, UUID, INTEGER) TO authenticated;

-- Comment for documentation
COMMENT ON FUNCTION public.decrement_inventory IS 'Decrements inventory quantity for a branch-product combination. Raises exception if insufficient stock.';
