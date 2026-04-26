## 2026-04-26 — Bitec data fix + spike guards

**Problema reportado:** "los números no están bien en Bitec" — abril 2026 mostraba IRONTECH MARIQUINA 1100 con 3451 cortes (su histórico total era 3398, imposible) y FLAPIX con 522 (vs total 449).

**Causa raíz:** El sync del 24/04 escribió en `device_cuts_daily` rows con `total_cuts > 0` para fechas pasadas (no solo `today`) en un INSERT batch único. Para 2 devices Bitec, la primera fila de la serie quedó con `daily_cuts = total_cuts` (~3364 y 435) en `cut_date=2026-04-13` porque la query de baseline (`gt total_cuts 0`) no encontró nada (todo el backfill previo tenía `total_cuts=0`).

**Fix aplicado:**
1. Data fix puntual: corregidos los 2 rows en `device_cuts_daily` (daily_cuts ajustado a 3 y 4) y recalculado el monthly de Bitec/2026-04 desde la serie limpia.
2. `sync-cutabc/index.ts`: agregado **SPIKE GUARD** — si `daily_cuts > 200` se fuerza a 0 con warning en logs.
3. `sync-cutabc/index.ts`: agregado **MONTHLY ANOMALY GUARD** — si el total mensual de un device > su `useqty` histórico, se capea al histórico con error en logs.

Resultado: IRONTECH abril = 90 cortes, FLAPIX abril = 91 cortes (rangos razonables). KLAZ no se tocó (no tenía el problema). Futuras corridas no podrán propagar spikes similares.


# Plan: Reparar números de Bitec y blindar el pipeline

## Diagnóstico

Bitec tiene **2 dispositivos con cortes diarios falsos** que rompen los totales mensuales y de 6 meses en el dashboard:

| fixno | sucursal | día corrupto | daily_cuts visto | daily_cuts real |
|---|---|---|---|---|
| HX003190821144513 | IRONTECH MARIQUINA 1100 | 2026-04-13 | 3364 | ~3-5 |
| HX002150621093339 | FLAPIX - Victor Romero | 2026-04-13 | 435 | ~3-5 |

Esto hace que IRONTECH aparezca con **3451 cortes en abril** cuando su histórico total es 3398 (imposible), y FLAPIX con **522** cuando el total es 449.

### Causa raíz

Cuando el sync corrió por primera vez después del rediseño (2026-04-24 20:47), insertó en `device_cuts_daily` rows con `total_cuts > 0` **para fechas pasadas** (13/04 a 23/04) en un solo INSERT batch — todos comparten el mismo timestamp al microsegundo. Para esos 2 devices la primera fila de la serie quedó con `daily_cuts = total_cuts` (en vez de 0), ya que no había baseline previo con `total_cuts > 0` (el backfill 2026-01 había insertado todo con `total_cuts=0`). El bug es un caso borde en el cálculo de `daily_cuts` cuando coincide:
1. Backfill previo con `total_cuts = 0`.
2. Primer sync que escribe varias fechas a la vez en lugar de solo `today`.
3. La query de baseline (`gt("total_cuts", 0)`) no encuentra nada y el código defensivo de la línea 261 solo cubre el caso `prevTotal === undefined` para `today`, no para fechas pasadas.

KLAZ no tiene el problema (los devices ahí siempre tuvieron `total_cuts > 0` en daily porque venían del sync viejo, que escribía total_cuts).

## Solución

### 1. Limpiar los datos corruptos (data fix puntual)

Migración SQL que:
- En `device_cuts_daily`, para Bitec, fija `daily_cuts` de los 2 rows corruptos a un valor razonable basado en el `total_cuts` del día anterior siguiente (interpolando):
  - HX003190821144513 / 2026-04-13: `daily_cuts = 3` (entre 4 del 12 y 3 del 14)
  - HX002150621093339 / 2026-04-13: `daily_cuts = 4` (entre 4 del 12 y 3 del 14)
- También ajusta `total_cuts` de los 2 rows del 13/04 a un valor consistente (no afecta daily_cuts del 14+, porque la fórmula de daily ya no se recalcula para días pasados).
- Recalcula `device_cuts_monthly` para Bitec / 2026-04 sumando los `daily_cuts` corregidos del mes.

### 2. Blindar el sync para futuros casos (preventivo)

Modificar `supabase/functions/sync-cutabc/index.ts` para:

