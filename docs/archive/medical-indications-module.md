# Módulo de indicaciones médicas (paciente hospitalizado)

## Objetivo

Este módulo permite registrar indicaciones clínicas estructuradas por paciente, con capacidad de edición, ordenamiento y exportación a PDF de forma rápida desde el censo.

## Mejoras implementadas

- **Edición habilitada por defecto**: al abrir el modal, el ingreso y modificación de indicaciones queda activo de inmediato.
- **Formulario más claro**: el modal se hizo más angosto para mejorar legibilidad y foco visual.
- **Kinesiología + frecuencia en la misma fila**: ambas variables clínicas se presentan agrupadas para reducir desplazamiento y mantener coherencia semántica.
- **Iconografía sutil y consistente**:
  - Encabezado del bloque clínico con ícono contextual.
  - Campos de médico tratante, kinesiología y frecuencia con íconos discretos.
  - Acciones por indicación (editar/quitar) representadas con íconos y accesibilidad (`aria-label` y `title`).

## Criterios de estabilidad y escalabilidad

- Se mantuvo la lógica de estado local con operaciones puras sobre arrays para evitar mutaciones accidentales.
- Se preservó el contrato de salida hacia el servicio PDF para evitar regresiones funcionales.
- Se agregaron pruebas de interfaz para validar:
  1. estado de edición por defecto;
  2. visibilidad de acciones de edición/eliminación con iconografía.

## Pruebas recomendadas

- Ejecutar pruebas unitarias del componente de indicaciones rápidas.
- Ejecutar pruebas del flujo de censo para verificar integración con acciones por paciente.
