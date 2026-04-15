ALTER TABLE public.clients ADD COLUMN code TEXT;
CREATE UNIQUE INDEX idx_clients_code_tenant ON public.clients(tenant_id, code) WHERE code IS NOT NULL;