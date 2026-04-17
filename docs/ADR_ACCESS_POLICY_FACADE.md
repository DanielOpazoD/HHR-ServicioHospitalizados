# ADR: Fachada Canónica de Acceso App Shell

**Estado:** Vigente

## Decisión

La navegación del app shell consume una fachada única en `shared/access/operationalAccessPolicy.ts` para visibilidad de módulos, edición y saneamiento de rutas.

## Motivo

La coexistencia entre helpers legacy de `utils/permissions` y políticas más nuevas generaba wiring duplicado y decisiones dispersas entre `Navbar`, `AppContent` y `AppRouter`.

## Consecuencia

- El app shell usa `getVisibleAppModules`, `canEditAppModule` y `sanitizeAppModuleForRole`.
- `utils/permissions` queda como compatibilidad legacy y fuente base de reglas.
- Los consumidores nuevos deben entrar por la fachada operativa, no por combinaciones ad hoc.
