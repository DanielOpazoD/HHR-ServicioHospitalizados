# `src/features/cudyr`

## Propósito

Feature de categorización CUDYR para enfermería, con vista web, exportación y soporte de impresión/PDF para entrega de turno nocturno.

## Contratos relevantes

- `cudyrUpdatedAt`
  Último timestamp persistido cuando se modifica un puntaje CUDYR principal o de cuna clínica.

## Regla de presentación del tiempo CUDYR

- La web muestra `Últ. mod.` usando `cudyrUpdatedAt`.
- El PDF de entrega de turno nocturno debe usar la fecha/hora fija de aplicación del instrumento nocturno (`día siguiente, 1:00 AM`).
- La tabla CUDYR incluida al final de la entrega de turno nocturna debe respetar la misma elegibilidad clínica, excluir cálculos para filas bloqueadas y reflejar también cunas clínicas elegibles.
- El formateo horario compartido se resuelve vía `formatTimeHHMM` en `src/utils/dateUtils.ts`.

## Regla de elegibilidad nocturna

- El instrumento nocturno usa como referencia fija las `01:00` del día siguiente al `record.date`.
- Solo se categoriza a pacientes con al menos `8` horas de hospitalización a ese corte.
- Ingresos del mismo `record.date` sin `admissionTime` se consideran elegibles por supuesto clínico conservador.
- Ingresos del día siguiente (`X + 1`) se bloquean para CUDYR aunque no exista `admissionTime`.
- Pacientes excluidos siguen visibles en la tabla, pero con nombre bloqueado y puntajes de solo lectura.

## Regla de edición

- Ya no existe botón manual de `Bloqueado/Desbloqueado` en la UI CUDYR.
- `admin` puede editar CUDYR en cualquier fecha.
- Los perfiles con permiso de edición CUDYR distintos de `admin` solo pueden editar el registro del día actual (`X`) y el día previo (`X - 1`).
- Los registros `X - 2` o más antiguos quedan automáticamente en solo lectura.

## Visor del instrumento

- `Ver Instrumento CUDYR` abre el PDF dentro de un visor modal interno.
- No debe abrirse en una ventana externa salvo que cambie explícitamente el contrato de UX.
