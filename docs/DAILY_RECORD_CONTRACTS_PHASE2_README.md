# Fase 2: Reducción de Acoplamiento de DailyRecord Contracts

## Objetivo

Reducir el radio de impacto de `src/application/shared/dailyRecordContracts.ts`
sin romper su contrato público de una sola vez.

## Estrategia

1. Crear contratos por slice:
   - core
   - beds
   - staffing
   - medical
2. Mantener `dailyRecordContracts.ts` como agregador temporal.
3. Migrar importadores al slice correcto.
4. Medir reducción del hotspot antes de retirar el agregador.

## Iteración 1

### Hipótesis

El hotspot viene más por centralidad/importadores que por complejidad interna. Si
los consumidores empiezan a depender del slice correcto, el costo de cambio baja
sin exigir un big bang.

### Cambios planeados

- Crear módulos de contratos por slice.
- Migrar importadores de hooks, application y context al módulo correcto.
- Dejar el agregador actual solo como compatibilidad transitoria.

### Criterio de éxito

- `dailyRecordContracts.ts` deja de ser el entrypoint dominante.
- El código nuevo queda encaminado a slices temáticos.
- La compatibilidad pública inmediata se mantiene.

### Resultado de la iteración

- Se crearon contratos por slice:
  - `dailyRecordCoreContracts.ts`
  - `dailyRecordBedContracts.ts`
  - `dailyRecordStaffContracts.ts`
  - `dailyRecordMedicalContracts.ts`
- `dailyRecordContracts.ts` quedó reducido a agregador temporal.
- Los importadores productivos dejaron de depender del agregador legado.

### Validación ejecutada

- `npm run typecheck`
  - resultado: ok
- `npm exec vitest run src/tests/security/dailyRecordRootImportGovernanceStatic.test.ts`
  - resultado: ok
- barrido de imports productivos:
  - `rg -n "from '@/application/shared/dailyRecordContracts'" src --glob '!src/tests/**'`
  - resultado: sin matches

### Siguiente corte recomendado

1. Migrar los barrels secundarios (`dailyRecordHookContracts`, contratos de contexto y feature contracts) para que también expongan slices más específicos.
2. Regenerar el reporte de hotspots cuando convenga medir reducción formal del acoplamiento.
3. Evaluar si `dailyRecordContracts.ts` ya puede pasar a deprecación explícita.
