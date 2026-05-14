# Daily Record Authority Rollout

## Objetivo

PR7 permite mover las escrituras completas del censo diario desde una proteccion
principalmente cliente hacia una autoridad transaccional en backend, sin hacer un cambio
big-bang.

## Modos

- `client_only`: modo por defecto. El cliente mantiene las validaciones locales y escribe
  directo a Firestore.
- `shadow`: el cliente ejecuta una validacion backend `dryRun` cuando hay usuario autenticado,
  pero conserva la escritura directa. Los errores de shadow no bloquean al usuario.
- `enforced`: las escrituras completas directas y las publicaciones del outbox pasan por
  `saveDailyRecordWithClinicalAuthority`.

Compatibilidad: `VITE_DAILY_RECORD_AUTHORITY_CALLABLE=true` equivale a `enforced`.
El flag recomendado para rollout nuevo es `VITE_DAILY_RECORD_AUTHORITY_MODE`.

## Secuencia Recomendada

1. Desplegar con `VITE_DAILY_RECORD_AUTHORITY_MODE=client_only`.
2. Cambiar a `shadow` durante al menos un turno clinico observado.
3. Revisar `functionsTelemetry` para:
   - `service = dailyRecordWriteAuthority`;
   - `operation = saveDailyRecordWithClinicalAuthority`;
   - `authorityStatus`;
   - `fallbackEpisodeKeys`;
   - `degenerateFallbackEpisodeKeys`;
   - `violationCount`.
4. Si no aparecen fallos inesperados, cambiar a `enforced`.

## Rollback

Volver a `VITE_DAILY_RECORD_AUTHORITY_MODE=client_only` deja las validaciones cliente activas
y desactiva el uso obligatorio del callable. Si se estaba usando el flag legacy, remover
`VITE_DAILY_RECORD_AUTHORITY_CALLABLE=true`.

## Privacidad De Telemetria

La telemetria de autoridad no debe registrar RUT, nombre, diagnostico ni notas clinicas.
Solo registra conteos, modo, origen, fecha del registro, estado de autoridad y tipos de
violacion.

## Senales A Vigilar

- Aumento de `permission-denied`: revisar roles/claims antes de activar `enforced`.
- Aumento de `failed-precondition`: revisar duplicados o episodios cerrados activos.
- `degenerateFallbackEpisodeKeys > 0`: hay pacientes activos sin identidad de episodio
  suficientemente fuerte; conviene revisar adopcion de `clinicalEpisodeId`.
