

## Indicador visual de alertas en la lista de Clientes y PdV

En la pantalla `/clientes` (Clientes y Puntos de Venta) hoy hay que expandir cada cliente y abrir cada PdV para ver si tiene alertas activadas. Propongo agregar señales visibles en los niveles colapsados.

## Cambios

### 1. Badge a nivel Cliente (fila colapsada)

Al lado del nombre del cliente, un pill compacto con el resumen de alertas de sus PdV:

```
🔔 4/6 alertas
```

- `4` = PdV con `alerts_enabled = true` y `alert_email` configurado
- `6` = total de PdV del cliente
- Color del pill:
  - **Verde** si todos los PdV tienen alertas ON con email
  - **Ámbar** si hay mezcla (algunos ON, otros OFF o sin email)
  - **Gris** si ninguno tiene alertas ON
  - **Rojo chico extra** si hay PdV con `alerts_enabled=true` pero **sin email** (config rota — no llega nada)

Tooltip al hover: "4 con alertas activas · 1 sin email configurado · 1 desactivado".

### 2. Indicador a nivel PdV (al expandir el cliente)

En cada fila de PdV, un ícono a la izquierda del nombre:

- 🔔 verde → alertas ON + email configurado
- 🔔 ámbar → alertas ON pero sin email (no llega nada, está rota)
- 🔕 gris → alertas OFF
- ⏸ azul → pausadas globalmente (si `tenant_settings.alerts_paused_until` está vigente)

Y el email destinatario en gris chico al lado, truncado si es largo. Así de un vistazo se ve a quién le llegan las alertas sin tener que abrir el panel.

### 3. Filtro rápido arriba de la lista

Un toggle compacto al lado del search:

```
[ Todos ] [ Con alertas ON ] [ Sin email ] [ OFF ]
```

Filtra la jerarquía mostrando solo clientes/PdV que matchean. "Sin email" es el más útil para detectar configuraciones rotas rápido.

### 4. Banner de pausa global (si aplica)

Si `tenant_settings.alerts_paused_until > now`, banner ámbar arriba de toda la lista:
> ⏸ Alertas pausadas hasta el 25 nov 2026, 14:30. Ningún cliente recibirá emails durante este periodo.

Ya existe el `GlobalAlertsPauseDialog` pero el estado no se ve reflejado en la lista — esto cierra el loop.

## Archivos

```text
EDIT src/pages/ClientsManager.tsx     — badges en filas de Cliente y PdV, filtro rápido, banner de pausa
```

Probablemente conviene extraer un mini componente `AlertsStatusBadge` en `src/components/AlertsStatusBadge.tsx` para reutilizar entre fila de Cliente (modo agregado N/M) y fila de PdV (modo individual). Los datos ya vienen en el query existente de `points_of_sale` (`alerts_enabled`, `alert_email`); solo hay que agregar `alerts_paused_until` desde `useTenantSettings` (hook ya existe).

## Notas UX

- Sin números de ranking ni distracciones — solo señales de salud de la config de alertas.
- El criterio "sin email" es el que más valor da: hoy no hay forma rápida de detectar PdV con alertas activadas pero sin destinatario configurado (silenciosamente no envía nada).
- Mobile: el badge a nivel Cliente cabe en una línea; en PdV el email se trunca con ellipsis.

