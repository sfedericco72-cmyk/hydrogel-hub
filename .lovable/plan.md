

## Diagnóstico

Los 3 números que mostrás miden cosas diferentes con definiciones distintas de "actividad":

### 1. Timeline Abr 26: "Equipos con cortes = 4"
- Cuenta dispositivos que tienen **cortes en abril 2026** (mes en curso, que recién empieza)
- Definido en `MonthlyTimeline.tsx`: `devicesWithCuts++` si `cuts > 0` ese mes
- Solo abril, ventana de ~16 días

### 2. Timeline Abr 26: "Conectados = 13"
- Cuenta dispositivos con `latest_online_time` en los **últimos 7 días** (`getConnectionLevel === "green"`)
- Es conexión a internet, **no** tiene que ver con cortes
- Por eso conectados (13) + desconectados (13) = 26 total ✓

### 3. Filtro abajo: "Activos = 14"
- Usa `getActivityState` → "activo" si tuvo cortes en los **últimos 3 meses** (configurable, `disconnect_months = 3`)
- Definido en `useDevices.ts`: ventana mucho más amplia que "abril"

### Por qué los números no calzan
- **4 ≠ 14**: porque "equipos con cortes en abril" (4) es subconjunto de "equipos con cortes en últimos 3 meses" (14). Los otros 10 cortaron en feb/mar pero todavía no en abril. **Esto es matemáticamente correcto** dada la definición.
- **Inactivos = 12** y **Activos = 14** suman 26 ✓
- **Conectados (13) + Desconectados (13) = 26** ✓ (eje conexión a internet)
- Activos/Inactivos vs Conectados/Desconectados son **dos dimensiones independientes** (memoria `device-states.md` ya lo dice).

### El problema real: la UI confunde al usuario
Tres definiciones coexistiendo sin etiqueta clara:
- Timeline mezcla **cortes del mes** + **conexión real** en una sola tabla, con un asterisco al pie que es fácil de no leer.
- Para meses pasados "conectados = equipos con cortes ese mes", para mes actual "conectados = online en últimos 7d". Es **inconsistente entre columnas de la misma fila**.
- El filtro de abajo dice "Activos (14)" sin aclarar que son últimos 3 meses.

## Propuesta de fix

**Objetivo: que los números sean comparables y las definiciones explícitas.**

### Cambios en `MonthlyTimeline.tsx`
1. **Renombrar y unificar la fila "Conectados"** → eliminar la doble definición. Dos opciones (te pregunto cuál preferís):
   - **A)** Una sola fila "Equipos con cortes" (la actual), eliminar Conectados/Desconectados del timeline. La conexión real va aparte.
   - **B)** Mantener "Equipos con cortes" para todos los meses (consistente), y agregar UNA fila "Online hoy (7d)" que solo muestre un valor, no por mes.
2. Agregar tooltips en cada fila explicando qué cuenta exactamente.
3. Resaltar columna del mes actual con nota "mes en curso" para que se entienda que el número es parcial.

### Cambios en filtros (`Dashboard.tsx`)
1. Tooltip o sub-label en "Activos (14)" → "con cortes en últimos 3 meses".
2. Tooltip en "Desconectados (13)" → "sin conexión >7 días".
3. Opcional: badge pequeño bajo el grupo de filtros aclarando que Activo/Inactivo y Conectado/Desconectado son dimensiones independientes (un equipo puede ser Activo + Desconectado).

### Sin cambios en backend
La data está bien. Es solo presentación + nomenclatura.

## Pregunta para vos

Antes de implementar, necesito decidir el approach del timeline (opción A vs B arriba). Te lo pregunto en cuanto apruebes el plan, o decidilo ahora si tenés clara la preferencia.

