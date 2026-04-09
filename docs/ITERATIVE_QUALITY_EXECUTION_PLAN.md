# Iterative Quality Execution Plan

Última actualización: 2026-04-09

## Objetivo

Ejecutar de forma iterativa y trazable tres líneas de trabajo priorizadas:

1. volver a verde `npm run check:quality`;
2. redefinir el PIN local como barrera UX y no como control de seguridad fuerte;
3. consolidar entrypoints públicos por feature para bajar acoplamiento y sostener escalabilidad.

## Regla de ejecución

No se inicia una fase nueva hasta cerrar completamente la actual.

Una fase se considera cerrada solo si:

- se completó el alcance definido abajo;
- pasaron los checks de salida de la fase;
- se actualizó el tracker `docs/FOUNDATION_CONTINUATION_TRACKER.md`;
- se actualizó este plan con fecha y nota breve de resultado;
- se dejó commit dedicado con el mensaje sugerido o equivalente.

## Secuencia obligatoria

| Fase  | Estado     | Objetivo principal                                 |
| ----- | ---------- | -------------------------------------------------- |
| `Q00` | completado | dejar plan, tracker y deuda abiertos versionados   |
| `Q01` | completado | recuperar gobernanza y artefactos de calidad       |
| `Q02` | completado | restaurar ownership y boundaries de `census`       |
| `Q03` | completado | romper ciclos de `clinical-documents`              |
| `Q04` | completado | alinear `repo-hygiene` y `domain-hotspot-boundary` |
| `Q05` | completado | consolidar APIs públicas por feature               |
| `Q06` | pendiente  | rebajar el PIN local a barrera UX explícita        |
| `Q07` | pendiente  | corrida final de convergencia y cierre del ciclo   |

## Fase `Q00` - Planificación versionada

### Alcance

- Crear este plan.
- Abrir el ciclo activo en `docs/FOUNDATION_CONTINUATION_TRACKER.md`.
- Registrar la deuda correspondiente en `docs/TECHNICAL_DEBT_REGISTER.md`.

### Archivos

- `docs/ITERATIVE_QUALITY_EXECUTION_PLAN.md`
- `docs/FOUNDATION_CONTINUATION_TRACKER.md`
- `docs/TECHNICAL_DEBT_REGISTER.md`

### Commit sugerido

- `docs: open iterative quality execution cycle`

### Checks de salida

- revisión manual del plan y consistencia entre documentos

## Fase `Q01` - Gobernanza y artefactos de calidad

### Objetivo

Eliminar fallas de configuración, catálogo y artefactos faltantes que hoy impiden confiar en `check:quality`.

### Archivos objetivo

- `scripts/feature-dependency-matrix.json`
- `scripts/config/test-failure-catalog.json`
- `scripts/config/guardrail-governance.json`
- `scripts/check-operational-runbooks.mjs`
- `scripts/check-guardrail-governance.mjs`
- `scripts/report-guardrail-governance.mjs`
- `reports/quality-metrics.md`
- `reports/operational-health.md`
- `reports/system-confidence.md`
- `reports/serverless-sensitive-coverage.md`
- `reports/compatibility-import-governance.md`
- `reports/release-readiness-scorecard.md`
- `reports/release-confidence-matrix.md`
- `reports/serverless-runtime-governance.md`
- `reports/guardrail-governance.md`
- `reports/technical-ownership-map.md`
- `reports/sustainable-change-policy.md`
- `reports/operational-health.json`

### Trabajo esperado

- agregar `laboratory` a la matriz de features;
- corregir referencias obsoletas del catálogo de fallos;
- decidir explícitamente si los artefactos `reports/*` son requeridos en repo o generados por script;
- dejar los checks de gobernanza alineados con esa decisión;
- evitar “placeholders vacíos” si el proyecto ya tiene scripts reales para producir los reportes.

### Commit sugerido

- `chore: restore quality governance artifacts`

### Checks de salida

- `npm run check:feature-dependencies`
- `npm run check:test-failure-catalog`
- `npm run check:guardrail-governance`
- `npm run check:operational-runbooks`

## Fase `Q02` - Ownership y boundaries de `census`

### Objetivo

Cerrar la deuda actual entre `src/hooks/controllers` y `src/features/census/controllers` sin abrir una capa nueva innecesaria.

### Decisión de diseño

El owner canónico debe seguir siendo `src/features/census/controllers`. Los wrappers o shims en `src/hooks/controllers` solo pueden sobrevivir si quedan mínimos, temporales y sin violar boundaries.

### Archivos objetivo

