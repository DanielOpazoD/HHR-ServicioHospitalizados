# Laboratory Module

Visor de exámenes de laboratorio del sistema Syslab (Hospital Hanga Roa).

## Arquitectura

```
features/laboratory/
├── public.ts                 # API pública — importar desde aquí
├── constants/labConstants.ts # Config clínica (grupos, exclusiones, orden)
├── controllers/
│   ├── labFormattingController.ts  # Puro: parsing, formateo, validación
│   └── labAnalyticsController.ts   # Puro: buildAnalysisData + helpers
├── components/               # 10 componentes React (1 por archivo)
├── hooks/useLabViewer.ts     # Estado React + orquestación
├── services/labExcelService.ts # Exportación Excel
└── types/labViewerTypes.ts   # Tipos internos UI
```

## Flujo de datos

```
Syslab (10.4.69.90)
  ↓ Playwright scraping
Express proxy (localhost:3000)
  ↓ REST API
syslabService.ts (fetch con timeout + retry)
  ↓
useLabViewer hook (estado)
  ↓ llama controllers para transformar
labAnalyticsController (buildAnalysisData)
  ↓
Componentes (tendencias, comparación, PDF, Excel)
```

## Uso desde otros módulos

```ts
import {
  LabResultsViewerModal,
  formatLabResult,
  buildAnalysisData,
} from '@/features/laboratory/public';
```

## Configuración

- `VITE_SYSLAB_API_URL` — URL del servidor Express proxy (default: `http://localhost:3000`)
- Requiere servidor Express de API-laboratorioHHR corriendo en la red del hospital

## Tests

```bash
npx vitest run src/tests/services/laboratory/ src/tests/hooks/laboratory/ src/tests/components/laboratory/ src/tests/features/laboratory/
```

109 tests: service (17), hook (31), component (12), formatting controller (27), analytics controller (17), constants validation (5).
