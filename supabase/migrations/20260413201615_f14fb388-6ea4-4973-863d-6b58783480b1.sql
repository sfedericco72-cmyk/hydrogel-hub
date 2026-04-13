CREATE TABLE public.devices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fixno TEXT NOT NULL UNIQUE,
  branch_name TEXT,
  customer_name TEXT,
  status TEXT,
  software_version TEXT,
  total_cuts INTEGER DEFAULT 0,
  remaining_cuts INTEGER DEFAULT 0,
  cuts_today INTEGER DEFAULT 0,
  latest_online_time TIMESTAMP WITH TIME ZONE,
  ip_address TEXT,
  city TEXT,
  address TEXT,
  contact_name TEXT,
  contact_phone TEXT,
  raw_data JSONB,
  last_synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read devices" ON public.devices FOR SELECT USING (true);

CREATE INDEX idx_devices_fixno ON public.devices (fixno);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_devices_updated_at
  BEFORE UPDATE ON public.devices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();