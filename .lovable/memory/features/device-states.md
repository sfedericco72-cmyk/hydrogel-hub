---
name: Device state classification & alerts
description: Criteria for device states (stock/active/inactive/disconnected) and stock alert logic
type: feature
---
## Device States
- **En Stock**: no branch_name or branch_name === fixno
- **Activo**: had cuts in last 2 months
- **Inactivo**: no cuts in 2 months BUT was online in last 7 days
- **Desconectado**: no cuts in 2 months AND not online in last 7 days

## Alerts
- **Stock bajo**: remaining_cuts / avg_daily_cuts < 7 days. Fallback: ≤10 cuts if no history.
- **Desconectado**: no connection in last 5 days (alert threshold).
- Online/Offline badge removed from cards (sync is daily, rarely shows online).
- `hasAlert` checks: status !== "enabled" OR low stock.
- Alerts run daily at 9 AM Chile time (12:00 UTC) via cron.
- Dedup: max 1 alert per device per type per 24h.
