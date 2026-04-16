

El usuario quiere dos cosas:

1. **Cambiar el email de contacto** en el banner de bienvenida y en la página de Auth de `santiago.federico@bitec.cl` a `cutmonitor@bitec.cl`.
2. **Saber dónde actualizar la lista blanca** de emails autorizados.

## 1. Cambio de email de contacto

Reemplazar la constante `CONTACT_EMAIL` en dos archivos:
- `src/components/WelcomeBanner.tsx` línea 8: `"santiago.federico@bitec.cl"` → `"cutmonitor@bitec.cl"`
- `src/pages/Auth.tsx` línea 13: `"santiago.federico@bitec.cl"` → `"cutmonitor@bitec.cl"`

También actualizo la memoria `auth.md` para reflejar el nuevo email.

**Nota sobre `bcc_email`**: el campo `bcc_email` en `tenant_settings` (default `santiago.federico@bitec.cl`) es independiente — se usa como BCC en alertas transaccionales, no como email de contacto público. No lo toco salvo que vos lo pidas.

**Nota sobre el dominio**: `cutmonitor@bitec.cl` es solo un texto de contacto (mailto). Para que ese buzón reciba mails de verdad, vos tenés que crearlo en el proveedor de correo de `bitec.cl`. No requiere cambios técnicos en CutMonitor.

## 2. Cómo actualizar la lista blanca (`allowed_emails`)

Hoy **no hay UI de admin** para esto. Las opciones disponibles:

**Opción A — SQL directo desde Lovable Cloud (lo que hay hoy)**
Vos abrís el backend de Lovable Cloud (botón "View Backend") → SQL editor, y corrés:
```sql
-- Agregar un email autorizado
INSERT INTO allowed_emails (email, notes)
VALUES ('cliente@empresa.com', 'Cliente Bitec — Tomás');

-- Ver todos los emails autorizados
SELECT email, notes, used_at, created_at FROM allowed_emails ORDER BY created_at DESC;

-- Quitar autorización
DELETE FROM allowed_emails WHERE email = 'cliente@empresa.com';
```
El trigger `normalize_allowed_email` se encarga de pasar el email a minúsculas automáticamente.

**Opción B — Crear una pantalla `/admin/emails` (no incluida en este cambio)**
Una UI simple para listar, agregar y borrar emails desde el navegador, protegida por rol admin. Si querés, lo armamos en una tarea separada.

## Cambio propuesto en este turno

Solo el rename del email de contacto (3 archivos). La pantalla admin la dejo como sugerencia para que decidas si querés armarla ahora o más adelante.

```text
EDIT src/components/WelcomeBanner.tsx          — CONTACT_EMAIL → cutmonitor@bitec.cl
EDIT src/pages/Auth.tsx                        — CONTACT_EMAIL → cutmonitor@bitec.cl
EDIT .lovable/memory/features/auth.md          — actualizar email de contacto
```

