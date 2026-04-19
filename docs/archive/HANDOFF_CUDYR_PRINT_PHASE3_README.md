# Fase 3: Refactor mecánico de `HandoffCudyrPrint`

## Objetivo

Reducir complejidad mecánica en `src/features/handoff/components/HandoffCudyrPrint.tsx`
sin cambiar el contrato del componente ni la salida de impresión.

## Alcance

- Extraer helpers/columnas de soporte.
- Extraer header de impresión.
- Extraer tabla CUDYR a un subcomponente local.
- Mantener `HandoffCudyrPrint.tsx` como entrypoint estable.

## Iteración 1

### Decisión

Se eligió este componente antes que el runtime orbital del censo porque tiene
un corte de presentación mucho más seguro y ya cuenta con cobertura de integración.

### Cambios aplicados

- `handoffCudyrPrintSupport.ts`: columnas, métricas, camas visibles y helpers.
- `HandoffCudyrPrintHeader.tsx`: bloque superior de impresión.
- `HandoffCudyrPrintTable.tsx`: tabla y filas CUDYR.
- `HandoffCudyrPrint.tsx`: reducido a wiring de datos y composición.
- Resultado de tamaño: `HandoffCudyrPrint.tsx` pasó de `386` a `37` líneas.

## Validación ejecutada

- `npm run typecheck`
- `npm exec vitest run src/tests/integration/cudyrTimestampFlow.test.tsx`
- Estado: validación verde

## Siguiente subfase candidata

1. Medir si `HandoffCudyrPrint.tsx` ya quedó en tamaño razonable.
2. Si Fase 3 sigue, evaluar `usePatientRowOrbitalLauncherRuntime.ts` con un corte de riesgo bajo.
