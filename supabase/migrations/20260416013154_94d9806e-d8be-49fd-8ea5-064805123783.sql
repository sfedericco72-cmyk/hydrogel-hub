
CREATE OR REPLACE FUNCTION public.setup_new_tenant(
  _company_name text,
  _bcc_email text DEFAULT NULL,
  _cutabc_company_no text DEFAULT NULL,
  _cutabc_username text DEFAULT NULL,
  _cutabc_password text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _tenant_id uuid;
  _slug text;
  _existing_tenant_id uuid;
BEGIN
  -- Check user is authenticated
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check user doesn't already have a tenant
  SELECT tenant_id INTO _existing_tenant_id FROM public.profiles WHERE id = _user_id;
  IF _existing_tenant_id IS NOT NULL THEN
    RAISE EXCEPTION 'User already has a tenant assigned';
  END IF;

  -- Generate slug from company name
  _slug := lower(regexp_replace(trim(_company_name), '[^a-zA-Z0-9]+', '-', 'g'));
  _slug := trim(both '-' from _slug);
  IF _slug = '' THEN _slug := 'tenant'; END IF;
  -- Add random suffix to ensure uniqueness
  _slug := _slug || '-' || substr(gen_random_uuid()::text, 1, 8);

  -- Create tenant
  INSERT INTO public.tenants (name, slug)
  VALUES (_company_name, _slug)
  RETURNING id INTO _tenant_id;

  -- Create tenant_settings
  INSERT INTO public.tenant_settings (tenant_id, tenant_name, company_name, bcc_email, cutabc_company_no, cutabc_username, cutabc_password)
  VALUES (_tenant_id, _slug, _company_name, _bcc_email, _cutabc_company_no, _cutabc_username, _cutabc_password);

  -- Link profile to tenant
  UPDATE public.profiles SET tenant_id = _tenant_id WHERE id = _user_id;

  -- Assign admin role
  INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, 'admin');

  RETURN _tenant_id;
END;
$$;