- `src/hooks/controllers/bedManagerGridItemsController.ts`
- `src/hooks/controllers/bedManagerModalController.ts`
- `src/hooks/controllers/censusEmailRecipientsController.ts`
- `src/hooks/controllers/censusMovementDatePresentationController.ts`
- `src/hooks/controllers/clinicalShiftCalendarController.ts`
- `src/hooks/controllers/dischargeModalController.ts`
- `src/hooks/controllers/modalFormController.ts`
- `src/hooks/controllers/moveCopyModalController.ts`
- `src/hooks/controllers/patientMovementCreationController.ts`
- `src/hooks/controllers/patientMovementCreationErrorPresentation.ts`
- `src/hooks/controllers/patientMovementCreationInputController.ts`
- `src/hooks/controllers/patientMovementCreationSharedController.ts`
- `src/hooks/controllers/patientMovementDischargeMutationController.ts`
- `src/hooks/controllers/patientMovementMutationController.ts`
- `src/hooks/controllers/patientMovementRuntimeController.ts`
- `src/hooks/controllers/patientMovementSelectionController.ts`
- `src/hooks/controllers/patientMovementTransferMutationController.ts`
- `src/hooks/controllers/patientMovementUndoController.ts`
- `src/hooks/controllers/patientMovementUndoErrorPresentation.ts`
- `src/hooks/controllers/patientMovementUndoMutationController.ts`
- `src/hooks/controllers/sharedCensusBrowserRuntimeController.ts`
- `src/hooks/controllers/sharedCensusFilesController.ts`
- `src/hooks/controllers/sharedCensusModeController.ts`
- `src/hooks/controllers/timeInputController.ts`
- `src/hooks/controllers/transferModalController.ts`
- `src/features/census/public.ts`
- `src/features/census/index.ts`
- `src/components/layout/date-strip/DateStripQuickActions.tsx`

### Trabajo esperado

- mover imports consumidores a la API canónica del feature;
- reducir o retirar shims si ya no agregan valor;
- corregir el acceso directo a runtime browser reportado por `check:census-runtime-boundary`;
- mantener rollback simple y diffs chicos por lote si hace falta partir la fase en subcommits locales, pero publicar un único commit limpio al cerrar la fase.

### Commit sugerido

- `refactor: restore census controller ownership boundaries`

### Checks de salida

- `npm run check:census-feature-boundary`
- `npm run check:shared-layer-boundary`
- `npm run check:folder-dependencies`
- `npm run check:census-runtime-boundary`

## Fase `Q03` - Romper ciclos de `clinical-documents`

### Objetivo

Eliminar los ciclos reportados por `check:architecture` sin introducir facades cosméticas.

### Archivos objetivo

- `src/application/clinical-documents/clinicalDocumentEditorUseCases.ts`
- `src/application/clinical-documents/clinicalDocumentPdfExportUseCase.ts`
- `src/application/clinical-documents/clinicalDocumentTemplateUseCases.ts`
- `src/application/clinical-documents/clinicalDocumentUseCases.ts`
- `src/application/ports/clinicalDocumentPort.ts`
- `src/features/clinical-documents/index.ts`
- `src/features/clinical-documents/public.ts`
- `src/features/clinical-documents/components/ClinicalDocumentsModal.tsx`
- `src/features/clinical-documents/components/ClinicalDocumentsWorkspace.tsx`
- `src/features/clinical-documents/components/ClinicalDocumentsSidebar.tsx`
- `src/features/clinical-documents/hooks/useClinicalDocumentsWorkspaceModel.ts`
- `src/features/clinical-documents/hooks/useClinicalDocumentWorkspaceDraft.ts`
- `src/features/clinical-documents/hooks/useClinicalDocumentDraftAutosave.ts`
- `src/features/clinical-documents/hooks/useClinicalDocumentDraftRemoteSync.ts`
- `src/features/clinical-documents/hooks/useClinicalDocumentWorkspaceExportActions.ts`
- `src/features/clinical-documents/hooks/useClinicalDocumentWorkspaceBootstrap.ts`
- `src/features/clinical-documents/controllers/clinicalDocumentWorkspaceController.ts`
- `src/shared/clinical-documents/clinicalDocumentPresentation.ts`
- `src/application/patient-flow/patientAnalysisEngine.ts`
- `src/application/patient-flow/patientAnalysisSupport.ts`

### Trabajo esperado

- mover tipos, presentation helpers o contratos compartidos a un punto neutral;
- evitar que código interno del feature vuelva a entrar por `index.ts` o `public.ts`;
- mantener la API pública del feature solo para consumidores externos.

### Commit sugerido

- `refactor: break clinical documents dependency cycles`

### Checks de salida

- `npm run check:architecture`

## Fase `Q04` - Alineación de hygiene y domain hotspots

### Objetivo

Cerrar imports no canónicos hacia contratos raíz de `dailyRecord` y dejar la surface de dominio consistente con los guardrails.

### Archivos objetivo

- `src/application/shared/dailyRecordBedContracts.ts`
- `src/application/shared/dailyRecordCoreContracts.ts`
- `src/application/shared/dailyRecordMedicalContracts.ts`
- `src/application/shared/dailyRecordStaffContracts.ts`
- `src/features/handoff/components/HandoffCudyrPrintTable.tsx`
- `src/features/handoff/components/handoffCudyrPrintSupport.ts`
- `src/types/domain/dailyRecord.ts`
- `src/application/shared/dailyRecordContracts.ts`

