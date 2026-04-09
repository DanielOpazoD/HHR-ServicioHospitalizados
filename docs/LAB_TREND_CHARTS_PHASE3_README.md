# Fase 3: Refactor mecánico de `LabViewerTrendCharts`

## Objetivo

Reducir complejidad mecánica en `src/features/laboratory/components/LabViewerTrendCharts.tsx`
sin cambiar comportamiento funcional ni tocar lógica clínica sensible.

## Alcance

- Extraer helpers puros de agrupación y ordenamiento.
- Extraer renderers/subcomponentes internos del chart.
- Extraer utilidad de exportación PNG.
- Mantener `LabViewerTrendCharts.tsx` como entrypoint estable.

## Iteración 1

### Decisión

Se eligió `LabViewerTrendCharts` antes que `useHandoffManagementPersistence` porque el
componente de laboratorio es un hotspot grande de UI y el refactor es mayormente mecánico,
con menos riesgo operacional que el hook de handoff médico.

### Cambios aplicados

- `LabTrendChartHelpers.ts`: agrupación por escala y ordenamiento de fechas.
- `LabTrendChartRenderers.tsx`: tooltip, labels y `UnitSubChart`.
- `LabTrendGroupCard.tsx`: composición por grupo clínico.
- `labTrendChartExport.ts`: exportación PNG separada del componente principal.
- `LabViewerTrendCharts.tsx`: reducido a wiring de estado, empty state y render principal.
- Resultado de tamaño: `LabViewerTrendCharts.tsx` pasó de `439` a `60` líneas.

### Validación ejecutada

- `npm run typecheck`
- `npm exec vitest run src/tests/components/laboratory/LabResultsViewerModal.test.tsx`
- Estado: validación verde

## Siguiente subfase candidata

Se recomienda continuar Fase 3 en:

1. `useHandoffManagementPersistence.ts` para extraer mutaciones por dominio.
2. Una segunda pasada pequeña sobre laboratorio para consolidar naming/README del submódulo.
