

El usuario reporta que las DeviceCards en el Dashboard se están mostrando en una sola columna (fila para abajo) en vez de 3 por fila como antes.

Mirando `src/pages/Dashboard.tsx` línea ~256:
```tsx
<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
```

El grid ya tiene `lg:grid-cols-3`, pero `lg` en Tailwind es **1024px**. El viewport del usuario es 1311px, así que debería estar mostrando 3 columnas. Pero el problema es que el contenedor padre tiene `max-w-6xl` (1152px) y dentro hay padding + márgenes del árbol jerárquico (`ml-2 ... pl-4`), reduciendo el ancho útil.

Más importante: las cards están dentro de `client → POS → devices`, y cada nivel agrega indentación (`ml-2 border-l pl-4`), comprimiendo el espacio horizontal real disponible para el grid. Con eso, `lg:grid-cols-3` arranca recién en 1024px de **viewport**, pero el contenedor real es mucho más chico.

## Solución

Cambiar los breakpoints del grid para que sean más agresivos, basándose en el ancho del contenedor visible, no del viewport:

```tsx
<div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-3">
```

O mejor, usar `min-content` con `auto-fit`:

```tsx
<div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
```

Esto fuerza 3 columnas desde 768px (md), que es el comportamiento que el usuario quería.

## Cambio único

**Archivo**: `src/pages/Dashboard.tsx` línea ~256
**Antes**: `className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"`
**Después**: `className="grid gap-3 sm:grid-cols-2 md:grid-cols-3"`

Cambio de 1 línea. Quedan 3 cards por fila desde tablet hacia arriba (≥768px), que es lo que el usuario tenía antes y prefiere.

