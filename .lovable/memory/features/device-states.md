---
name: Device state classification & indicators
description: 4-state system (stock/active/inactive/disconnected) with traffic light indicators for cuts and connection
type: feature
---
## Device States (4 states)
- **En Stock**: no branch_name or branch_name === fixno
- **Activo**: had cuts in last 3 months (and connected ≤7 days)
- **Inactivo**: no cuts in last 3 months (but connected ≤7 days)
- **Desconectado**: no internet connection >7 days

Priority: stock > disconnected > inactive > active

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
- `hasAlert` checks: status !== "enabled" OR low stock.
- Alerts run daily at 9 AM Chile time (12:00 UTC) via cron.
- **Frequency**: max 1 alert per device per type per 7 days (weekly).
- **Window**: alerts auto-stop after 2 weeks (first_alert_sent_at + 14 days). Device alerts_enabled set to false.
- **Toggle**: per-device alerts_enabled flag. Re-enabling resets first_alert_sent_at to restart the 2-week window.
