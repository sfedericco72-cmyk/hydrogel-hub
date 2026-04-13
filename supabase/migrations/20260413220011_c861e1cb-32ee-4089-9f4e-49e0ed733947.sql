
CREATE TABLE public.device_cuts_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fixno TEXT NOT NULL,
  cut_date DATE NOT NULL,
  total_cuts INTEGER NOT NULL DEFAULT 0,
  daily_cuts INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_device_date UNIQUE (fixno, cut_date)
);

ALTER TABLE public.device_cuts_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read cuts history"
ON public.device_cuts_history
FOR SELECT
TO public
USING (true);
