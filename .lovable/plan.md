

Sumo el ordenamiento por ranking de cortes a los cambios ya aprobados del `DeviceCard`.

## Orden de las tarjetas

Criterio: **suma de cortes de los últimos 6 meses** (mismo `monthlyCutsMap` filtrado por asignación que ya usamos para el total del card y el reporte). Así el "ranking" coincide con lo que el usuario ve en cada tarjeta.

Jerarquía del orden (de fuera hacia adentro):

1. **Clientes** ordenados por suma total de cortes 6m de todos sus equipos (desc).
2. **Puntos de venta** dentro de cada cliente: por suma de cortes 6m del PdV (desc).
3. **Equipos** dentro de cada PdV: por cortes 6m del equipo (desc).

Los que tengan 0 cortes en 6 meses van al final, ordenados alfabéticamente para que sean predecibles.

## Implementación

Helper `sumLast6Months(deviceMonthlyCuts)` ya implícito en los cambios previos del card. Lo extraigo a un util compartido (`src/lib/cuts.ts`) y lo reutilizo en `Dashboard.tsx` al construir `filteredHierarchy` (después del filtro por estado/búsqueda y antes del render):

```text
EDIT src/lib/cuts.ts                     — NEW: sumLast6Months(monthMap)
EDIT src/pages/Dashboard.tsx             — sort cliente → PdV → equipo por cortes 6m desc
EDIT src/components/DeviceCard.tsx       — (cambios previos ya aprobados) usar mismo util para total
```

Sin cambios en hooks ni queries — `monthlyCutsMap` ya viene listo y filtrado por asignación.

## Detalles UX

- El orden se aplica solo al panel principal de tarjetas. El árbol de Clientes del sidebar se mantiene alfabético (es navegación, no ranking).
- Si el usuario filtra por un cliente o cambia el filtro de estado, el ranking se recalcula sobre el subconjunto visible.
- Sin badges ni números de ranking visibles — el orden mismo comunica la prioridad.

