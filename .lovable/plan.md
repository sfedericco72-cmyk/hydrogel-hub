## Blindar paginación universal en queries del dashboard

Tenés razón: la lógica debe ser idéntica para cualquier tenant, sin importar cuántos devices tenga. Hoy 4 queries arman maps tenant-wide y pueden truncarse silenciosamente al toparse con el límite por defecto de Supabase (1000 filas).

### Queries afectadas

Todas en `src/hooks/useDevices.ts`:

| Hook | Carga teórica máx | Riesgo |
|---|---|---|
| `useDevices` | 1 fila × N devices | Bajo hoy, alto si crece |
| `useLastCutDates` | hasta 90 filas × N devices | **Alto** — bitec ya tiene 1.015 |
| `useAvgDailyCuts` | hasta 30 filas × N devices | Medio — bitec ~600 |
| `useMonthlyCutsMap` | 6 filas × N devices | **Alto** — bitec ~1.032 (ya en el límite) |

### Cambio

Agregar un helper `fetchAll<T>()` en el mismo archivo que pagina con `.range(from, to)` por chunks de 1000 hasta que un chunk vuelva con menos de 1000 filas. Aplicarlo a las 4 queries.

```ts
const PAGE_SIZE = 1000;
async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>,
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await build(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const chunk = data ?? [];
    all.push(...chunk);
    if (chunk.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
}
```

Y reemplazar cada `.select(...)` por:
```ts
const data = await fetchAll<Row>((from, to) =>
  supabase.from("...").select("...").<filtros>.range(from, to),
);
```

### Por qué no usar `.limit(10000)`

`.limit()` también está topado por la config del PostgREST por defecto (`max-rows`). `.range()` con paginación es la forma idiomática y respeta cualquier `max-rows` futuro.

### Por qué solo `useDevices.ts`

`useCutsHistory` y `useMonthlyCuts` filtran por un solo `fixno` (≤ 90 filas o ≤ 36 meses). `useAssignmentCuts` ya itera dispositivo por dispositivo. `useTransactions` también es per-device. Esos no necesitan cambio.

### Resultado

Bitec (172 devices) y cualquier tenant futuro con 500-2000 devices verán siempre los datos completos en dashboard, "Último corte", "Promedio 30d" y "Cortes 6m" — sin importar el tamaño.

### Archivo a tocar

- `src/hooks/useDevices.ts` (un solo archivo, +helper, 4 queries refactorizadas)
