

## Plan: Mejoras a Gestión de Clientes y Equipos

Cuatro features para `/clientes`. Lo organizo de manera que los cambios de schema vayan juntos y la UI se construya encima.

### 1. Agrupador: Clientes con/sin equipos asignados

En `ClientsManager.tsx`, separar los clientes en **dos secciones colapsables**:
- **Con equipos asignados** (expandida por defecto): clientes que tienen al menos 1 PdV con asignación activa
- **Sin asignar** (colapsada): clientes que no tienen ningún equipo activo

Calculado en cliente con un query liviano que cuente assignments activos por cliente. Sin cambios de schema.

### 2. Sección "Equipos sin asignar" + clasificación

**Schema** (1 migración):
- Agregar `devices.condition` (text, nullable) — estado físico del equipo
- Agregar `devices.condition_notes` (text, nullable) — observaciones libres
- Agregar `devices.condition_updated_at` (timestamptz)

**Valores propuestos para `condition`** (te pregunto cuál preferís — ver pregunta 1):
- `nuevo`, `usado`, `roto`, `en_reparacion`, `reparado`, `fuera_de_servicio`

**UI**: Nuevo bloque colapsable "Equipos sin asignar" arriba del listado de clientes, mostrando los devices que no tienen `device_assignment` activo. Cada equipo con:
- fixno, branch_name, status (online/offline)
- Selector de condición (badge clickeable)
- Campo de notas (popover)
- Botón "Asignar a PdV" que abre el diálogo existente con el device pre-seleccionado

### 3. Buscador global Clientes / PdV / Equipos

Input de búsqueda en el header de `/clientes` que filtra **en cliente** (los datos ya están cargados):
- Busca por nombre/código de cliente, nombre/dirección de PdV, fixno/branch_name de device
- Resaltado visual del match
- Cuando hay match en un PdV o device hijo, expandir automáticamente el cliente y el PdV correspondiente

Sin backend.

### 4. Motivo de asignación/desasignación

**Schema** (misma migración del punto 2):
- `device_assignments.assignment_reason` (text, nullable)
- `device_assignments.unassignment_reason` (text, nullable)

**UI**:
- En `AssignDeviceDialog`: agregar campo de texto "Motivo (opcional)"
- En la confirmación de desasignación: reemplazar el `confirm()` nativo por un Dialog que pida el motivo
- En el historial del PdV: mostrar el motivo debajo de cada fila

### 5. Exportador

Botón "Exportar" en el header que descarga un **XLSX** con 3 hojas:
- **Clientes**: código, nombre, contacto, email, teléfono, dirección, # PdV, # equipos
- **Puntos de Venta**: cliente, nombre, dirección, email alertas, alertas activas, # equipos
- **Equipos**: fixno, cliente, PdV, condición, status, cortes totales, cortes restantes, fecha asignación

Usando librería `xlsx` (SheetJS, ya popular y liviana). Genera y descarga en cliente.

---

### Pregunta antes de implementar
Te pregunto al pasar a default mode:

**Clasificación de equipos**: ¿con qué set de estados arrancamos?
- A) `nuevo / usado / roto / en_reparacion / reparado` (5 estados, los que nombraste)
- B) Lo anterior + `fuera_de_servicio` (para dar de baja sin borrar)
- C) Sólo 3: `operativo / en_reparacion / fuera_de_servicio` (más simple)

### Detalle técnico

**Migración SQL** (una sola):
```sql
alter table devices 
  add column condition text,
  add column condition_notes text,
  add column condition_updated_at timestamptz;

alter table device_assignments
  add column assignment_reason text,
  add column unassignment_reason text;
```

**Hooks nuevos**:
- `useUpdateDeviceCondition(deviceId, condition, notes)` 
- Extender `useAssignDevice` y `useUnassignDevice` para aceptar reason

**Componentes nuevos**:
- `UnassignedDevicesSection.tsx` — bloque arriba con buscador interno y selector de condición
- `UnassignDialog.tsx` — reemplaza el confirm nativo, pide motivo
- `ExportClientsButton.tsx` — genera XLSX

**Modificados**:
- `ClientsManager.tsx`: agrega buscador global, agrupador, botón export, sección equipos sin asignar
- `AssignDeviceDialog`: agrega campo motivo
- `PdVRow` historial: muestra motivos
- `useClients.ts`: hook `useUpdateDeviceCondition`

**Dependencia nueva**: `xlsx` (SheetJS)

### Orden de implementación
1. Migración SQL (schema)
2. Hooks + tipos
3. Sección equipos sin asignar con clasificación
4. Buscador global
5. Agrupador con/sin asignación
6. Motivos asignar/desasignar
7. Exportador XLSX

