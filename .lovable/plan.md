

## Plan: Arreglar el onboarding que queda colgado después de guardar

### Problema raíz
Después de que `setup_new_tenant` se ejecuta correctamente y `navigate("/")` redirige a la ruta principal, `ProtectedRoute` vuelve a evaluar `needsOnboarding`. Pero el `useEffect` que hace esa verificación solo se dispara cuando cambia `session` — que no cambia. Entonces `needsOnboarding` sigue siendo `true` del check anterior, y redirige de vuelta a `/onboarding`. El usuario ve la pantalla quieta.

### Solución

**1. ProtectedRoute — invalidar el check después del onboarding**
- Cambiar el trigger del `useEffect` de onboarding para que también responda a cambios de `location.pathname`. Así cuando navega de `/onboarding` a `/`, se re-ejecuta el check y esta vez encuentra `tenant_id` con credenciales.

**2. Onboarding.tsx — forzar re-check antes de navegar**
- Después de `setup_new_tenant`, esperar un breve momento y luego navegar. Opcionalmente invalidar React Query caches si los hay.

### Cambios concretos

| Archivo | Cambio |
|---------|--------|
| `src/components/ProtectedRoute.tsx` | Agregar `location.pathname` al array de dependencias del `useEffect` de onboarding. Resetear `needsOnboarding` a `undefined` antes de cada check para que muestre spinner mientras verifica. |
| `src/pages/Onboarding.tsx` | Después de `setup_new_tenant`, hacer un pequeño delay o re-fetch del profile antes de navegar, para asegurar que el dato está disponible. |

### Notas
- `sync-cutabc` sigue usando secrets globales — funciona para BITEC pero no para nuevos tenants. Eso se resuelve en el paso de "sync multi-tenant" que queda pendiente.
- No se pierden datos ni se tocan migraciones.

