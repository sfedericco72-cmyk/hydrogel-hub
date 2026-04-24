-- Restaurar valores correctos del tenant Bitec que se habían pisado:
--  - company_name = 'Bitec' (estaba como 'TestNuevoTenant')
--  - support_email = 'cutmonitor@bitec.cl' (era el email personal de un admin)
-- El brand_name queda existente en BD pero ya no se usa en los emails:
-- el "From" siempre es "CutMonitor" desde ahora.
UPDATE public.tenant_settings
SET
  company_name = 'Bitec',
  support_email = 'cutmonitor@bitec.cl'
WHERE tenant_name = 'bitec';
