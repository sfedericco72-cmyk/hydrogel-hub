-- Add new tenant branding & localization columns
ALTER TABLE public.tenant_settings
  ADD COLUMN IF NOT EXISTS store_url text,
  ADD COLUMN IF NOT EXISTS store_button_label text,
  ADD COLUMN IF NOT EXISTS brand_name text,
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'America/Santiago',
  ADD COLUMN IF NOT EXISTS support_email text;

-- Update setup_new_tenant to accept new branding params
CREATE OR REPLACE FUNCTION public.setup_new_tenant(
  _company_name text,
  _bcc_email text DEFAULT NULL,
  _cutabc_company_no text DEFAULT NULL,
  _cutabc_username text DEFAULT NULL,
  _cutabc_password text DEFAULT NULL,
  _logo_url text DEFAULT NULL,
  _brand_name text DEFAULT NULL,
  _store_url text DEFAULT NULL,
  _store_button_label text DEFAULT NULL,
  _support_email text DEFAULT NULL,
  _timezone text DEFAULT 'America/Santiago'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid := auth.uid();
  _tenant_id uuid;
  _slug text;
  _existing_tenant_id uuid;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT tenant_id INTO _existing_tenant_id FROM public.profiles WHERE id = _user_id;
  IF _existing_tenant_id IS NOT NULL THEN
    RAISE EXCEPTION 'User already has a tenant assigned';
  END IF;

  _slug := lower(regexp_replace(trim(_company_name), '[^a-zA-Z0-9]+', '-', 'g'));
  _slug := trim(both '-' from _slug);
  IF _slug = '' THEN _slug := 'tenant'; END IF;
  _slug := _slug || '-' || substr(gen_random_uuid()::text, 1, 8);

  INSERT INTO public.tenants (name, slug)
  VALUES (_company_name, _slug)
  RETURNING id INTO _tenant_id;

  INSERT INTO public.tenant_settings (
    tenant_id, tenant_name, company_name, bcc_email,
    cutabc_company_no, cutabc_username, cutabc_password,
    logo_url, brand_name, store_url, store_button_label, support_email, timezone
  )
  VALUES (
    _tenant_id, _slug, _company_name, _bcc_email,
    _cutabc_company_no, _cutabc_username, _cutabc_password,
    _logo_url,
    COALESCE(NULLIF(trim(_brand_name), ''), _company_name),
    _store_url, _store_button_label, _support_email,
    COALESCE(NULLIF(trim(_timezone), ''), 'America/Santiago')
  );

  UPDATE public.profiles SET tenant_id = _tenant_id WHERE id = _user_id;

  INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, 'admin');

  RETURN _tenant_id;
END;
$function$;