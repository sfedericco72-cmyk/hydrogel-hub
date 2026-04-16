

El usuario quiere borrar la cuenta de Google de prueba (TestNuevoTenant) que usó para validar el aislamiento multi-tenant. La sincronización funciona, así que ese tenant de prueba ya no hace falta.

Necesito identificar qué hay que borrar:
1. El usuario en `auth.users` (la cuenta Google)
2. Su `profile` (cascade desde auth.users probablemente)
3. El tenant `TestNuevoTenant` y todo lo que cuelga de él: `tenant_settings`, `clients`, `points_of_sale`, `device_assignments`, `devices`, `device_cuts_history`, `device_transactions`, `equipment_sales`, etc.

No tengo acceso a inspeccionar la DB ahora (modo plan), pero el plan es claro y acotado.

## Plan: Borrar cuenta Google de prueba y tenant TestNuevoTenant

### Pasos

**1. Identificar el tenant y usuario a borrar**
- Buscar en `tenants` el registro con nombre `TestNuevoTenant` (o similar) y obtener su `tenant_id`
- Buscar en `profiles` los usuarios asociados a ese `tenant_id`
- Confirmar que es el usuario Google de prueba antes de borrar

**2. Migración SQL para limpieza en cascada**
Borrar en orden (de hijos a padres) para respetar foreign keys:
- `device_transactions` where `tenant_id = X`
- `device_cuts_history` where `tenant_id = X`
- `device_assignments` where `tenant_id = X`
- `equipment_sales` where `tenant_id = X`
- `devices` where `tenant_id = X`
- `points_of_sale` where `tenant_id = X`
- `clients` where `tenant_id = X`
- `tenant_settings` where `tenant_id = X`
- `user_roles` del usuario Google
- `profiles` del usuario Google
- `auth.users` del usuario Google (vía `auth.admin.deleteUser` desde edge function o SQL directo con service role)
- `tenants` el registro `TestNuevoTenant`

**3. Confirmación**
Después de borrar, listar tenants restantes para confirmar que solo queda Bitec.

### Confirmación necesaria antes de ejecutar
Antes de correr la migración, voy a:
- Listar los tenants actuales y sus usuarios para que confirmes cuál es exactamente el que querés borrar (no me quiero llevar puesto Bitec por error)

### Archivos
- 1 migración SQL de limpieza

