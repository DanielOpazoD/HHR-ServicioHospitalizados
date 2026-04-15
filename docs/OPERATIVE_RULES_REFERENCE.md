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
- La clasificación microbiológica debe resolverse en un controller propio, separado de comparación y tendencias, para evitar mezclar panel viral con cultivo al crecer el análisis.

Referencias:

- `src/features/laboratory/controllers/labAnalyticsController.ts`
- `src/features/laboratory/controllers/labMicrobiologyAnalyticsController.ts`
- `src/features/laboratory/services/labMicrobiologyPdfService.ts`
- `src/features/laboratory/hooks/useLabViewer.ts`

## MMRAD

- El copiado estructurado debe entregar `tipo de estudio + fecha`, seguido por `Hallazgos` e `Impresión`.
- Documentos clínicos usa un acceso rápido de rayo para los TAC recientes con el mismo formato de copiado.

Referencias:

- `src/services/radiology/mmradReportSupport.ts`
- `src/components/modals/RadiologyViewerModal.tsx`
- `src/features/clinical-documents/components/ClinicalDocumentMMRADCopyDialog.tsx`

## DailyRecord write path

- El write path de `dailyRecord` debe mantener separadas las decisiones puras de recovery (`changed paths`, `retry origin`, `conflict summary`) del flujo de persistencia real.
- El sync en background hacia `PatientMaster` debe reutilizar builders pequeños para seeds, eventos, patches y payloads de append, en lugar de recomponer esos datos inline por cada rama.

## Reducer de camas

- `useBedManagementReducer` debe seguir siendo un patch reducer: builders puros para mutaciones repetidas y un switch orquestador corto, en vez de recomponer patches inline por cada acción.
- Las reglas sensibles como `firstSeenDate`, limpieza clínica al cambiar identidad, UPC y toggles de bloque/cama extra/tipo deben quedar protegidas con tests directos del reducer.

## Listas globales de correo del censo

- El hook `useCensusEmailRecipientLists` debe quedar como orquestador: bootstrap, selección activa, mutaciones y fallbacks deben resolverse en controllers puros o casos de uso.
- Los casos de uso de listas de correo deben traducir validación, fallos de servicio y errores desconocidos con helpers compartidos de outcome, para no duplicar `createApplicationFailed(...)`.

Referencias:

- `src/services/repositories/dailyRecordWriteSupport.ts`
- `src/services/repositories/dailyRecordWriteRecoveryController.ts`
- `src/services/repositories/dailyRecordMasterSyncController.ts`
- `src/application/census-email/censusRecipientListUseCases.ts`
- `src/application/census-email/censusRecipientListOutcomeController.ts`

## Scorecard de deuda viva

Para regenerar un snapshot mínimo de hotspots, estabilidad de tests, crecimiento de `firestore.rules` y churn reciente:

```bash
npm run report:maintenance-debt-scorecard
```
