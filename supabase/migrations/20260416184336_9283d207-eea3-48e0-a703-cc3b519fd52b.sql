-- Add alert fields to points_of_sale
ALTER TABLE public.points_of_sale
  ADD COLUMN IF NOT EXISTS alert_email text,
  ADD COLUMN IF NOT EXISTS alerts_enabled boolean NOT NULL DEFAULT true;

-- Migrate existing alert_email from devices into their assigned PdV
-- Pick the most recent assignment's device alert_email per PdV (only if PdV doesn't have one yet)
UPDATE public.points_of_sale pos
SET alert_email = sub.alert_email
FROM (
  SELECT DISTINCT ON (da.point_of_sale_id)
    da.point_of_sale_id,
    d.alert_email
  FROM public.device_assignments da
  JOIN public.devices d ON d.id = da.device_id
  WHERE da.unassigned_at IS NULL
    AND d.alert_email IS NOT NULL
    AND d.alert_email <> ''
  ORDER BY da.point_of_sale_id, da.assigned_at DESC
) sub
WHERE pos.id = sub.point_of_sale_id
  AND (pos.alert_email IS NULL OR pos.alert_email = '');

-- Add global pause field on tenant_settings
ALTER TABLE public.tenant_settings
  ADD COLUMN IF NOT EXISTS alerts_paused_until timestamptz;