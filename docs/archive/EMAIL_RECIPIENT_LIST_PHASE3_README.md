# Fase 3: Refactor mecánico de `emailRecipientListService`

## Objetivo

Reducir complejidad mecánica en `src/services/email/emailRecipientListService.ts`
sin cambiar sus entrypoints públicos ni el formato de listas globales.

## Alcance

- Extraer tipos y constantes del servicio.
- Extraer normalización y mapeo de listas a un módulo de soporte.
- Mantener el servicio centrado en Firestore y `ApplicationOutcome`.

## Iteración 1

### Decisión

Se eligió este servicio porque es un hotspot productivo grande, con pruebas directas
y con una separación natural entre soporte de shape/normalización y lógica de I/O.

### Cambios aplicados

- `emailRecipientListSupport.ts`: tipos, constantes, normalización, comparadores y builders.
- `emailRecipientListService.ts`: reducido a fetch/save/delete/subscribe y wrappers de outcome.
- Resultado de tamaño: `emailRecipientListService.ts` pasó de `357` a `233` líneas.

## Validación ejecutada

- `npm run typecheck`
- `npm exec vitest run src/tests/services/email/emailRecipientListService.test.ts src/tests/application/census-email/censusRecipientListUseCases.test.ts`
- Estado: validación verde

## Siguiente subfase candidata

1. Verificar si el servicio quedó ya en tamaño razonable.
2. Si todavía está denso, extraer manejo repetido de errores operacionales.
