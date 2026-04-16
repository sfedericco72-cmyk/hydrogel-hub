# Project Memory

## Core
Spanish-language hydrogel cutting machine monitoring dashboard. Dark theme.
CutABC API at http://www.cutabc.cn:8091/cut_app/app/ — credentials stored as secrets.
Lovable Cloud enabled. Devices table synced from CutABC.
Auth required: email+password + Google. ProtectedRoute on all routes except /auth, /unsubscribe.
Tenant 'bitec' (was 'default'). RLS requires authenticated on all tables.

## Memories
- [CutABC API](mem://reference/cutabc-api) — Login params, device list endpoint, session handling
- [Auth & security](mem://features/auth) — Login/signup, ProtectedRoute, profiles, user_roles, RLS policies
- [Tenant settings](mem://features/tenant-settings) — Parametrizable thresholds, CutABC creds columns
- [Device states](mem://features/device-states) — Activity/connection state logic
- [Attach rate](mem://features/attach-rate) — Equipment sales vs active devices ratio
- [Email alerts](mem://features/email-alerts) — Transactional email system for device alerts
- [Branch-device decoupling](mem://features/branch-device-decoupling) — POS/branch identity separate from device
