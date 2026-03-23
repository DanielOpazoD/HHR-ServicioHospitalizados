# Documentos Clínicos

## Arquitectura

- `components/`: shell visual del workspace, hoja clínica y renderers especializados por sección.
- `hooks/`: bootstrap remoto, draft/autosave, exportación y estado UI efímero de la hoja.
- `controllers/`: reglas puras de compatibilidad, validación, secciones, rich text y permisos.
- `domain/`: entidades, templates, definiciones por tipo documental y versión de esquema.
- `services/`: impresión, exportación PDF y sincronización con infraestructura.
- `contracts/`: validación runtime de documentos y templates.

## Flujo principal

1. `useClinicalDocumentWorkspaceBootstrap` carga templates y subscribe documentos por episodio.
2. `useClinicalDocumentWorkspaceDraft` hidrata documentos legacy al esquema actual, mantiene draft local y resuelve conflictos remotos.
3. `ClinicalDocumentSheet` compone subcomponentes puros y usa `useClinicalDocumentSheetState` para estado UI no persistente.
4. `useClinicalDocumentWorkspaceDocumentActions` guarda, firma y desfirma.
5. `useClinicalDocumentWorkspaceExportActions` imprime y exporta PDF.
6. Repositorio y templates validan contratos runtime antes de devolver o persistir datos.

## Draft, autosave y compatibilidad

- Todo documento nuevo se crea con `schemaVersion` actual.
- Documentos antiguos se hidratan por `hydrateLegacyClinicalDocument`.
- Todo documento/template leído o persistido pasa por contratos runtime.
- El reducer del draft separa:
  - edición local
  - base persistida
  - actualización remota pendiente
  - estado de autosave
- `lastPersistedSnapshotRef` sigue siendo el punto de comparación para detectar cambios locales.
- La resolución de carga remota y la persistencia del editor pasan por use cases de aplicación.

## Tipos documentales y secciones especiales

- `domain/definitions.ts` define el comportamiento por `documentType`.
- Cada definición puede declarar:
  - `sectionRenderers`
  - `sectionNormalizers`
  - `sectionValidators`
  - `printOptions`
- Las secciones especiales no deben agregarse con `if` en la hoja; deben registrarse en la definición del documento.
- La integridad del registry debe validarse con tests dedicados.

## Impresión y exportación

- `clinicalDocumentPrintDomSanitizer`: limpia la hoja para impresión.
- `clinicalDocumentPrintHtmlBuilder`: construye el HTML imprimible.
- `clinicalDocumentBrowserPrintService`: abre impresión desde la misma página.
- `clinicalDocumentPdfRenderService`: intenta backend render y luego fallback snapshot.
- `clinicalDocumentDriveService`: debe exponer variantes con resultado tipado para uploads/listados
  en Drive; la UI no debe interpretar errores remotos parseando excepciones inline.
- Los resultados esperados de exportación/impresión deben resolverse con outcomes tipados y
  notices compartidos; errores recuperables de Drive no deben volver a salir como excepciones
  “normales” dentro del workspace.
- `useClinicalDocumentWorkspaceDocumentActions` debe tratar outcomes fallidos como estado esperado:
  crear, eliminar, firmar y desfimar no deben depender de `throw` para informar bloqueos o
  degradaciones recuperables al usuario.

## Invariantes

- `sections` siempre se ordenan por `order`.
- `status === signed` implica `isLocked === true` al persistir.
- `footerMedicoLabel`, `footerEspecialidadLabel` y `patientInfoTitle` nunca deben quedar vacíos tras hidratar/persistir.
- Nuevas migraciones deben pasar por el controlador de compatibilidad, no por parches ad hoc en componentes.

## Checks del feature

- `npm run test:clinical-documents`
- `npm run check:clinical-documents`
- Nota de arquitectura en [ARCHITECTURE.md](/Users/danielopazodamiani/Desktop/HHR%20Tracker%20Marzo%202026/src/features/clinical-documents/ARCHITECTURE.md)

## Runtime boundaries

- El consumo externo a la feature debe entrar por `index.ts` o `public.ts`. `public.ts` es la
  superficie permitida para `application` y `shared` cuando necesitan tipos, helpers del
  workspace o servicios documentales sin entrar por internals.
- La hoja principal no debe recuperar `if` especiales por `documentType`; la extensibilidad entra por definiciones/section renderers.
- Todo documento/template leído o persistido debe pasar por contratos runtime antes de salir del repositorio.
- La impresión/exportación debe reportar fallos por telemetría operativa y no depender de logs sueltos.
- Los errores de Drive recuperables deben salir con `userSafeMessage` y degradar a feedback visible,
  no romper el workspace por excepciones sin clasificar.
- Fechas visibles del workspace, sidebar y nombres de PDF deben reutilizar presentation helpers
  compartidos; no deben reaparecer variantes locales de fecha u origen documental en controllers.
- La fecha visible del nombre de PDF debe salir del helper compartido del feature; no se debe
  volver a formatear inline según origen (`finf`, `sourceDailyRecordDate`, `audit.updatedAt`).
- `scripts/check-clinical-documents-feature-boundary.mjs` bloquea imports profundos nuevos desde
  fuera de la feature para que `application` y `shared` dependan solo de entrypoints públicos.

## Test entrypoints recomendados

- `npm run test:clinical-documents`
- `npx vitest run src/tests/features/clinical-documents src/tests/services/repositories/ClinicalDocumentRepository.test.ts`

## Safe change links

- [docs/QUALITY_GUARDRAILS.md](/Users/danielopazodamiani/Desktop/HHR%20Tracker%20Marzo%202026/docs/QUALITY_GUARDRAILS.md)
- [docs/SAFE_CHANGE_CHECKLIST.md](/Users/danielopazodamiani/Desktop/HHR%20Tracker%20Marzo%202026/docs/SAFE_CHANGE_CHECKLIST.md)
