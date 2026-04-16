
## Problema detectado

Sí, ya sé cuál es el problema.

El onboarding sí se está guardando en el backend. Lo confirmé porque tu usuario ya tiene:
- `profiles.tenant_id` con valor
- `tenant_settings` con las credenciales CutABC cargadas

O sea: la creación del tenant funciona. El bug está en la navegación.

La pantalla donde quedás “quieto” encaja con esto:
- terminás el wizard
- la app vuelve a `/onboarding`
- esa ruta no tiene una salida automática cuando el onboarding ya quedó completo
- entonces te quedás atrapado ahí, incluso con los datos ya guardados

## Plan

1. **Arreglar el guard de rutas para que sea bidireccional**
   - Si falta onboarding y estás en una ruta normal: redirigir a `/onboarding`
   - Si el onboarding ya está completo y seguís en `/onboarding`: redirigir a `/`

2. **Separar mejor la lógica de la ruta onboarding**
   - Ajustar `ProtectedRoute` o crear un wrapper específico para `/onboarding`
   - Actualizar `App.tsx` para usar esa lógica sin ambigüedades

3. **Hacer más robusta la salida del wizard**
   - En `Onboarding.tsx`, después de guardar, revalidar perfil/configuración del usuario
   - Recién después navegar al dashboard
   - Mantener el estado de carga hasta que esa confirmación termine

4. **Endurecer el manejo de errores**
   - No asumir “todo bien” si falla la lectura del estado de onboarding
   - Agregar logs temporales en la decisión de redirección para validar el flujo exacto

5. **Validar el flujo completo**
   - Completar onboarding con el usuario de prueba
   - Confirmar llegada al dashboard
   - Refrescar manualmente `/onboarding` y verificar que te saque a `/`
   - Cerrar sesión y volver a entrar para confirmar que el wizard no reaparece

## Archivos a tocar

- `src/components/ProtectedRoute.tsx`
- `src/App.tsx`
- `src/pages/Onboarding.tsx`
- opcional: `src/components/OnboardingRoute.tsx`

## Detalles técnicos

La evidencia actual apunta a un problema de redirección, no de persistencia:
- `profiles` ya devuelve `tenant_id`
- `tenant_settings` ya devuelve `cutabc_company_no`, `cutabc_username` y `cutabc_password`
- por eso no hace falta rehacer la migración ni el RPC; hay que corregir el flujo de ruta después del guardado
