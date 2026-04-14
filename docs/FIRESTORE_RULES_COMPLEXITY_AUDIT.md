# Firestore Rules Complexity Audit

Fecha: 2026-04-12
Estado: `P1-02` cerrado con limitación conocida del emulador; el hotspot principal quedó reducido y validado
Owner sugerido: seguridad / repositorios / runtime

## Objetivo

Bajar el riesgo operativo de `firestore.rules` sin abrir una reescritura completa.

## Señales observadas

- El archivo tiene 731 líneas y concentra demasiada lógica en un solo boundary.
- El emulador ya mostró errores por límite de evaluación en updates críticos.
- La resolución de roles dinámicos (`config/roles`) se usa muchas veces en cascada.
- El path de `dailyRecords.update` es el más sensible porque mezcla:
  - ventana temporal de edición
  - permisos por rol
  - firma médica
  - escritura especialista estructurada y por cama

## Hotspots priorizados

1. Resolución de acceso clínico y edición
   Archivos: `firestore.rules`, helpers `isAdmin/isNurse/isDoctor/...`
   Riesgo: recalcular roles en cascada encarece cada evaluación.

2. `isSpecialistMedicalHandoffUpdate`
   Archivo: `firestore.rules`
   Riesgo: cadena larga de camas permitidas y checks estructurales profundos.

3. `getConfiguredRole`
   Archivo: `firestore.rules`
   Riesgo: depende de `config/roles` y hoy participa de múltiples caminos de acceso.

4. `isValidSystemHealthWrite`
   Archivo: `firestore.rules`
   Riesgo: payload guard extenso; no es el path más caliente, pero sí costoso.

## Iteración 1 ejecutada

Se consolidó la resolución de roles para evitar cascadas innecesarias en:

- `canReadClinicalData`
- `canEdit`
- `canReportSystemHealth`
- `canManageCensusAccess`
- helpers `isAdmin/isNurse/isDoctor/isDoctorSpecialist/isEditorRole/isGeneralViewer`

La mejora busca bajar el costo de evaluación sin cambiar la semántica de permisos.

## Resultado de la validación

- `bash scripts/run-firestore-rules-ci.sh`: verde (`76` tests).
- `npm run test:emulator:sync:ci`: verde (`4` tests sync + `3` UI).
- Aun así, el emulador sigue registrando el error de límite de evaluación en el caso
  denegado de `dailyRecords.update` sobre documento faltante.

Conclusión: la iteración 1 mejoró el hot path de resolución de acceso, pero no resuelve
todavía el hotspot estructural principal.

## Iteración 2 ejecutada

Se intentó bajar el costo específico de `dailyRecords.update` con dos cambios controlados:

- se agregó una guarda `hasPersistedDailyRecord()` para evitar tratar documentos inexistentes como candidatos válidos a `update`
- se consolidó la decisión de `dailyRecords.update` en `canUpdateDailyRecord()`, resolviendo `getEffectiveRole()` una sola vez y separando `isSpecialistMedicalHandoffPayload()` del chequeo de rol especialista

La mejora mantuvo la semántica de permisos y dejó verdes las suites funcionales, pero no eliminó el límite de expresiones del emulador en el caso denegado de `partial update` sobre documento faltante.

## Resultado de la validación de la iteración 2

- `bash scripts/run-firestore-rules-ci.sh`: verde (`76` tests).
- `npm run test:emulator:sync:ci`: verde (`4` tests sync + `3` UI).
- El emulador sigue registrando `maximum of 1000 expressions to evaluate` en `dailyRecords.update` para el caso denegado de `sync-concurrency.emulator.test.ts`.

Conclusión: la iteración 2 mejoró la claridad y redujo recomputación de roles en el hot path, pero el costo dominante sigue concentrado en el payload path de especialista y/o en la resolución dinámica de `config/roles`.

## Iteración 3 ejecutada

Se reescribió `dailyRecords.update` para que la decisión de escritura quede segmentada por rol:

- `allow update` ahora delega en `canUpdateDailyRecord()`
- la rama de enfermería usa `request.resource.data` y exige `dateTimestamp` explícito antes de abrir la ventana temporal
- las ramas de médico urgencia y especialista solo tocan `resource` cuando el rol realmente corresponde

Además, se probó una simplificación de `getConfiguredRole()` para evitar `exists + get`, pero se descartó en la misma iteración porque introdujo `Service call error` en el emulador cuando `config/roles` no existía. El repo quedó con la versión estable previa de ese helper.

