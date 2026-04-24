## Diagnóstico

La vista semanal **sí está calculando bien la agrupación por semana ISO** (los datos en `device_cuts_daily` se agrupan correctamente en 12-13 semanas). El problema visual de "semanal = monthly" viene de un **bug de datos introducido en la migración**:

### Lo que pasó

1. La migración inicial pobló `device_cuts_daily` con los datos diarios desde 1-feb-2026, copiando `daily_cuts` correctamente desde el legacy, pero **dejó `total_cuts = 0` en todos los registros migrados** (no era un dato necesario en el legacy).
2. Hoy (2026-04-24) corrió el primer `sync-cutabc` con la nueva lógica. Esa lógica calcula:
   ```
   daily_cuts = currentTotal - prev_total_de_ayer
   ```
   Como `prev_total_de_ayer = 0` (por el punto 1), el resultado fue `daily_cuts = currentTotal` (el acumulado histórico completo del equipo).
3. Ejemplo real: device `HX001121218162321` quedó hoy con `daily_cuts = 39.290` (cuando lo normal son ~3 cortes/día). Total tenant del 24-abr: **84.538 cortes** vs ~450 días normales.
4. En el gráfico semanal eso hace que la semana W17 (actual) sea **enorme** y aplaste visualmente las otras 12 semanas a casi cero, dando la sensación de que "una sola barra = todo el mes".

### Verificación

```text
fixno HX001121218162321:
  2026-04-23  total_cuts=0     daily_cuts=2     ← migrado, total=0
  2026-04-24  total_cuts=39290 daily_cuts=39290 ← sync de hoy: 39290-0
```

Y el monthly de abril también quedó inflado, porque el job lo recalcula sumando `daily_cuts` del mes desde la tabla diaria.

## Solución

Dos arreglos: corregir los datos malos de hoy y blindar el código para que no se repita.

### 1. Corregir datos del 24-abr-2026 (one-shot)

Recalcular `daily_cuts` y `total_cuts` del 24-abr para todos los devices, comparando `devices.total_cuts` actual contra el `total_cuts` real de antes (que tenemos en el legacy). Para los devices con `prev_total = 0` por la migración, usamos como referencia el último `total_cuts` real disponible en `device_cuts_history_legacy` (o `devices.total_cuts - daily_cuts_real_de_hoy_estimado`).

Plan más simple y seguro: **borrar los registros del 24-abr y dejar que el próximo sync los re-cree bien**, una vez que arreglemos el `total_cuts` histórico.

Pasos en SQL (migration con `INSERT/UPDATE`):

a. Backfillear `total_cuts` en `device_cuts_daily` desde `device_cuts_history_legacy` (que sí tenía el acumulado correcto):
```sql
UPDATE device_cuts_daily d
SET total_cuts = l.total_cuts
FROM device_cuts_history_legacy l
WHERE d.fixno = l.fixno
  AND d.cut_date = l.cut_date
  AND d.total_cuts = 0
  AND l.total_cuts > 0;
```

b. Borrar los registros corruptos del 24-abr:
```sql
DELETE FROM device_cuts_daily WHERE cut_date = '2026-04-24';
```

c. Recalcular el monthly de abril desde la tabla diaria (ya sin el outlier):
```sql
DELETE FROM device_cuts_monthly WHERE year_month = '2026-04';
INSERT INTO device_cuts_monthly (tenant_id, fixno, year_month, total_cuts)
SELECT tenant_id, fixno, '2026-04', SUM(daily_cuts)
FROM device_cuts_daily
WHERE cut_date >= '2026-04-01' AND cut_date < '2026-05-01'
GROUP BY tenant_id, fixno;
```

d. Disparar manualmente `sync-cutabc` para regenerar el snapshot del 24-abr con `daily_cuts` correctos.

### 2. Blindar `sync-cutabc` para evitar el bug en el futuro

En el cálculo de `daily_cuts`, si `prev_total === 0` y `currentTotal` es muy grande (ej. > prev_total + 1000 cortes), tratar como "primer registro" y usar `daily_cuts = 0` en vez del salto enorme. Más simple: si `prev_total === 0` **y** existe algún registro previo con `total_cuts > 0` para ese device, usar el más reciente con `total_cuts > 0` como referencia.

Cambio puntual en `supabase/functions/sync-cutabc/index.ts`:
```ts
// Buscar el último total_cuts > 0 conocido (no solo ayer), para evitar
// arrastrar ceros heredados de la migración o de syncs fallidos.
const { data: lastKnown } = await supabase
  .from("device_cuts_daily")
  .select("fixno, total_cuts, cut_date")
  .eq("tenant_id", tenantId)
  .gt("total_cuts", 0)
  .lt("cut_date", today)
  .in("fixno", fixnos)
  .order("cut_date", { ascending: false });

// Construir mapa "último total conocido" tomando el primero por fixno.
const prevTotalMap = new Map<string, number>();
(lastKnown ?? []).forEach((r: any) => {
  if (!prevTotalMap.has(r.fixno)) prevTotalMap.set(r.fixno, r.total_cuts);
});
```

Y cambiar el cálculo:
```ts
const prevTotal = prevTotalMap.get(d.fixno);
const dailyCuts = prevTotal !== undefined && currentTotal >= prevTotal
  ? currentTotal - prevTotal
  : 0;
```

(Nota: la query trae a lo sumo ~90 días × N devices, paginada por chunks si pasa los 1000.)

## Resultado esperado

- Vista semanal del BranchDetail muestra las 12-13 barras semanales con valores realistas (~150-300 cortes por semana en lugar de una barra gigante de 39k).
- Tarjeta del dashboard y reporte mensual de abril dejan de estar inflados.
- Próximos syncs no vuelven a romperse aunque algún día venga con `total_cuts = 0`.

## Archivos a tocar

- **Nueva migration SQL**: pasos a-c de arriba (backfill `total_cuts`, borrar 24-abr, recalcular abril mensual).
- **`supabase/functions/sync-cutabc/index.ts`**: usar "último total conocido > 0" en lugar del de ayer estricto.
- Disparar `sync-cutabc` manualmente al final para repoblar el 24-abr correctamente.
