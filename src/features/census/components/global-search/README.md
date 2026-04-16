# Búsqueda global de pacientes

Este submódulo usa dos fuentes de datos a propósito:

- **Firestore `patientMaster`** para resultados rápidos de búsqueda
- **historial operativo** desde daily records para movimientos reales

## Cómo se reparte la responsabilidad

- [usePatientSearchQuery.ts](./usePatientSearchQuery.ts)
  ejecuta la búsqueda base en Firestore.
- [usePatientSelection.ts](./usePatientSelection.ts)
  carga historial clínico real y documentos del episodio.
- [episodeGroupingController.ts](./episodeGroupingController.ts)
  agrupa hospitalizaciones y reconcilia episodios abiertos con el historial.
- [patientEpisodeTimelineController.ts](./patientEpisodeTimelineController.ts)
  arma el estado final que renderiza el timeline.

## Regla importante

El timeline no debe asumir que `patientMaster.hospitalizations` esté siempre
perfectamente sincronizado. Si Firestore sigue mostrando un episodio abierto,
pero el historial real ya contiene:

- `discharge`
- `transfer`
- `Fallecimiento`

la UI debe cerrar ese episodio antes de renderizarlo.

## Objetivo

- mantener búsqueda rápida
- mantener cronología correcta
- evitar divergencias entre “Movimientos recientes” y “Episodios de hospitalización”