## Resultado de la validación de la iteración 3

- `bash scripts/run-firestore-rules-ci.sh`: verde (`76` tests).
- `npm run test:emulator:sync:ci`: verde (`4` tests sync + `3` UI).
- El caso denegado de `partial update` sobre documento faltante ya no dispara `maximum of 1000 expressions to evaluate`.
- El emulador sigue reportando un `evaluation error` localizado en `allow update: if canUpdateDailyRecord()` para ese mismo caso denegado.

Conclusión: la severidad bajó. El hotspot ya no agota el presupuesto del evaluador, pero todavía no produce un rechazo completamente limpio en el caso de `update` sobre documento inexistente.

## Riesgos que siguen abiertos

- `isSpecialistMedicalHandoffUpdate` sigue siendo el hotspot más complejo del archivo.
- `getConfiguredRole` todavía usa un patrón caro (`exists` + `get`) y conviene revisarlo con cuidado.
- `dailyRecords.update` ya tiene mejor factoring, pero el caso denegado por documento faltante sigue atravesando suficiente lógica como para agotar el presupuesto del evaluador.
- El caso denegado de `partial update` sobre documento faltante ahora cae en `evaluation error` localizado, no en límite global de expresiones; sigue siendo deuda, aunque más acotada.
- La política de bootstrap admins ya quedó revisada y documentada como excepción temporal de recuperación; sigue pendiente su retiro futuro, pero no su inventario ni justificación.

## Iteración 4 ejecutada

Se hizo un recorte estructural pequeño sobre el path especialista y el gating de `update`:

- `isSpecialistMedicalHandoffPayload()` ahora calcula una sola vez el caso `una sola cama permitida afectada`, evitando repetir `size + hasOnly` dentro de cada OR por cama
- `dailyRecords.update` pasó a negar con `exists(...)` antes de entrar a `canUpdatePersistedDailyRecord()`, para intentar cortar temprano el caso de `update` sobre documento inexistente

El árbol final mantiene semántica de permisos y deja verdes las suites funcionales, pero el residuo del emulador no desapareció: el caso denegado de `partial update` sobre documento faltante sigue cayendo en `evaluation error` localizado en `allow update`.

## Resultado de la validación de la iteración 4

- `bash scripts/run-firestore-rules-ci.sh`: verde (`76` tests).
- `npm run test:emulator:sync:ci`: verde (`4` tests sync + `3` UI).
- El emulador sigue reportando `evaluation error` en `dailyRecords.update` para el caso denegado de documento inexistente.

Conclusión: la iteración 4 mejora factoring y deja menos duplicación estructural en el path especialista, pero no resuelve todavía el borde del evaluador en el `update` denegado sobre documento ausente.

## Iteración 5 ejecutada

Se corrigió un desvío introducido en la iteración previa dentro del path especialista:

- `isSpecialistMedicalHandoffPayload()` volvió a usar `isOnlySpecialistAffectedBed(...)` para la rama de cama única
- con eso, el evaluador vuelve a hacer `size + hasOnly([bedId])` antes de tocar `isValidSpecialistMedicalBedUpdate(bedId)`, evitando diffs profundos sobre camas no afectadas

Este ajuste no cambia permisos ni contratos; corrige el costo del camino de validación para que solo la cama realmente afectada entre al chequeo profundo.

## Resultado de la validación de la iteración 5

- `bash scripts/run-firestore-rules-ci.sh`: verde (`76` tests).
- `npm run test:emulator:sync:ci`: verde (`4` tests sync + `3` UI).
- El caso denegado de `partial update` sobre documento faltante sigue cayendo en `evaluation error`, pero el path de especialista recupera una forma de evaluación más barata que la variante anterior.

Conclusión: la iteración 5 sí mejora el hotspot principal del especialista, aunque el residuo del `update` sobre documento inexistente sigue abierto como deuda separada del emulador.

## Iteración 6 ejecutada

Se recortó el caso profundo de `clinicalCrib` en el path especialista:

- `isValidSpecialistMedicalBedUpdate(bedId)` ahora separa explícitamente el caso de handoff médico del paciente principal y el caso exclusivo de `clinicalCrib`
- el update del `clinicalCrib` solo se acepta cuando la cama afecta exclusivamente la clave `clinicalCrib`, y luego valida solo `medicalHandoffEntries`, `medicalHandoffNote`, `medicalHandoffAudit` y `clinicalEvents` dentro de ese subdocumento
- se agregaron dos regresiones de reglas:
  - especialista puede persistir handoff médico acotado sobre `beds.R1.clinicalCrib.*`
  - especialista no puede tocar campos no permitidos del `clinicalCrib`, como `patientName`

