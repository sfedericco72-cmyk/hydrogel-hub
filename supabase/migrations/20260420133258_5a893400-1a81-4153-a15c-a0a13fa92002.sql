ALTER TABLE public.tenant_settings
ADD COLUMN IF NOT EXISTS alerts_check_hour integer NOT NULL DEFAULT 9
  CHECK (alerts_check_hour >= 0 AND alerts_check_hour <= 23);