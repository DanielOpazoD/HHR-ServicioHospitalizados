import type { ProgressState } from '../types/labViewerTypes';

export const SEARCH_STEPS: ProgressState[] = [
  { pct: 10, text: 'Conectando con servidor de laboratorio...' },
  { pct: 30, text: 'Iniciando sesión en Syslab...' },
  { pct: 50, text: 'Buscando exámenes del paciente...' },
  { pct: 70, text: 'Extrayendo lista de órdenes...' },
  { pct: 85, text: 'Procesando resultados...' },
];

export const ANALYSIS_STEPS: ProgressState[] = [
  { pct: 10, text: 'Conectando con Syslab...' },
  { pct: 25, text: 'Abriendo informes PDF...' },
  { pct: 45, text: 'Extrayendo datos de laboratorio...' },
  { pct: 65, text: 'Parseando resultados numéricos...' },
  { pct: 80, text: 'Construyendo tablas y tendencias...' },
  { pct: 90, text: 'Finalizando análisis...' },
];

export const STEP_INTERVAL_MS = 2500;
