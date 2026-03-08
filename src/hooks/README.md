# `src/hooks`

## Propósito

Lógica de aplicación reusable y composición de casos de uso. Es el puente entre UI (`components/features`) y servicios/context.

Cuando una operación necesita coordinar repositorios, clasificar outcomes remotos o reutilizar semántica clínica cross-feature, la implementación preferida ya no es el hook directo sino `src/application/*`, dejando al hook como adaptador de UI.

## Estructura

| Path                         | Rol                                                   |
| ---------------------------- | ----------------------------------------------------- |
| `useDailyRecord.ts`          | Hook orquestador principal de censo diario            |
| `useDailyRecordQuery.ts`     | Query/mutation con React Query para registros diarios |
| `useDailyRecordSyncQuery.ts` | Sincronización, estado sync y compatibilidad de API   |
| `usePatientDischarges.ts`    | Operaciones de altas                                  |
| `usePatientTransfers.ts`     | Operaciones de traslados                              |
| `useBedManagement.ts`        | Operaciones de camas/paciente                         |
| `useHandoff*`                | Familia de hooks de entrega de turno                  |
| `useCensusEmail*`            | Preparación/envío de email de censo                   |
| `useBackup*`                 | Navegación, listing y acciones de respaldos           |
| `controllers/`               | Lógica pura usada por hooks (sin React UI)            |
| `admin/`                     | Hooks auxiliares del módulo admin                     |
| `whatsapp/`                  | Hooks de integración WhatsApp                         |

## Hooks clave (alta prioridad)

| Hook                         | Responsabilidad                                    |
| ---------------------------- | -------------------------------------------------- |
| `useDailyRecord.ts`          | API consolidada de acciones/estado del censo       |
| `useDailyRecordQuery.ts`     | Lectura/suscripción/cache y optimistic updates     |
| `useMovements.ts`            | Wrapper de compatibilidad para altas/traslados     |
| `useTransferViewStates.ts`   | Estado de UX del flujo de traslados en vista censo |
| `useHandoffCommunication.ts` | Comunicación y envío de handoff                    |

## Patrones usados

- **Orchestrator Hook**: hooks agregadores que exponen API estable.
- **Application-backed hooks**: hooks que delegan casos críticos a `src/application/*` para no mezclar UI y coordinación de infraestructura.
- **Ports-backed use cases**: cuando un use-case requiere acceso remoto, la dependencia preferida es `src/application/ports/*`, no servicios concretos desde el hook.
- **Command Hooks**: ejecutan comandos tipados y notifican errores.
- **Controller-backed hooks**: validación/transformación extraída a `controllers`.
- `useDailyRecordQuery.ts` ahora delega construcción de query/subscription/prefetch a [controllers/dailyRecordQueryController.ts](/Users/danielopazodamiani/Desktop/HHR%20Tracker%20Marzo%202026/src/hooks/controllers/dailyRecordQueryController.ts) para concentrar decisiones de cache en un único punto.
- `useDailyRecordSyncQuery.ts` delega resolución de estado y bootstrap de creación de día a [controllers/dailyRecordSyncController.ts](/Users/danielopazodamiani/Desktop/HHR%20Tracker%20Marzo%202026/src/hooks/controllers/dailyRecordSyncController.ts).
- `useDailyRecord.ts` ahora usa [useDailyRecordDomainModules.ts](/Users/danielopazodamiani/Desktop/HHR%20Tracker%20Marzo%202026/src/hooks/useDailyRecordDomainModules.ts) y [useDailyRecordCopyActions.ts](/Users/danielopazodamiani/Desktop/HHR%20Tracker%20Marzo%202026/src/hooks/useDailyRecordCopyActions.ts) para bajar carga cognitiva del hook raíz sin cambiar su API.
- `useCensusEmail.ts` usa [useCensusEmailRecipientLists.ts](/Users/danielopazodamiani/Desktop/HHR%20Tracker%20Marzo%202026/src/hooks/useCensusEmailRecipientLists.ts) y casos de uso en `src/application/census-email/*` para separar bootstrap/sync/CRUD de listas del estado UI del envío.
- `useAudit.ts` delega escritura/lectura remota a `src/application/audit/*` y mantiene en el hook solo la fachada de UI + debounce.
- `useBedManagement.ts` ahora centraliza validación/auditoría/reducer a [controllers/bedManagementDispatchController.ts](/Users/danielopazodamiani/Desktop/HHR%20Tracker%20Marzo%202026/src/hooks/controllers/bedManagementDispatchController.ts), reduciendo lógica inline de dispatch.
- `useExportManager.ts` y el browser de respaldos consumen ahora casos de uso separados por bounded context en `src/application/backup-export/*`, manteniendo el barrel `backupExportUseCases.ts` como API estable del módulo.
- La telemetría operativa del core puede reenviarse a un endpoint externo configurable por `VITE_OPERATIONAL_TELEMETRY_ENDPOINT`; los hooks emiten eventos estructurados y no conocen vendors concretos.
- Los hooks del core operativo consumen un `errorService` de fachada; la clasificación, retry y fan-out a sinks quedan fuera del hook para evitar mezclar policy con side effects.
- **LatestRef pattern**: evita stale closures en callbacks largos.
- `useTransferViewStates.ts` ahora delega preparación/caché documental a [controllers/transferDocumentPackageController.ts](/Users/danielopazodamiani/Desktop/HHR%20Tracker%20Marzo%202026/src/hooks/controllers/transferDocumentPackageController.ts) para mantener el hook enfocado en estado de modales y selección.

## Taxonomía rápida

- `facade`: API pública estable del subdominio.
- `state`: estado local o draft.
- `bootstrap`: carga/selección inicial.
- `delivery`: envío/export/comunicación remota.
- `persistence`: save/patch/delete.
- `query`: lectura reactiva y caché.
- `compat`: bridge temporal o adapter técnico.

Referencia detallada: [docs/hooks-reference.md](/Users/danielopazodamiani/Desktop/HHR%20Tracker%20Marzo%202026/docs/hooks-reference.md)

## Ejemplo

```ts
const dailyRecord = useDailyRecord(currentDate, isOfflineMode, isFirebaseConnected);

dailyRecord.updatePatient('R1', 'patientName', 'Paciente Demo');
```

## Reglas de mantenimiento

1. Hooks no deben importar implementación de componentes.
2. Lógica de validación compleja va a controllers puros.
3. Si ya existe use-case o port equivalente, el hook no debe importar directo `auditService`, `DailyRecordRepository`, `ClinicalDocumentRepository` ni `censusEmailService`.
4. Los tests de hooks deben mockear use-cases, ports o adapters antes que servicios concretos.
5. Mantener API estable y documentar breaking changes en este README.
6. Evitar `ReturnType<typeof hook>` para contratos semánticos del core cuando ya exista `*Contracts.ts` o `*Types.ts`.

## Guardrails activos

- `npm run check:application-port-boundary`
- `npm run check:runtime-adapter-boundary`
- `npm run check:hook-hotspots`
