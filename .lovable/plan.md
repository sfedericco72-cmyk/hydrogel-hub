

# Autocompletado de direcciones con Google Maps Places API

## Lo que necesitas hacer (tu parte)

1. Ir a [Google Cloud Console](https://console.cloud.google.com/)
2. Crear un proyecto (o usar uno existente)
3. Habilitar la API **"Places API (New)"**
4. Crear una API Key en Credenciales
5. (Recomendado) Restringir la key por dominio HTTP: `*.lovable.app/*`
6. Pasarme la API Key cuando la tengas

Google da USD 200/mes de crédito gratis, que cubre ~28,000 solicitudes de autocompletado.

## Lo que implemento yo

1. **Guardar la key** como `VITE_GOOGLE_MAPS_API_KEY` en el proyecto
2. **Crear componente `AddressAutocomplete`** que:
   - Carga el script de Google Maps Places
   - Muestra sugerencias mientras el usuario escribe
   - Al seleccionar, extrae dirección formateada + latitud + longitud
3. **Reemplazar el input de Domicilio** en el formulario de clientes por este componente
4. **Aplicar también** en el formulario de Puntos de Venta si tiene campo dirección

## Detalle tecnico
- Libreria: `@react-google-maps/api` con `usePlacesAutocomplete` o Google Places Autocomplete Widget directo
- Los valores se guardan en las columnas `address`, `latitude`, `longitude` que ya existen en `clients`
- Si la API no carga (sin key o error), el campo funciona como input de texto normal (fallback)

