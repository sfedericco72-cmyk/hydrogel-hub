-- Allow authenticated users to read alert email logs whose recipient is one of their tenant's PdV alert emails or BCC email
CREATE POLICY "Tenant can read own alert email logs"
ON public.email_send_log
FOR SELECT
TO authenticated
USING (
  template_name IN ('stock-bajo', 'dispositivo-desconectado', 'email-no-configurado')
  AND (
    EXISTS (
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