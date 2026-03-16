# `src/types`

## Propósito

Contratos TypeScript de dominio, entidades, payloads y value objects.

## Mapa de archivos

| Archivo                 | Propósito                                                    |
| ----------------------- | ------------------------------------------------------------ |
| `core.ts`               | Fachada deprecated de compatibilidad hacia `types/domain/*`  |
| `domain/base.ts`        | Bed, specialty, status, shift y catálogo profesional         |
| `domain/clinical.ts`    | Clinical events, FHIR, CUDYR, dispositivos y patient master  |
| `domain/patient.ts`     | `PatientData` y contratos de handoff médico por paciente     |
| `domain/movements.ts`   | Altas, traslados, CMA e IEEH                                 |
| `domain/dailyRecord.ts` | `DailyRecord`, patching y contratos médicos por especialidad |
| `audit.ts`              | Tipos de auditoría                                           |
| `auth.ts`               | Tipos de autenticación/rol                                   |
| `backup.ts`             | Tipos de backup y restauración                               |
| `bookmarks.ts`          | Tipos de marcadores                                          |
| `censusAccess.ts`       | Tipos de acceso compartido al censo                          |
| `minsalTypes.ts`        | Tipos de analítica MINSAL/DEIS                               |
| `printTemplates.ts`     | Tipos de templates de impresión                              |
| `transferDocuments.ts`  | Tipos de documentos de traslado                              |
| `transfers.ts`          | Tipos de flujo de traslados                                  |
| `valueTypes.ts`         | Tipos de valores auxiliares                                  |
| `whatsapp.ts`           | Tipos de integración WhatsApp                                |
| `global.d.ts`           | Extensiones globales de tipos                                |
| `index.ts`              | Barrel export de tipos                                       |

## Convención

- Evitar `any`; expresar contratos explícitos.
- Importar desde el owner real del contrato, no desde `core.ts`.
- `core.ts` existe solo como bridge temporal y no debe recibir imports productivos nuevos.
