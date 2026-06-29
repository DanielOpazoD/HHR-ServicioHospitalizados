# Política de auditoría de mutaciones clínicas

**Estado:** Vigente (2026-06-26)
**Gate:** `check:clinical-mutation-audit-policy` (en `check:quality`)
**Fuente declarada:** [`scripts/clinical-mutation-audit-policy.json`](../scripts/clinical-mutation-audit-policy.json)

## Por qué existe

La autorización server-side de las mutaciones vive en las **Firestore rules** (cada path clínico se
escribe sólo con el predicado correcto: `isAdmin()`, `canEdit()`, `canWriteClinicalDocument()`, …).
Lo que esta política gobierna es la otra mitad del contrato clínico: **cómo se audita cada
mutación**, para que un cambio sobre datos clínicos nunca quede sin rastro de forma accidental.

El disparador fue un hallazgo real: `executeWriteAuditEvent` **no lanza** — devuelve un
`ApplicationOutcome` (`success` | `failed`, p.ej. `failed` para actor anónimo). Código que lo
`await`-eaba e ignoraba el resultado dejaba caer fallos de auditoría en silencio
(`CONFLICT_VERSION_RESTORED`, `CONFLICT_AUTO_MERGED`). En vez de arreglar caso a caso, declaramos la
postura de **cada** `AuditAction` y la enforzamos con un gate.

## Las dos arquitecturas de auditoría (contexto)

| Camino                                                                  | Semántica de fallo                                                                                                                        | Uso típico                                                 |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `executeWriteAuditEvent` (`@/application/audit/writeAuditEventUseCase`) | Devuelve `ApplicationOutcome`; **rechaza actor anónimo**. El caller decide.                                                               | Commands / use-cases (restore, discharge, transfer, admit) |
| `logAuditEvent` / `auditPort.writeEvent` (`@/services/admin/auditCore`) | **Local-first**: persiste local y sincroniza a Firestore best-effort; los errores remotos se observan dentro de `auditCore` (no relanza). | Ediciones de censo de alta frecuencia, vistas              |

Ninguna es "mejor": son decisiones distintas. La política sólo exige que la elección sea
**explícita** por acción.

## Las tres posturas

- **`failClosed`** — la mutación **debe abortar** si su auditoría no se puede escribir. Reservada
  para sobrescrituras/borrados de administrador donde un cambio sin auditar es inaceptable **y**
  abortar es seguro (no urgente, reversible). Ej.: `CONFLICT_VERSION_RESTORED`,
  `*_DELETED`, `MEDICAL_INDICATION_TEMPLATE_*`.
- **`bestEffortObservable`** — la mutación **procede** aunque la auditoría falle, pero el fallo se
  **superficializa** (outcome degradado, telemetría, o el log local-first auto-observado). Reservada
  para acciones de **flujo clínico urgente** donde abortar dañaría la atención (admitir, dar de alta,
  trasladar, cargar en el censo). Requiere `justification`.
- **`exemptNonMutation`** — vistas, login/logout, exportaciones/impresiones (salida/acceso) y eventos
  de sistema que **no mutan** estado clínico; no requieren auditoría fail-closed.

## El gate

`check:clinical-mutation-audit-policy` ([`scripts/check-clinical-mutation-audit-policy.mjs`](../scripts/check-clinical-mutation-audit-policy.mjs))
tiene **dos enforcements**:

**A. Declaración (registro).** Lee el union `AuditAction` y la política, y **falla** si:

1. una `AuditAction` no está clasificada (fuerza decidir su postura antes de mergear);
2. una acción aparece en más de un bucket;
3. una entrada `bestEffortObservable` no trae `justification`;
4. la política declara una acción que ya no existe en el union (entrada obsoleta).

**B. Cumplimiento (outcome no descartado).** Escanea `src/` (excluyendo tests) y **falla** si algún
llamado a `executeWriteAuditEvent(...)` descarta su `ApplicationOutcome` (statement que arranca con
el call, con o sin `await`/`void`). Ese es el bug exacto que reapareció en #129/#130: como
`executeWriteAuditEvent` **no lanza**, un outcome ignorado deja caer el fallo en silencio. El emisor
debe capturar e inspeccionar el outcome (o pasarlo por un helper fail-closed).

Cubierto por `src/tests/build/clinicalMutationAuditPolicyScript.test.ts`: test de no-drift del
registro real + tests del detector (atrapa el `await` desnudo / `void`, acepta asignación/return).

## Limitaciones (qué NO verifica)

Para no dar **falsa confianza**, conviene ser explícito sobre el alcance:

- **No prueba el _cumplimiento_ de la postura `failClosed` declarada.** El enforcement B atrapa el
  patrón-bug más común (outcome descartado en un call directo a `executeWriteAuditEvent`), pero **no**
  demuestra que un emisor `failClosed` realmente **aborte** la mutación si la auditoría falla. Eso se
  prueba con un test por acción (p.ej. `dailyRecordVersionRestoreController.test.ts` para
  `CONFLICT_VERSION_RESTORED`). Una postura `failClosed` sin su test es deuda, no garantía.
- **No detecta el call vía alias.** Si el `executeWriteAuditEvent` se invoca a través de un alias
  inyectado (`deps.writeAuditEvent ?? executeWriteAuditEvent`), el escaneo sintáctico no lo ve; hoy
  esos consumidores capturan el outcome, pero es un punto ciego conocido.
- **No detecta una mutación clínica que no emita _ninguna_ `AuditAction`.** El gate gobierna las
  acciones declaradas; una escritura clínica nueva sin evento de auditoría es invisible aquí (queda
  para revisión humana / las rules + cobertura crítica).
- **Las posturas son políticas declaradas**, no todas verificadas contra su emisor. Las verificadas
  este ciclo se listan abajo; el resto es intención declarada hasta que se audite su emisor.

## Cómo agregar una `AuditAction` nueva

1. Agrega el literal al union en `src/types/auditActionTypes.ts`.
2. Clasifícalo en `scripts/clinical-mutation-audit-policy.json` (con `justification` si es
   `bestEffortObservable`).
3. Asegura que el emisor cumpla la postura declarada (fail-closed → verificar el outcome y abortar).

## Alineaciones aplicadas en este ciclo

- `CONFLICT_VERSION_RESTORED` → `failClosed` (audita antes de guardar; aborta si falla).
- `CONFLICT_AUTO_MERGED` → `bestEffortObservable`; el helper ahora superficializa el outcome fallido
  y el caller lo telemetría (antes se tragaba el fallo).
- `PATIENT_HARMONIZED` → `bestEffortObservable`; se audita **antes** de mutar la identidad.
