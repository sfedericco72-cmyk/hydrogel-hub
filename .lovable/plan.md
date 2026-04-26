## Objetivo
Asegurar que el historial de alertas muestre las alertas viejas (donde `metadata` está vacío) y mejorar el fallback para resolver `fixno`/`pdv` sin depender solo de metadata.

## Diagnóstico confirmado
- Las alertas del **20-abr-2026** tienen `metadata: null` en `email_send_log` y `message_id` es un UUID puro (no contiene el fixno).
- `useAlertHistory.ts` actualmente intenta resolver `fixno` desde `metadata.fixno` o desde un regex sobre `message_id` con formato `template-fixno-fecha`. Como ninguno aplica, `fixno = null` y la fila no aparece en el historial filtrado por equipo.
- Las alertas **nuevas** (a partir del despliegue del check-alerts con `baseMetadata`) ya quedan con metadata correcta — ese flujo está OK. El problema es solo histórico.

## Cambios

### 1. Mejorar el fallback de resolución en `useAlertHistory.ts`
Cuando `metadata` está vacío y el regex sobre `message_id` no matchea, agregar un tercer paso de resolución:

- **Resolver PdV por `recipient_email`** (ya existe esa lógica, pero solo se usaba como respaldo de `pdv_id`).
- Si el `recipient_email` corresponde al `bcc_email` del tenant (caso `email-no-configurado`), no se puede resolver PdV por email → quedar con `pdv_name = null`.
- **Resolver `fixno` desde el PdV resuelto**: si el PdV tiene exactamente **un** equipo activo asignado, asumir ese fixno. Si tiene varios, dejar `fixno = null` (no podemos adivinar).

Esto cubre el caso típico: 1 PdV = 1 equipo. Para HX007190821143217 → PdV `San_Cristobal_Inversiones` tiene solo ese equipo asignado → la alerta del 20-abr aparecerá en el historial del equipo.

### 2. Mostrar alertas "huérfanas" en el historial del PdV
En `BranchDetail.tsx` el filtro actual es:
```ts
history.filter(h => h.fixno === device.fixno)
```
Cambiarlo a:
```ts
history.filter(h => h.fixno === device.fixno || (h.pdv_id === pdvId && !h.fixno))
```
Para que las viejas (donde no se pudo resolver fixno pero sí PdV) aparezcan también en el detalle del equipo cuando el PdV solo tiene ese equipo.

### 3. (Opcional, recomendado) Backfill de metadata
Ejecutar un INSERT/UPDATE one-shot vía `supabase--execute_sql` para rellenar `metadata` de las filas viejas donde podamos resolver `pdv_id` y `fixno` por email + asignación activa. Esto deja la base "limpia" y no depende del fallback en runtime.

Solo aplicaría a alertas con `template_name IN ('stock-bajo','dispositivo-desconectado')` y donde `metadata IS NULL`. Para `email-no-configurado` (que va a BCC) habría que parsear `message_id` con el formato viejo `no-email-{stock|desconectado}-{fixno}-{fecha}` si existe — si no, dejarlas como están.

## Detalles técnicos
**Archivo `src/hooks/useAlertHistory.ts` — bloque enriquecido:**
```ts
// Nuevo: si tras resolver pdv aún no tenemos fixno, intentar inferirlo
// desde la asignación única del PdV.
const pdvFixnos = new Map<string, string[]>(); // pdv_id → fixnos activos
assigns.forEach((a: any) => {
  const fx = a.devices?.fixno;
  if (fx && a.point_of_sale_id) {
    const arr = pdvFixnos.get(a.point_of_sale_id) ?? [];
    arr.push(fx);
    pdvFixnos.set(a.point_of_sale_id, arr);
  }
});
// ...dentro del map de enrichment, después de resolver pdvId:
if (!fixno && pdvId) {
  const fxList = pdvFixnos.get(pdvId) ?? [];
  if (fxList.length === 1) fixno = fxList[0];
}
```

**Archivo `src/pages/BranchDetail.tsx` — filtro:**
```ts
const filtered = useMemo(() => {
  return alertHistory.filter(h =>
    h.fixno === device.fixno ||
    (h.pdv_id === pdvId && !h.fixno && pdvFixnos.length === 1)
  );
}, [alertHistory, device.fixno, pdvId]);
```
(Necesito verificar de dónde viene `pdvId` en ese componente; probablemente del `useAssignedHierarchy` o de la asignación activa del device.)

## Lo que NO se hace
- No tocar `send-transactional-email` ni `process-email-queue` — ya persisten metadata correctamente.
- No tocar `check-alerts` — ya envía con `baseMetadata`.

## ¿Hago también el backfill de metadata?
Es una opción "extra" que limpia la base. Recomiendo hacerlo después de validar que el fallback en runtime funciona — así no rompemos nada.