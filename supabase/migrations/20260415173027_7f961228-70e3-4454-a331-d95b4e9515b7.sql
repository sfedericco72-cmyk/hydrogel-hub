
-- 1. Tenants table
CREATE TABLE public.tenants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read tenants" ON public.tenants FOR SELECT USING (true);
CREATE POLICY "Anyone can insert tenants" ON public.tenants FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update tenants" ON public.tenants FOR UPDATE USING (true) WITH CHECK (true);

CREATE TRIGGER update_tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Clients table
CREATE TABLE public.clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  contact_name TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read clients" ON public.clients FOR SELECT USING (true);
CREATE POLICY "Anyone can insert clients" ON public.clients FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update clients" ON public.clients FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete clients" ON public.clients FOR DELETE USING (true);

CREATE INDEX idx_clients_tenant ON public.clients(tenant_id);

CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Points of Sale table
CREATE TABLE public.points_of_sale (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.points_of_sale ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read pos" ON public.points_of_sale FOR SELECT USING (true);
CREATE POLICY "Anyone can insert pos" ON public.points_of_sale FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update pos" ON public.points_of_sale FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete pos" ON public.points_of_sale FOR DELETE USING (true);

CREATE INDEX idx_pos_client ON public.points_of_sale(client_id);

CREATE TRIGGER update_pos_updated_at
  BEFORE UPDATE ON public.points_of_sale
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Device Assignments table
CREATE TABLE public.device_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  point_of_sale_id UUID NOT NULL REFERENCES public.points_of_sale(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  unassigned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.device_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read assignments" ON public.device_assignments FOR SELECT USING (true);
CREATE POLICY "Anyone can insert assignments" ON public.device_assignments FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update assignments" ON public.device_assignments FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete assignments" ON public.device_assignments FOR DELETE USING (true);

CREATE INDEX idx_assignments_device ON public.device_assignments(device_id);
CREATE INDEX idx_assignments_pos ON public.device_assignments(point_of_sale_id);
CREATE INDEX idx_assignments_active ON public.device_assignments(device_id) WHERE unassigned_at IS NULL;

CREATE TRIGGER update_assignments_updated_at
  BEFORE UPDATE ON public.device_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Add tenant_id to existing devices table (nullable for backward compat)
ALTER TABLE public.devices ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL;
CREATE INDEX idx_devices_tenant ON public.devices(tenant_id);

-- 6. Link tenant_settings to tenants
ALTER TABLE public.tenant_settings ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
CREATE INDEX idx_tenant_settings_tenant ON public.tenant_settings(tenant_id);
