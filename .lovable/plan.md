

El usuario eligió una alternativa más simple que el código de invitación: **lista blanca de emails autorizados**. Solo los emails que él agregue a la lista pueden registrarse. El banner de bienvenida explica el proceso (escribir a un email para pedir autorización).

## 1. Lista blanca de emails (`allowed_emails`)

### Tabla nueva
- `email` (text, unique, lowercase) — email autorizado.
- `notes` (text, nullable) — para qué cliente / contexto.
- `added_by` (uuid, nullable) — quién lo agregó.
- `used_at` (timestamptz, nullable) — cuándo se registró (informativo).
- `created_at`, `updated_at`.

RLS: solo admin puede leer/insertar/actualizar/borrar. **No expuesta al cliente público** — la verificación se hace en edge function con service role.

### Edge function `check-email-allowed` (pública, sin JWT)
- Recibe `{ email }`.
- Normaliza email (trim + lowercase).
- Devuelve `{ allowed: true }` o `{ allowed: false }`.
- No revela detalles (sin info sensible).

### Cambios en `src/pages/Auth.tsx`
- **Signup email/password**: antes de `supabase.auth.signUp`, llamar `check-email-allowed`. Si no autorizado → toast claro: "Tu email no está autorizado. Solicitá acceso a santiago.federico@bitec.cl".
- **Google OAuth**: bloqueo se hace post-login (al volver del OAuth). Si email no autorizado → `signOut()` inmediato + toast con instrucciones. Esto se chequea en `ProtectedRoute` o un wrapper en `Auth.tsx` que detecte la sesión recién creada.

Mejor enfoque para Google: hook en `ProtectedRoute` que, antes de chequear onboarding, valide si el email del session está en la whitelist (vía la misma edge function). Si no → `signOut()` + redirect a `/auth?denied=1`. `Auth.tsx` muestra mensaje si `?denied=1`.

### Marcar como usado
Edge function `check-email-allowed` puede recibir flag `markUsed: true` y actualizar `used_at` cuando se confirma signup exitoso. O un edge function aparte `mark-email-used`. Vamos con flag opcional para simplicidad.

## 2. Banner de bienvenida en Dashboard

Componente `WelcomeBanner` en `src/components/WelcomeBanner.tsx`:
- Card con badge "BETA", ícono Sparkles.
- Título: "Bienvenido a CutMonitor".
- Texto corto explicando: monitorea máquinas de corte de hidrogel conectadas a CutABC (cutabc.cn), muestra estado en tiempo real, alertas por email, attach rate de equipos vs ventas, gestión de clientes y sucursales.
- Aviso beta: "Estamos en versión beta — pueden haber cambios o ajustes".
- Línea sobre acceso: "El acceso es por invitación. Para autorizar nuevos usuarios, escribí a santiago.federico@bitec.cl indicando empresa y email."
- Botón "Entendido" → guarda en `localStorage` con clave `welcome-banner-dismissed-{userId}`.
- Ícono pequeño de info en header del Dashboard para volver a abrirlo.

## 3. Admin SQL para agregar emails (sin UI por ahora)

Te paso SQL listo: `INSERT INTO allowed_emails (email, notes) VALUES ('cliente@empresa.com', 'Cliente Bitec — Tomás');`. Más adelante se puede armar UI `/admin/emails`.

## Archivos a crear/editar

```text
NEW  supabase/migrations/<ts>_allowed_emails.sql       — tabla + RLS + index
NEW  supabase/functions/check-email-allowed/index.ts   — edge fn pública
NEW  supabase/functions/check-email-allowed/deno.json
NEW  src/components/WelcomeBanner.tsx
EDIT supabase/config.toml                              — verify_jwt = false para check-email-allowed
EDIT src/pages/Auth.tsx                                — gate email signup + handle ?denied=1
EDIT src/components/ProtectedRoute.tsx                 — gate Google OAuth post-login
EDIT src/pages/Dashboard.tsx                           — render WelcomeBanner
EDIT .lovable/memory/features/auth.md                  — documentar whitelist
```

## Email de contacto para solicitar acceso

Voy a usar `santiago.federico@bitec.cl` (que ya figura como `bcc_email` por defecto en `tenant_settings`). Si querés otro email, decime.

