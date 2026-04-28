# Firestore Rules Critical Access Matrix

## Objetivo

Mantener visible la politica efectiva de permisos en rutas clinicas criticas y evitar cambios silenciosos en `firestore.rules`.

Este documento no reemplaza los tests de emulador. Funciona como mapa ejecutivo y como respaldo humano del guardrail:

- `scripts/check-firestore-rules-critical-access-matrix.mjs`
- `scripts/firestoreRulesCriticalAccessMatrixSupport.mjs`
- `src/tests/build/firestoreRulesCriticalAccessMatrixSupport.test.ts`

## Matriz vigente

| Ruta critica                                            | Read                                | Create                                     | Update                               | Delete                               |
| ------------------------------------------------------- | ----------------------------------- | ------------------------------------------ | ------------------------------------ | ------------------------------------ |
| `hospitals/{hospitalId}/dailyRecords/{date}`            | `canReadClinicalData()`             | `canEdit()`                                | `canUpdatePersistedDailyRecord()`    | `isAdmin()`                          |
| `hospitals/{hospitalId}/clinicalDocuments/{documentId}` | `canReadClinicalData()`             | `canWriteClinicalDocument()`               | `canWriteClinicalDocument()`         | `canDeleteClinicalDocument()`        |
| `hospitals/{hospitalId}/auditLogs/{logId}`              | `canReadAppendOnlyOperationalLog()` | `canCreateAppendOnlyOperationalLogEntry()` | `false`                              | `false`                              |
| `hospitals/{hospitalId}/transferRequests/{transferId}`  | `canReadClinicalData()`             | `canEdit()`                                | `canEdit()`                          | `isAdmin()`                          |
| `hospitals/{hospitalId}/backupFiles/{fileId}`           | `canReadClinicalData()`             | `canCreateEditableHospitalDocument()`      | `canAdminMaintainHospitalDocument()` | `canAdminMaintainHospitalDocument()` |
| `hospitals/{hospitalId}/patients/{rut}`                 | `canReadClinicalData()`             | `canEdit()`                                | `canEdit()`                          | `canEdit()`                          |
| `hospitals/{hospitalId}/reminders/{reminderId}`         | `canReadClinicalData()`             | `isAdmin()`                                | `isAdmin()`                          | `isAdmin()`                          |
| `stats/system_health/users/{userId}`                    | `canReportSystemHealth()`           | `isValidSystemHealthWrite(userId)`         | `isValidSystemHealthWrite(userId)`   | `false`                              |
| `config/roles`                                          | `isAdmin()`                         | `isAdmin()`                                | `isAdmin()`                          | `isAdmin()`                          |

## Regla operacional

Cualquier cambio en una condicion de esta matriz debe ser deliberado y venir con:

- cambio correspondiente en el guardrail;
- test focalizado o emulator test cuando afecte lectura/escritura real;
- actualizacion de este documento si cambia la politica esperada.

Cambios cosmeticos en `firestore.rules` no deben modificar esta matriz.
