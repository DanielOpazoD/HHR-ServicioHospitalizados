/**
 * @module labConstants
 * @description Centralized clinical configuration for the laboratory module.
 *
 * All hardcoded clinical variable names, display groups, exclusions,
 * ordering, and visual constants are defined here. This makes it easy
 * to adjust when Syslab changes variable names or the hospital adds
 * new lab tests.
 */

import type { ProgressState } from '../types/labViewerTypes';

/* ================================================================== */
/*  Progress bar steps                                                 */
/* ================================================================== */

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

/* ================================================================== */
/*  Trend groups — related variables shown together in charts          */
/* ================================================================== */

export const TREND_GROUPS: { label: string; patterns: string[] }[] = [
  {
    label: 'Electrolitos',
    patterns: ['Sodio', 'Potasio', 'Cloro'],
  },
  {
    label: 'Función Renal',
    patterns: ['Creatinina', 'Nitrogeno Ureico', 'Uremia'],
  },
  {
    label: 'Perfil Hepático',
    patterns: [
      'ASAT',
      'ALAT',
      'GGT',
      'Fosfatasa Alcalina',
      'Bilirrubina Total',
      'Bilirrubina Directa',
    ],
  },
  {
    label: 'Actividad Inflamatoria',
    patterns: ['Recuento Leucocitos', 'Segmentados', 'Proteina C Reactiva', 'VHS'],
  },
  {
    label: 'Hemograma',
    patterns: ['Hemoglobina', 'Hematocrito', 'Recuento de Plaquetas'],
  },
  {
    label: 'Glicemia',
    patterns: ['Glicemia'],
  },
  {
    label: 'Gases',
    patterns: ['pH', 'pCO2', 'pO2', 'HCO3', 'Lactato'],
  },
  {
    label: 'Otros',
    patterns: ['Troponina', 'LDH', 'CK Total', 'Magnesio', 'Acido Urico', 'Albumina'],
  },
  {
    label: 'RPC / RAC',
    patterns: ['RPC', 'RAC'],
  },
];

/* ================================================================== */
/*  Comparison table configuration                                     */
/* ================================================================== */

/** Variables excluded from the comparison table (noise/redundant). */
export const COMPARISON_EXCLUDE: string[] = [
  'Razon A/G',
  'Raz',
  'CHCM',
  'Conc.Hb.Corp',
  'Baciliformes',
  'Mielocitos',
  'Juveniles',
  'Blastos',
  'Promielocitos',
  'sO2c',
  'CO2 TOTAL',
  'Hora',
  'Veloc. Filtr. Glomer',
  'Veloc Filtr',
  'Deseable',
  'Indice de riesgo',
  'Hemoglobina Glicosilada',
  'Glucosa promedio',
  'Normal',
  'Muy alto',
  'Recuento Hematies',
  'Basofilos',
  'Control',
  ', OT',
  'VLDL',
  'RDW',
  'Amilasa',
  'BEecf',
  'Globulinas',
  'N° de ingreso',
  'Nº de ingreso',
  'N° ingreso',
  'Nº ingreso',
  'No de ingreso',
  'Numero de ingreso',
  'MIDAS',
  'Tipo de muestra',
];

/** Preferred display order for comparison table variables (clinical priority). */
export const COMPARISON_ORDER: string[] = [
  // Hemograma
  'Recuento Leucocitos',
  'Hemoglobina',
  'Hematocrito',
  'VCM',
  'HCM',
  'Recuento de Plaquetas',
  // Fórmula diferencial
  'Segmentados',
  'Linfocitos',
  'Monocitos',
  'Eosinofilos',
  // PCR y VHS al final del bloque hemograma/inflamación
  'Proteina C Reactiva',
  'VHS',
  // Función renal + ELP
  'Creatinina',
  'RPC',
  'RAC',
  'Nitrogeno Ureico',
  'Uremia',
  'Sodio',
  'Potasio',
  'Cloro',
  'Cuerpos Cetónicos',
  'Proteínas',
  'Nitritos',
  'Densidad',
  'Leucocitos',
  'Eritrocitos',
  'Bacterias',
  'Cilindros',
  'Placas de pus',
  // Gases
  'pH',
  'pCO2',
  'pO2',
  'HCO3',
  'Lactato',
  // Minerales
  'Calcio',
  'Fosforo',
  'Magnesio',
  // Perfil hepático
  'ASAT/GOT',
  'ALAT/GPT',
  'GGT',
  'Fosfatasa Alcalina',
  'Bilirrubinas',
  // Otros
  'Lipasa',
  'Protrombina',
  'TTPK',
  'INR',
  'Albumina',
  'Proteinas Totales',
  'Troponina',
  'Dimero',
  'CK Total',
  'LDH',
  'TSH',
  'Acido Urico',
  'Glicemia',
  'Colesterol Total',
  'LDL',
  'HDL',
  'Trigliceridos',
  'Cuerpos Ceton',
  'Cetonemia',
];

/* ================================================================== */
/*  Exam list filter categories                                        */
/* ================================================================== */

/**
 * Maps exam name patterns to filter categories.
 * Used to group exams in the filter bar above the exam list.
 * Order matters — first match wins.
 */
