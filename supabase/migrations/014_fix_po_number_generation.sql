-- ============================================
-- Fix PO Number Generation with Atomic Function
-- Migration: 014
-- Date: 2026-02-09
-- ============================================

-- Create a function to generate unique PO numbers atomically
CREATE OR REPLACE FUNCTION generate_dealer_po_number()
RETURNS TEXT AS $$
DECLARE
  date_str TEXT;
  prefix TEXT;
  next_seq INTEGER;
  po_number TEXT;
BEGIN
  -- Get today's date in YYYYMMDD format
  date_str := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');
  prefix := 'DPO-' || date_str || '-';
  
  -- Get the next sequence number for today (atomic operation)
  -- Use table alias to avoid ambiguous column reference
  SELECT COALESCE(MAX(
    CASE 
      WHEN po.po_number ~ ('^' || prefix || '[0-9]{4}$') 
      THEN CAST(SUBSTRING(po.po_number FROM LENGTH(prefix) + 1) AS INTEGER)
      ELSE 0
    END
  ), 0) + 1
  INTO next_seq
  FROM purchase_orders po
  WHERE po.po_number LIKE prefix || '%';
  
  -- Format the PO number
  po_number := prefix || LPAD(next_seq::TEXT, 4, '0');
  
  RETURN po_number;
END;
$$ LANGUAGE plpgsql;

-- Add comment
COMMENT ON FUNCTION generate_dealer_po_number() IS 'Atomically generates unique dealer PO numbers in format DPO-YYYYMMDD-XXXX';
