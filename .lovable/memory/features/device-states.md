---
name: Device state classification & indicators
description: 2 independent dimensions — activity (active/inactive based on cuts) and connection (connected/disconnected based on internet ≤7d)
type: feature
---
## Two Independent Dimensions

### Activity (based on cuts)
- **Activo**: had cuts in last 3 months
- **Inactivo**: no cuts in last 3 months

### Connection (based on internet)
- **Conectado**: last online ≤7 days (green light)
- **Desconectado**: last online >7 days (red light, always show days)

A device can be Activo + Desconectado. "En stock" filter removed.

## Traffic Light Indicators

### Cortes (3 lights)
- 3 circles: current month, month-1, month-2
- Green = has sales that month, Red = no sales

### Conexión (1 light)
- Green: connected in last 7 days
- Red: more than 7 days without connection
- Always show days of disconnection

## Alerts
- **Stock bajo**: remaining_cuts / avg_daily_cuts < 7 days. Fallback: ≤10 cuts if no history.
- Alerts run daily at 9 AM Chile time (12:00 UTC) via cron.
- **Frequency**: max 1 alert per device per type per 7 days (weekly).
- **Window**: alerts auto-stop after 2 weeks. Device alerts_enabled set to false.
- **Toggle**: per-device alerts_enabled flag. Re-enabling resets the 2-week window.