**a) Sanity check anti-spike al insertar daily:**
Antes de hacer el upsert en `device_cuts_daily` (línea ~272), si `daily_cuts > max(promedio_30d * 10, 200)` para ese fixno, log un warning y reemplaza `daily_cuts` por `0`. Es una salvaguarda barata: ningún device real corta más de 200 hidrogeles en un día.

**b) Validación cruzada del monthly:**
Al construir `monthlyRows` (línea ~301), si `total_cuts > devices.total_cuts` para ese fixno (matemáticamente imposible: 1 mes no puede superar el histórico), log un error y cap `total_cuts = devices.total_cuts`. Esto evita que un dato dañado en daily se propague a monthly.

**c) Defensa en el cálculo de baseline (línea 242-262):**
La query actual usa `gt("total_cuts", 0)`. Cuando todos los rows previos vienen del backfill (total_cuts=0), no hay baseline y devuelve `dailyCuts = 0` para today, lo cual es correcto. Pero si el sync alguna vez escribiera fechas pasadas (no debería, pero pasó), el cálculo se rompe. Vamos a:
  - Asegurar que el sync **solo escriba `cut_date = today`** (es lo que hace ya — vamos a dejar un comment explícito y un assert).
  - Si `prevTotal === undefined` Y `currentTotal > 0`, en vez de `dailyCuts = 0` usar el `cuts_today` que retorna la API (campo `usedayqty` de CutABC) cuando esté disponible y sea ≤ 200.

### 3. Cleanup script de detección

Edge function `detect-data-anomalies/index.ts` (nueva, opcional invocada manual) que escanea `device_cuts_daily` por tenant buscando `daily_cuts > 200` o `daily_cuts > device.total_cuts * 0.3` y los reporta. No corrige automáticamente — solo lista para revisión manual. Útil cuando aparezcan tenants nuevos.

## Detalles técnicos

```sql
-- Migración (data fix puntual)
UPDATE device_cuts_daily
SET daily_cuts = 3, total_cuts = 3367 - 3
WHERE tenant_id = 'c10e00fe-c1f6-423e-85db-8996c65dc1b6'
  AND fixno = 'HX003190821144513' AND cut_date = '2026-04-13';

UPDATE device_cuts_daily
SET daily_cuts = 4, total_cuts = 438 - 3
WHERE tenant_id = 'c10e00fe-c1f6-423e-85db-8996c65dc1b6'
  AND fixno = 'HX002150621093339' AND cut_date = '2026-04-13';

-- Recomputar monthly de abril Bitec
WITH mtd AS (
  SELECT fixno, SUM(daily_cuts) AS total_cuts
  FROM device_cuts_daily
  WHERE tenant_id = 'c10e00fe-c1f6-423e-85db-8996c65dc1b6'
    AND cut_date >= '2026-04-01' AND cut_date < '2026-05-01' AND daily_cuts > 0
  GROUP BY fixno
)
UPDATE device_cuts_monthly m
SET total_cuts = mtd.total_cuts, updated_at = now()
FROM mtd
WHERE m.tenant_id = 'c10e00fe-c1f6-423e-85db-8996c65dc1b6'
  AND m.year_month = '2026-04' AND m.fixno = mtd.fixno;
```

```typescript
// Sanity check en sync-cutabc/index.ts (después de línea 270)
const SANITY_DAILY_CAP = 200;
const cleanedHistoryData = historyData.map(r => {
  if (r.daily_cuts > SANITY_DAILY_CAP) {
    console.warn(`[${tenantId}] SPIKE detected ${r.fixno} ${r.cut_date}: daily_cuts=${r.daily_cuts} → forcing 0`);
    return { ...r, daily_cuts: 0 };
  }
  return r;
});
```

```typescript
// Cap monthly por total histórico del device (después de línea 306)
const totalByFixno = new Map(allDevices.map(d => [d.fixno, parseInt(d.useqty) || 0]));
const cappedMonthlyRows = monthlyRows.map(r => {
  const cap = totalByFixno.get(r.fixno) ?? Infinity;
  if (r.total_cuts > cap) {
    console.error(`[${tenantId}] Monthly anomaly ${r.fixno} ${r.year_month}: ${r.total_cuts} > device total ${cap}`);
    return { ...r, total_cuts: cap };
  }
  return r;
});
```

## Resultado esperado

- IRONTECH abril 2026: **~28 cortes** (en vez de 3451) — match con la realidad.
- FLAPIX abril 2026: **~22 cortes** (en vez de 522).
- Totales 6m del dashboard recuperan coherencia.
- KLAZ no se toca (no tiene el problema).
- Futuras corridas del sync no podrán propagar spikes similares gracias a los 2 sanity checks.
