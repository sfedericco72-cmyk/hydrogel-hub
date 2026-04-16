-- Allowed emails whitelist for signup gating
CREATE TABLE public.allowed_emails (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL UNIQUE,
  notes text,
  added_by uuid,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Force email to lowercase + trim on insert/update
CREATE OR REPLACE FUNCTION public.normalize_allowed_email()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.email = lower(trim(NEW.email));
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_normalize_allowed_email
BEFORE INSERT OR UPDATE ON public.allowed_emails
FOR EACH ROW
EXECUTE FUNCTION public.normalize_allowed_email();

CREATE TRIGGER trg_allowed_emails_updated_at
BEFORE UPDATE ON public.allowed_emails
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.allowed_emails ENABLE ROW LEVEL SECURITY;

-- Only admins can manage. Public/anon access is blocked entirely.
-- The signup check uses an edge function with the service role key.
CREATE POLICY "Admins can read allowed emails"
ON public.allowed_emails
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert allowed emails"
ON public.allowed_emails
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update allowed emails"
ON public.allowed_emails
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete allowed emails"
ON public.allowed_emails
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Pre-seed your own email so you can keep registering / re-using
INSERT INTO public.allowed_emails (email, notes)
VALUES ('santiago.federico@bitec.cl', 'Owner — pre-seeded')
ON CONFLICT (email) DO NOTHING;