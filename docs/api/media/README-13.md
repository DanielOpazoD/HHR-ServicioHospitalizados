# `src/infrastructure`

## Propósito

`src/infrastructure/` ya no es una capa activa del proyecto.

Se conserva solo como placeholder histórico para evitar reabrir una transición incompleta.

## Decisión vigente

- No agregar código nuevo en este directorio.
- La infraestructura concreta vive en `src/services/`.
- Los contratos o puertos de caso de uso viven en `src/application/`.
- Si en el futuro se reactiva una capa `infrastructure`, debe hacerse con una decisión arquitectónica explícita antes de mover código.

## Entrypoints actuales

- Firestore-backed provider: `src/services/storage/firestore/firestoreDatabaseProvider.ts`
- Implementación reusable del provider: `src/services/infrastructure/db/*`

La transición queda cerrada: este directorio no debe volver a usarse como zona ambigua o “en evolución”.
