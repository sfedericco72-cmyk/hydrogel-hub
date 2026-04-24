

## Guardar plan del tenant demo "Supermercados Líder"

Persistir el plan acordado en `.lovable/plan.md` para retomarlo cuando quieras ejecutarlo. **No se ejecuta nada todavía** — solo queda el documento listo.

## Qué se guarda

El plan completo del demo, con:
- **Acceso**: usuario nuevo dedicado (`demo@cutmonitor.com`) + onboarding normal
- **Lista de 100 sucursales**: formato a definir (CSV / solo nombres / generación sintética)
- **Profundidad media**: estados actuales variados + 90 días de `device_cuts_history` + 2-6 recargas por dispositivo + 1-2 ventas de equipos por sucursal en últimos 12 meses
- **Branding del tenant demo**: nombre "Supermercados Líder Demo", logo Líder, timezone Santiago
- **Implementación**: una edge function nueva `seed-demo-tenant` (admin-only, service_role) que recibe la lista de sucursales y siembra todo en orden (clients → POS → devices → assignments → cuts history → transactions → equipment sales)
- **Aislamiento**: todo va con `tenant_id` del demo, RLS existente lo respeta, cero impacto en Bitec
- **Sin cambios de schema**: usa tablas existentes
- **Permanente**: no se incluye script de borrado

## Archivos a tocar (cuando lo disparemos)

- `EDIT .lovable/plan.md` — ahora, para guardar el plan
- `EDIT supabase/functions/seed-demo-tenant/index.ts` — después, edge function de seeding
- `INSERT` en `allowed_emails` — después, email del usuario demo
- *(Opcional)* `EDIT src/pages/Setup.tsx` — botón "Sembrar datos demo" visible solo para el tenant demo

## Cómo lo retomamos

Cuando quieras arrancar, decime "ejecutemos el plan demo" y:
1. Definimos formato de las 100 sucursales (te pregunto si todavía no lo decidiste)
2. Creo la edge function
3. Vos hacés el onboarding del usuario demo
4. Disparamos el seeding (~30-60 seg)
5. Revisás el dashboard demo

## Resultado de este paso

Solo queda el archivo `.lovable/plan.md` actualizado con el plan completo. Nada más cambia en el proyecto.

