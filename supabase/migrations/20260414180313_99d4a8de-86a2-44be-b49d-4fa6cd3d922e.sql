
CREATE TABLE public.device_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fixno TEXT NOT NULL,
  bill_no TEXT NOT NULL,
  bill_date TIMESTAMP WITH TIME ZONE,
  transaction_type TEXT,
  quantity INTEGER NOT NULL DEFAULT 0,
  balance_after INTEGER,
  customer_name TEXT,
  branch_name TEXT,
  creator TEXT,
  remark TEXT,
  audit_date TIMESTAMP WITH TIME ZONE,
  raw_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(fixno, bill_no)
);

ALTER TABLE public.device_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read transactions"
  ON public.device_transactions
  FOR SELECT
  TO public
  USING (true);

CREATE INDEX idx_device_transactions_fixno ON public.device_transactions(fixno);
CREATE INDEX idx_device_transactions_bill_date ON public.device_transactions(bill_date DESC);
CREATE INDEX idx_device_transactions_type ON public.device_transactions(transaction_type);
