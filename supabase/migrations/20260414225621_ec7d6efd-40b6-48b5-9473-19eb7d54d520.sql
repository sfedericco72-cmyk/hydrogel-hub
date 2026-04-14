
CREATE TABLE public.tenant_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_name text NOT NULL DEFAULT 'default',
  company_name text NOT NULL DEFAULT '',
  logo_url text,
  bcc_email text DEFAULT 'santiago.federico@bitec.cl',
  attach_rate_green integer NOT NULL DEFAULT 80,
  attach_rate_yellow integer NOT NULL DEFAULT 50,
  low_stock_days integer NOT NULL DEFAULT 7,
  disconnect_months integer NOT NULL DEFAULT 3,
  connection_green_days integer NOT NULL DEFAULT 7,
  connection_yellow_days integer NOT NULL DEFAULT 14,
  alert_cooldown_days integer NOT NULL DEFAULT 7,
  alert_max_window_days integer NOT NULL DEFAULT 14,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.tenant_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read tenant settings" ON public.tenant_settings FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can update tenant settings" ON public.tenant_settings FOR UPDATE TO public USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can insert tenant settings" ON public.tenant_settings FOR INSERT TO public WITH CHECK (true);

-- Insert default row
INSERT INTO public.tenant_settings (tenant_name, company_name, bcc_email) VALUES ('default', 'CutMonitor', 'santiago.federico@bitec.cl');

-- Trigger for updated_at
CREATE TRIGGER update_tenant_settings_updated_at BEFORE UPDATE ON public.tenant_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
