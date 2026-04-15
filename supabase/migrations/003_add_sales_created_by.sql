-- Add created_by column to sales table to track who submitted the sale
-- This is separate from staff_id (PIC) which tracks who is responsible for the sale

ALTER TABLE public.sales 
ADD COLUMN created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX idx_sales_created_by ON public.sales(created_by);

-- Update existing records to set created_by = staff_id (best guess for historical data)
UPDATE public.sales SET created_by = staff_id WHERE created_by IS NULL;
