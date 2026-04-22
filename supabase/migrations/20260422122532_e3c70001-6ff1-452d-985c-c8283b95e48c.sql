ALTER TABLE public.device_transactions ADD COLUMN IF NOT EXISTS summary text;

UPDATE public.device_transactions
SET summary = raw_data->>'summary'
WHERE summary IS NULL
  AND raw_data ? 'summary'
  AND nullif(raw_data->>'summary', '') IS NOT NULL;