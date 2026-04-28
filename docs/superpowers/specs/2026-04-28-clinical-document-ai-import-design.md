# Clinical Document AI Import Design

Fecha: `2026-04-28`
Estado: `aprobado para plan de implementación`
Scope: `src/features/clinical-documents`, `netlify/functions`

## Objetivo

Crear un submódulo inicial de importación asistida por IA para convertir informes clínicos de traslado en una `epicrisis_traslado` editable dentro de Documentos Clínicos.

El MVP debe permitir adjuntar un archivo `.pdf` o `.docx`, extraer texto localmente, transformar ese texto con IA a un JSON clínico simplificado y dejar que el usuario revise/corrija antes de crear el documento visible en el workspace.

## Decisiones aprobadas

- La integración será un flujo guiado dentro del workspace de Documentos Clínicos.
- El destino inicial será específicamente `epicrisis_traslado`.
- La revisión previa usará JSON clínico simplificado, no el `ClinicalDocumentRecord` técnico completo.
- La IA solo debe ordenar y transformar contenido explícito; no debe inferir datos clínicos ausentes.
- El campo final se llamará `planEgreso` y debe orientar la continuidad del manejo en el centro receptor cuando el texto fuente lo exprese o corresponda al informe de traslado.
- El archivo completo no se enviará al backend en el MVP; se enviará solo texto plano extraído localmente.

## No objetivos

- No implementar OCR para PDFs escaneados.
- No guardar documentos sin revisión humana.
- No crear un editor paralelo de documentos clínicos.
- No permitir que la IA firme, bloquee o publique documentos.
- No transformar documentos a otros formatos en esta primera fase.
- No persistir archivos fuente ni textos extraídos completos en Firestore/Drive.
- No exponer claves IA en frontend.

## Flujo funcional

1. El usuario abre Documentos Clínicos y selecciona `Importar con IA`.
2. El flujo muestra que el caso soportado es `Informe de traslado -> Epicrisis traslado`.
3. El usuario adjunta un `.pdf` o `.docx`.
4. El navegador extrae texto del archivo:
   - PDF textual: extracción con `pdfjs-dist`, reutilizando el patrón existente de LAB si aplica.
   - DOCX: extracción lazy-loaded con una librería enfocada en texto, por ejemplo `mammoth`, para no cargarla en el bundle principal.
5. Si la extracción produce texto suficiente, la app envía solo ese texto a una Netlify Function autenticada.
6. La Function usa el provider IA ya existente (`netlify/functions/lib/ai-provider.ts`) y responde con JSON clínico simplificado.
7. La UI muestra el JSON editable en una pantalla de revisión.
8. El usuario corrige campos si es necesario.
9. La app valida el JSON simplificado.
10. Al confirmar, la app crea una nueva `epicrisis_traslado` usando las definiciones y contratos actuales del módulo.

## Contrato JSON simplificado

```json
{
  "antecedentes": "",
  "historiaEvolucionClinica": "",
  "examenesComplementarios": "",
  "diagnosticosEgreso": "",
  "planEgreso": ""
}
```

Reglas:

- Todos los campos son strings.
- Los campos sin información explícita deben quedar vacíos o con texto breve de revisión, nunca inventados.
- `planEgreso` debe incluir indicaciones terapéuticas, continuidad de manejo y destino/recomendaciones para el centro receptor cuando estén en el texto fuente.
- El JSON simplificado se convierte internamente a secciones del documento, respetando el contrato vigente de `ClinicalDocumentRecord`.

## Prompt IA

La Function debe construir un prompt estricto:

- actuar como transformador de formato, no como médico que diagnostica
- usar solo contenido explícito del texto fuente
- no agregar diagnósticos, exámenes, tratamientos ni evolución no mencionados
- devolver JSON válido sin Markdown
- mantener español clínico sobrio
- preservar negaciones, fechas, dosis y nombres propios cuando estén presentes
- si un dato es ambiguo, dejarlo en la sección más probable solo si aparece textual; si no, omitirlo
- priorizar `planEgreso` como continuidad de tratamiento y manejo en el centro receptor para informes de traslado

## Arquitectura

### UI

Agregar un flujo contenido dentro de `clinical-documents`, idealmente como componentes propios del submódulo:

- selector de archivo
- estado de extracción
- preview de texto extraído resumido o truncado
- revisión JSON editable
- acciones: `Transformar`, `Reintentar`, `Crear epicrisis traslado`, `Cancelar`

