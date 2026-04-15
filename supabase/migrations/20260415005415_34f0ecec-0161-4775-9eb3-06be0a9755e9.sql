CREATE TABLE public.cuts_history_backfill (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  period text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  records_loaded integer DEFAULT 0,
  error_message text,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.cuts_history_backfill ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read backfill status" ON public.cuts_history_backfill FOR SELECT USING (true);
CREATE POLICY "Anyone can insert backfill" ON public.cuts_history_backfill FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update backfill" ON public.cuts_history_backfill FOR UPDATE USING (true) WITH CHECK (true);

CREATE TRIGGER update_backfill_updated_at
  BEFORE UPDATE ON public.cuts_history_backfill
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();