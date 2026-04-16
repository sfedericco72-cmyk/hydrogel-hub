
-- devices: drop old unique on fixno, add new composite
ALTER TABLE public.devices DROP CONSTRAINT IF EXISTS devices_fixno_key;
ALTER TABLE public.devices ADD CONSTRAINT devices_fixno_tenant_id_key UNIQUE (fixno, tenant_id);

-- device_cuts_history: drop old unique on (fixno, cut_date), add new composite
ALTER TABLE public.device_cuts_history DROP CONSTRAINT IF EXISTS device_cuts_history_fixno_cut_date_key;
ALTER TABLE public.device_cuts_history ADD CONSTRAINT device_cuts_history_fixno_cut_date_tenant_id_key UNIQUE (fixno, cut_date, tenant_id);

-- device_transactions: drop old unique on (fixno, bill_no), add new composite
ALTER TABLE public.device_transactions DROP CONSTRAINT IF EXISTS device_transactions_fixno_bill_no_key;
ALTER TABLE public.device_transactions ADD CONSTRAINT device_transactions_fixno_bill_no_tenant_id_key UNIQUE (fixno, bill_no, tenant_id);
