# Operative Rules Reference

Guía corta para reglas operativas no obvias que hoy conviene conocer antes de tocar `census`, `handoff`, `CUDYR`, `laboratorio` o la búsqueda global de pacientes.

## Censo y turnos nocturnos

- El badge amarillo de `ingreso` debe pertenecer a un solo turno.
- Un ingreso ocurrido en la madrugada de `X + 1` puede seguir perteneciendo al turno noche de `X`.
- La búsqueda global de paciente (`Ir a censo`) debe abrir el último día en que el episodio estuvo hospitalizado, no la fecha de ingreso.

Referencias:

- `src/application/patient-flow/clinicalEpisode.ts`
- `src/utils/clinicalDayUtils.ts`
- `src/features/census/components/global-search/episodeGroupingController.ts`

## CUDYR nocturno

- El corte nocturno fijo es `01:00` del día siguiente al `record.date`.
- Solo son elegibles pacientes con al menos `8` horas de hospitalización a ese corte.
- Los casos bloqueados siguen visibles, pero no deben sumar cálculo, resumen ni exportación.
- Los perfiles no admin solo editan `X` y `X - 1`; `X - 2` o más antiguo queda en solo lectura.

Referencias:

- `src/features/cudyr/controllers/cudyrEligibilityController.ts`
- `src/features/cudyr/controllers/cudyrEditAccessController.ts`
- `src/services/cudyr/cudyrSummary.ts`
- `src/services/exporters/reportWorkbookBuilders.ts`

## Laboratorio microbiológico

- `Microbiología` se presenta como pestaña separada del visor.
- `Clostridium difficile`, `Coprocultivo`, `Cultivo corriente / Antibiograma`, `PCR panel respiratorio` y `Sedimento/Urocultivo` son exámenes distintos.
- Si Syslab no entrega el detalle microbiológico completo en `details`, el visor debe completar la tarjeta desde el PDF original antes de degradar a “resultado disponible en PDF”.

Referencias:

- `src/features/laboratory/controllers/labAnalyticsController.ts`
- `src/features/laboratory/services/labMicrobiologyPdfService.ts`
- `src/features/laboratory/hooks/useLabViewer.ts`

## MMRAD

- El copiado estructurado debe entregar `tipo de estudio + fecha`, seguido por `Hallazgos` e `Impresión`.
- Documentos clínicos usa un acceso rápido de rayo para los TAC recientes con el mismo formato de copiado.

Referencias:

- `src/services/radiology/mmradReportSupport.ts`
- `src/components/modals/RadiologyViewerModal.tsx`
- `src/features/clinical-documents/components/ClinicalDocumentMMRADCopyDialog.tsx`

## Scorecard de deuda viva

Para regenerar un snapshot mínimo de hotspots, estabilidad de tests, crecimiento de `firestore.rules` y churn reciente:

```bash
npm run report:maintenance-debt-scorecard
```
