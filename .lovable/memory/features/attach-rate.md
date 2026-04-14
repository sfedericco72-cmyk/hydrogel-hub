---
name: Attach rate feature & setup params
description: Láminas cortadas vs equipos vendidos. Rangos de color parametrizables en setup futuro.
type: feature
---
## Attach Rate
- **Fórmula**: (láminas cortadas / equipos vendidos) × 100
- **Tabla**: `equipment_sales` (customer_name, branch_name, period YYYY-MM, units_sold, source)
- **Datos de cortes**: vienen de `device_cuts_history` agrupados por mes
- **Carga obligatoria por sucursal** — el total consolidado es la suma de sucursales

## Rangos de color (PARAMETRIZAR en setup)
- Verde: ≥ 80%
- Amarillo: ≥ 50%
- Rojo: < 50%
- Estos umbrales deben ser configurables por tenant en la futura página de setup (tenant_settings).

## Fuentes de datos
- Carga manual por sucursal (implementado)
- Vista consolidada + por sucursal (implementado)

## Nice to have (pendiente)
- Export template Excel con sucursales × meses para completar offline
- Import del Excel/CSV completado para carga masiva
