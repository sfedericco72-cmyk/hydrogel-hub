

# Roadmap CutMonitor — Registro de decisiones

## Lo que definimos hoy

### 1. CAMBIO DE MODELO DE DATOS (fundacional)
Pasar de un modelo centrado en el equipo (`fixno`) a una estructura jerárquica:

```text
Tenant (empresa)
  └── Cliente
        └── Punto de Venta (PdV)
              └── Equipo(s) — con fecha de asignación/desasignación
```

**Reglas clave:**
- Un PdV puede tener múltiples equipos al mismo tiempo
- Los cortes de un equipo suman al PdV/Cliente **solo mientras está asignado**
- Si se reasigna a otro cliente, empieza a sumar para el nuevo
- Los reportes muestran cortes del **punto de venta**, no el acumulado histórico de la máquina
- Resuelve el problema de reemplazos de equipos

### 2. MULTI-TENANT
- Cada empresa (tenant) tiene sus propios clientes, equipos y configuración
- Primer caso de prueba: el socio

### 3. ONBOARDING GUIADO
- Registro self-service con wizard de configuración inicial
- Paso a paso simple para nuevos tenants

### 4. ROLES Y PERMISOS (segunda etapa)
- Admin del tenant invita usuarios individuales
- Usuarios ven solo los equipos/PdV asignados
- Control de acceso granular

## Orden de implementación sugerido
1. **Modelo de datos** — es la base, todo se construye encima
2. **Autenticación + multi-tenant básico**
3. **Onboarding wizard**
4. **Roles y permisos**

## Acciones inmediatas de este plan
- Guardar todo esto en la memoria del proyecto como roadmap
- NO implementar nada todavía

