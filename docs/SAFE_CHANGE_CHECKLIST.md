# Safe Change Checklist

Antes de cerrar una modificación relevante en este repo:

1. Clasificar la change según `scripts/config/sustainable-change-policy.json`.
2. Actualizar tests unitarios e integración afectados por la change.
3. Si la change es upgrade o excepción, documentar owner, riesgo, rollback y criterio de cierre.
4. Revisar si la change toca reglas clínicas de fecha/turno, sync o identidad paciente.
5. Correr `npm run typecheck`.
6. Correr `npm run check:quality`.
7. Elegir y ejecutar el gate correcto:
   `npm run ci:inner-loop`, `npm run ci:merge-gate` o `npm run ci:release-gate`.
8. Verificar límites de tamaño/hotspots si el cambio toca archivos grandes.
9. Revisar contratos runtime si la change toca repositorios, Firestore, templates o serialización.
10. Revisar si la change impacta `firestore.rules`, emulador o E2E crítico.
11. Si se agrega una excepción de arquitectura o tamaño, documentarla en la allowlist correspondiente.
12. Si se introduce un nuevo error operativo, mapearlo al contrato compartido y a telemetría.
13. Dejar referencias en README/ARCHITECTURE del módulo si la decisión cambia una regla estable.
14. Si la change toca startup, lazy loading o vistas críticas, correr `npm run check:flow-performance-budget`.
15. Si el budget por flujo cambia, regenerar y revisar `reports/e2e/flow-performance-budget-summary.json` y `.md`.
16. Si la change toca login, roles o auth bootstrap, revisar y actualizar [docs/AUTH_ACCESS_MODEL.md](./AUTH_ACCESS_MODEL.md).
17. Si la policy lo exige, regenerar `reports/release-readiness-scorecard.md`.
