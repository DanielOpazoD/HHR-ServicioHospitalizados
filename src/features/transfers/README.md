# `src/features/transfers`

## Propósito

Módulo de gestión de traslados clínicos. Cubre el ciclo completo de la solicitud:

- creación y edición
- cambio de estado
- cancelación y traslado efectivo
- segmentación entre casos activos y finalizados
- preparación y visualización de documentos por hospital

## Flujo funcional

### Estados activos

- `REQUESTED`
- `RECEIVED`
- `ACCEPTED`

Estos casos aparecen en la tabla principal y siguen abiertos a edición operativa.

### Estados finalizados

- `TRANSFERRED`
- `REJECTED`
- `CANCELLED`
- `NO_RESPONSE`

Estos casos aparecen en la sección colapsable de finalizados para el mes seleccionado.

## Estructura interna

```text
transfers/
├── components/
│   ├── TransferManagementView.tsx
│   └── components/
│       ├── TransferTable.tsx
│       ├── TransferTableRow.tsx
│       ├── TransferTableRowActions.tsx
│       └── TransferDocumentPackageModal.tsx
├── controllers/
│   └── transferStatusInteractionController.ts
├── hooks/
│   └── useTransferSubscriptions.ts
├── services/
│   └── destinationHospitalCatalogService.ts
└── utils/
    └── localDate.ts
```

La persistencia y sincronización operativa de traslados vive en:

- [transferService.ts](/Users/danielopazodamiani/Desktop/HHR%20Tracker%20Marzo%202026/src/services/transfers/transferService.ts)
- [transferQueriesService.ts](/Users/danielopazodamiani/Desktop/HHR%20Tracker%20Marzo%202026/src/services/transfers/transferQueriesService.ts)
- [transferMutationsService.ts](/Users/danielopazodamiani/Desktop/HHR%20Tracker%20Marzo%202026/src/services/transfers/transferMutationsService.ts)
- [transferSubscriptionsService.ts](/Users/danielopazodamiani/Desktop/HHR%20Tracker%20Marzo%202026/src/services/transfers/transferSubscriptionsService.ts)
- [transferStatusController.ts](/Users/danielopazodamiani/Desktop/HHR%20Tracker%20Marzo%202026/src/services/transfers/transferStatusController.ts)

`transferService.ts` debe mantenerse como fachada pública. La lógica nueva debe entrar en estas capas internas, no volver a crecer dentro de la fachada.

## Responsabilidades clave

### `TransferManagementView.tsx`

- filtra por año/mes
- separa activos vs finalizados
- conecta hooks de dominio y hooks de UI

### `TransferTable.tsx`

- layout tabular
- confirmación de borrado
- menú de cierre por fila

La policy de estados y acciones no vive aquí; se centraliza en:

- [transferTableController.ts](/Users/danielopazodamiani/Desktop/HHR%20Tracker%20Marzo%202026/src/features/transfers/components/controllers/transferTableController.ts)

### `useTransferViewStates.ts`

Hook orquestador de UX para:

- modales del flujo
- selección de traslado activo
- apertura de cuestionario
- apertura del paquete documental

La preparación/caché de documentos se apoya en:

- [transferDocumentPackageController.ts](/Users/danielopazodamiani/Desktop/HHR%20Tracker%20Marzo%202026/src/hooks/controllers/transferDocumentPackageController.ts)

### `useTransferSubscriptions.ts`

- encapsula suscripción realtime
- separa `transfers`, `isLoading` y `error`
- evita que `useTransferManagement` tenga que manejar directamente snapshots de Firestore

## Documentos y hospitales

Hoy el soporte documental real está habilitado para:

- Hospital del Salvador

Si un hospital no tiene configuración documental:

- `Preparar docs` y `Ver docs` se deshabilitan
- la tabla muestra el hospital, pero no permite flujo documental

## Regla de visualización

- la tabla principal no debe usar scroll lateral
- los modales deben evitar scroll interno cuando el contenido cabe
- los textos largos se parten en múltiples líneas en vez de forzar una sola línea

## Reglas de mantenimiento

