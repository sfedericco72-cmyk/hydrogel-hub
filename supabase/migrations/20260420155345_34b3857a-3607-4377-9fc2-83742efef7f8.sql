-- Update RLS to allow tenant to also read alert email logs whose metadata.tenant_id matches
DROP POLICY IF EXISTS "Tenant can read own alert email logs" ON public.email_send_log;

CREATE POLICY "Tenant can read own alert email logs"
ON public.email_send_log
FOR SELECT
TO authenticated
USING (
  template_name IN ('stock-bajo', 'dispositivo-desconectado', 'email-no-configurado')
  AND (
    (metadata->>'tenant_id') = public.get_user_tenant_id()::text
    OR EXISTS (
      SELECT 1 FROM public.points_of_sale pos
      WHERE pos.tenant_id = public.get_user_tenant_id()
        AND lower(trim(pos.alert_email)) = lower(trim(email_send_log.recipient_email))
    )
    OR EXISTS (
      SELECT 1 FROM public.tenant_settings ts
      WHERE ts.tenant_id = public.get_user_tenant_id()
        AND lower(trim(ts.bcc_email)) = lower(trim(email_send_log.recipient_email))
    )
  )
);

-- One-shot cleanup: remove BCC duplicate rows from past alerts.
-- A row is considered a BCC duplicate when its recipient matches some tenant's bcc_email
-- AND a sibling row (same template, same calendar date) was sent to a PdV alert_email of the same tenant.
DELETE FROM public.email_send_log bcc
USING public.tenant_settings ts
WHERE bcc.template_name IN ('stock-bajo', 'dispositivo-desconectado')
  AND lower(trim(bcc.recipient_email)) = lower(trim(ts.bcc_email))
  AND EXISTS (
    SELECT 1
    FROM public.email_send_log sib
    JOIN public.points_of_sale pos
      ON pos.tenant_id = ts.tenant_id
     AND lower(trim(pos.alert_email)) = lower(trim(sib.recipient_email))
    WHERE sib.template_name = bcc.template_name
      AND date_trunc('day', sib.created_at) = date_trunc('day', bcc.created_at)
  );