

## Plan: Aislar datos por tenant (multi-tenant RLS)

### Problema
Todas las tablas de datos usan `USING (true)` en RLS. Cualquier usuario autenticado ve todos los registros de todos los tenants.

### Solución

**1. Crear función helper `get_user_tenant_id()`**
- Función SECURITY DEFINER que devuelve el `tenant_id` del usuario autenticado desde `profiles`
- Se usa en todas las políticas RLS para filtrar por tenant

**2. Actualizar RLS en tablas con `tenant_id`**

Tablas que YA tienen `tenant_id`: `clients`, `devices`
- Cambiar SELECT/INSERT/UPDATE/DELETE policies de `true` a `tenant_id = get_user_tenant_id()`

**3. Agregar `tenant_id` a tablas que NO lo tienen**

| Tabla | Acción |
|-------|--------|
| `points_of_sale` | Agregar `tenant_id uuid`, popular desde `clients.tenant_id` via `client_id` |
| `device_assignments` | Agregar `tenant_id uuid`, popular desde `devices.tenant_id` via `device_id` |
| `equipment_sales` | Agregar `tenant_id uuid` |
| `device_cuts_history` | Filtrar via JOIN con devices (por `fixno`) — o agregar `tenant_id` |
| `device_transactions` | Idem |
| `cuts_history_backfill` | Mantener global (es operacional) |

**4. Actualizar `useTenantSettings` hook**
- Cambiar de `.eq("tenant_name", "bitec")` a filtrar por `tenant_id` del usuario actual (obteniéndolo de profiles)

**5. Actualizar código frontend**
- Todos los INSERT deben incluir `tenant_id` del usuario
- Hooks como `useClients`, `useDevices` ya no necesitan filtro manual — RLS lo hace

**6. Limpiar cuenta huérfana**
- El perfil `aef452e2` sin tenant se puede dejar (el onboarding lo atrapa)

### Migración SQL (resumen)

```sql
-- Helper function
CREATE FUNCTION get_user_tenant_id() RETURNS uuid ...

-- Add tenant_id where missing
ALTER TABLE points_of_sale ADD COLUMN tenant_id uuid;
ALTER TABLE device_assignments ADD COLUMN tenant_id uuid;
ALTER TABLE equipment_sales ADD COLUMN tenant_id uuid;

-- Backfill existing data
UPDATE points_of_sale SET tenant_id = (SELECT tenant_id FROM clients WHERE clients.id = points_of_sale.client_id);
UPDATE device_assignments SET tenant_id = (SELECT tenant_id FROM devices WHERE devices.id = device_assignments.device_id);
UPDATE equipment_sales SET tenant_id = 'c10e00fe-...'; -- all belong to Bitec

-- Replace all permissive RLS policies with tenant-scoped ones
-- Example: clients SELECT
DROP POLICY "Authenticated can read clients" ON clients;
CREATE POLICY "Tenant can read clients" ON clients FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id());
```

### Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| Migración SQL | Función helper + ALTER TABLEs + nuevas RLS policies |
| `src/hooks/useTenantSettings.ts` | Filtrar por tenant_id del usuario en vez de hardcoded "bitec" |
| `src/hooks/useClients.ts` | Agregar tenant_id en INSERTs |
| `src/pages/ClientsManager.tsx` | Pasar tenant_id al crear clientes/PdV |
| Edge functions (`sync-cutabc`, `check-alerts`) | Iterar por tenant o filtrar por tenant_id |

### Estimación
~3-4 mensajes: migración grande + actualización de hooks + edge functions

### Nota sobre la cuenta Google
Después de este cambio, cuando entres con Google verás solo los datos de TestNuevoTenant (que está vacío). Bitec queda aislado para santiago.federico@bitec.cl.