export const EXAM_FILTER_CATEGORIES: { label: string; patterns: string[] }[] = [
  { label: 'Hemograma', patterns: ['HEMOGRAMA'] },
  {
    label: 'Bioquímica',
    patterns: ['BIOQUIMIC', 'PERFIL BIOQUIM', 'ALBUMINA', 'PROTEINA', 'GLICEMIA'],
  },
  { label: 'Electrolitos', patterns: ['ELECTROLITOS'] },
  { label: 'P. hepático', patterns: ['PERFIL HEPAT', 'HEPAT'] },
  { label: 'P. lipídico', patterns: ['LIPID', 'COLESTEROL'] },
  { label: 'Coagulación', patterns: ['PROTROMBINA', 'TTPK', 'INR', 'COAGUL'] },
  { label: 'Función Renal', patterns: ['CREA', 'UREMIA', 'VFG', 'BUN'] },
  {
    label: 'Cultivos',
    patterns: [
      'CULTIVO',
      'COPROCULTIVO',
      'UROCULTIVO',
      'HEMOCULTIVO',
      'ANTIBIOGRAMA',
      'MICROBIOLOG',
    ],
  },
  {
    label: 'PCR Virales',
    patterns: ['PCR PANEL', 'PANEL RESPIRATORIO', 'PANEL VIRAL', 'ARBOVIROSIS'],
  },
  { label: 'Orina', patterns: ['ORINA', 'SEDIMENTO'] },
];

/** Exam/finding patterns that should surface in the microbiology summary panel. */
export const MICROBIOLOGY_PATTERNS: string[] = [
  'CULTIVO',
  'COPROCULTIVO',
  'UROCULTIVO',
  'HEMOCULTIVO',
  'MICROBIOLOG',
  'ANTIBIOGRAMA',
  'PCR PANEL',
  'PANEL RESPIRATORIO',
  'ARBOVIROSIS',
  'DENGUE',
  'CHIKUNGUNYA',
  'ZIKA',
  'VIRUS',
  'INFLUENZA',
  'COVID',
  'SARS',
  'BACTER',
  'HONGO',
  'LEVADUR',
  'PARASITO',
];

/** Analysis name normalization rules (regex → replacement). */
export const ANALYSIS_NAME_REPLACEMENTS: [RegExp, string][] = [
  [/HCO3\s*ACTUAL/i, 'HCO3'],
  [/Hb\.\s*Corp\.\s*Media\s*-\s*HCM/i, 'HCM'],
  [/Vol\.\s*Corp\.\s*Medio\s*VCM/i, 'VCM'],
  [/^\s*Leucocitos(?:\s+totales)?\s*$/i, 'Recuento Leucocitos'],
  [/^\s*Rcto\.?\s*Leucocitos\s*$/i, 'Recuento Leucocitos'],
  [/^\s*Plaquetas\s*$/i, 'Recuento de Plaquetas'],
  [/^\s*Neutr[oó]filos(?:\s+segmentados)?\s*$/i, 'Segmentados'],
  [/^\s*Creatinina(?:\s+s[eé]rica)?\s*$/i, 'Creatinina'],
  [/^\s*PCR\s*$/i, 'Proteina C Reactiva'],
  [/^\s*Prot\.?\s*C\.?\s*Reactiva\s*$/i, 'Proteina C Reactiva'],
  [/^\s*(?:Rel(?:aci[oó]n|ac\.?|\.?)\s*)?Proteinuria\s*\/\s*Creatininuria\s*[:=]?\s*$/i, 'RPC'],
  [
    /^\s*(?:Rel(?:aci[oó]n|ac\.?|\.?)\s*)?Albumina\s*\/\s*Creatin(?:in)?uri[a]?\s*[:=]?\s*$/i,
    'RAC',
  ],
  [/^\s*Bilirrubina\s+T\.?\s*$/i, 'Bilirrubina Total'],
  [/^\s*Bilirrubina\s+D\.?\s*$/i, 'Bilirrubina Directa'],
  [/^\s*Bilirrubina\s+I\.?\s*$/i, 'Bilirrubina Indirecta'],
];

/* ================================================================== */
/*  Chart visual constants                                             */
/* ================================================================== */

/** Color palette for multiple lines within a trend group. */
export const LINE_COLORS = ['#10b981', '#0ea5e9', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

/** Stroke dash patterns to visually distinguish overlapping lines. */
export const DASH_PATTERNS = ['', '8 4', '4 4', '12 4 4 4', '2 4', '8 4 2 4'];

/** Staggered label vertical offsets so labels don't overlap when values are similar. */
export const LABEL_OFFSETS = [
  { position: 'top' as const, dy: -10 },
  { position: 'bottom' as const, dy: 14 },
  { position: 'top' as const, dy: -22 },
  { position: 'bottom' as const, dy: 26 },
  { position: 'top' as const, dy: -34 },
  { position: 'bottom' as const, dy: 38 },
];

/** Ratio threshold for splitting variables into separate sub-charts when scales differ. */
export const SCALE_SPLIT_RATIO = 4;
