# Project Memory

## Core
Spanish-language hydrogel cutting machine monitoring dashboard. Dark theme.
CutABC API at http://www.cutabc.cn:8091/cut_app/app/ — credentials stored as secrets.
Lovable Cloud enabled. Devices table synced from CutABC.
BCC santiago.federico@bitec.cl on ALL alert emails.
All display names use titleCase() from lib/utils — never show raw uppercase/lowercase from API.
App settings in tenant_settings table — thresholds are parametrizable, not hardcoded.

## Memories
- [CutABC API](mem://reference/cutabc-api) — Login params, device list endpoint, session handling
- [Device states](mem://features/device-states) — Stock/active/inactive/disconnected criteria, alert logic
- [Email alerts](mem://features/email-alerts) — BCC config, alert_email column, /emails management page, notify.bitec.cl domain
- [Attach rate](mem://features/attach-rate) — Láminas vs equipos vendidos, rangos de color parametrizables en setup
- [Tenant settings](mem://features/tenant-settings) — Setup page with parametrizable thresholds, preparing for multi-tenant
- [Roadmap](mem://features/roadmap-next) — Plan aprobado: modelo Tenant→Cliente→PdV→Equipo, multi-tenant, onboarding, roles
