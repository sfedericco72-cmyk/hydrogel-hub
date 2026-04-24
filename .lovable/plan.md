# Rediseño del histórico de cortes: dos granularidades

## El problema de raíz
El límite por defecto de Supabase de **1.000 filas por query** trunca silenciosamente la consulta del Dashboard (`useMonthlyCutsMap` pide ~11k filas). Por eso la tarjeta y el reporte no coinciden.

Tu propuesta resuelve esto **estructuralmente**: si el agregado mensual ya está pre-calculado en una tabla, el Dashboard pide ~600 filas (1 por equipo × 6 meses) y entra holgado bajo el límite. Bonus: queda más limpio y rápido.

> **Nota de tamaño**: hoy la tabla pesa solo 4.7 MB (16k filas, 2 tenants). El rediseño es por *claridad y performance de queries*, no por presión de espacio. Cuando se sumen tenants grandes va a notarse más.

## Modelo nuevo

Dos tablas con propósitos claros:

### `device_cuts_daily` (granularidad fina, ventana móvil)
- Una fila por equipo / día con cortes > 0
- **Solo conserva los últimos 90 días** (rolling window). Más viejo se borra automáticamente.
- Sirve para: vista **Semanal** del reporte (necesita resolución diaria para calcular semana ISO), última fecha con cortes (`useLastCutDates`), promedio de cortes/día (`useAvgDailyCuts`).
- Columnas: `id, tenant_id, fixno, cut_date, daily_cuts, total_cuts, created_at`
- Constraint único: `(tenant_id, fixno, cut_date)`

### `device_cuts_monthly` (consolidado histórico, sin caducidad)
- Una fila por equipo / mes con `total_cuts > 0`
- Conserva **todo el historial** que hayamos cargado.
- Sirve para: tarjetas del Dashboard (6 meses), vistas Mensual y Anual del reporte, MonthlyTimeline.
- Columnas: `id, tenant_id, fixno, year_month (text 'YYYY-MM'), total_cuts, created_at, updated_at`
- Constraint único: `(tenant_id, fixno, year_month)`

Ambas con RLS idéntica a la actual: service role escribe, tenants leen lo suyo.

## Cómo se llenan

### Sync diario (`sync-cutabc`)
Cuando inserta el snapshot diario en `device_cuts_daily`, además **incrementa** la fila correspondiente en `device_cuts_monthly` (UPSERT con suma). Así el mensual siempre está al día sin recalcular nada.

### Backfill (`backfill-cuts-history`)
Cuando el usuario carga un mes histórico:
- Si el mes está dentro de los últimos 90 días → escribe en **ambas** tablas (diaria + mensual).
- Si el mes es anterior a 90 días → escribe **solo en mensual** (suma directa de cortes del mes, no se guarda detalle diario).

### Limpieza (cron)
Job programado (pg_cron diario) que:
1. Para cada fila de `device_cuts_daily` más vieja que 90 días: garantiza que el agregado mensual existe (idempotente) y la borra.
2. Es un `DELETE FROM device_cuts_daily WHERE cut_date < current_date - interval '90 days'` — el mensual ya está poblado por sync/backfill.

## Migración de los datos existentes

Migración SQL que se corre una sola vez al desplegar el cambio:

```text
1. Crear las dos tablas nuevas con RLS.
2. Poblar device_cuts_monthly desde device_cuts_history:
   INSERT ... SELECT tenant_id, fixno, to_char(cut_date,'YYYY-MM'),
                     SUM(daily_cuts), now(), now()
              FROM device_cuts_history
              WHERE daily_cuts > 0
              GROUP BY tenant_id, fixno, to_char(cut_date,'YYYY-MM');
3. Poblar device_cuts_daily desde device_cuts_history (solo últimos 90 días).
4. Renombrar device_cuts_history → device_cuts_history_legacy (no se borra
   por seguridad; se puede eliminar manual después de validar).
5. Crear el cron job de limpieza (pg_cron, diario a las 03:00 UTC).
```

## Cambios en código frontend

**`src/hooks/useDevices.ts`**
- `useMonthlyCutsMap` → consulta `device_cuts_monthly` (filtra por `year_month >= startMonth`). Mucho menos volumen, sin paginación necesaria.
- `useLastCutDates` → consulta `device_cuts_daily` (ventana de 90 días es suficiente para "última fecha con cortes" porque si no cortó en 90 días ya está inactivo).
- `useAvgDailyCuts` → consulta `device_cuts_daily` (últimos 30 días).

**`src/hooks/useCutsHistory.ts`** (usado por BranchDetail)
- Para vista **Semanal** (últ. 3 meses): leer de `device_cuts_daily`.
- Para vistas **Mensual** y **Anual**: leer de `device_cuts_monthly`.
- Refactor: el hook devuelve `{ daily, monthly }` y BranchDetail usa la fuente según `resolution`.

**`src/hooks/useAssignmentCuts.ts`**
- "Cortes desde asignación": si la asignación tiene <90 días → suma `device_cuts_daily`. Si es más vieja → combina `device_cuts_monthly` (meses completos) + `device_cuts_daily` (mes en curso, parcial). Manejo del mes parcial inicial igual.

## Cambios en edge functions

**`sync-cutabc`**
- Escribir snapshot diario en `device_cuts_daily` (igual que hoy en `device_cuts_history`).
- Después: para los equipos que tuvieron `daily_cuts > 0` hoy, hacer UPSERT incremental en `device_cuts_monthly` (sumar al `total_cuts` existente del mes).

**`backfill-cuts-history`**
- Mismo input (un período YYYY-MM), pero al volcar a la base:
  - Calcular el total mensual y UPSERT en `device_cuts_monthly`.
  - Si el período cae dentro de los últimos 90 días, además insertar el detalle diario en `device_cuts_daily`.
- Renombrar internamente a algo como `backfill-monthly-cuts` (opcional, no crítico).

**`check-alerts`**
- La query "últimos 30 días para promedio diario" pasa a `device_cuts_daily`.

## Resumen de cambios

```text
Migración SQL:
  + device_cuts_daily          (nueva)
  + device_cuts_monthly        (nueva)
  + pg_cron job limpieza
  ~ device_cuts_history → renombrar a _legacy

Edge functions:
  ~ sync-cutabc                (escribir en ambas tablas)
  ~ backfill-cuts-history      (escribir en ambas, según ventana)
  ~ check-alerts               (leer de daily)

Frontend:
  ~ src/hooks/useDevices.ts    (3 hooks repuntados)
  ~ src/hooks/useCutsHistory.ts (split daily/monthly)
  ~ src/hooks/useAssignmentCuts.ts (combinar fuentes)
```

## Verificación post-deploy
1. Tarjeta del Dashboard y total del reporte coinciden para cualquier equipo.
2. Vista Semanal del reporte muestra las mismas 13 semanas que hoy.
3. Vistas Mensual/Anual muestran el mismo histórico que hoy.
4. Después de un sync, los números se actualizan en ambas vistas.

## Riesgos y mitigaciones
- **Doble escritura puede divergir**: lo evito con UPSERT incremental atómico desde el sync. Si pasa, el cron de limpieza puede correr en modo "rebuild" (recalcular `device_cuts_monthly` a partir de `device_cuts_history_legacy` que dejamos como backup).
- **Cron podría fallar y acumular diario**: no rompe nada (solo crece la tabla); fácil de detectar y limpiar manual.
- **Tabla _legacy ocupando espacio**: 4.7 MB hoy, intrascendente. La eliminás cuando quieras una vez validado.
