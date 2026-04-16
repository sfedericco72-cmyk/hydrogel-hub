# Project Memory

## Core
Spanish-language hydrogel cutting machine monitoring dashboard. Dark theme.
CutABC API at http://www.cutabc.cn:8091/cut_app/app/ — credentials stored per tenant in tenant_settings.
Lovable Cloud enabled. Multi-tenant: all data isolated by tenant_id via RLS.

## Memories
- [CutABC API](mem://reference/cutabc-api) — Login params, device list endpoint, session handling
- [Multi-tenant RLS](mem://features/multi-tenant-rls) — get_user_tenant_id(), tenant-scoped RLS on all tables, edge functions iterate tenants
- [Tenant settings](mem://features/tenant-settings) — Parametrizable thresholds, CutABC credentials per tenant
- [Auth flow](mem://features/auth) — Email+password, Google OAuth, ProtectedRoute, user_roles
- [Attach rate](mem://features/attach-rate) — Equipment sales tracking
- [Device states](mem://features/device-states) — Activity, connection, stock states
- [Email alerts](mem://features/email-alerts) — Low stock, disconnected alerts with cooldown
- [Roadmap](mem://features/roadmap-next) — Pending features
- [Branch-device decoupling](mem://features/branch-device-decoupling) — POS/branch identity separate from device
