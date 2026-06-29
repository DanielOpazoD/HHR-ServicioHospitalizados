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
lee el union `AuditAction` y la política, y **falla** si:

1. una `AuditAction` no está clasificada (fuerza decidir su postura antes de mergear);
2. una acción aparece en más de un bucket;
3. una entrada `bestEffortObservable` no trae `justification`;
4. la política declara una acción que ya no existe en el union (entrada obsoleta).

Cubierto por `src/tests/build/clinicalMutationAuditPolicyScript.test.ts`, incluido un test de
no-drift que valida el registro real contra el union real.

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
