-- Migration 029: Staff Targets Table
-- Stores per-staff monthly sales targets

CREATE TABLE IF NOT EXISTS public.staff_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  year INTEGER NOT NULL CHECK (year >= 2000 AND year <= 2100),
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  target DECIMAL(15,2) NOT NULL DEFAULT 0 CHECK (target >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (staff_id, year, month)
);

ALTER TABLE public.staff_targets ENABLE ROW LEVEL SECURITY;

-- Admin and manager can read all targets
CREATE POLICY "staff_targets_select" ON public.staff_targets
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
  );

-- Only admin and manager can insert/update targets
CREATE POLICY "staff_targets_insert" ON public.staff_targets
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
  );

CREATE POLICY "staff_targets_update" ON public.staff_targets
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
  );

CREATE POLICY "staff_targets_delete" ON public.staff_targets
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE TRIGGER set_updated_at_staff_targets
  BEFORE UPDATE ON public.staff_targets
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX idx_staff_targets_staff_id ON public.staff_targets(staff_id);
CREATE INDEX idx_staff_targets_year_month ON public.staff_targets(year, month);
