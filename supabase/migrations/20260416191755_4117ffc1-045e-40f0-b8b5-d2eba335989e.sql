-- Add condition tracking to devices
ALTER TABLE public.devices
  ADD COLUMN condition text,
  ADD COLUMN condition_notes text,
  ADD COLUMN condition_updated_at timestamptz;

-- Add reason fields to device_assignments
ALTER TABLE public.device_assignments
  ADD COLUMN assignment_reason text,
  ADD COLUMN unassignment_reason text;

-- Validation: allowed condition values
CREATE OR REPLACE FUNCTION public.validate_device_condition()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.condition IS NOT NULL AND NEW.condition NOT IN ('nuevo','usado','roto','en_reparacion','reparado','fuera_de_servicio') THEN
    RAISE EXCEPTION 'Invalid condition value: %', NEW.condition;
  END IF;
  -- Auto-update timestamp when condition changes
  IF (TG_OP = 'INSERT' AND NEW.condition IS NOT NULL)
     OR (TG_OP = 'UPDATE' AND NEW.condition IS DISTINCT FROM OLD.condition) THEN
    NEW.condition_updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_device_condition_trigger
BEFORE INSERT OR UPDATE OF condition ON public.devices
FOR EACH ROW
EXECUTE FUNCTION public.validate_device_condition();