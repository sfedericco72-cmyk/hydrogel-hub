## Problema

El backfill de marzo falla con "Function returned a non-2xx" y nunca actualiza el contador de registros cargados. En los logs de la Edge Function se ve:

- **Doble boot/shutdown** del worker (la función fue reiniciada por el runtime).
- 17 páginas × **4 brannas** × 2 quincenas = **136 llamadas secuenciales** a CutABC para un solo mes → **~9 minutos**, muy por encima del límite de wall-clock de Edge Functions.
- Las 4 brannas devuelven **exactamente los mismos 8.356 registros** (`Page 1: 500/8356` idéntico para Klaz, CDRSI, JBCP y Marioclp).

## Causa raíz

En el cambio anterior agregamos iteración por branna en **ambas** funciones, pero los dos endpoints de CutABC se comportan distinto:

- `custbalaqry` (sync incremental): **sí** oculta los Consume si no se filtra por branna → la iteración está bien.
- `fixbalaqty` (backfill histórico): **ignora** el filtro `branna` y devuelve siempre el total del usuario → iterar por branna multiplica el trabajo ×4 sin obtener datos nuevos.

Por eso BITEC funcionaba antes: usaba una sola pasada sin branna, que es lo correcto para `fixbalaqty`.

## Solución

### 1. Revertir `backfill-cuts-history` a una sola pasada
- Quitar el loop por brannas (y la query a `devices` para descubrirlas).
- Pasar `branna: ""` como antes.
- Resultado: **~34 páginas** por mes en lugar de 136 → cabe holgado en el tiempo de la función.

### 2. Procesamiento en background con `EdgeRuntime.waitUntil`
Para meses muy grandes y para que el cliente nunca vea "non-2xx":
- Crear/upsert el registro en `cuts_history_backfill` con `status: "loading"` y responder **inmediatamente** con `{ job_id, status: "loading" }` (HTTP 202).
- Lanzar el trabajo real con `EdgeRuntime.waitUntil(...)`.
- En caso de error dentro del background, marcar el registro como `status: "error"` con el mensaje.

### 3. Polling desde el frontend
- `useRunBackfill` ya invalida `cuts_history_backfill`. Agregar polling automático en `useBackfillStatus` (refetchInterval cada 3s) **mientras haya algún período en `loading`**, y detenerlo cuando todos estén `done` o `error`.
- El toast de éxito/error se dispara cuando el período cambia de `loading` → `done`/`error`, no al recibir la respuesta inicial.

### 4. Mantener cambios en `sync-cutabc`
La iteración por branna en `sync-cutabc` se queda como está — ahí sí es necesaria.

## Archivos a tocar

- `supabase/functions/backfill-cuts-history/index.ts` — quitar loop de brannas, mover trabajo a `waitUntil`, responder 202.
- `src/hooks/useBackfillHistory.ts` — polling condicional, manejar respuesta async.
- `src/pages/Setup.tsx` (o donde se muestre el botón de backfill) — ajustar mensajes para reflejar "en progreso".

## Validación

1. Lanzar backfill de marzo desde KLAZ → respuesta inmediata, fila pasa a `loading`.
2. UI hace polling, muestra el progreso, termina en `done` con `records_loaded > 0`.
3. Verificar que el dispositivo `HX00240919194318` ahora tiene cortes diarios en marzo.
4. Re-correr meses ya cargados (feb, mar) para incorporar los Consume que faltaban.