### Trabajo esperado

- migrar imports hacia `@/application/shared/dailyRecordContracts` o facade aprobada;
- dejar `dailyRecord` concentrado en ports/facades y no en consumo directo desde hojas externas.

### Commit sugerido

- `refactor: align daily record imports with canonical contracts`

### Checks de salida

- `npm run check:repo-hygiene`
- `npm run check:domain-hotspot-boundary`

## Fase `Q05` - Consolidación de APIs públicas por feature

### Objetivo

Dejar entrypoints públicos mínimos y explícitos para `census`, `clinical-documents` y `laboratory`, reduciendo imports profundos desde capas compartidas.

### Archivos objetivo

- `src/features/census/public.ts`
- `src/features/census/index.ts`
- `src/features/clinical-documents/public.ts`
- `src/features/clinical-documents/index.ts`
- `src/features/laboratory/public.ts`
- `src/components/layout/date-strip/DateStripQuickActions.tsx`
- consumidores externos que hoy entren por rutas internas del feature

### Trabajo esperado

- revisar que cada `public.ts` exporte solo lo que realmente necesita el resto del repo;
- migrar consumidores a esos entrypoints;
- endurecer los checks existentes sin inventar nuevos si los actuales ya cubren el riesgo.

### Commit sugerido

- `refactor: consolidate feature public entrypoints`

### Checks de salida

- `npm run check:feature-dependencies`
- `npm run check:shared-layer-boundary`
- `npm run check:folder-dependencies`

## Fase `Q06` - PIN local como barrera UX

### Objetivo

Hacer explícito en código, UI y documentación que el PIN local solo protege privacidad casual del puesto y no actúa como control de seguridad fuerte.

### Archivos objetivo

- `src/context/SecurityContext.tsx`
- `src/components/modals/SecuritySettings.tsx`
- `src/components/security/PinLockScreen.tsx`
- `src/tests/context/SecurityContext.test.tsx`
- `src/tests/components/PinLockScreen.test.tsx`
- `docs/system-behaviors.md`
- `README.md`

### Trabajo esperado

- cambiar copy de UI para hablar de “bloqueo rápido local” o equivalente;
- dejar visible que no reemplaza logout, sesión ni permisos;
- evitar reutilización del PIN para decisiones sensibles;
- si se mantiene persistencia local, documentarla como decisión UX deliberada.

### Commit sugerido

- `docs: redefine local pin as privacy ux barrier`

### Checks de salida

- `npm run test:risk:auth`
- `npm run test:risk:admin-health`
- `vitest run src/tests/context/SecurityContext.test.tsx src/tests/components/PinLockScreen.test.tsx`

## Fase `Q07` - Convergencia y cierre

### Objetivo

Ejecutar la validación integral y dejar el ciclo documentado como cerrado.

### Archivos objetivo

- `docs/ITERATIVE_QUALITY_EXECUTION_PLAN.md`
- `docs/FOUNDATION_CONTINUATION_TRACKER.md`
- `docs/TECHNICAL_DEBT_REGISTER.md`

### Commit sugerido

- `docs: close iterative quality execution cycle`

### Checks de salida

- `npm run typecheck`
- `npm run check:quality`
- `npm run test:risk:auth`
- `npm run test:risk:admin-health`

## Registro de progreso

| Fecha      | Fase  | Estado     | Nota                                                                                                                                                                                                                          |
| ---------- | ----- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-04-09 | `Q00` | completado | Plan inicial versionado y ciclo abierto                                                                                                                                                                                       |
| 2026-04-09 | `Q01` | completado | Matriz de features, catálogo de fallos y artefactos `reports/*` alineados; checks de salida en verde                                                                                                                          |
| 2026-04-09 | `Q02` | completado | Shims gobernados de `hooks/controllers` aceptados por guardrail, runtime de `sharedCensus` migrado a adapter y queda 1 excepción explícita en `folder-dependency-allowlist` para tratar en `Q05`                              |
| 2026-04-09 | `Q03` | completado | Los casos de uso de `clinical-documents` dejaron de reingresar por la API pública del feature, `patient-flow` concentra el tipo `Conflict` en el engine y `check:architecture` + `typecheck` quedaron en verde                |
| 2026-04-09 | `Q04` | completado | `handoff` ya consume `DailyRecord` desde contratos canónicos de aplicación, `dailyRecordCoreContracts` quedó explicitado como facade permitida y `repo-hygiene` reconoce a los colaboradores internos de `clinical-documents` |
| 2026-04-09 | `Q05` | completado | `clinical-documents` expone un entrypoint interno explícito para `application/shared`, `laboratory` ya ofrece root barrel y la única excepción residual de `DateStripQuickActions` quedó acotada al root del feature          |
| 2026-04-09 | `Q06` | pendiente  | Sin iniciar                                                                                                                                                                                                                   |
| 2026-04-09 | `Q07` | pendiente  | Sin iniciar                                                                                                                                                                                                                   |
