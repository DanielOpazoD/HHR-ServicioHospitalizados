# Decisiones Estables del Módulo

## Reglas de arquitectura

- `ClinicalDocumentSheet` no debe incorporar lógica especial nueva por `documentType` o `section.id`.
- Toda sección especializada debe registrarse en `domain/definitions.ts` y resolverse por renderer registrado.
- Toda compatibilidad legacy o migración de shape debe pasar por `clinicalDocumentCompatibilityController.ts`.
- Todo documento o template leído/persistido debe pasar por contratos runtime.

## Reglas de calidad

- Cambios en draft/sync/autosave deben entrar por reducer, use case o controlador puro; evitar lógica nueva repartida entre varios `useEffect`.
- Impresión y exportación deben entrar por servicios/use cases dedicados, no por acceso directo desde componentes.
- Si un cambio añade un nuevo tipo documental, también debe añadir:
  - definición
  - test de integridad del registry
  - test de compatibilidad si cambia `schemaVersion`

## Checklist de cambio seguro

1. ¿El documento/template nuevo pasa contratos runtime?
2. ¿La definición del `documentType` está registrada y validada?
3. ¿El flujo crítico `crear -> editar -> guardar -> firmar -> imprimir -> exportar` sigue cubierto?
4. ¿Se agregó test del caso nuevo en `clinical-documents`?
5. ¿La documentación del feature quedó actualizada?