La UI debe ser visible y explícita en sus estados. Si la transformación se ejecuta, el botón y el panel deben cambiar de estado claramente.

### Controladores

Agregar lógica pura para:

- validar tipo/tamaño de archivo
- normalizar resultado de extracción
- validar el JSON simplificado
- mapear JSON simplificado a secciones de `epicrisis_traslado`
- construir mensajes de error recuperables

La hoja principal no debe incorporar `if` especiales por IA. El flujo debe integrarse por acciones del workspace y por las definiciones existentes.

### Servicios frontend

Agregar servicios lazy-loaded para:

- extraer texto de PDF
- extraer texto de DOCX
- llamar a la Function de transformación con token de usuario

Los parsers de archivo deben vivir fuera del render y devolver outcomes tipados.

### Netlify Function

Crear una Function específica, por ejemplo `clinical-document-ai-import.ts`, en vez de extender `clinical-ai-summary.ts`.

Razones:

- el caso de uso no resume contexto desde Firestore
- recibe texto extraído, no `recordDate`/`bedId`
- necesita prompt, rate limit y contrato propios
- reduce riesgo de mezclar objetivos clínicos distintos

La Function debe:

- validar origen
- aceptar solo `POST`
- exigir `Authorization: Bearer`
- autorizar roles clínicos equivalentes al endpoint de resumen clínico
- aplicar rate limit
- validar tamaño máximo de texto
- usar `resolveClinicalAIProviderConfig`
- responder `available: false` si no hay IA configurada
- devolver errores user-safe

## Mapeo a documento clínico

El JSON simplificado se mapeará a secciones:

- `antecedentes` -> `Antecedentes`
- `historiaEvolucionClinica` -> `Historia y evolución clínica`
- `examenesComplementarios` -> `Exámenes complementarios`
- `diagnosticosEgreso` -> `Diagnósticos de egreso`
- `planEgreso` -> `Plan de egreso`

El documento resultante debe:

- tener `documentType: 'epicrisis_traslado'`
- nacer como borrador editable
- pasar por hidratación/serialización/validación runtime vigente
- no marcarse firmado ni bloqueado
- preservar actor/auditoría de creación según el workspace actual

## Errores y degradación

Estados esperados:

- tipo de archivo no soportado
- archivo demasiado grande
- PDF escaneado o sin texto extraíble
- DOCX ilegible
- texto extraído demasiado corto
- IA no configurada
- timeout o error del provider IA
- respuesta IA no parseable como JSON válido
- JSON válido pero incompleto

Cada error debe mostrarse como estado recuperable con acción clara. Ningún fallo de IA debe romper el workspace ni modificar el documento activo.

## Seguridad y privacidad

- El archivo fuente se queda en el navegador durante el MVP.
- A backend se envía solo texto extraído.
- No se guarda texto fuente completo por defecto.
- No se registran prompts completos ni contenido clínico en logs.
- La Function debe usar telemetría con metadatos no sensibles: provider, modelo, tamaño aproximado y outcome.
- El usuario debe revisar antes de guardar.

## Tests y validación

Tests unitarios:

- validación de archivo
- validación de JSON simplificado
- mapeo JSON -> secciones de `epicrisis_traslado`
- prompt builder con regla anti-inferencia
- Function con auth, roles, rate limit, IA no configurada, respuesta válida e inválida

Tests UI:

- subir archivo válido
- mostrar estado de extracción
- mostrar JSON editable
- bloquear creación si JSON inválido
- crear borrador `epicrisis_traslado` tras confirmación
- mostrar error recuperable si IA falla

Checks recomendados:

- `npm run test:clinical-documents`
- `npm run check:clinical-documents`
- `npm run test:risk:platform`
- `npm run check:serverless-runtime-governance`
- `npm run typecheck`
- `npm run lint -- --max-warnings 0`

## Riesgos

1. La IA puede devolver JSON aparentemente correcto pero clínicamente incompleto.
2. PDFs escaneados pueden parecer válidos pero no entregar texto.
3. DOCX con tablas complejas puede perder estructura durante extracción.
4. El JSON editable puede ser intimidante si se muestra como bloque técnico.
5. Enviar texto extraído sigue siendo sensible; el endpoint debe evitar logs con contenido clínico.

## Criterio de aceptación

El MVP queda aceptado cuando un usuario puede tomar un informe textual de traslado en PDF/DOCX, transformarlo a JSON clínico simplificado, editarlo, y crear una nueva `epicrisis_traslado` visible y editable en Documentos Clínicos sin inferencias clínicas automáticas ni guardado silencioso.
