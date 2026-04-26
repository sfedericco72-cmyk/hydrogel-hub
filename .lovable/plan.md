## Cambios

### 1. Equipos sin asignar — mostrar estado Activo/Inactivo
Objetivo: que ningún equipo activo quede sin asignar. Hoy en la sección "Equipos sin asignar" (Setup) sólo se muestra el ícono de Wi-Fi (online en últimos 60 min), pero no la actividad (cortes en últimos 3 meses).

Cambios en `UnassignedDevicesSection.tsx`:
- Mostrar un badge **Activo** (verde) o **Inactivo** (gris) al lado de cada equipo, usando la misma definición que el resto de la app: cortes en los últimos 3 meses (`getActivityState` + `useLastCutDates`).
- Agregar un filtro arriba: **Todos / Activos / Inactivos**, junto al filtro de estado/condición ya existente.
- Mostrar el contador del header dividido: "Equipos sin asignar (12 · 3 activos)" para que el problema sea visible de un vistazo.
- Por defecto ordenar primero los **Activos** (son los que urgen asignar).

Cambios en `useUnassignedDevices` (`src/hooks/useClients.ts`):
- Agregar al `select` los campos necesarios para activity (`total_cuts` ya viene; necesitamos cruzar con `device_cuts_daily` vía el hook `useLastCutDates`, que ya existe — lo consumimos en el componente, sin tocar el hook).

### 2. Historial de alertas en la página del equipo
Objetivo: poder ver las alertas enviadas para un equipo específico desde su pantalla de detalle (la del screenshot: "Vivocell Olmue – Luzmira Muza Vera").

Cambios en `BranchDetail.tsx`:
- Agregar una nueva sección colapsable **HISTORIAL DE ALERTAS** (con el mismo estilo que "HISTORIAL DE RECARGAS") debajo del gráfico de cortes y arriba/al lado del historial de recargas.
- Reutilizar el componente `AlertHistoryTable` y el hook `useAlertHistory(60)`, filtrando las entradas por `fixno === device.fixno`.
- Header con ícono de campana, label "Historial de alertas" y badge con la cantidad (ej: "3 alertas").
- Si no hay alertas para ese equipo en los últimos 60 días, mostrar mensaje vacío: "Este equipo no tiene alertas enviadas en los últimos 60 días."
- Columnas: Fecha, Tipo (stock bajo / desconectado / sin email), Estado (enviado / falló / etc.). Ocultar columnas Cliente/PdV/Equipo (`showClient={false}` y dejar el resto sin redundancia ya que estamos en la vista del equipo).

Pequeño ajuste a `AlertHistoryTable.tsx`:
- Agregar prop opcional `showFixno?: boolean` (default `true`) para poder ocultar la columna Equipo cuando ya estamos viendo un único equipo.

### Detalles técnicos

**Filtrado por fixno en AlertHistory**: el hook `useAlertHistory` ya enriquece cada entrada con `fixno` (extraído de `metadata.fixno` o parseado del `message_id`). Filtramos en el componente con `useMemo`:
```ts
const filtered = useMemo(
  () => history.filter(h => h.fixno === device.fixno),
  [history, device.fixno]
);
```

**Activity badge en sin asignar**: usamos `getActivityState(device, lastCutDates)` que devuelve `"active" | "inactive"`. Esto requiere pasar también `total_cuts`/`fixno` al select del hook (fixno ya está). El cálculo es client-side con el map de `useLastCutDates`.

### Fuera de alcance
- No se modifica el backend ni edge functions.
- No se cambian otras tarjetas de la página de detalle.
- No se agregan nuevas alertas ni cambia la lógica de envío.
