# Safe Change Checklist

Antes de cerrar una modificación relevante en este repo:

1. Actualizar tests unitarios e integración afectados por la change.
2. Revisar si la change toca reglas clínicas de fecha/turno, sync o identidad paciente.
3. Correr `npm run typecheck`.
4. Correr `npm run check:quality`.
5. Elegir y ejecutar el gate correcto:
   `npm run ci:inner-loop`, `npm run ci:merge-gate` o `npm run ci:release-gate`.
6. Verificar límites de tamaño/hotspots si el cambio toca archivos grandes.
7. Revisar contratos runtime si la change toca repositorios, Firestore, templates o serialización.
8. Revisar si la change impacta `firestore.rules`, emulador o E2E crítico.
9. Si se agrega una excepción de arquitectura o tamaño, documentarla en la allowlist correspondiente.
10. Si se introduce un nuevo error operativo, mapearlo al contrato compartido y a telemetría.
11. Dejar referencias en README/ARCHITECTURE del módulo si la decisión cambia una regla estable.
12. Si la change toca startup, lazy loading o vistas críticas, correr `npm run check:flow-performance-budget`.
13. Si el budget por flujo cambia, regenerar y revisar `reports/e2e/flow-performance-budget-summary.json` y `.md`.
14. Si la change toca login, roles o auth bootstrap, revisar y actualizar [docs/AUTH_ACCESS_MODEL.md](./AUTH_ACCESS_MODEL.md).
