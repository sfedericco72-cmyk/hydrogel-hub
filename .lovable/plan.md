

## Auditoría: qué está hardcodeado a Bitec hoy

Recorrí todo el código y encontré varios lugares donde la marca/configuración de Bitec quedó pegada en lugar de ser parametrizable por tenant:

### En los emails (lo que ven los clientes finales)
- **Logo**: `https://bitec.cl/wp-content/uploads/2025/01/logo-bitec-hd.png` hardcodeado en los 3 templates (`stock-bajo`, `dispositivo-desconectado`, `email-no-configurado`).
- **Nombre del remitente** ("Bitec Hydrogel Hub"): hardcodeado en `send-transactional-email/index.ts` y en cada template (`SITE_NAME`).
- **Botón "Comprar insumos en bitec.cl"** → URL `https://bitec.cl/tienda/`: hardcodeado en `stock-bajo.tsx`. Esto es lo más crítico porque le manda los clientes de OTROS tenants directo a la tienda de Bitec.
- **Texto del botón**: "Comprar insumos en bitec.cl" — hardcodeado.
- **Pie**: "contacte a su ejecutivo comercial" — genérico, OK.

### En la app (lo que ve el usuario logueado)
- **Email de contacto** `cutmonitor@bitec.cl` hardcodeado en `Auth.tsx` y `WelcomeBanner.tsx` ("solicitá acceso a..."). Esto es de la plataforma CutMonitor, no del tenant — tiene sentido que quede así.

### En la lógica de alertas
- **Timezone** `America/Santiago` hardcodeado en `check-alerts/index.ts`. Para tenants en Argentina/Perú/etc. va a calcular mal la hora.

### En el onboarding
- Hoy se piden: nombre de empresa, BCC email, credenciales CutABC.
- **No se piden**: logo, URL de tienda, texto del botón, color de marca, timezone.

## Cambios propuestos

### 1. Nuevas columnas en `tenant_settings`
```text
logo_url            text       — URL pública del logo del tenant (ya existe, pero no se usa)
store_url           text       — URL del botón "Comprar" en el email de stock bajo
store_button_label  text       — Texto del botón (default: "Comprar insumos")
brand_name          text       — Nombre que aparece como remitente y firma (default: company_name)
timezone            text       — IANA timezone, default 'America/Santiago'
support_email       text       — Email de contacto del tenant para sus clientes (footer emails)
```

`logo_url` y `bcc_email` ya existen → reutilizar.

### 2. Templates de email pasan a recibir branding por props
Hoy los templates leen constantes hardcodeadas. Cambio:
- `SITE_NAME`, `LOGO_URL`, store URL, store label → entran por `templateData` como props.
- `check-alerts` carga `tenant_settings` (ya lo hace) y agrega `brand_name`, `logo_url`, `store_url`, `store_button_label`, `support_email` al `templateData` de cada send.
- `send-transactional-email`: el `from` header pasa a usar `brand_name` del payload (cae a `SITE_NAME` global como fallback para emails de auth/sistema).
- Los templates rinden con valores default si faltan props (no rompe los previews del dashboard).

### 3. Onboarding: sumar paso "Marca y comunicación"
Insertar un nuevo paso entre "Empresa" y "Credenciales CutABC":

```text
Paso 1: Empresa            (company_name, bcc_email)  ← ya existe
Paso 2: Marca [NUEVO]      (logo_url, brand_name, store_url, store_button_label, support_email, timezone)
Paso 3: Credenciales       ← ya existe
Paso 4: Validar            ← ya existe
```

Campos del nuevo paso, todos opcionales salvo lo mínimo:
- **Logo (URL)**: input de URL + preview en vivo. Opcional — si vacío, no se muestra logo.
- **Nombre de marca para emails**: default = `company_name`.
- **URL tienda online**: opcional. Si vacío → el botón "Comprar" no se muestra en el email de stock bajo.
- **Texto del botón**: default "Comprar insumos".
- **Email de soporte para tus clientes**: opcional, aparece en footer "consultas: ...".
- **Zona horaria**: select con opciones comunes (Santiago, Buenos Aires, Lima, Bogotá, México), default Santiago.

`setup_new_tenant` RPC se actualiza para aceptar y guardar estos campos.

### 4. Setup page (`/setup`): agregar sección "Marca y comunicación"
Mismos campos que el paso 2 del onboarding, editables después. Hoy `Setup.tsx` no tiene sección de logo ni store URL.

### 5. `check-alerts`: usar timezone del tenant
- Cargar `timezone` de `tenant_settings` por tenant.
- Reemplazar `TENANT_TZ` constante por el valor del tenant en cada iteración del loop.

### 6. Datos existentes (Bitec)
Migración de datos one-shot (insert tool, no schema):
- Para el tenant "bitec": setear `logo_url`, `store_url=https://bitec.cl/tienda/`, `store_button_label='Comprar insumos en bitec.cl'`, `brand_name='Bitec Hydrogel Hub'`, `timezone='America/Santiago'`.
- Para cualquier otro tenant ya creado: dejar campos vacíos (los emails caen a defaults sanos sin marca específica).

## Detalles técnicos

**Archivos a tocar:**
- `MIGRATION` — agregar columnas a `tenant_settings` (`store_url`, `store_button_label`, `brand_name`, `timezone`, `support_email`).
- `MIGRATION` — actualizar `setup_new_tenant` RPC para aceptar nuevos params.
- `INSERT` — backfill de tenant Bitec con sus valores actuales.
- `EDIT supabase/functions/check-alerts/index.ts` — leer branding + timezone por tenant, pasarlos por `templateData`.
- `EDIT supabase/functions/send-transactional-email/index.ts` — usar `brand_name` del payload en el `from` header cuando esté presente.
- `EDIT` los 3 templates en `_shared/transactional-email-templates/` — recibir `brandName`, `logoUrl`, `storeUrl`, `storeButtonLabel`, `supportEmail` como props con defaults; ocultar el botón "Comprar" si no hay `storeUrl`.
- `EDIT src/pages/Onboarding.tsx` — nuevo paso "Marca", reordenar stepper (4 pasos en vez de 3), pasar nuevos campos al RPC.
- `EDIT src/hooks/useTenantSettings.ts` — agregar campos al tipo.
- `EDIT src/pages/Setup.tsx` — nueva sección "Marca y comunicación".

**Lo que NO cambia:**
- `cutmonitor@bitec.cl` en `Auth.tsx` / `WelcomeBanner.tsx`: es contacto de la plataforma, no del tenant.
- Dominio remitente `notify.cutmonitor.com`: técnico, único por toda la plataforma.

## Resultado

- Cada tenant ve su propio logo y nombre en los emails que recibe el cliente final.
- El botón "Comprar" lleva a la tienda del tenant (o se oculta si no tiene tienda).
- Las alertas se disparan en la zona horaria local del tenant.
- Onboarding nuevo: 4 pasos en vez de 3, todos los campos de marca editables después en /setup.
- Bitec sigue funcionando exactamente igual gracias al backfill.

