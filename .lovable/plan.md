

El usuario está en `/auth` (cutmonitor.com/auth) y dice que no ve el mensaje de beta ni la info que hablamos. Mirando la captura: solo se ve el card de "Inicia sesión para continuar" sin el aviso de beta.

Revisando `src/pages/Auth.tsx`: el aviso amber con `ShieldAlert` que explica beta + invitación + email de contacto está dentro de `{!isLogin && (...)}` — solo se muestra en modo **registro**, no en login. Por eso no lo ve: está en la pantalla de login.

El `WelcomeBanner` con toda la info de beta + funcionalidad + acceso por invitación está en el **Dashboard**, que requiere estar logueado. Tampoco lo ve porque no entró todavía.

## Problema

El usuario nuevo (no logueado) no ve nada del contexto de beta hasta que hace click en "Regístrate" o entra a la app. La landing real es `/auth` en modo login y ahí no hay info.

## Propuesta

Mostrar el aviso de beta + invitación **siempre** en `/auth` (no solo en signup). Dos opciones de presentación:

**A. Mover el aviso fuera del `{!isLogin && ...}`** para que se muestre en login y signup. Mismo bloque amber compacto que ya existe.

**B. Agregar arriba del card un bloque más visible** estilo mini-hero: título "CutMonitor (BETA)", una línea de qué hace + conexión con cutabc.cn, y la nota de invitación con email. Más vendedor y deja claro de qué se trata antes de pedir credenciales.

Recomiendo **B** porque es la primera impresión pública del producto y hoy es muy seca. El bloque va arriba del Card, ancho similar (max-w-md), tono sutil para no competir con el form.

## Cambio único

```text
EDIT src/pages/Auth.tsx — agregar bloque informativo arriba del Card,
                          visible siempre (login y signup).
                          Mantener el ShieldAlert dentro de signup como refuerzo
                          o quitarlo (queda redundante). Propongo quitarlo.
```

Contenido del bloque (arriba del Card, mismo max-w-md):
- Badge "BETA" + título "CutMonitor"
- 1 línea: "Monitoreo en tiempo real de máquinas de corte de hidrogel conectadas a CutABC (cutabc.cn)."
- 1 línea con ícono mail: "Acceso por invitación. Solicitá autorización a cutmonitor@bitec.cl indicando empresa y email."

Sin lista larga de features (eso queda para el WelcomeBanner del Dashboard, post-login). Acá solo lo mínimo para que entiendan qué es y cómo pedir acceso.

