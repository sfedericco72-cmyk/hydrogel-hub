ALTER TABLE public.devices
  ADD COLUMN IF NOT EXISTS alerts_muted_until timestamptz,
  ADD COLUMN IF NOT EXISTS alerts_mute_reason text;

ALTER TABLE public.tenant_settings
  ADD COLUMN IF NOT EXISTS alert_mute_days integer NOT NULL DEFAULT 30;

CREATE TABLE IF NOT EXISTS public.alert_check_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running',
  forced boolean NOT NULL DEFAULT false,
  tenants_processed integer NOT NULL DEFAULT 0,
  tenants_skipped jsonb,
  alerts_sent jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.alert_check_runs TO authenticated;
GRANT ALL ON public.alert_check_runs TO service_role;

ALTER TABLE public.alert_check_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view alert check runs of their tenant"
ON public.alert_check_runs
FOR SELECT
TO authenticated
USING (tenant_id IS NULL OR tenant_id = public.get_user_tenant_id());

CREATE TRIGGER trg_alert_check_runs_updated_at
BEFORE UPDATE ON public.alert_check_runs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_alert_check_runs_started_at ON public.alert_check_runs (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_devices_alerts_muted_until ON public.devices (alerts_muted_until);