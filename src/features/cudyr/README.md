# `src/features/cudyr`

## Propósito

Feature de categorización CUDYR para enfermería, con vista web, exportación y soporte de impresión/PDF para entrega de turno nocturno.

## Contratos relevantes

- `cudyrUpdatedAt`
  Último timestamp persistido cuando se modifica un puntaje CUDYR principal o de cuna clínica.
- `cudyrLockedAt`
  Timestamp de cierre/bloqueo del instrumento cuando se congela la edición del día.

## Regla de presentación del tiempo CUDYR

- La web muestra `Últ. mod.` usando `cudyrUpdatedAt`.
- Si `cudyrUpdatedAt` no existe, se usa `cudyrLockedAt` como fallback operativo.
- El PDF de entrega de turno nocturno debe usar la misma regla.
- El formateo horario compartido se resuelve vía `formatTimeHHMM` en `src/utils/dateUtils.ts`.

## Visor del instrumento

- `Ver Instrumento CUDYR` abre el PDF dentro de un visor modal interno.
- No debe abrirse en una ventana externa salvo que cambie explícitamente el contrato de UX.
