---
name: Authentication & security
description: Email+password and Google OAuth login. Signup is gated by allowed_emails whitelist (admin-only table, checked via check-email-allowed edge fn). ProtectedRoute also re-validates whitelist post-login (covers Google OAuth) and signs out + redirects to /auth?denied=1 if email is not authorized. Profiles auto-created on signup. user_roles table with has_role() for admin checks.
type: feature
---
## Auth flow
- /auth page: login (email+password), signup, Google OAuth via lovable.auth
- /reset-password: password recovery flow
- ProtectedRoute component redirects unauthenticated to /auth
- Public routes: /auth, /reset-password, /unsubscribe

## Whitelist (invitation-only signup)
- Table `allowed_emails` (admin-only RLS) holds authorized emails (lowercased via trigger).
- Edge fn `check-email-allowed` (verify_jwt=false) uses service role to check `{ email }`. Optional `markUsed: true` stamps `used_at`.
- Auth.tsx: email/password signup calls check BEFORE supabase.auth.signUp. If not allowed → toast pointing to santiago.federico@bitec.cl.
- ProtectedRoute: on every authenticated session, re-validates email vs whitelist. If not allowed → signOut() + redirect to `/auth?denied=1` (covers Google OAuth where the check can't run pre-signup).
- Auth.tsx reads `?denied=1` and shows a destructive toast.
- To add an email: `INSERT INTO allowed_emails (email, notes) VALUES ('user@x.com', 'context');` (admin only).
- Pre-seeded: santiago.federico@bitec.cl.

## Database
- profiles table: auto-created via trigger on auth.users insert
- user_roles table: app_role enum (admin), has_role() SECURITY DEFINER
- All tables: RLS requires `TO authenticated`
- tenant_settings: UPDATE restricted to admin role

## Tenant
- tenant_name changed from 'default' to 'bitec'
- tenant_settings has cutabc_company_no, cutabc_username, cutabc_password columns

## Welcome banner
- src/components/WelcomeBanner.tsx renders on Dashboard, BETA badge, explains CutMonitor + invitation-only access. Dismiss state per-user in localStorage `welcome-banner-dismissed-{userId}`. Re-openable from Info icon next to Dashboard title.
