

El usuario quiere reorganizar el sistema de emails de alerta. Actualmente:
- `devices.alert_email` (por equipo)
- `devices.alerts_enabled` (por equipo)
- Página `/emails` lista equipos agrupados por cliente

Propuesta:
- Mover el email al **Punto de Venta** (`points_of_sale.alert_email`, `alerts_enabled`)
- Migrar emails actuales: para cada equipo asignado a un PdV, copiar el `alert_email` del equipo al PdV
- Integrar configuración de email + toggle alertas + historial directamente en la página de Clientes (gestión jerárquica)
- Botón global "alertas off"

Necesito decidir algunas cosas:

1. **¿Qué pasa con `devices.alert_email` después?** El check-alerts edge function lo usa. Hay que actualizarlo para resolver el email vía la asignación activa al PdV. Si un equipo no está asignado a un PdV → ¿no manda alerta? ¿o cae a un fallback?

2. **Historial de alertas**: hoy se busca por `message_id` que contiene `fixno`. Si lo movemos al PdV, el historial se podría mostrar agrupado por PdV (mostrando alertas de todos los equipos asignados ahí).

3. **Página /emails**: ¿la borramos, la dejamos como vista de solo lectura, o la convertimos en redirect a /clients?

Voy a explorar primero qué hay en check-alerts, ClientsManager y el schema actual para ser preciso.

Voy a leer:
- check-alerts/index.ts (cómo se usa alert_email hoy)
- ClientsManager.tsx (cómo está estructurada)
- DeviceCard / componentes relacionados

Hago las preguntas críticas antes de plantear el plan completo, porque hay varias decisiones de producto.

