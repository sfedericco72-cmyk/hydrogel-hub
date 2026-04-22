

## Cambios al historial de recargas

Dos ajustes en la tabla de recargas (BranchDetail):

### 1. Mostrar "Confirm date" en vez de "Transaction Date"
La columna **Fecha** hoy lee `tx.bill_date` (= `billdate` del API CutABC = "Transaction Date"). Cambia a `tx.audit_date` (= `auditdt` = "Confirm date"), que es la fecha real en que la recarga fue confirmada.

- Orden de la consulta: pasa de `order("bill_date")` a `order("audit_date")` para que el listado quede ordenado por confirmación.

### 2. Mostrar el campo `summary` en la columna "Nota"
Hoy la columna **Nota** lee `tx.remark`. En el API el campo útil que aparece como "Summary" en la UI de CutABC es `summary`, que en muchos casos tiene valor cuando `remark` está vacío. Hoy ese campo no se persiste en la tabla `device_transactions`.

Pasos:
- Migración: agregar columna `summary text` a `device_transactions`.
- Edge function `sync-cutabc`: mapear `summary: (t.summary as string) || null` en el upsert.
- Backfill one-shot en la migración: rellenar `summary` desde `raw_data->>'summary'` para filas existentes (todas las filas históricas tienen `raw_data` con el payload completo, así que no se pierde nada).
- UI: la columna "Nota" pasa a mostrar `tx.summary ?? tx.remark ?? "—"` (fallback por si alguna fila vieja no tiene summary).
- Hook `useTransactions.ts`: agregar `summary: string | null` al tipo `DeviceTransaction`.

## Archivos afectados

- `MIGRATION` — `ALTER TABLE device_transactions ADD COLUMN summary text` + backfill desde `raw_data`
- `EDIT supabase/functions/sync-cutabc/index.ts` — mapear `summary` en el upsert
- `EDIT src/hooks/useTransactions.ts` — agregar `summary` al tipo + cambiar `order` a `audit_date`
- `EDIT src/pages/BranchDetail.tsx` — mostrar `audit_date` en columna Fecha y `summary` (con fallback a `remark`) en columna Nota

## Resultado

- **Fecha** muestra cuándo se confirmó la recarga (ej: `21 abr 2026 22:15`), no cuándo se emitió el documento.
- **Nota** muestra el número de Summary (ej: `6020926`) que aparece en CutABC, en vez de quedar vacío.
- Filas históricas se backfillean automáticamente desde `raw_data`, así que el cambio es retroactivo sin esperar a la próxima sync.

