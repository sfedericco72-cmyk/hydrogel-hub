# Plan: arreglar el cron de alertas + rediseñar el apagado automático

KLAZ queda como está (pausa intencional hasta que terminen de configurar su entorno). Nada de este plan la despausa.

## Parte 1 — Que el cron ejecute la revisión completa

**Problema:** el job horario llama a la función desde la base con un límite de 5 segundos. La revisión de ~474 equipos tarda minutos, así que la conexión se corta y la corrida no termina (todas las llamadas de hoy fallaron con `Timeout of 5000 ms reached`).

**Solución:**
- La función `check-alerts` responde de inmediato (`202 accepted`) y hace todo el trabajo en background, igual que ya hace el backfill de cortes. El cron nunca más espera.
- El llamado desde el cron pasa a timeout amplio, y de todos modos ya no depende de la respuesta.
- Cada corrida queda registrada en una tabla nueva `alert_check_runs` (inicio, fin, tenants procesados, tenants salteados con motivo, alertas enviadas por tipo, error si hubo). Esto es lo que faltó para darnos cuenta antes: no había forma de ver que el cron estaba fallando.
- Candado de una sola corrida a la vez: si una revisión está en curso (menos de 10 minutos), la siguiente sale sin hacer nada.

## Parte 2 — Apagado automático de alertas, rediseñado

**Problema actual:** cuando pasan 14 días desde la primera alerta de un equipo, el sistema apaga las alertas de **todo el punto de venta** para siempre. Nadie las vuelve a encender a mano, así que 26 de 28 PdV de Bitec quedaron mudos y hoy solo 2 equipos del sistema son alertables.

**Nuevo comportamiento:**
- El silenciado pasa a ser **por equipo, no por PdV**. Un equipo vencido ya no calla a sus compañeros del mismo punto de venta.
- El silenciado es **temporal**: el equipo queda en pausa por una cantidad de días configurable (`alert_mute_days`, por defecto 30) y después vuelve solo al circuito, reiniciando su ventana de 14 días.
- Cada silenciado guarda motivo y fecha, para que sea visible y auditable.
- El switch manual de alertas del PdV sigue existiendo y manda sobre todo lo demás: si el usuario lo apaga, se respeta; el sistema nunca más lo apaga por su cuenta.

**Migración de lo que ya está roto:** los 26 PdV de Bitec que fueron apagados automáticamente se reactivan, y sus equipos con ventana vencida arrancan con un silenciado temporal de 30 días en lugar de un apagado permanente. Así el circuito vuelve a funcionar sin disparar una avalancha de emails el primer día.

## Parte 3 — Panel de reactivación y control

Sección nueva **Estado de alertas** en Configuración (`/setup`):
- Semáforo arriba: última revisión ejecutada (fecha/hora y resultado), alertas enviadas en los últimos 7 días, y aviso rojo si la última corrida falló o si hace más de 26 horas que no corre ninguna.
- Tabla de equipos silenciados: cliente, punto de venta, equipo, motivo, desde cuándo, cuándo vuelve. Botón **Reactivar** por fila y **Reactivar todos**.
- Tabla de PdV con alertas apagadas manualmente y los que no tienen email configurado (hoy son 4 en Bitec), porque sin email no hay alerta posible.

En el detalle del equipo se muestra un cartel cuando ese equipo está silenciado, con la fecha de reactivación y el botón para reactivarlo ahí mismo.

## Detalles técnicos

**Migración:**
- `devices`: nuevas columnas `alerts_muted_until timestamptz`, `alerts_mute_reason text`.
- `tenant_settings`: nueva columna `alert_mute_days int not null default 30`.
- Nueva tabla `alert_check_runs` (`tenant_id` nullable para la corrida global, `started_at`, `finished_at`, `status`, `tenants_processed`, `tenants_skipped jsonb`, `alerts_sent jsonb`, `error_message`), con RLS por tenant + grants para `authenticated` y `service_role`.
- Data fix (SQL aparte, no migración): reactivar los PdV de Bitec apagados automáticamente y sembrar `alerts_muted_until` en los equipos con `first_alert_sent_at` vencido.

**Edge function `check-alerts`:**
- Responde `202` y corre el loop con `EdgeRuntime.waitUntil`.
- Reemplaza el `update points_of_sale set alerts_enabled = false` por `update devices set alerts_muted_until = now() + alert_mute_days`.
- Saltea equipos con `alerts_muted_until > now()`; al expirar limpia `first_alert_sent_at` para reiniciar la ventana.
- Escribe una fila en `alert_check_runs` al empezar y la cierra al terminar (o con el error).

**Cron:** reprogramar `check-device-alerts` con timeout amplio en el `net.http_post` (vía run_sql, porque lleva la key del proyecto).

**Frontend:** hook nuevo `useAlertsHealth` (última corrida + equipos silenciados + PdV sin email), componente `AlertsHealthSection` en `src/pages/Setup.tsx`, y cartel de silenciado en `src/pages/BranchDetail.tsx`.

## Riesgo a tener en cuenta

Al reactivar el circuito, los equipos que hoy están en stock bajo o desconectados van a generar alertas reales en la primera corrida de las 9 AM. Con el silenciado inicial de 30 días sobre los equipos ya vencidos, el volumen del primer día queda acotado a los casos nuevos.