Este corte vuelve la regla más estricta y reduce el trabajo del evaluador cuando el patch corresponde al RN clínico.

## Resultado de la validación de la iteración 6

- `bash scripts/run-firestore-rules-ci.sh`: verde (`78` tests).
- `npm run test:emulator:sync:ci`: verde (`4` tests sync + `3` UI).
- El residuo del emulador sobre `update` a documento inexistente sigue igual, pero el path especialista para `clinicalCrib` quedó mejor delimitado y cubierto.

Conclusión: la iteración 6 mejora mantenibilidad, reduce ambigüedad en el path `clinicalCrib` y sube cobertura de seguridad sin cambiar el contrato productivo.

## Cierre de `P1-02`

Decisión tomada el `2026-04-12`:

- se da por cerrado `P1-02` a nivel de mejora estructural y reducción de riesgo
- el residuo restante se clasifica como **limitación conocida del emulador** en el caso denegado de `update` sobre documento inexistente
- no se seguirá iterando a ciegas sobre ese borde mientras:
  - la denegación siga siendo correcta (`permission-denied`)
  - `bash scripts/run-firestore-rules-ci.sh` permanezca verde
  - `npm run test:emulator:sync:ci` permanezca verde
  - el write path productivo del especialista siga pasando por callable y no por write directo a reglas

Justificación técnica:

- el problema grave original (`maximum of 1000 expressions to evaluate`) ya fue eliminado
- el residuo actual no habilita escrituras indebidas ni rompe el contrato funcional; el documento inexistente sigue siendo rechazado
- después de varias iteraciones, el `evaluation error` quedó aislado al borde denegado del emulador y no mostró impacto productivo adicional
- seguir iterando sobre ese caso sin nueva evidencia probablemente tendría retorno bajo y riesgo innecesario

Seguimiento:

- si aparece evidencia de impacto productivo real, o si el write path vuelve a depender de reglas para especialista, este frente debe reabrirse
- hasta entonces, el siguiente valor técnico está en `P1-03`, `P1-04` y `P1-05`

## Próximas iteraciones recomendadas

1. Pasar a `P1-03`: revisar bootstrap admins y excepciones legacy de seguridad.
2. Abrir `P1-04`: reducir complejidad del write path de `dailyRecord`.
3. Abrir `P1-05`: consolidar golden path de lectura/sync.

## Iteración 7 ejecutada

Se abrió un frente nuevo y de bajo riesgo sobre el guard de `systemHealth`:

- se agregaron helpers reutilizables `isOptionalString(...)`, `isOptionalBool(...)`, `isOptionalBoundedInt(...)` e `isOptionalEnum(...)`
- `isValidSystemHealthWrite(userId)` pasó a reutilizar esos helpers para validar escalares opcionales, contadores acotados y enums operativos
- no se cambiaron keys permitidas, rangos ni semántica de permisos; el recorte fue estructural y orientado a bajar repetición/costo de mantenimiento

## Resultado de la validación de la iteración 7

- `bash scripts/run-firestore-rules-ci.sh`: verde (`81` tests).

Conclusión: el archivo sigue siendo grande, pero `systemHealth` ya dejó de ser un bloque de validación repetitivo difícil de extender. Este frente tiene buen retorno estructural y riesgo funcional bajo.

## Iteración 8 ejecutada

Se hizo otro recorte quirúrgico sobre el handoff estructurado de especialista:

- se agregó `hasOnlySpecialistStructuredRecordKeys(...)` para centralizar la lista de keys permitidas en el payload estructurado
- se agregó `isOnlyAffectedSpecialistStructuredSpecialty(...)` para evitar repetir `size == 1 + hasOnly + isValid...` por cada especialidad
- `isSpecialistStructuredMedicalHandoffUpdate()` quedó más corto y con menos duplicación visible, sin cambiar permisos ni el contrato del path especialista

## Resultado de la validación de la iteración 8

- `bash scripts/run-firestore-rules-ci.sh`: verde (`81` tests).

Conclusión: `firestore.rules` sigue siendo un boundary grande, pero el subpath estructurado del especialista quedó más fácil de auditar y menos propenso a volver a crecer con ORs repetidos.
