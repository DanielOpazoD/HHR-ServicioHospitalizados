# Technical Debt Register

| Estado | Owner             | Area               | Item                                                                                              | Criterio de cierre                                                 |
| ------ | ----------------- | ------------------ | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| activo | frontend-platform | firebase-runtime   | Reducir `console.warn/error` legacy fuera de sinks estructurados                                  | Sustituido por `logger` u observabilidad donde aplique             |
| activo | architecture      | permissions        | Migrar consumidores legacy restantes de `utils/permissions` al facade operativa                   | App shell y flujos críticos sin imports directos legacy            |
| activo | platform          | firestore services | Extender inyección explícita a otros servicios Firestore/Storage aún acoplados a `firebaseConfig` | Providers/servicios reutilizables reciben dependencias por factory |
| activo | qa                | critical coverage  | Ampliar zonas críticas hacia app shell, auth bootstrap y reminders                                | `check:critical-coverage` incluye esas zonas con baseline estable  |
| activo | qa                | phase-1 confidence | Vaciar el catálogo de fallos conocidos de `test:ci:unit` y sacar las cuarentenas flaky temporales | `test:ci:unit` sin fallos clasificados abiertos ni cuarentenas     |
