

## Una alerta = una fila en el historial

Hoy el log tiene dos filas por cada alerta enviada (una al PdV, una al BCC), y la del BCC aparece sin Cliente / PdV / Equipo. Vamos a colapsarlo a una sola fila con info enriquecida.

## Cambios

### 1. Edge Function `check-alerts` — guardar contexto en `metadata` y suprimir log del BCC

Al disparar la alerta:
- En el envío al PdV (o al BCC en caso `email-no-configurado`): pasar `metadata` enriquecido al payload del enqueue:
  ```json
  { "tenant_id": "...", "pdv_id": "...", "fixno": "...", "alert_type": "stock-bajo" }
  ```
- En el envío al BCC (caso normal con destinatario PdV): marcar la copia como "no loggear" para que no aparezca como fila independiente.

### 2. `process-email-queue` — persistir `metadata` y respetar flag `skip_log`

- Verificar cómo se construye hoy el insert en `email_send_log` y forwardear el `metadata` del payload de la cola hacia la columna `metadata` de la tabla.
- Si el payload trae `skip_log: true` (las copias BCC), saltar el insert en `email_send_log` (el email igual se envía normal). Así el BCC sigue llegando al inbox pero no contamina el historial.

### 3. RLS de `email_send_log` — permitir leer por `metadata.tenant_id`

Agregar OR a la policy actual:
```sql
OR (metadata->>'tenant_id' = get_user_tenant_id()::text)
```
Así las filas enriquecidas con tenant_id en metadata son legibles aunque el recipient_email no matchee ningún PdV (caso `email-no-configurado` enviado solo al BCC).

### 4. Hook `useAlertHistory.ts` — priorizar metadata

Cambiar resolución a:
1. Si `row.metadata.pdv_id` → resolver Cliente y PdV directamente.
2. Si `row.metadata.fixno` → resolver Equipo directamente.
3. Fallback (filas viejas sin metadata): mantener lógica actual (match por email + parse de message_id).

### 5. Limpieza de filas BCC históricas (opcional pero recomendado)

Las 144 filas existentes están duplicadas (mitad PdV, mitad BCC sin contexto). Migración one-shot que borra del log las filas cuyo `recipient_email` matchea algún `bcc_email` de tenant_settings y existe una fila hermana del mismo template enviada el mismo día a un email de PdV del mismo tenant. Esto deja el historial limpio retroactivamente.

Si preferís no tocar las históricas, salteamos este paso y solo a partir de ahora cada alerta = 1 fila.

## Archivos afectados

- `EDIT supabase/functions/check-alerts/index.ts` — pasar `metadata` enriquecido + `skip_log: true` para copias BCC
- `EDIT supabase/functions/process-email-queue/index.ts` — persistir `metadata` y respetar `skip_log`
- `MIGRATION` — actualizar RLS de `email_send_log` (OR sobre `metadata->>'tenant_id'`) + (opcional) limpieza de BCC históricos
- `EDIT src/hooks/useAlertHistory.ts` — leer metadata primero, fallback al match por email
- `EDIT src/components/AlertHistoryTable.tsx` — eliminar columna "Destinatario" si ya no aporta (cada fila = una alerta lógica, no un envío individual). A confirmar.

## Resultado

- Una alerta disparada = una fila en el historial, con Cliente / PdV / Equipo siempre resueltos.
- El BCC sigue llegando al inbox de monitoreo (no se rompe nada del flujo de email).
- Filas viejas: o se limpian con la migración opcional, o se quedan como están y solo las nuevas son consistentes.

