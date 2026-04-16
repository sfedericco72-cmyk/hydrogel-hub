
-- 1. Helper function: get current user's tenant_id
CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
$$;

-- 2. Add tenant_id to tables that don't have it
ALTER TABLE public.points_of_sale ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.device_assignments ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.equipment_sales ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.device_cuts_history ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.device_transactions ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);

-- 3. Backfill existing data
UPDATE public.points_of_sale SET tenant_id = c.tenant_id
FROM public.clients c WHERE c.id = points_of_sale.client_id;

UPDATE public.device_assignments SET tenant_id = d.tenant_id
FROM public.devices d WHERE d.id = device_assignments.device_id;

UPDATE public.equipment_sales SET tenant_id = 'c10e00fe-c1f6-423e-85db-8996c65dc1b6';

UPDATE public.device_cuts_history SET tenant_id = d.tenant_id
FROM public.devices d WHERE d.fixno = device_cuts_history.fixno;

UPDATE public.device_transactions SET tenant_id = d.tenant_id
FROM public.devices d WHERE d.fixno = device_transactions.fixno;

-- 4. Replace RLS policies on clients
DROP POLICY IF EXISTS "Authenticated can read clients" ON public.clients;
DROP POLICY IF EXISTS "Authenticated can insert clients" ON public.clients;
DROP POLICY IF EXISTS "Authenticated can update clients" ON public.clients;
DROP POLICY IF EXISTS "Authenticated can delete clients" ON public.clients;

CREATE POLICY "Tenant can read clients" ON public.clients FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id());
CREATE POLICY "Tenant can insert clients" ON public.clients FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id());
CREATE POLICY "Tenant can update clients" ON public.clients FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id()) WITH CHECK (tenant_id = get_user_tenant_id());
CREATE POLICY "Tenant can delete clients" ON public.clients FOR DELETE TO authenticated
  USING (tenant_id = get_user_tenant_id());

-- 5. Replace RLS policies on devices
DROP POLICY IF EXISTS "Authenticated can read devices" ON public.devices;
DROP POLICY IF EXISTS "Authenticated can update devices" ON public.devices;

CREATE POLICY "Tenant can read devices" ON public.devices FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id());
CREATE POLICY "Tenant can update devices" ON public.devices FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id()) WITH CHECK (tenant_id = get_user_tenant_id());
-- Service role needs to insert/upsert devices during sync
CREATE POLICY "Service can manage devices" ON public.devices FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- 6. Replace RLS policies on points_of_sale
DROP POLICY IF EXISTS "Authenticated can read pos" ON public.points_of_sale;
DROP POLICY IF EXISTS "Authenticated can insert pos" ON public.points_of_sale;
DROP POLICY IF EXISTS "Authenticated can update pos" ON public.points_of_sale;
DROP POLICY IF EXISTS "Authenticated can delete pos" ON public.points_of_sale;

CREATE POLICY "Tenant can read pos" ON public.points_of_sale FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id());
CREATE POLICY "Tenant can insert pos" ON public.points_of_sale FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id());
CREATE POLICY "Tenant can update pos" ON public.points_of_sale FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id()) WITH CHECK (tenant_id = get_user_tenant_id());
CREATE POLICY "Tenant can delete pos" ON public.points_of_sale FOR DELETE TO authenticated
  USING (tenant_id = get_user_tenant_id());

-- 7. Replace RLS policies on device_assignments
DROP POLICY IF EXISTS "Authenticated can read assignments" ON public.device_assignments;
DROP POLICY IF EXISTS "Authenticated can insert assignments" ON public.device_assignments;
DROP POLICY IF EXISTS "Authenticated can update assignments" ON public.device_assignments;
DROP POLICY IF EXISTS "Authenticated can delete assignments" ON public.device_assignments;

CREATE POLICY "Tenant can read assignments" ON public.device_assignments FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id());
CREATE POLICY "Tenant can insert assignments" ON public.device_assignments FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id());
CREATE POLICY "Tenant can update assignments" ON public.device_assignments FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id()) WITH CHECK (tenant_id = get_user_tenant_id());
CREATE POLICY "Tenant can delete assignments" ON public.device_assignments FOR DELETE TO authenticated
  USING (tenant_id = get_user_tenant_id());

-- 8. Replace RLS policies on equipment_sales
DROP POLICY IF EXISTS "Authenticated can read equipment sales" ON public.equipment_sales;
DROP POLICY IF EXISTS "Authenticated can insert equipment sales" ON public.equipment_sales;
DROP POLICY IF EXISTS "Authenticated can update equipment sales" ON public.equipment_sales;
DROP POLICY IF EXISTS "Authenticated can delete equipment sales" ON public.equipment_sales;

CREATE POLICY "Tenant can read equipment sales" ON public.equipment_sales FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id());
CREATE POLICY "Tenant can insert equipment sales" ON public.equipment_sales FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id());
CREATE POLICY "Tenant can update equipment sales" ON public.equipment_sales FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id()) WITH CHECK (tenant_id = get_user_tenant_id());
CREATE POLICY "Tenant can delete equipment sales" ON public.equipment_sales FOR DELETE TO authenticated
  USING (tenant_id = get_user_tenant_id());

-- 9. Replace RLS on device_cuts_history
DROP POLICY IF EXISTS "Authenticated can read cuts history" ON public.device_cuts_history;

CREATE POLICY "Tenant can read cuts history" ON public.device_cuts_history FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id());
CREATE POLICY "Service can manage cuts history" ON public.device_cuts_history FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- 10. Replace RLS on device_transactions
DROP POLICY IF EXISTS "Authenticated can read transactions" ON public.device_transactions;

CREATE POLICY "Tenant can read transactions" ON public.device_transactions FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id());
CREATE POLICY "Service can manage transactions" ON public.device_transactions FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- 11. Scope tenant_settings read to own tenant
DROP POLICY IF EXISTS "Authenticated can read tenant settings" ON public.tenant_settings;
CREATE POLICY "Tenant can read own settings" ON public.tenant_settings FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id());

-- 12. Scope tenants read to own tenant
DROP POLICY IF EXISTS "Authenticated can read tenants" ON public.tenants;
CREATE POLICY "Tenant can read own tenant" ON public.tenants FOR SELECT TO authenticated
  USING (id = get_user_tenant_id());
