-- ============================================
-- Add Credit Note Support to Purchase Orders
-- Migration: 013
-- Date: 2026-02-09
-- ============================================

-- Add credit note fields to purchase_orders table
ALTER TABLE public.purchase_orders 
  ADD COLUMN IF NOT EXISTS credit_note_id UUID REFERENCES public.credit_notes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS credit_note_amount DECIMAL(15,2) DEFAULT 0 CHECK (credit_note_amount >= 0);

-- Add index for credit note lookups
CREATE INDEX IF NOT EXISTS idx_purchase_orders_credit_note_id ON public.purchase_orders(credit_note_id);

-- Add used_in_po_id to credit_notes to track which PO used it
ALTER TABLE public.credit_notes
  ADD COLUMN IF NOT EXISTS used_in_po_id UUID REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS used_at TIMESTAMPTZ;

-- Add index for PO lookups
CREATE INDEX IF NOT EXISTS idx_credit_notes_used_in_po_id ON public.credit_notes(used_in_po_id);

-- Add comment explaining the relationship
COMMENT ON COLUMN public.purchase_orders.credit_note_id IS 'Reference to the credit note applied to this PO';
COMMENT ON COLUMN public.purchase_orders.credit_note_amount IS 'Amount of credit note applied (max 50% of grand_total)';
COMMENT ON COLUMN public.credit_notes.used_in_po_id IS 'Reference to the PO where this credit note was used';
COMMENT ON COLUMN public.credit_notes.used_at IS 'Timestamp when the credit note was used';
