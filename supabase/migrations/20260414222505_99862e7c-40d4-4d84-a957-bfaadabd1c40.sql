
CREATE TABLE public.equipment_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name text NOT NULL,
  branch_name text,
  period text NOT NULL, -- YYYY-MM format
  units_sold integer NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'manual', -- manual, csv
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Unique constraint to prevent duplicate entries
CREATE UNIQUE INDEX idx_equipment_sales_unique 
ON public.equipment_sales (customer_name, period, COALESCE(branch_name, ''));

-- Enable RLS
ALTER TABLE public.equipment_sales ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Anyone can read equipment sales"
ON public.equipment_sales FOR SELECT
USING (true);

-- Public insert
CREATE POLICY "Anyone can insert equipment sales"
ON public.equipment_sales FOR INSERT
WITH CHECK (true);

-- Public update
CREATE POLICY "Anyone can update equipment sales"
ON public.equipment_sales FOR UPDATE
USING (true)
WITH CHECK (true);

-- Public delete
CREATE POLICY "Anyone can delete equipment sales"
ON public.equipment_sales FOR DELETE
USING (true);

-- Auto-update timestamp
CREATE TRIGGER update_equipment_sales_updated_at
BEFORE UPDATE ON public.equipment_sales
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
