---
name: Tenant settings & setup page
description: Parametrizable app settings (attach rate thresholds, stock days, disconnect months, connection levels, alert windows). Preparing for multi-tenant.
type: feature
---
## tenant_settings table
- tenant_name: 'default' (single tenant for now, multi-tenant ready)
- company_name, logo_url, bcc_email
- brand_name, store_url, store_button_label, support_email, timezone (per-tenant branding for emails)
- attach_rate_green (80%), attach_rate_yellow (50%)
- low_stock_days (7)
- disconnect_months (3)
- connection_green_days (7), connection_yellow_days (14)
- alert_cooldown_days (7), alert_max_window_days (14)

## Wiring
- Frontend: useTenantSettings hook, values consumed in AttachRate, useDevices, TrafficLights
- Edge function check-alerts reads from tenant_settings at runtime, including timezone (per-tenant) and branding props injected into every templateData
- Edge function send-transactional-email uses brandName from templateData as From header
- Email templates (stock-bajo, dispositivo-desconectado, email-no-configurado) accept brandName/logoUrl/storeUrl/storeButtonLabel/supportEmail props with safe defaults; "Comprar" button hidden when storeUrl missing
- Setup page at /setup
- Onboarding has 4 steps: Empresa, Marca, Credenciales CutABC, Validar
- setup_new_tenant RPC accepts: _logo_url, _brand_name, _store_url, _store_button_label, _support_email, _timezone

## Email domain
- Currently: notify.bitec.cl (verified)
- User wants cutmonitor.com — needs new domain setup
