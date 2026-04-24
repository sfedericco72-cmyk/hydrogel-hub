# Arreglar carga de historia de KLAZ

## Diagnóstico

El intento de cargar **2026-03 para KLAZ** quedó trabado en estado `loading` con 0 registros. Los logs muestran que la edge function alcanzó a procesar la primera página (1000/8356) y se cortó silenciosamente.

**Causa raíz**: KLAZ tiene **mucho más volumen** que Bitec (8356 transacciones en una sola quincena vs ~500-1000 mensuales de Bitec). La edge function actual:
- Pide todas las páginas en paralelo (`Promise.all` sobre 9 páginas → 9000 registros en memoria a la vez)
- Procesa todo y luego upserta en chunks de 50

Resultado: timeout (~150s) o muerte por memoria antes de terminar la primera quincena.

Además, como quedó en `loading`, el botón de "Cargar" en `/setup` no permite reintentar (la UI lo muestra como en progreso).

## Plan

**1. Liberar el período trabado** (1 query SQL)
- Resetear `2026-03` de KLAZ de `loading` → `pending` para poder reintentar.

**2. Robustecer `backfill-cuts-history` para volúmenes altos**
- Procesar las páginas **secuencialmente** dentro de cada quincena (no en paralelo) para evitar pico de memoria.
- Hacer **upsert incremental por página**: en vez de acumular 9000 registros y procesar al final, agregar al `dailyMap` y hacer flush a DB cada N páginas.
- Reducir el tamaño de página de 1000 → 500 para acelerar la primera respuesta y reducir memoria por request.
- Agregar logging de progreso más granular para detectar dónde se traba si vuelve a fallar.
- Mantener la división en quincenas (ya está bien).

**3. Detección automática de "loading" zombie**
- En la UI (`Setup.tsx` o el hook `useBackfillHistory`), considerar como "reintenable" cualquier período en `loading` cuyo `started_at` sea de hace más de 5 minutos (claramente murió). Mostrarlo con un ícono de warning + botón "Reintentar" en lugar de "En progreso".

**4. Reintentar 2026-03 KLAZ**
- Después de deployar, vos disparás manualmente el botón "Cargar" desde `/setup` con el usuario de KLAZ logueado, y verifico los logs.

## Lo que NO se toca

- El tenant Bitec y sus 10 períodos ya cargados quedan intactos.
- La estructura de tablas y RLS no cambia (la migración del turno anterior ya quedó bien).
- La UI general de `/setup` sigue igual; solo el manejo del estado "loading zombie".

## Detalle técnico

**SQL de desbloqueo**:
```sql
UPDATE cuts_history_backfill 
SET status = 'pending', started_at = NULL, records_loaded = 0
WHERE period = '2026-03' AND tenant_id = 'a18d13ac-dc92-4059-80cc-06d7b91fedb3';
```

**Cambios en `backfill-cuts-history/index.ts`**:
- `fetchAllPages` → reemplazada por un loop secuencial que devuelve un async iterator (o callback) para procesar página por página.
- Mover la lógica de "Consume → dailyMap" dentro del loop de páginas.
- Hacer flush del `dailyMap` parcial a `device_cuts_history` cada 3 páginas (~1500 transacciones), o al terminar cada quincena.
- Page size: 500 en lugar de 1000.

**Cambios en UI** (`useBackfillHistory.ts` o `Setup.tsx`):
- Helper `isStaleLoading(row)`: `row.status === 'loading' && row.started_at && (Date.now() - new Date(row.started_at).getTime()) > 5 * 60 * 1000`.
- Si `isStaleLoading`, tratar el período como reintentable con badge de warning ("Carga interrumpida — Reintentar").

**Deploy**: `backfill-cuts-history` se redeploya automáticamente.
