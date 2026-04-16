---
name: Multi-tenant RLS isolation
description: All data tables scoped by tenant_id via get_user_tenant_id() SECURITY DEFINER function. RLS enforces isolation automatically.
type: feature
---
## How it works
- `get_user_tenant_id()` — SECURITY DEFINER function returns `profiles.tenant_id` for `auth.uid()`
- All data tables (clients, devices, points_of_sale, device_assignments, equipment_sales, device_cuts_history, device_transactions) have `tenant_id` column
- RLS policies use `USING (tenant_id = get_user_tenant_id())` for all CRUD operations
- Service role has unrestricted access for edge functions (sync, alerts)
- tenant_settings and tenants tables also scoped to own tenant

## Frontend
- `useUserTenantId` hook — single source of truth for current user's tenant
- `useTenantSettings` filters by user's tenant_id (no more hardcoded "bitec")
- `useClients` no longer needs tenantId argument — RLS handles filtering
- `useAssignedHierarchy` no longer needs tenantId argument
- All INSERT operations (clients, POS, assignments) include tenant_id

## Edge functions
- `sync-cutabc` iterates all tenants with CutABC credentials from tenant_settings
- `check-alerts` iterates all tenants, scoping device queries by tenant_id
- Both include tenant_id in all upserts
