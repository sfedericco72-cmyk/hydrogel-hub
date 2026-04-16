
-- 1. Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin');

-- 2. Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  tenant_id UUID REFERENCES public.tenants(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 4. has_role() security definer function
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 5. Add CutABC credential columns to tenant_settings
ALTER TABLE public.tenant_settings
  ADD COLUMN cutabc_company_no TEXT,
  ADD COLUMN cutabc_username TEXT,
  ADD COLUMN cutabc_password TEXT;

-- 6. Rename tenant_name from 'default' to 'bitec'
UPDATE public.tenant_settings
  SET tenant_name = 'bitec'
  WHERE tenant_name = 'default';

-- 7. Securize RLS on all public tables
-- Drop old open policies and replace with authenticated-only

-- clients
DROP POLICY IF EXISTS "Anyone can read clients" ON public.clients;
DROP POLICY IF EXISTS "Anyone can insert clients" ON public.clients;
DROP POLICY IF EXISTS "Anyone can update clients" ON public.clients;
DROP POLICY IF EXISTS "Anyone can delete clients" ON public.clients;

CREATE POLICY "Authenticated can read clients" ON public.clients
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert clients" ON public.clients
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update clients" ON public.clients
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete clients" ON public.clients
  FOR DELETE TO authenticated USING (true);

-- points_of_sale
DROP POLICY IF EXISTS "Anyone can read pos" ON public.points_of_sale;
DROP POLICY IF EXISTS "Anyone can insert pos" ON public.points_of_sale;
DROP POLICY IF EXISTS "Anyone can update pos" ON public.points_of_sale;
DROP POLICY IF EXISTS "Anyone can delete pos" ON public.points_of_sale;

CREATE POLICY "Authenticated can read pos" ON public.points_of_sale
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert pos" ON public.points_of_sale
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update pos" ON public.points_of_sale
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete pos" ON public.points_of_sale
  FOR DELETE TO authenticated USING (true);

-- device_assignments
DROP POLICY IF EXISTS "Anyone can read assignments" ON public.device_assignments;
DROP POLICY IF EXISTS "Anyone can insert assignments" ON public.device_assignments;
DROP POLICY IF EXISTS "Anyone can update assignments" ON public.device_assignments;
DROP POLICY IF EXISTS "Anyone can delete assignments" ON public.device_assignments;

CREATE POLICY "Authenticated can read assignments" ON public.device_assignments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert assignments" ON public.device_assignments
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update assignments" ON public.device_assignments
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete assignments" ON public.device_assignments
  FOR DELETE TO authenticated USING (true);

-- devices
DROP POLICY IF EXISTS "Anyone can read devices" ON public.devices;
DROP POLICY IF EXISTS "Anyone can update alert_email" ON public.devices;

CREATE POLICY "Authenticated can read devices" ON public.devices
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can update devices" ON public.devices
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- equipment_sales
DROP POLICY IF EXISTS "Anyone can read equipment sales" ON public.equipment_sales;
DROP POLICY IF EXISTS "Anyone can insert equipment sales" ON public.equipment_sales;
DROP POLICY IF EXISTS "Anyone can update equipment sales" ON public.equipment_sales;
DROP POLICY IF EXISTS "Anyone can delete equipment sales" ON public.equipment_sales;

CREATE POLICY "Authenticated can read equipment sales" ON public.equipment_sales
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert equipment sales" ON public.equipment_sales
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update equipment sales" ON public.equipment_sales
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete equipment sales" ON public.equipment_sales
  FOR DELETE TO authenticated USING (true);

-- tenant_settings (read: authenticated, update: admin only)
DROP POLICY IF EXISTS "Anyone can read tenant settings" ON public.tenant_settings;
DROP POLICY IF EXISTS "Anyone can insert tenant settings" ON public.tenant_settings;
DROP POLICY IF EXISTS "Anyone can update tenant settings" ON public.tenant_settings;

CREATE POLICY "Authenticated can read tenant settings" ON public.tenant_settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert tenant settings" ON public.tenant_settings
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update tenant settings" ON public.tenant_settings
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- tenants
DROP POLICY IF EXISTS "Anyone can read tenants" ON public.tenants;
DROP POLICY IF EXISTS "Anyone can insert tenants" ON public.tenants;
DROP POLICY IF EXISTS "Anyone can update tenants" ON public.tenants;

CREATE POLICY "Authenticated can read tenants" ON public.tenants
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert tenants" ON public.tenants
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update tenants" ON public.tenants
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- cuts_history_backfill
DROP POLICY IF EXISTS "Anyone can read backfill status" ON public.cuts_history_backfill;
DROP POLICY IF EXISTS "Anyone can insert backfill" ON public.cuts_history_backfill;
DROP POLICY IF EXISTS "Anyone can update backfill" ON public.cuts_history_backfill;

CREATE POLICY "Authenticated can read backfill" ON public.cuts_history_backfill
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert backfill" ON public.cuts_history_backfill
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update backfill" ON public.cuts_history_backfill
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- device_cuts_history (read: authenticated, write stays service_role via edge functions)
DROP POLICY IF EXISTS "Anyone can read cuts history" ON public.device_cuts_history;
CREATE POLICY "Authenticated can read cuts history" ON public.device_cuts_history
  FOR SELECT TO authenticated USING (true);

-- device_transactions (read: authenticated)
DROP POLICY IF EXISTS "Anyone can read transactions" ON public.device_transactions;
CREATE POLICY "Authenticated can read transactions" ON public.device_transactions
  FOR SELECT TO authenticated USING (true);
