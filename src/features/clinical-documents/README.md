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

## Invariantes

- `sections` siempre se ordenan por `order`.
- `status === signed` implica `isLocked === true` al persistir.
- `footerMedicoLabel`, `footerEspecialidadLabel` y `patientInfoTitle` nunca deben quedar vacíos tras hidratar/persistir.
- Nuevas migraciones deben pasar por el controlador de compatibilidad, no por parches ad hoc en componentes.

## Checks del feature

- `npm run test:clinical-documents`
- `npm run check:clinical-documents`
- Nota de arquitectura en [ARCHITECTURE.md](/Users/danielopazodamiani/Desktop/HHR%20Tracker%20Marzo%202026/src/features/clinical-documents/ARCHITECTURE.md)
