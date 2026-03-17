# `src/features/census`

## Propósito

Módulo central del producto: censo diario, acciones sobre camas/pacientes, movimientos (alta/traslado/move-copy), UI de tablas y reglas de turno/fecha.

## Subcapas internas

| Path           | Rol                                                      |
| -------------- | -------------------------------------------------------- |
| `components/`  | UI del censo (tabla, filas, modales, secciones)          |
| `hooks/`       | Orquestación de estado y acciones de la feature          |
| `controllers/` | Lógica pura (validación, mapping, ejecución de comandos) |
| `domain/`      | Contratos de movimientos y reglas propias                |
| `context/`     | Contextos internos de acciones de censo                  |
| `types/`       | Tipos internos del módulo                                |
| `validation/`  | Validaciones específicas de acciones de censo            |

## Flujos críticos

### Acción de movimiento

```text
UI modal -> use*ModalForm -> controller validation
-> resolve*Command -> execute*RuntimeCommand
-> actions DailyRecord -> persistencia
```

### Reglas de fecha/turno

```text
clinicalShiftCalendarController
  -> bounds (recordDate / nextDay / nightEnd)
  -> validation (movementDate + movementTime)
  -> presentation (dateLabel + timeLabel)
```

## Archivos clave

| Archivo                                                  | Motivo                                                  |
| -------------------------------------------------------- | ------------------------------------------------------- |
| `controllers/clinicalShiftCalendarController.ts`         | Fuente única de invariantes de fecha/turno              |
| `controllers/censusActionExecutionController.ts`         | Resolución de comandos tipados                          |
| `controllers/censusActionRuntimeController.ts`           | Ejecución runtime desacoplada de provider               |
| `controllers/patientMovementCommandRuntimeController.ts` | Bridge command -> action runtime                        |
| `controllers/bedManagerModalController.ts`               | Transiciones y validación del flujo de bloqueo de camas |
| `controllers/bedManagerGridItemsController.ts`           | Mapeo puro de `DailyRecord` a props de grillas de camas |
| `controllers/censusMovementActionIconController.ts`      | Resolución de iconografía para acciones de movimientos  |
| `hooks/useDischargeModalForm.ts`                         | Form flow de altas                                      |
| `hooks/useTransferModalForm.ts`                          | Form flow de traslados                                  |
| `hooks/useBedManagerModalModel.ts`                       | Orquestación UI vs dominio del modal de camas           |
| `hooks/useCensusMovementActionsCellModel.ts`             | View-model para celda de acciones de movimientos        |

## Calidad

- Cobertura alta en `src/tests/views/census/**`.
- Checks de arquitectura y boundaries runtime en CI local (`check:quality`).

## Invariantes

- El cálculo de `nuevo ingreso` debe salir del dominio temporal compartido, no de helpers locales de tabla.
- Los indicadores clínicos de fila deben depender del sujeto correcto: paciente/episodio cuando corresponda, no cama por arrastre.
- Los modales visibles deben derivar de capabilities/runtime de fila, no solo de estado UI.
- La creación manual de un día con copia desde el anterior sigue respetando el horario clínico salvo
  cuando el actor es `admin` y usa el override explícito; ese bypass no debe reutilizarse para otros roles.
- La verificación pasiva de respaldos remotos no debe ejecutarse para roles sin capacidad operativa
  real sobre el módulo, para evitar `403` ruidosos desde Storage.
- Los warnings de creación de día deben distinguir entre `bloqueado por horario`, `permitido por override`
  y `falla real de inicialización`.

## Runtime boundaries

- `controllers/` no debe importar React ni hooks.
- `components/` no debe recalcular reglas clínicas ya resueltas por controllers.
- Las acciones del censo deben salir de los command/runtime controllers, no de callbacks ad hoc embebidos.
- El formateo de fechas compactas de `census` debe reutilizar presentation helpers compartidos;
  no deben reaparecer `toLocaleDateString()` o `toLocaleString()` inline en controllers de UI.

## Test entrypoints recomendados

- `npx vitest run src/tests/views/census`
- `npm run test:ci:unit`

## Comandos de validación del módulo

- `npm run typecheck`
- `npm run check:quality`
- `npm run test:ci:unit -- src/tests/views/census`

## Safe change links

- [docs/QUALITY_GUARDRAILS.md](/Users/danielopazodamiani/Desktop/HHR%20Tracker%20Marzo%202026/docs/QUALITY_GUARDRAILS.md)
- [docs/SAFE_CHANGE_CHECKLIST.md](/Users/danielopazodamiani/Desktop/HHR%20Tracker%20Marzo%202026/docs/SAFE_CHANGE_CHECKLIST.md)
