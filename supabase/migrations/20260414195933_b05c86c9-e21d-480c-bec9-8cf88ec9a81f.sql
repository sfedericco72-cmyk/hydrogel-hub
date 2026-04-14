ALTER TABLE public.devices 
ADD COLUMN alerts_enabled boolean NOT NULL DEFAULT true,
ADD COLUMN first_alert_sent_at timestamp with time zone DEFAULT NULL;