## Diagnóstico: el backfill está hardcodeado a Bitec

Tu intuición es correcta. La función `backfill-cuts-history` **ignora completamente el tenant del usuario logueado** y siempre carga datos con las credenciales de Bitec hardcodeadas en variables de entorno. Por eso:

1. **Los meses que ves precargados (Abr 2025 → Ene 2026)** son del backfill que vos corriste hace una semana logueado como Bitec. Como la tabla `cuts_history_backfill` no tiene `tenant_id`, esos registros aparecen para CUALQUIER usuario que abra `/setup`.
2. **Cuando como KLAZ apretás "Cargar"**, la función se loguea con credenciales de Bitec (`CUT05` + usuario `lovable`), trae transacciones de Bitec, e intenta guardarlas con `tenant_id = NULL` (porque el upsert no incluye tenant_id). Resultado: 182 registros huérfanos en BD que no se ven en ningún dashboard.

### Evidencia

**Tabla `tenants`:**
| name | slug | cutabc_username |
|------|------|-----------------|
| Bitec | bitec | lovable |
| KLAZ | klaz-bef23799 | lovablearg |

**Tabla `device_cuts_history` por tenant:**
| tenant_id | registros | rango |
|-----------|-----------|-------|
| Bitec | 8.479 | abr/2025 → hoy |
| KLAZ | 302 | hoy únicamente (vienen del sync diario) |
| **NULL (huérfanos)** | **182** | **ene/2026** ← creados por tu intento de backfill como KLAZ |

**Tabla `cuts_history_backfill`:** 10 períodos cargados, todos sin `tenant_id` → la UI los muestra a todos los usuarios.

**Código culpable** (`supabase/functions/backfill-cuts-history/index.ts`):
- Línea 10-25: `loginCutABC()` lee `CUTABC_COMPANY_NUMBER`, `CUTABC_USERNAME`, `CUTABC_PASSWORD` de **secrets de entorno** (Bitec) — no de `tenant_settings`.
- Línea 88: lee solo `period` del body, nunca pregunta por tenant.
- Línea 99-104: upsert sin `tenant_id`, `onConflict: "period"` (debería ser `period,tenant_id`).
- Línea 180-185: el array de history **no incluye `tenant_id`** → se inserta como NULL.
- Línea 193: `onConflict: "fixno,cut_date"` (la tabla ya tiene constraint `fixno,cut_date,tenant_id` por sync-cutabc, pero como tenant_id es NULL acá no colisiona con los datos reales).

Compará con `sync-cutabc` que sí lo hace bien (lee `tenant_settings`, itera tenants, incluye `tenant_id` en upserts).

## Plan de arreglo

### 1. Refactor de `backfill-cuts-history`
Replicar el patrón de `sync-cutabc`:
- Recibir `period` + identificar al tenant del caller (vía JWT del usuario que invoca, leer su `profiles.tenant_id`)
- Levantar credenciales CutABC de `tenant_settings` para ese tenant
- Hacer login con esas credenciales (no con secrets)
- Incluir `tenant_id` en TODOS los upserts (`device_cuts_history` y `cuts_history_backfill`)
- Cambiar `onConflict` a `"fixno,cut_date,tenant_id"` y `"period,tenant_id"` respectivamente

### 2. Migración de schema
- Agregar columna `tenant_id uuid` a `cuts_history_backfill`
- Cambiar la unique constraint de `(period)` a `(period, tenant_id)` para que cada tenant tenga su propio historial de backfills
- Agregar RLS policy: `tenant_id = get_user_tenant_id()` en SELECT/INSERT/UPDATE (hoy es `true` para todos)

### 3. Limpieza de datos
- **Borrar los 182 registros huérfanos** en `device_cuts_history` con `tenant_id IS NULL` (los que generaste con tus intentos como KLAZ — son de Bitec pero quedaron sin dueño y no se ven en ningún lado)
- **Asignar los 10 períodos existentes en `cuts_history_backfill` al tenant Bitec** (ya que vos los corriste logueado como Bitec). Así KLAZ va a ver su tabla limpia.

### 4. Frontend (`useBackfillStatus`)
Hoy hace `select * from cuts_history_backfill` sin filtro — confía en RLS. Una vez que el RLS esté bien, va a filtrar automáticamente. **No requiere cambios de código en el hook**, solo asegurar que la query siga funcionando.

### 5. Edge function: `verify_jwt`
Agregar `[functions.backfill-cuts-history] verify_jwt = true` en `supabase/config.toml` para poder leer el `auth.uid()` del caller. Hoy está en default. Y dentro de la función, usar el JWT del request para crear un cliente con `Authorization` header y consultar `profiles` (o usar service role + leer el sub del JWT).

## Resultado esperado

Después del fix, cuando vos (como usuario de KLAZ) apretes "Cargar Mar 2026":
- La función se loguea en CutABC con `lovablearg` (las credenciales de KLAZ)
- Trae transacciones del tenant KLAZ
- Las guarda con `tenant_id = a18d13ac-...` (KLAZ)
- En `/setup` solo ves los backfills de KLAZ (la columna "Recargar" arrancará vacía para KLAZ, y Bitec va a ver los suyos sin cambios)
- El dashboard de KLAZ por fin va a mostrar cortes históricos

## Archivos a tocar

- `MIGRATION` agregar `tenant_id` a `cuts_history_backfill`, nueva unique, nueva RLS, limpieza de datos
- `EDIT supabase/functions/backfill-cuts-history/index.ts` — refactor completo siguiendo patrón de `sync-cutabc`
- `EDIT supabase/config.toml` — `verify_jwt = true` para `backfill-cuts-history`
- `DEPLOY backfill-cuts-history`

## Una pregunta antes de ejecutar

Los 10 períodos que ya están cargados (`2025-04` a `2026-01`, todos de Bitec): ¿los **asigno a Bitec** (mantienen su valor para Bitec, KLAZ los verá vacíos para recargarlos), o preferís **borrarlos todos** y que ambos tenants arranquen de cero? Recomiendo asignarlos a Bitec porque ya tienen 8.479 registros válidos asociados y borrarlos te obliga a recargar todo Bitec desde cero.
