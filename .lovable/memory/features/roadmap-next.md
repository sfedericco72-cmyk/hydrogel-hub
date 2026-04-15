---
name: Roadmap — próximos pasos
description: Plan aprobado: modelo jerárquico Tenant→Cliente→PdV→Equipo, multi-tenant, onboarding, roles
type: feature
---
## Orden de implementación
1. **Modelo de datos** — Tenant → Cliente → PdV → Equipo(s) con asignaciones temporales
2. **Autenticación + multi-tenant básico**
3. **Onboarding wizard** (registro self-service)
4. **Roles y permisos** (admin invita usuarios, acceso granular por PdV/equipo)

## Reglas del nuevo modelo
- Un PdV puede tener múltiples equipos simultáneos
- Cortes suman al PdV/Cliente **solo mientras el equipo está asignado**
- Reasignar equipo → empieza a sumar para el nuevo cliente
- Reportes muestran cortes del **punto de venta**, no acumulado histórico de la máquina
- Resuelve reemplazos de equipos sin perder historia del PdV

## Estado
- Plan aprobado, sin implementar aún
