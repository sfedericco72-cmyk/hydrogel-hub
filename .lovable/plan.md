## Objetivo

Tener una forma simple, repetible y autoservicio de **controlar los totales mensuales por equipo** que muestra el sistema, comparándolos contra el archivo "fuente de verdad" que CutABC permite exportar (el mismo formato del CSV `marzo2026_2.csv` que subiste: `Device NO, Device Name, Customer Name, Usage Count, Remark`).

La idea: subir un archivo del mes → ver tabla comparativa equipo por equipo → identificar desvíos al instante.

---

## Cómo funciona desde el usuario

Nueva tab dentro de **Setup → "Control de cortes"**:

1. **Seleccionar período** (mes/año). Default: mes anterior.
2. **Subir CSV** exportado de CutABC con totales del mes (mismo formato que ya tenés).
3. La app:
   - Parsea el CSV en el navegador (sin enviar a backend, sin guardar archivo).
   - Cruza por `Device NO` (= `fixno`) contra `device_cuts_monthly` del tenant para ese período.
4. Muestra una **tabla comparativa**:

   ```text
   Equipo            | CutABC (real) | Sistema | Diferencia | Estado
   IRONTECH MARIQ.   |     118       |   115   |    -3      | ⚠ Menor
   VIVOCELL OLMUE    |      86       |    86   |     0      | ✓ OK
   FLAPIX            |      34       |   435   |  +401      | 🚨 Spike
   (no en sistema)   |      21       |    -    |    -       | ❓ Falta
   ```

5. Resumen arriba: **Total real vs Total sistema**, % de exactitud, cantidad de equipos OK / con desvíos / faltantes.
6. Botón **"Exportar comparativa CSV"** para guardar registro.

Sin guardar nada en la base por ahora — es una herramienta de QA, no un proceso de corrección automática.

---

## Reglas de cruce

- **Match key**: `Device NO` del CSV ↔ `fixno` en `device_cuts_monthly`.
- **Período**: el CSV no trae fecha → el usuario elige el mes en el selector. Se filtra `device_cuts_monthly` por `year_month = 'YYYY-MM'` y `tenant_id`.
- **Tolerancia configurable** (default ±2 cortes): debajo de eso = ✓ OK, arriba = ⚠ desvío, >100 = 🚨 spike sospechoso.
- **Equipos en CSV pero no en sistema** → fila "Falta en sistema".
- **Equipos en sistema pero no en CSV** → fila "Falta en CutABC export" (puede pasar si el equipo no tuvo cortes en CutABC pero sí registros viejos).

---

## Dónde se ubica

Dentro de `src/pages/Setup.tsx`, agregar una nueva sección colapsable **"Control de cortes"** al final, junto a "Carga histórica" — no necesita ruta nueva, mantiene todo en un solo lugar.

Si en el futuro querés un tab dedicado tipo `/setup?tab=control`, es un refactor menor; por ahora una sección más alcanza y es más simple.

---

## Detalles técnicos

**Archivos nuevos / modificados:**

- `src/pages/Setup.tsx` → agregar `<NumberControlSection />` al final del stack.
- `src/components/NumberControlSection.tsx` (nuevo) → toda la UI: selector de mes, file input, tabla, resumen, export.
- `src/hooks/useMonthlyCutsForControl.ts` (nuevo) → query a `device_cuts_monthly` filtrando por `tenant_id` + `year_month`, joineada con `devices` para traer `branch_name` (más útil que `fixno` solo).
- `src/lib/cutsControl.ts` (nuevo) → funciones puras: `parseCutabcCsv()`, `compareCuts()`, `exportComparisonCsv()`. Testeable sin React.

**Parsing CSV:**

- Usar parser simple manual (regex) o agregar `papaparse` (~7KB gz). Voto por `papaparse` porque maneja BOM (el CSV subido tiene `\ufeff`), comillas, escapes, etc. sin dolor.
- Columnas requeridas: `Device NO`, `Usage Count`. Las demás se ignoran.
- Validar formato; si falla, mostrar error claro ("El archivo no parece ser un export de CutABC. Esperaba columnas Device NO y Usage Count").

**Sin cambios de backend:**

- No nuevas tablas, no edge functions, no RLS. Solo lectura de `device_cuts_monthly` (que ya tiene RLS por tenant).
- Toda la lógica corre en el cliente.

**UX**:

- Estados visuales: verde (OK), amarillo (desvío menor), rojo (spike), gris (faltante).
- Ordenar por mayor desvío absoluto al tope para que los problemas salten a la vista.
- Mostrar también el `Customer Name` del CSV para que el usuario reconozca rápido.

---

## Por qué este enfoque

- **Multi-tenant nativo**: cada usuario ve solo sus propios `device_cuts_monthly` por RLS, sin código extra.
- **Sin acoplamiento a CutABC**: si mañana el formato del export cambia, solo tocás `parseCutabcCsv()`.
- **No invasivo**: no escribe nada, no rompe nada, no consume API de CutABC. Pura inspección.
- **Reutilizable**: el mismo flujo sirve para auditar abril, mayo, etc., y para validar después de cada `sync-cutabc` o backfill.
- **Base para más**: si en el futuro querés que detecte automáticamente y genere alertas, ya tenés la lógica de comparación lista en `src/lib/cutsControl.ts`.

---

## Fuera de alcance (decisiones explícitas)

- **No corrige automáticamente** los datos del sistema. Si hay desvíos, vos decidís qué hacer (forzar sync, ajustar manualmente, investigar).
- **No guarda historial de auditorías** en la base. Si querés eso después, agregamos una tabla `cuts_audit_log` — pero por ahora KISS.
- **No soporta CSV con cortes diarios**. Solo totales mensuales por equipo (que es lo que CutABC exporta cómodamente).
