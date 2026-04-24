# Arreglar sincronización de KLAZ en `sync-cutabc`

## Problema

La sincro diaria se cuelga porque:

1. **Volumen**: `fetchAllTransactions` pide TODO el historial de CutABC sin filtro de fecha. KLAZ tiene ~15.000 transacciones/mes (Bitec ~2.000 totales) → timeout o memoria.
2. **Serial**: los tenants se procesan uno por uno. Si KLAZ falla, Bitec ni se ejecuta.
3. **Sin visibilidad**: no hay logs de progreso por página, así que no se ve dónde se traba.

## Cambios

### 1. Ventana de 15 días en transacciones
En `fetchAllTransactions`, pasar `billdate_beg` con la fecha de hace 15 días (formato CutABC) en vez de string vacío. El histórico viejo ya está congelado y se carga aparte vía `backfill-cuts-history`, así que el sync diario solo necesita movimientos recientes.

### 2. Tenants en paralelo con timeout
Reemplazar el `for` secuencial sobre tenants por `Promise.allSettled`, envolviendo cada tenant en una promesa con timeout de 120s (`Promise.race` con `setTimeout`). Si KLAZ se cuelga o falla, Bitec sigue. El resultado final reporta éxito/fallo por tenant.

### 3. Page size 100 → 500
Subir `pagesize` en las llamadas a CutABC para reducir round-trips (de ~150 páginas a ~30 en KLAZ).

### 4. Logging por página
Agregar `console.log` con tenant + página + acumulado vs total esperado, para que si vuelve a fallar veamos exactamente en qué página/tenant.

## Lo que NO toco

- `backfill-cuts-history` (histórico)
- Lógica de `daily_cuts` / cierre del día
- Cron schedule
- DB / migraciones
- UI

## Detalles técnicos

- Archivo único: `supabase/functions/sync-cutabc/index.ts`
- Formato fecha CutABC: el mismo que ya usa el código (revisar helper existente).
- Timeout pattern:
  ```ts
  const withTimeout = <T>(p: Promise<T>, ms: number, label: string) =>
    Promise.race([
      p,
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error(`Timeout ${label}`)), ms))
    ]);
  ```
- Resultado: array `{ tenant, status: 'ok'|'error', error?, counts }` devuelto al caller.

## Pregunta abierta

Ventana de 15 días ¿está bien? Alternativas: 7 días (más rápido, menos margen) o 30 días (más colchón si el cron falla varios días seguidos).
