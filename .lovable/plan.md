

## Plan: Publicar y dejar listo para invitar a Tomás

El multi-tenant **ya está funcionando correctamente** (verificado en DB y en código). El flujo Auth → Onboarding → setup_new_tenant → tenant aislado con RLS está completo. Tomás puede registrarse y va a tener su propio tenant sin ver datos tuyos.

Lo único que falta para invitarlo es **publicar** y **un par de mejoras de UX** para que su primera experiencia sea pulida.

### Pasos (en orden)

**1. Publicar a cutmonitor.com**
- Activar visibility = `public` (hoy no está publicado).
- Vos hacés el "Update" desde el botón Publish (no es algo que yo pueda hacer en código).
- Una vez publicado, cutmonitor.com queda activo automáticamente.

**2. Confirmar email obligatorio en signup**
- Hoy cuando Tomás se registre con email/password, va a recibir un correo de confirmación. Hay que verificar que la URL de redirect del email esté configurada para `cutmonitor.com` (no para el preview de Lovable). Si no, el link del email lo manda al lugar equivocado.

**3. Pequeñas mejoras en `/auth` y `/onboarding`**
- En `Auth.tsx`, después del signup mostrar un mensaje más claro: "Te enviamos un email a X para confirmar tu cuenta. Una vez confirmado, podrás iniciar sesión y configurar tu empresa."
- En `Onboarding.tsx` paso 0, agregar un texto introductorio breve: "Bienvenido a CutMonitor. Vamos a configurar tu cuenta en 3 pasos rápidos."

**4. (Opcional) Email de bienvenida BCC para vos**
- Trigger o lógica simple: cuando se crea un nuevo tenant, mandar un mail a tu BCC avisando "Nuevo registro: [empresa]". Así te enterás cuando Tomás (o cualquiera) se registra.

### Lo que NO hay que tocar
- `setup_new_tenant` RPC ya crea tenant + settings + rol admin atómicamente. ✓
- RLS por `get_user_tenant_id()` en todas las tablas. ✓
- `sync-cutabc` y `check-alerts` ya iteran por tenant. ✓
- `useUserTenantId` y demás hooks ya scopean correctamente. ✓

### Sobre tu pregunta de "¿los cambios se aplican a todos?"

- **Backend** (DB, edge functions, RLS): cambios en vivo al instante para todos.
- **Frontend** (UI, componentes): solo aparecen en cutmonitor.com cuando vos hagas Publish → Update. En el preview los ves al toque.
- **Datos**: la base es compartida, pero RLS aísla por tenant. Si hacés un cambio destructivo de schema (raro), afecta a todos los tenants. Por eso conviene siempre testear en preview primero.

### Detalles técnicos
- `publish_settings--update_visibility` para poner el sitio público.
- Edits menores en `src/pages/Auth.tsx` (mensaje post-signup) y `src/pages/Onboarding.tsx` (intro paso 0).
- (Opcional) Modificar `setup_new_tenant` para que mande un mail a un email fijo cuando se crea un tenant nuevo, o crear edge function `notify-new-tenant`.

