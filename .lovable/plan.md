# Plan: Tenant demo "Supermercados Líder"

> Estado: **guardado, no ejecutado**. Disparar cuando el usuario diga "ejecutemos el plan demo".

## Objetivo
Crear un tenant aislado con datos sintéticos realistas para usar en demos comerciales sin tocar Bitec ni ningún tenant real.

## Decisiones tomadas
- **Acceso**: Usuario nuevo dedicado (ej: `demo@cutmonitor.com`). Se agrega a `allowed_emails`, hace onboarding normal, queda asignado solo al tenant demo. El usuario actual sigue viendo Bitec sin cambios.
- **Lista de 100 sucursales**: formato a definir al momento de ejecutar (CSV con dirección/ciudad, solo nombres, o generación 100% sintética tipo "Líder Sucursal 001").
- **Profundidad de datos**: Media — 90 días de cortes históricos + recargas + ventas de equipos. Attach rate funcional, timeline mensual con datos, alertas históricas plausibles.
- **Limpieza**: No hace falta script de borrado, queda permanente.

## Branding del tenant demo
- `company_name` / `brand_name`: "Supermercados Líder Demo"
- `logo_url`: logo de Líder (URL pública)
- `store_url`: vacío o URL ficticia (ej: tienda interna de Líder)
- `timezone`: `America/Santiago`
- `support_email`: `demo@cutmonitor.com`
- `bcc_email`: `demo@cutmonitor.com`

## Implementación

### 1. Edge function nueva: `seed-demo-tenant`
- `verify_jwt = false`, autenticación por header con `SUPABASE_SERVICE_ROLE_KEY` (admin-only).
- Recibe: `{ tenant_id, branches: [{ name, address?, city? }, ...] }`.
- Siembra en orden, todo con `tenant_id` del demo:
  1. **Clients**: 1 cliente "Supermercados Líder" + clientes secundarios opcionales.
  2. **Points of sale**: 100 sucursales con dirección/ciudad (random plausible si no viene).
  3. **Devices**: 1 device por sucursal, `fixno` sintético (ej: `LIDER-DEMO-0001` a `LIDER-DEMO-0100`), `total_cuts`/`remaining_cuts` random pero coherentes, `latest_online_time` distribuido para variar estados (verde/amarillo/rojo, conectado/desconectado).
  4. **Device assignments**: link device ↔ POS, `assigned_at` distribuido en últimos 6-12 meses.
  5. **device_cuts_history**: 90 días por device, con `daily_cuts` random siguiendo curva semanal (más uso lunes-viernes).
  6. **device_transactions**: 2-6 recargas por device en los últimos 90 días, con `summary`, `audit_date`, `bill_date`.
  7. **equipment_sales**: 1-2 ventas por sucursal en últimos 12 meses para que attach rate tenga sentido.
- Usa `service_role` client → bypass de RLS, pero todo escrito con `tenant_id` correcto → RLS protege en lectura.

### 2. Onboarding del usuario demo
- INSERT en `allowed_emails` para `demo@cutmonitor.com`.
- Usuario hace signup normal en `/auth` → completa onboarding de 4 pasos con branding Líder → queda creado el `tenant_id` demo.
- Después se invoca `seed-demo-tenant` con ese `tenant_id`.

### 3. Disparo del seeding
Opciones (decidir al ejecutar):
- (a) `curl` directo a la edge function con la lista de sucursales como JSON.
- (b) Botón "Sembrar datos demo" visible solo si `tenant_id` == demo, en `/setup`.

## Aislamiento garantizado
- Toda la data lleva `tenant_id` del demo.
- RLS existente (`get_user_tenant_id()`) ya filtra por tenant en todas las tablas.
- Cero impacto en Bitec ni en cualquier otro tenant.
- `sync-cutabc` no toca el demo porque el tenant demo NO tiene credenciales CutABC (`cutabc_company_no` queda NULL).
- `check-alerts` SÍ va a procesar el demo (itera todos los tenants). Para evitar enviar emails reales: dejar `bcc_email` y `alert_email` de los POS apuntando a `demo@cutmonitor.com` o pausar alertas con `alerts_paused_until` lejos en el futuro.

## Sin cambios de schema
Toda la data va a tablas existentes. No hay migration nueva.

## Archivos a tocar (al ejecutar)
- `supabase/functions/seed-demo-tenant/index.ts` — NUEVA edge function
- `INSERT` en `allowed_emails` — email del usuario demo
- *(Opcional)* `src/pages/Setup.tsx` — botón "Sembrar datos demo" para el tenant demo

## Tiempo estimado de ejecución
~30-60 segundos de seeding una vez disparado.

## Riesgo de que `check-alerts` mande emails reales del demo
**Mitigación**: al crear el tenant demo, setear `alerts_paused_until = '2099-01-01'` en `tenant_settings` para que nunca dispare alertas reales. Si querés mostrar alertas en el demo, las generamos sintéticas en `email_send_log` directamente.
