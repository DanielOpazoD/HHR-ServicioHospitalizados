# Fase 3: Refactor mecánico de `useHandoffManagementPersistence`

## Objetivo

Reducir complejidad mecánica en `src/hooks/useHandoffManagementPersistence.ts`
sin cambiar su API pública ni el flujo de persistencia/auditoría.

## Alcance

- Extraer runtime compartido del hook.
- Separar acciones generales de handoff.
- Separar acciones médicas de handoff.
- Mantener `useHandoffManagementPersistence.ts` como entrypoint estable.

## Iteración 1

### Decisión

Se eligió un corte conservador porque este hotspot sí toca flujo médico y auditoría.
La separación se hizo por grupos de mutaciones, apoyándose en la cobertura existente
de `useHandoffManagement` y de integración de firma médica.

### Cambios aplicados

- `useHandoffPersistenceRuntime.ts`: record lookup, guard de edición médica y runner de mutaciones.
- `useHandoffGeneralPersistenceActions.ts`: checklist, novedades, staff y reset.
- `useMedicalHandoffPersistenceActions.ts`: specialty note, confirm no changes, firma y doctor.
- `useHandoffManagementPersistence.ts`: reducido a composición de hooks auxiliares.
- Resultado de tamaño: `useHandoffManagementPersistence.ts` pasó de `422` a `35` líneas.

## Validación ejecutada

- `npm run typecheck`
- `npm exec vitest run src/tests/hooks/useHandoffManagement.test.ts src/tests/integration/handoff-signature.test.ts`
- Estado: validación verde

## Siguiente subfase candidata

1. Medir si el hook principal queda suficientemente pequeño tras esta iteración.
2. Si aún está denso, extraer tipos compartidos de handoff a un módulo interno estable.
