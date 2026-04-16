

## Plan: Completar flujo de onboarding para usuarios nuevos + opción de testeo

### Problema actual
Cuando un usuario nuevo se registra, su `profiles.tenant_id` es `null`. El onboarding intenta actualizar `tenant_settings` con ese tenant_id null → falla. Falta crear el tenant automáticamente.

### Cambios

**1. Modificar `Onboarding.tsx` — handleFinish()**
- Si `profile.tenant_id` es null:
  - Crear un nuevo registro en `tenants` (name = company_name, slug = generado)
  - Crear un nuevo registro en `tenant_settings` con las credenciales CutABC
  - Actualizar `profiles.tenant_id` con el nuevo tenant
  - Asignar rol `admin` al usuario en `user_roles`
- Si ya tiene tenant_id (caso existente): actualizar como está ahora

**2. Ajustar RLS para permitir estas operaciones**
- `tenants` INSERT: actualmente solo admins. Un usuario nuevo no tiene rol todavía → necesita policy para INSERT si no tiene tenant asignado
- `tenant_settings` INSERT: mismo caso
- `profiles` UPDATE: ya existe policy para `auth.uid() = id` ✓
- `user_roles` INSERT: actualmente bloqueado para todos → necesita policy o usar una database function SECURITY DEFINER que haga todo el setup

**3. Crear función `setup_new_tenant` SECURITY DEFINER**
Más limpio y seguro: una sola función de DB que:
- Crea el tenant
- Crea tenant_settings con credenciales
- Actualiza profiles.tenant_id
- Asigna rol admin
- Todo en una transacción

El onboarding solo llama a esta función vía `supabase.rpc('setup_new_tenant', {...})`.

**4. Para testear**
- Registrarte con otro email (ej: `tu+test@gmail.com`)
- Al entrar, te redirige al wizard de onboarding
- Completás los 3 pasos y queda configurado

### Estimación
~2 mensajes: 1 migración (función DB) + 1 actualización del onboarding.

