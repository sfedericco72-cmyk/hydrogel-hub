-- ============================================================
-- 1) Nueva tabla: device_cuts_daily (ventana móvil ~90 días)
-- ============================================================
CREATE TABLE public.device_cuts_daily (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid,
  fixno text NOT NULL,
  cut_date date NOT NULL,
  daily_cuts integer NOT NULL DEFAULT 0,
  total_cuts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT device_cuts_daily_unique UNIQUE (tenant_id, fixno, cut_date)
);

CREATE INDEX idx_device_cuts_daily_tenant_date ON public.device_cuts_daily (tenant_id, cut_date);
CREATE INDEX idx_device_cuts_daily_fixno_date ON public.device_cuts_daily (fixno, cut_date DESC);

ALTER TABLE public.device_cuts_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service can manage cuts daily"
ON public.device_cuts_daily
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Tenant can read cuts daily"
ON public.device_cuts_daily
FOR SELECT
TO authenticated
USING (tenant_id = public.get_user_tenant_id());

-- ============================================================
-- 2) Nueva tabla: device_cuts_monthly (consolidado histórico)
-- ============================================================
CREATE TABLE public.device_cuts_monthly (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid,
  fixno text NOT NULL,
  year_month text NOT NULL, -- 'YYYY-MM'
  total_cuts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT device_cuts_monthly_unique UNIQUE (tenant_id, fixno, year_month),
  CONSTRAINT device_cuts_monthly_year_month_format CHECK (year_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
);

CREATE INDEX idx_device_cuts_monthly_tenant_month ON public.device_cuts_monthly (tenant_id, year_month);
CREATE INDEX idx_device_cuts_monthly_fixno_month ON public.device_cuts_monthly (fixno, year_month DESC);

ALTER TABLE public.device_cuts_monthly ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service can manage cuts monthly"
ON public.device_cuts_monthly
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Tenant can read cuts monthly"
ON public.device_cuts_monthly
FOR SELECT
TO authenticated
USING (tenant_id = public.get_user_tenant_id());

-- Trigger para actualizar updated_at en monthly
CREATE TRIGGER trg_device_cuts_monthly_updated_at
BEFORE UPDATE ON public.device_cuts_monthly
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 3) Poblar device_cuts_monthly desde device_cuts_history
-- ============================================================
INSERT INTO public.device_cuts_monthly (tenant_id, fixno, year_month, total_cuts, created_at, updated_at)
SELECT
  tenant_id,
  fixno,
  to_char(cut_date, 'YYYY-MM') AS year_month,
  SUM(daily_cuts)::int AS total_cuts,
  now(),
  now()
FROM public.device_cuts_history
WHERE daily_cuts IS NOT NULL AND daily_cuts > 0
GROUP BY tenant_id, fixno, to_char(cut_date, 'YYYY-MM')
ON CONFLICT (tenant_id, fixno, year_month) DO NOTHING;

-- ============================================================
-- 4) Poblar device_cuts_daily con últimos 90 días
-- ============================================================
INSERT INTO public.device_cuts_daily (tenant_id, fixno, cut_date, daily_cuts, total_cuts, created_at)
SELECT
  tenant_id,
  fixno,
  cut_date,
  COALESCE(daily_cuts, 0),
  COALESCE(total_cuts, 0),
  now()
FROM public.device_cuts_history
WHERE cut_date >= (current_date - interval '90 days')::date
  AND daily_cuts IS NOT NULL AND daily_cuts > 0
ON CONFLICT (tenant_id, fixno, cut_date) DO NOTHING;

-- ============================================================
-- 5) Renombrar tabla histórica a _legacy (backup)
-- ============================================================
ALTER TABLE public.device_cuts_history RENAME TO device_cuts_history_legacy;