# Documentation Map

Última actualización: 2026-04-10

## Lectura recomendada

1. [README.md](../README.md)
2. [docs/CODEBASE_CANON.md](CODEBASE_CANON.md)
3. [docs/FOUNDATION_TRACKER.md](FOUNDATION_TRACKER.md)
4. [PROJECT_STATUS.md](../PROJECT_STATUS.md)
5. README del módulo que vas a tocar en `src/features/*/README.md` o `src/*/README.md`

## Categorías

### Canónica

Documentos que gobiernan decisiones activas y estructura actual del repo.

- [README.md](../README.md)
- [ARCHITECTURE.md](../ARCHITECTURE.md)
- [PROJECT_STATUS.md](../PROJECT_STATUS.md)
- [docs/CODEBASE_CANON.md](CODEBASE_CANON.md)
- [docs/FOUNDATION_TRACKER.md](FOUNDATION_TRACKER.md)
- [docs/QUALITY_GUARDRAILS.md](QUALITY_GUARDRAILS.md)
- [docs/SAFE_CHANGE_CHECKLIST.md](SAFE_CHANGE_CHECKLIST.md)

### Operativa

Documentos que ayudan a ejecutar trabajo, validar cambios o entender un área concreta.

- `docs/testing/*`
- `docs/features/*`
- `docs/architecture/*`
- `docs/compliance/*`
- README por módulo en `src/`
- [docs/DEVELOPER_COMMANDS.md](DEVELOPER_COMMANDS.md)
- [docs/TEST_MEGATEST_BACKLOG.md](TEST_MEGATEST_BACKLOG.md)

### Generada

Artefactos producidos por tooling o reportes automáticos. Son útiles para consulta, pero no son la fuente primaria de diseño.

- `docs/api/**`
- `reports/**/*.md`
- `reports/**/*.json`

## Reglas de mantenimiento

- Si un documento describe decisiones activas del código, debe estar en la categoría canónica u operativa.
- Si un archivo se regenera desde scripts o CI, debe tratarse como generado aunque esté versionado.
- No duplicar decisiones arquitectónicas entre documentos generados y canónicos.
- Si un documento canónico cambia una regla, el tracker y el README correspondiente deben quedar alineados en la misma iteración.
- Las rutas internas de documentación deben ser relativas al repo. No agregar rutas absolutas locales ni URLs de archivo local.
- Las compatibilidades legacy de roles/auth/rules se documentan como protección de migración hasta que la app sea oficial; no deben crecer con consumidores nuevos.

## Decisión sobre `docs/api`

- Se mantiene versionado por ahora como referencia offline y para revisión local rápida.
- Se considera generado y de solo consulta.
- No debe editarse manualmente.
- Si en el futuro CI publica artefactos navegables externos, este directorio es candidato a salir del repositorio.

## Decisión sobre `reports`

- `reports/` se mantiene versionado mientras siga siendo parte del flujo local de gobernanza.
- Cada reporte es un snapshot generado, no un documento narrativo de arquitectura.
- Las decisiones activas deben resumirse en documentación canónica, no delegarse a un reporte.
