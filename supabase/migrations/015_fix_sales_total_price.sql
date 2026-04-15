-- ============================================
-- Fix Sales Total Price to Use Tax-Inclusive Price
-- Migration: 015
-- Date: 2026-02-09
-- ============================================

-- Update all existing sales to use tax-inclusive total price
-- Formula: total_price = (unit_price * 1.11 * quantity) - discount
UPDATE sales
SET total_price = (unit_price * 1.11 * quantity) - discount
WHERE total_price IS NOT NULL;

-- Add comment
COMMENT ON COLUMN sales.total_price IS 'Total price after tax (unit_price * 1.11 * quantity - discount)';
