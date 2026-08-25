# Revisión de alertas (solo diagnóstico)

No toqué nada. Esto es lo que encontré, ordenado por gravedad.

## Resumen

Las alertas **no se están enviando desde el 12 de junio de 2026** (último registro en el log de envíos; hoy es 25 de agosto). Hay tres causas independientes, todas reales y verificadas.

## Hallazgo 1 — El cron corta la ejecución a los 5 segundos (causa técnica principal)

El job horario `check-device-alerts` llama a la función por HTTP desde la base. **Todas** las llamadas de las últimas horas terminaron así:

```text
09:00 UTC  error: Timeout of 5000 ms reached
10:00 UTC  error: Timeout of 5000 ms reached
11:00 UTC  error: Timeout of 5000 ms reached
12:00 UTC  error: Timeout of 5000 ms reached
```

La función en sí está sana: la invoqué manualmente y respondió 200 correctamente. El problema es que el llamador de la base tiene un límite de 5 segundos y la revisión de ~474 equipos tarda minutos, así que la conexión se corta a mitad de camino y no hay garantía de que el proceso termine. Tampoco quedan logs de la función en esas corridas.

**Propuesta:** que el cron dispare la función en modo "fire and forget" con timeout amplio, y que la función responda de inmediato y haga el trabajo en background (mismo patrón que ya usamos en el backfill de cortes, que tenía exactamente este problema). Opcionalmente, registrar cada corrida en una tabla para poder auditar "última revisión de alertas" desde la UI.

## Hallazgo 2 — Casi todos los PdV quedaron con alertas apagadas y nunca se reactivan

| Tenant | PdV | Con alertas ON | Apagados | Sin email |
|---|---|---|---|---|
| Bitec | 28 | 2 | 26 | 4 |
| KLAZ | 4 | 3 | 1 | 4 |

En todo el sistema hay **34 equipos asignados y solo 2 realmente alertables**.

El motivo es la regla `alert_max_window_days = 14`: cuando pasan 14 días desde la primera alerta de un equipo, `check-alerts` apaga `alerts_enabled` del PdV. Como nadie lo vuelve a encender a mano, el apagado es **permanente** — 71 de 172 equipos de Bitec ya tienen `first_alert_sent_at`, y sus PdV fueron quedando mudos uno por uno.

**Propuesta (a elegir):**
1. Reactivación automática: en vez de apagar el PdV para siempre, "silenciar" el equipo por N días (ej. 30) y luego volver a evaluarlo. Requiere guardar la fecha de silenciado por equipo en lugar de apagar el PdV.
2. Apagar por equipo, no por PdV: hoy un solo equipo vencido silencia todo el punto de venta, incluidos sus otros equipos.
3. Visibilidad: mostrar en la UI un panel "PdV con alertas apagadas" con el motivo y la fecha, y un botón para reactivar en lote.

## Hallazgo 3 — KLAZ tiene las alertas pausadas hasta 2027

`alerts_paused_until = 2027-01-01`. Mientras esté así, KLAZ nunca va a recibir nada. Además sus 4 PdV no tienen `alert_email`, así que incluso despausado solo generaría avisos de "email no configurado" al BCC.

**Propuesta:** decidir si esa pausa es intencional. Si no, quitarla y cargar los emails de los 4 PdV de KLAZ.

## Lo que sí está funcionando

- El sync diario corre bien: último `last_synced_at` de hoy 02:59 UTC en ambos tenants, y equipos conectados hasta hace minutos.
- La función `check-alerts` está desplegada y responde correctamente; respeta la hora configurada (9 AM `America/Santiago`) y saltea tenants pausados.
- La cadena de envío (cola de emails, metadata para el historial) quedó bien después de los cambios anteriores.

## Orden sugerido si querés que avance

1. Arreglar el timeout del cron (sin esto, nada más importa).
2. Rediseñar el apagado automático de alertas + panel de reactivación.
3. Definir la situación de KLAZ (pausa y emails de PdV).

No implemento nada hasta que me digas cuáles de estos puntos querés atacar.
