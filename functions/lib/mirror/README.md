# `functions/lib/mirror`

## Contrato

- Replicar y escribir snapshots derivados sin mezclar autorización clínica.
- `dailyRecords` queda fuera del espejo: los censos corregidos en `hhr-pruebas`
  se conservan como base de la migración y no deben sobrescribirse desde el antiguo.
  `mirrorDailyRecords` se retiró de Cloud Functions el 15-10-2026 y no se exporta.

## Límites

- Configuración de paths en `mirrorConfig.js`.
- La configuración del app secundario y credenciales vive en `mirrorSecondaryFirestoreFactory.js`, no en `appContext.js`.
- El mirror secundario debe configurarse por secretos de entorno/runtime:
  `BETA_SERVICE_ACCOUNT_JSON`, `BETA_SERVICE_ACCOUNT_JSON_B64` o
  `functions.config().mirror.beta_service_account_json(_b64)`.
- No se deben trackear service accounts JSON ni llaves privadas en el repositorio.
- Escrituras y transformación de payloads deben quedar en factories dedicadas.
- Nuevas colecciones espejo deben declararse en `mirrorFunctionRegistry.js` antes de agregarse al wiring público.
