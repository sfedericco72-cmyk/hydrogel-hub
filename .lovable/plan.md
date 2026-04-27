## Objetivo

Mostrar de forma prominente en el header del **Panel de Control** la cantidad de cortes reportados ayer, para que se vea de un vistazo al entrar al dashboard.

## Diseño visual

Bloque destacado a la derecha del título "Panel de Control" (antes de los botones de acción), con dos números:

- **Número grande**: cortes de ayer de equipos asignados (global, no se ve afectado por el filtro de cliente).
- **Número chico debajo**: cortes de ayer de equipos NO asignados (solo aparece si es > 0).
- **Línea de contexto**: "Promedio últimos 7 días: X" como referencia.

Maquetación aproximada (1257px viewport actual):

```text
┌──────────────────────────────────┐  ┌──────────────────────┐  ┌── botones ──┐
│ Panel de Control       (i)       │  │ Cortes ayer          │  │ [Sincr.]    │
│ Seguimiento de máquinas...       │  │   1.234              │  │ [Attach]    │
│ ⏱ Última sincronización: ...     │  │ +18 sin asignar      │  │ [Clientes]  │
│                                  │  │ prom. 7d: 1.050      │  │ [⚙] [⎋]    │
└──────────────────────────────────┘  └──────────────────────┘  └─────────────┘
```

Estilo: tarjeta con `bg-card`, borde sutil, número en `text-3xl font-bold` con color `text-primary`, etiqueta en `text-xs uppercase text-muted-foreground`. En mobile pasa a stack vertical debajo del título.

## Datos y reglas

- **"Ayer"** se calcula en la zona horaria del tenant (`tenant_settings.timezone`, default `America/Santiago`) para evitar el desfase UTC.
- **Cortes ayer (asignados)**: suma de `device_cuts_daily.daily_cuts` para `cut_date = ayer`, filtrando por `fixno` que esté actualmente en `device_assignments` activos (`unassigned_at IS NULL`). **No respeta el filtro de cliente** — siempre global.
- **Cortes ayer (no asignados)**: misma suma pero para `fixno` que NO esté en ninguna asignación activa. Solo se muestra si > 0.
- **Promedio últimos 7 días**: media diaria de `daily_cuts` de los últimos 7 días completos (excluye hoy), solo equipos asignados, redondeado.

## Cambios técnicos

### 1. Nuevo hook `src/hooks/useYesterdayCuts.ts`

- Expone `{ assignedYesterday, unassignedYesterday, avg7d, isLoading }`.
- Usa `useTenantSettings` para obtener el `timezone` y calcular el rango "ayer" como `[ayer 00:00, hoy 00:00)` en esa TZ → convertido a `YYYY-MM-DD` para `cut_date`.
- Una sola query a `device_cuts_daily` con `cut_date >= ayer-6d AND cut_date <= ayer`, trayendo `fixno, cut_date, daily_cuts`.
- Una segunda query liviana a `device_assignments` (where `unassigned_at IS NULL`) para construir el set de fixnos asignados (o reutilizar `useAssignedHierarchy` ya disponible en Dashboard).
- Agrega los totales en memoria (sin agregaciones nuevas en DB).

### 2. Componente `src/components/YesterdayCutsCard.tsx`

- Recibe `{ assignedYesterday, unassignedYesterday, avg7d, isLoading }`.
- Skeleton mientras carga.
- Formatea con `toLocaleString("es-CL")` para separadores de miles.
- Tooltip en el bloque "sin asignar" explicando "Cortes de equipos detectados por la API que aún no tienen punto de venta asignado".

### 3. `src/pages/Dashboard.tsx`

- Importar el hook y el componente.
- Insertar `<YesterdayCutsCard ... />` en el header `DashboardHeader` (lines 377-421), entre el bloque del título y el bloque de botones, con un wrapper flex que mantenga buen comportamiento responsive (en `md:` queda al medio, en mobile cae debajo del título).
- Pasar las props desde Dashboard (el hook se llama en Dashboard y se pasan los valores ya calculados al header, siguiendo el patrón actual de `lastSyncDate`).

## Lo que NO cambia

- No se modifica la base de datos ni se crean agregaciones nuevas.
- El filtro de cliente sigue funcionando igual para el resto del dashboard; el número grande es siempre global por diseño.
- No se tocan los emails de alertas ni la lógica de `alert_history`.

## Aclaración pendiente menor

Si querés, en lugar de "+18 sin asignar" como número chico debajo, puedo mostrarlo como una segunda mini-tarjeta al costado. Lo dejo así (apilado debajo) por ser más compacto, pero es trivial cambiarlo después.
