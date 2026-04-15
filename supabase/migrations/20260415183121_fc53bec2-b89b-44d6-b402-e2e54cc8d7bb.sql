
ALTER TABLE public.clients
  ADD COLUMN address text,
  ADD COLUMN latitude double precision,
  ADD COLUMN longitude double precision;
