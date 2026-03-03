# `functions/lib/mirror`

## Contrato

- Replicar y escribir snapshots derivados sin mezclar autorización clínica.

## Límites

- Configuración de paths en `mirrorConfig.js`.
- La configuración del app secundario y credenciales vive en `mirrorSecondaryFirestoreFactory.js`, no en `appContext.js`.
- Escrituras y transformación de payloads deben quedar en factories dedicadas.
- Nuevas colecciones espejo deben declararse en `mirrorFunctionRegistry.js` antes de agregarse al wiring público.