1. La separación de estados activos/finalizados debe seguir usando la policy compartida del controller.
2. El estado de ciclo de vida de traslados debe seguir saliendo de [transferStatusController.ts](/Users/danielopazodamiani/Desktop/HHR%20Tracker%20Marzo%202026/src/services/transfers/transferStatusController.ts), no de listas duplicadas en hooks o componentes.
3. `transferService.ts` no debe volver a mezclar queries, mutaciones, normalización y suscripción en un solo archivo.
4. La suscripción realtime debe exponer error legible al consumidor, aunque el UI decida no mostrarlo.
5. Los cambios en documentos de traslado deben mantener el comportamiento:
   - `Preparar docs` persiste respuestas
   - `Ver docs` reutiliza el paquete ya generado dentro de la sesión si la firma no cambió
6. La fecha de solicitud debe manejarse con fecha local, no UTC.
7. Si se agregan nuevos hospitales con plantillas, actualizar la configuración documental y los tests del flujo.
8. La capacidad para preparar o abrir documentos debe salir de policies compartidas
   (`operationalAccessPolicy`) y no de checks inline por componente o fila.
9. Las fechas visibles de estados/modales/documentos deben reutilizar presentation helpers
   compartidos; no deben reaparecer variantes locales de `toLocaleDateString()`.

## Tests relevantes

- [TransferManagementView.test.tsx](/Users/danielopazodamiani/Desktop/HHR%20Tracker%20Marzo%202026/src/tests/features/transfers/TransferManagementView.test.tsx)
- [transferManagementViewController.test.ts](/Users/danielopazodamiani/Desktop/HHR%20Tracker%20Marzo%202026/src/tests/features/transfers/transferManagementViewController.test.ts)
- [useTransferSubscriptions.test.ts](/Users/danielopazodamiani/Desktop/HHR%20Tracker%20Marzo%202026/src/tests/features/transfers/useTransferSubscriptions.test.ts)
- [TransferFormModal.test.tsx](/Users/danielopazodamiani/Desktop/HHR%20Tracker%20Marzo%202026/src/tests/features/transfers/TransferFormModal.test.tsx)
- [transferTableController.test.ts](/Users/danielopazodamiani/Desktop/HHR%20Tracker%20Marzo%202026/src/tests/features/transfers/transferTableController.test.ts)
- [transferStatusController.test.ts](/Users/danielopazodamiani/Desktop/HHR%20Tracker%20Marzo%202026/src/tests/services/transfers/transferStatusController.test.ts)
- [transferSubscriptionController.test.ts](/Users/danielopazodamiani/Desktop/HHR%20Tracker%20Marzo%202026/src/tests/services/transfers/transferSubscriptionController.test.ts)
- [useTransferViewStates.test.ts](/Users/danielopazodamiani/Desktop/HHR%20Tracker%20Marzo%202026/src/tests/hooks/useTransferViewStates.test.ts)
- [transferDocumentPackageController.test.ts](/Users/danielopazodamiani/Desktop/HHR%20Tracker%20Marzo%202026/src/tests/hooks/controllers/transferDocumentPackageController.test.ts)

## Runtime boundaries

- `transferService.ts` sigue siendo la fachada pública; lógica nueva entra en queries, mutations, status o subscriptions.
- La vista de management no debe volver a mezclar filtros de período, lifecycle y wiring de modales en un solo componente.
- Las fallas realtime deben mapearse a error operativo estructurado + telemetría, no solo a `console.error`.
- Los generadores DOCX y templates deben reutilizar helpers compartidos de fecha; no deben volver a
  introducir variantes locales de `toLocaleDateString()` por documento o template.
- Los estados degradados del flujo documental o de upload deben mapearse a notices explícitos
  (`info`/`warning`/`error`) y no a mensajes armados inline dentro de modales o hooks de vista.

## Comandos de validación del módulo

- `npm run typecheck`
- `npm run check:quality`
- `npx vitest run src/tests/features/transfers src/tests/services/transfers`

## Safe change links

- [docs/QUALITY_GUARDRAILS.md](/Users/danielopazodamiani/Desktop/HHR%20Tracker%20Marzo%202026/docs/QUALITY_GUARDRAILS.md)
- [docs/SAFE_CHANGE_CHECKLIST.md](/Users/danielopazodamiani/Desktop/HHR%20Tracker%20Marzo%202026/docs/SAFE_CHANGE_CHECKLIST.md)
