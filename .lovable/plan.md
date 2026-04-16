

## Plan: Arreglar dispositivos duplicados entre tenants con mismas credenciales CutABC

### Problema
El upsert de `devices` usa `onConflict: "fixno"` — la constraint de unicidad es solo sobre `fixno`. Cuando dos tenants comparten las mismas credenciales CutABC (como ahora con CUT05/lovable), el último tenant en sincronizar sobreescribe los dispositivos del primero. Por eso tu cuenta Google (tenant TestNuevoTenant) no ve dispositivos: Bitec sincronizó después y se quedó con todos.

Lo mismo pasa con `device_cuts_history` (`fixno,cut_date`) y `device_transactions` (`fixno,bill_no`).

### Solución

**1. Migración: cambiar constraints de unicidad para incluir `tenant_id`**

| Tabla | Constraint actual | Nueva constraint |
|-------|------------------|-----------------|
| `devices` | `UNIQUE(fixno)` | `UNIQUE(fixno, tenant_id)` |
| `device_cuts_history` | `UNIQUE(fixno, cut_date)` | `UNIQUE(fixno, cut_date, tenant_id)` |
| `device_transactions` | `UNIQUE(fixno, bill_no)` | `UNIQUE(fixno, bill_no, tenant_id)` |

**2. Actualizar `sync-cutabc`**
- Cambiar `onConflict` para incluir `tenant_id` en las 3 tablas
- Esto permite que cada tenant tenga su propia copia de los dispositivos

**3. Re-sincronizar**
- Después de la migración, sincronizar de nuevo para que ambos tenants tengan sus dispositivos

### Archivos a modificar
- Migración SQL (constraints)
- `supabase/functions/sync-cutabc/index.ts` (onConflict)

### Nota sobre SuperAdmin
Este cambio es prerequisito para que el SuperAdmin funcione bien. Lo implementamos después de que el multi-tenant funcione correctamente.

