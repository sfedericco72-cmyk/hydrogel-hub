## Diagnóstico

CutABC particiona internamente los datos por un campo llamado `branna` (clientes del portal de CutABC). En CutMonitor **no usamos ese concepto** — los clientes y la agrupación se definen acá.

El problema es puramente técnico: cuando pedimos transacciones a CutABC sin filtrar por `branna`, la API devuelve solo agregados/distribuciones y oculta los "Consume" individuales. Por eso `device_cuts_history` queda vacío para muchos equipos (ej. `HX00240919194318` en KLAZ) y el gráfico/contador "cortes desde asignación" muestra 0.

Verificado contra la API: pidiendo el mismo equipo con `branna="Klaz"` aparecen las 223 transacciones reales con sus "Consume" diarios.

## Solución

Tratar al `branna` como un detalle de implementación del sync, invisible para el usuario. El sync auto-descubre los brannas a partir de los equipos que CutABC ya devuelve y los usa para iterar las consultas de transacciones. Sin configuración, sin UI, sin columnas nuevas.

### 1. `sync-cutabc` (edge function)
- `fetchAllDevices` ya devuelve todos los equipos visibles para el usuario del tenant (sigue igual).
- Calcular internamente `brannas = unique(devices.map(d => d.branna)).filter(Boolean)`.
- `fetchAllTransactions`: en vez de 1 llamada con `branna=""`, hacer **1 pasada por cada branna**, paginadas. Concatenar y deduplicar por `(fixno, billno)`.
- Resto del flujo (upsert devices, snapshot diario, upsert transactions) sin cambios.

### 2. `backfill-cuts-history` (edge function)
- Mismo patrón: tomar brannas únicos desde `devices` del tenant (`SELECT DISTINCT customer_name FROM devices WHERE tenant_id=$1`) y por cada chunk mensual hacer una pasada por cada branna.
- Mantiene el acumulado de `total_cuts` y el chunking actual.

### 3. Lo que NO cambia
- Esquema de la base de datos.
- UI.
- Comportamiento para tenants con un solo branna (Bitec, etc.): hace 1 pasada filtrada, idéntico al resultado actual pero correcto.
- El `customer_name` que vemos hoy en algunas pantallas de CutMonitor (que viene de `branna`) puede seguir guardándose en `devices.customer_name` como metadato crudo, pero no se usa como concepto de cliente.

## Validación post-deploy
1. Relanzar backfill de KLAZ desde 2024-01-01.
2. `device_cuts_history` para `HX00240919194318` debe traer ~223 filas con cortes diarios reales.
3. En la UI: el gráfico de historia del equipo muestra datos, y el contador "cortes desde asignación" deja de quedar en 0.

## Detalle técnico

```text
syncTenant:
  devices = fetchAllDevices(session)            # 302 equipos para KLAZ
  brannas = unique(devices.map(d=>d.branna))    # ["Klaz","Marioclp","CDRSI","JBCP"]
  txs = []
  for b of brannas:
    txs.push(...fetchTxByBranna(session, b, since))
  dedup(txs, key=`${fixno}|${billno}`)
  upsert into device_transactions / device_cuts_history

backfill-cuts-history:
  brannas = SELECT DISTINCT customer_name FROM devices WHERE tenant_id=$1
  for each month chunk:
    for b of brannas:
      custbalaqry with {branna:b}
```
