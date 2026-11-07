# Ver qué equipos "sin asignar" cortaron ayer y asignarlos

## Qué cambia
- En la tarjeta **Cortes ayer**, el texto "+1 sin asignar" pasa a ser un botón.
- Al tocarlo se abre una ventanita con la lista de esos equipos: ID (fixno), sucursal/cliente según CutABC y cortes de ayer, ordenados de mayor a menor.
- Cada fila tiene un botón **Asignar** que abre el mismo selector de punto de venta que ya existe en Clientes. Al asignar, el equipo desaparece de la lista y el número de la tarjeta se actualiza.
- Al pie, un enlace "Ver todos los sin asignar" lleva a la sección Equipos sin asignar en Clientes.

## Detalles técnicos
- `useYesterdayCuts`: además del total, devolver `unassignedDevices: { id, fixno, branch_name, customer_name, cuts }[]`.
- `YesterdayCutsCard`: envolver el texto en un `Popover` con la lista.
- Extraer el diálogo "Pick PdV" de `ClientsManager.tsx` a un componente reutilizable y usarlo en ambos lugares; invalidar `yesterday-cuts` y `unassigned-devices` al asignar.
