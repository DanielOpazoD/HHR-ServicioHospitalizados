# Specialist Medical Handoff Write Path

## Objetivo

Documentar el flujo productivo que permite a `doctor_specialist` editar la entrega de turno
medico por paciente/cama sin depender de un write directo a Firestore Rules.

Este documento existe para evitar regresiones en un punto que ya fallo en produccion/localhost:

- la UI permitia escribir;
- el write directo a Firestore era rechazado con `permission-denied`;
- el payload visible era correcto;
- el problema estaba en la rama restrictiva de reglas, no en el formulario.

Desde `2026-04-11`, el especialista usa una ruta server-side acotada via callable.

## Resumen ejecutivo

- `admin` y otros roles siguen pudiendo usar el flujo normal de `updateDoc`.
- `doctor_specialist` redirige solo los parches medicos acotados a una callable backend.
- la callable valida:
  - autenticacion;
  - rol resuelto desde `config/roles`;
  - una sola cama por request;
  - whitelist estricta de campos;
  - existencia del bed en el documento remoto;
- el cliente mantiene optimistic update local y la suscripcion realtime no debe pisarlo con
  snapshots mas viejos.

## Dependencias y superficies

### Cliente

- [src/hooks/useMedicalHandoffHandlers.ts](../src/hooks/useMedicalHandoffHandlers.ts)
- [src/application/handoff/medicalPatientHandoffUseCases.ts](../src/application/handoff/medicalPatientHandoffUseCases.ts)
- [src/hooks/useHandoffLogic.ts](../src/hooks/useHandoffLogic.ts)
- [src/hooks/useBedManagementActionCreators.ts](../src/hooks/useBedManagementActionCreators.ts)
- [src/services/storage/firestore/firestoreRecordWrites.ts](../src/services/storage/firestore/firestoreRecordWrites.ts)
- [src/hooks/controllers/dailyRecordQueryController.ts](../src/hooks/controllers/dailyRecordQueryController.ts)

### Backend

- [functions/lib/specialistMedicalHandoffFunctions.js](../functions/lib/specialistMedicalHandoffFunctions.js)
- [functions/lib/auth/authHelpersFactory.js](../functions/lib/auth/authHelpersFactory.js)
- [functions/lib/auth/authFunctionsFactory.js](../functions/lib/auth/authFunctionsFactory.js)
- [functions/index.js](../functions/index.js)

### Reglas y contratos relacionados

- [firestore.rules](../firestore.rules)
- [src/services/repositories/dailyRecordClinicalDomainService.ts](../src/services/repositories/dailyRecordClinicalDomainService.ts)
- [src/types/domain/patient.ts](../src/types/domain/patient.ts)

## Flujo actual

1. La UI del handoff medico arma un patch por paciente/cama:
   - `beds.<bed>.medicalHandoffEntries`
   - `beds.<bed>.medicalHandoffNote`
   - `beds.<bed>.medicalHandoffAudit`
2. `firestoreRecordWrites.updateRecordPartial(...)` detecta si es un patch medico acotado de
   especialista usando `isSpecialistScopedDailyRecordPatch(...)`.
3. Si el usuario actual resuelve a `doctor_specialist`, el cliente llama:
   - `updateSpecialistMedicalHandoff`
4. La callable:
   - vuelve a resolver rol;
   - valida que el patch toque solo una cama permitida;
   - valida que los paths esten en la whitelist;
   - confirma que el bed existe en el documento remoto;
   - escribe los cambios y estampa `lastUpdated` de servidor.
5. La cache local ya fue actualizada optimisticamente; la suscripcion realtime solo debe aceptar
   snapshots iguales o mas nuevos.

## Funciones clave

### Cliente

- `isSpecialistScopedDailyRecordPatch(patch)`
  - decide si el patch es candidato a la ruta protegida de especialista.
- `shouldRouteSpecialistPatchViaCallable()`
  - solo activa la callable para `doctor_specialist`.
- `updateSpecialistMedicalHandoffViaCallable(date, patch)`
  - ejecuta la callable productiva.
