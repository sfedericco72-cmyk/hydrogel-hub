---
name: Authentication & security
description: Email+password and Google OAuth login. ProtectedRoute wraps all routes except /auth, /reset-password, /unsubscribe. Profiles auto-created on signup. user_roles table with has_role() for admin checks. All RLS requires authenticated.
type: feature
---
## Auth flow
- /auth page: login (email+password), signup, Google OAuth via lovable.auth
- /reset-password: password recovery flow
- ProtectedRoute component redirects unauthenticated to /auth
- Public routes: /auth, /reset-password, /unsubscribe

## Database
- profiles table: auto-created via trigger on auth.users insert
- user_roles table: app_role enum (admin), has_role() SECURITY DEFINER
- All tables: RLS requires `TO authenticated`
- tenant_settings: UPDATE restricted to admin role

## Tenant
- tenant_name changed from 'default' to 'bitec'
- tenant_settings has cutabc_company_no, cutabc_username, cutabc_password columns
