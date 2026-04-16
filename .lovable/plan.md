

## Plan: Autenticación Admin + Migración tenant "default" → "BITEC"

### Alcance reducido
- Solo admin (sin roles de usuario normal por ahora)
- Migrar el tenant actual de "default" a "BITEC" sin perder datos
- Auth con email+contraseña + Google
- Securizar RLS (requiere login)
- Onboarding wizard para nuevos tenants (credenciales CutABC)

### Paso 1: Migraciones de base de datos

**1a. Crear tabla `profiles`**
- Columnas: `id` (FK → auth.users), `full_name`, `avatar_url`, `tenant_id` (FK → tenants)
- Trigger auto-create on signup
- RLS: usuario solo ve su perfil

**1b. Crear tabla `user_roles`**
- Enum `app_role` (solo `admin` por ahora)
- Función `has_role()` SECURITY DEFINER
- El primer usuario registrado se asigna admin manualmente

**1c. Agregar credenciales CutABC a `tenant_settings`**
- Columnas: `cutabc_company_no`, `cutabc_username`, `cutabc_password`
- Para BITEC, migrar los valores actuales de los secrets a la tabla

**1d. Migrar tenant "default" → "BITEC"**
- `UPDATE tenants SET name = 'Bitec', slug = 'bitec' WHERE ...`
- `UPDATE tenant_settings SET tenant_name = 'bitec', company_name = 'Bitec' WHERE tenant_name = 'default'`
- Asegurar que todos los devices/clients existentes apuntan al tenant_id correcto

**1e. Securizar RLS en todas las tablas**
- Reemplazar `true` por `auth.uid() IS NOT NULL` en: `clients`, `points_of_sale`, `device_assignments`, `devices`, `equipment_sales`, `tenant_settings`, `tenants`, `cuts_history_backfill`
- `tenant_settings` UPDATE solo para admins
- Tablas de email y service_role quedan igual

### Paso 2: Página de autenticación
- Crear `/auth` con login (email+contraseña) y Google
- Componente `ProtectedRoute` que redirige a `/auth` si no hay sesión
- Proteger todas las rutas excepto `/auth` y `/unsubscribe`
- Botón de logout en el header
- Página `/reset-password`

### Paso 3: Onboarding wizard (nuevos tenants)
- Después del primer login, si el tenant no tiene credenciales CutABC → wizard
- 3 pasos: Empresa → Credenciales CutABC (con instrucciones de usuario solo lectura) → Validar conexión
- Edge function `validate-cutabc-credentials` para probar login en tiempo real
- Al completar, guardar en `tenant_settings` y disparar primera sync

### Paso 4: Adaptar sync a multi-tenant
- `sync-cutabc` lee credenciales de `tenant_settings` por tenant (ya no de secrets globales)
- Itera por cada tenant activo
- `check-alerts` igual: lee por tenant
- Los secrets globales CUTABC_* quedan como fallback temporal

### Paso 5: Restricciones admin
- `/setup` solo accesible si `has_role(uid, 'admin')`
- Redirect si no es admin

### Datos existentes
Ningún dato se pierde. La migración solo renombra el tenant y vincula los registros existentes al tenant_id de BITEC.

### Estimación
~12-16 mensajes de implementación.