- `createDailyRecordSubscription(...)`
  - evita que un snapshot remoto atrasado borre temporalmente el optimistic update local.

### Backend

- `parseSpecialistPatch(rawPatch)`
  - valida shape, bed unico y paths permitidos.
- `createSpecialistMedicalHandoffFunctions(...)`
  - publica `updateSpecialistMedicalHandoff`.
- `resolveRoleForEmail(email)`
  - usa `config/roles` como fuente canonica.

## Limites operativos intencionales

- solo una cama por request;
- solo campos medicos permitidos;
- no se aceptan campos administrativos ni FHIR;
- no se crea un bed inexistente desde este flujo;
- el write queda acotado al hospital configurado en runtime;
- `admin` puede pasar por la callable, pero no depende de ella para funcionar;
- la callable no reemplaza el flujo estructurado top-level `medicalHandoffBySpecialty`; cubre
  especificamente el handoff medico por paciente/cama.

## Configuracion relevante

- proyecto frontend/local:
  - `.env.local` con `VITE_FIREBASE_PROJECT_ID=hhr-pruebas`
- project/backend:
  - deploy de Functions en `hhr-pruebas`
- hospital:
  - `HOSPITAL_ID` en runtime de Functions
  - `HospitalConfigService.getHospitalId()` del lado cliente
- auth:
  - `config/roles`
  - callable `checkUserRole`
  - callable `syncCurrentUserRoleClaim`

## Problemas historicos que no deben repetirse

### 1. Confiar en Firestore Rules para el write directo del especialista

Problema observado:
- el especialista tenia UI habilitada;
- el payload visible era correcto;
- Firestore respondia `Missing or insufficient permissions`.

Leccion:
- no volver a mover este flujo a write directo sin una razon fuerte y pruebas de regresion sobre
  la rama real de reglas.

### 2. Flatten accidental de paths medicos

Problema observado:
- `flattenObject(...)` expandia objetos como `medicalHandoffAudit` a subpaths;
- la diff de reglas cambiaba de forma y el write era rechazado.

Leccion:
- los patches medicos acotados deben mantenerse en dot-notation estable.

### 3. Side effects que ensucian el patch

Problema observado:
- reglas o reducers agregaban campos ajenos al handoff medico;
- el especialista terminaba intentando modificar mas de lo permitido.

Leccion:
- no meter normalizaciones amplias, FHIR ni side effects de otra area en este write path.

### 4. Reemplazar optimistic update con snapshot remoto atrasado

Problema observado:
- la nota se guardaba;
- al salir del textarea desaparecia un instante y luego volvia.

Leccion:
- la suscripcion realtime debe ignorar snapshots con `lastUpdated` mas antiguo que el cache local.

### 5. Dejar logs de depuracion permanentes

Problema observado:
- `DEBUG partialUpdate` y warnings de runtime escondian la señal real.

Leccion:
- los logs de depuracion para incidentes deben retirarse cuando el fix queda estable.

## Checks y tests minimos antes de tocar este flujo

- `npx vitest run src/tests/functions/specialistMedicalHandoffFunctions.test.ts`
- `npx vitest run src/tests/services/storage/firestoreRecordWrites.test.ts`
- `npx vitest run src/tests/hooks/controllers/dailyRecordQueryController.test.ts`
- `npx vitest run src/tests/hooks/useHandoffLogic.medical-handoff.test.ts`
- `bash scripts/run-firestore-rules-ci.sh`

## Regla de cambio seguro

Si una change toca cualquiera de estos puntos:

- `firestoreRecordWrites.ts`
- `specialistMedicalHandoffFunctions.js`
- `dailyRecordQueryController.ts`
- `firestore.rules`

entonces debe responder explicitamente:

1. El especialista sigue escribiendo por callable o se cambia deliberadamente?
2. El patch sigue limitado a una sola cama?
3. El backend sigue validando rol con `config/roles`?
4. El optimistic update sigue protegido contra snapshots viejos?
5. Los tests de especialista cubren el cambio?
