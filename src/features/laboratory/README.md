# Laboratory Module

Visor de exámenes de laboratorio del sistema Syslab (Hospital Hanga Roa).

## Arquitectura

```
features/laboratory/
├── public.ts                 # API pública — importar desde aquí
├── constants/labConstants.ts # Config clínica (grupos, exclusiones, orden, filtros)
├── controllers/
│   ├── labFormattingController.ts  # Puro: parsing, formateo, validación, utilidades compartidas
│   ├── labAnalyticsController.ts   # Puro: buildAnalysisData + helpers
│   └── labSummaryController.ts     # Puro: resumen con siglas clínicas para documentos
├── components/               # 12 componentes React (1 por archivo)
│   ├── LabResultsViewerModal.tsx
│   ├── LabViewerControls.tsx
│   ├── LabViewerExamList.tsx (con filtro por categoría)
│   ├── LabViewerAnalyzeBar.tsx
│   ├── LabViewerPdf.tsx
│   ├── LabViewerAnalysis.tsx
│   ├── LabViewerTrendCharts.tsx
│   ├── LabViewerComparisonTable.tsx
│   ├── LabExportConfigDialog.tsx
│   ├── LabViewerEmptyState.tsx
│   ├── LabViewerProgress.tsx
│   └── LabChartErrorBoundary.tsx
├── hooks/useLabViewer.ts     # Estado React + orquestación + TanStack Query cache
├── services/
│   ├── labExcelService.ts    # Exportación Excel
│   └── labFirestoreService.ts # Persistencia Firestore
└── types/labViewerTypes.ts   # Tipos internos UI
```

## Integración con otros módulos

### Documentos clínicos

Botón "Lab" en la toolbar del documento clínico (junto a PDF) que inserta
un resumen compacto de laboratorio con siglas clínicas:

```
Laboratorio (08/04/2026 14:00): Hb 13 HTO 40% RGB 7.000 PMN 70% Creat 1 ...
```

Archivos: `ClinicalDocumentLabInsertDialog.tsx`, `ClinicalDocumentFormattingToolbar.tsx`

## Flujo de datos

```
Syslab (10.4.69.90)
  ↓ Playwright scraping
Express proxy (localhost:3000)
  ↓ REST API (con timeout 30s + retry)
syslabService.ts
  ↓ TanStack Query cache (10 min staleTime)
useLabViewer hook
  ↓ Controllers puros para transformar
labAnalyticsController / labSummaryController
  ↓
Componentes UI + Firestore persistence (background)
```

## Uso desde otros módulos

```ts
import {
  LabResultsViewerModal,
  buildLabSummaryText,
  getLabResults,
  formatLabResult,
  parseLocalizedNumber,
  parseScientificValue,
} from '@/features/laboratory/public';
```

## Configuración

- `VITE_SYSLAB_API_URL` — URL del servidor Express proxy (default: `http://localhost:3000`)
- Requiere servidor Express de API-laboratorioHHR corriendo en la red del hospital

## Tests

```bash
npx vitest run src/tests/services/laboratory/ src/tests/hooks/laboratory/ src/tests/components/laboratory/ src/tests/features/laboratory/
```
