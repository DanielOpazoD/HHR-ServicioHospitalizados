/**
 * @module LabResultsViewerModalContent
 * @description Presentational sub-components for the laboratory exam viewer modal.
 *
 * Components:
 * - {@link LabViewerControls} — Patient selector + search button
 * - {@link LabViewerProgress} — Animated progress bar
 * - {@link LabViewerExamList} — Exam list with checkboxes + "Ver PDF" buttons
 * - {@link LabViewerAnalyzeBar} — Floating bar with "Analizar" button
 * - {@link LabViewerPdf} — Inline PDF viewer (iframe)
 * - {@link LabViewerAnalysis} — Analysis container with tabs
 * - {@link LabAnalysisSummaryTable} — Results grouped by section
 * - {@link LabAnalysisTrendCharts} — Trend line charts with reference bands
 * - {@link LabAnalysisComparisonTable} — Pivot table dates × variables
 * - {@link LabViewerEmptyState} — Placeholder before first search
 */

import React from 'react';
import clsx from 'clsx';
import {
  ArrowLeft,
  BarChart3,
  FileText,
  FlaskConical,
  Loader2,
  Search,
  TrendingUp,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceArea,
} from 'recharts';
import type {
  SyslabExamItem,
  LabPatient,
  LabAnalysisData,
  LabTrendPoint,
  LabTrendGroup,
  AnalysisViewTab,
} from '@/types/domain/laboratory';
import { buildSyslabPdfUrl } from '@/services/laboratory/syslabService';
import { isOutOfRange } from '@/hooks/laboratory/useLabViewer';

/* ================================================================== */
/*  Controls — patient selector + search button                        */
/* ================================================================== */

interface LabViewerControlsProps {
  uniquePatients: LabPatient[];
  selectedRut: string;
  isLoading: boolean;
  onPatientChange: (rut: string) => void;
  onSearch: () => void;
}

export const LabViewerControls: React.FC<LabViewerControlsProps> = ({
  uniquePatients,
  selectedRut,
  isLoading,
  onPatientChange,
  onSearch,
}) => (
  <div className="mb-4 space-y-2">
    <div className="flex items-center gap-2">
      <div className="flex flex-1 items-center gap-2">
        <label className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Paciente
        </label>
        <select
          value={selectedRut}
          onChange={e => onPatientChange(e.target.value)}
          className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-700 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-4 focus:ring-emerald-500/10"
        >
          {uniquePatients.map(patient => (
            <option key={patient.bedId} value={patient.rut}>
              {patient.label} ({patient.rut})
            </option>
          ))}
        </select>
      </div>
      <button
        onClick={onSearch}
        disabled={!selectedRut || isLoading}
        className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-b from-emerald-500 to-emerald-600 px-4 py-2 text-[13px] font-semibold text-white shadow-md shadow-emerald-600/25 transition-all hover:from-emerald-600 hover:to-emerald-700 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
      >
        {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
        Buscar
      </button>
    </div>
  </div>
);

/* ================================================================== */
/*  Progress bar                                                       */
/* ================================================================== */

interface LabViewerProgressProps {
  progress: { pct: number; text: string } | null;
}

export const LabViewerProgress: React.FC<LabViewerProgressProps> = ({ progress }) =>
  progress ? (
    <div className="mb-4">
      <div className="h-[3px] w-full overflow-hidden rounded-full bg-slate-200/80">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-[width] duration-500 ease-out"
          style={{ width: `${progress.pct}%` }}
        />
      </div>
      <p className="mt-1.5 text-center text-[11px] text-slate-400">{progress.text}</p>
    </div>
  ) : null;

/* ================================================================== */
/*  Exam list — cards with checkboxes + "Ver PDF" button               */
/* ================================================================== */

interface LabViewerExamListProps {
  exams: SyslabExamItem[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onViewPdf: (exam: SyslabExamItem) => void;
}

export const LabViewerExamList: React.FC<LabViewerExamListProps> = ({
  exams,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onViewPdf,
}) => {
  const selectableExams = exams.filter(e => e.link);
  const allSelected =
    selectableExams.length > 0 && selectableExams.every(e => selectedIds.has(e.id));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-400">
          {exams.length} exámenes encontrados
        </p>
        {selectableExams.length > 0 && (
          <button
            type="button"
            onClick={onSelectAll}
            className="text-[10px] font-medium text-emerald-600 hover:text-emerald-700"
          >
            {allSelected ? 'Deseleccionar todo' : 'Seleccionar todo'}
          </button>
        )}
      </div>

      <div className="space-y-1.5">
        {exams.map((exam, index) => {
          const isSelected = selectedIds.has(exam.id);
          return (
            <div
              key={`${exam.id}-${index}`}
              className={clsx(
                'flex items-center gap-3 rounded-xl border p-3 transition-all',
                isSelected
                  ? 'border-emerald-200 bg-emerald-50/50 ring-1 ring-emerald-200/50'
                  : 'border-slate-200/80 bg-white hover:shadow-sm'
              )}
            >
              {exam.link && (
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => onToggleSelect(exam.id)}
                  className="h-4 w-4 shrink-0 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500/20"
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold text-slate-700">{exam.date}</span>
                  {exam.time && <span className="text-[11px] text-slate-400">{exam.time}</span>}
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                    #{exam.id}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  {exam.exams.map((name, i) => (
                    <span
                      key={i}
                      className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 border border-emerald-100"
                    >
                      {name}
                    </span>
                  ))}
                </div>
              </div>
              {exam.link && (
                <button
                  type="button"
                  onClick={() => onViewPdf(exam)}
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-[11px] font-medium text-emerald-700 transition-colors hover:bg-emerald-50 hover:text-emerald-800"
                >
                  <FileText size={12} />
                  Ver PDF
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ================================================================== */
/*  Analyze bar — floating action when exams are selected              */
/* ================================================================== */

interface LabViewerAnalyzeBarProps {
  selectedCount: number;
  isAnalyzing: boolean;
  onAnalyze: () => void;
  onClear: () => void;
}

export const LabViewerAnalyzeBar: React.FC<LabViewerAnalyzeBarProps> = ({
  selectedCount,
  isAnalyzing,
  onAnalyze,
  onClear,
}) =>
  selectedCount > 0 ? (
    <div className="sticky bottom-0 z-10 -mx-5 -mb-4 mt-3 border-t border-emerald-200 bg-emerald-50/90 px-5 py-3 backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-medium text-emerald-700">
          {selectedCount} examen{selectedCount > 1 ? 'es' : ''} seleccionado
          {selectedCount > 1 ? 's' : ''}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClear}
            className="text-[11px] font-medium text-emerald-600 hover:text-emerald-700"
          >
            Limpiar
          </button>
          <button
            onClick={onAnalyze}
            disabled={isAnalyzing}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-b from-emerald-600 to-emerald-700 px-4 py-2 text-[12px] font-semibold text-white shadow-md shadow-emerald-700/25 transition-all hover:from-emerald-700 hover:to-emerald-800 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
          >
            {isAnalyzing ? <Loader2 size={14} className="animate-spin" /> : <BarChart3 size={14} />}
            Analizar ({selectedCount})
          </button>
        </div>
      </div>
    </div>
  ) : null;

/* ================================================================== */
/*  PDF viewer — inline iframe with loading overlay                    */
/* ================================================================== */

interface LabViewerPdfProps {
  exam: SyslabExamItem;
  onBack: () => void;
}

export const LabViewerPdf: React.FC<LabViewerPdfProps> = ({ exam, onBack }) => {
  const [isLoading, setIsLoading] = React.useState(true);
  const pdfUrl = exam.link ? `${buildSyslabPdfUrl(exam.link)}#navpanes=0&scrollbar=1&zoom=110` : '';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-[12px] font-medium text-emerald-600 hover:text-emerald-700"
        >
          <ArrowLeft size={14} />
          Volver a lista de exámenes
        </button>
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-semibold text-slate-600">
            {exam.date} {exam.time}
          </span>
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
            #{exam.id}
          </span>
        </div>
      </div>

      <div className="relative rounded-xl border border-slate-200/80 bg-white overflow-hidden">
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 z-10">
            <Loader2 size={24} className="animate-spin text-emerald-500 mb-2" />
            <p className="text-[12px] text-slate-400">Obteniendo PDF desde Syslab...</p>
            <p className="text-[10px] text-slate-300 mt-1">Esto puede tardar unos segundos</p>
          </div>
        )}
        <iframe
          src={pdfUrl}
          title={`PDF Examen ${exam.id}`}
          className="w-full border-0"
          style={{ height: '80vh' }}
          onLoad={() => setIsLoading(false)}
        />
      </div>
    </div>
  );
};

/* ================================================================== */
/*  Analysis view — container with tabs                                */
/* ================================================================== */

interface LabViewerAnalysisProps {
  data: LabAnalysisData;
  activeTab: AnalysisViewTab;
  onTabChange: (tab: AnalysisViewTab) => void;
  onBack: () => void;
}

const TAB_CONFIG: { key: AnalysisViewTab; label: string; icon: React.ReactNode }[] = [
  { key: 'trends', label: 'Tendencias', icon: <TrendingUp size={13} /> },
  { key: 'comparison', label: 'Comparación', icon: <BarChart3 size={13} /> },
];

export const LabViewerAnalysis: React.FC<LabViewerAnalysisProps> = ({
  data,
  activeTab,
  onTabChange,
  onBack,
}) => (
  <div className="space-y-4">
    <div className="flex items-center justify-between">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-[12px] font-medium text-emerald-600 hover:text-emerald-700"
      >
        <ArrowLeft size={14} />
        Volver a lista de exámenes
      </button>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        {data.examDates.length} exámenes analizados
      </span>
    </div>

    {/* Tabs */}
    <div className="flex items-center gap-1 border-b border-slate-200 pb-0">
      {TAB_CONFIG.map(tab => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onTabChange(tab.key)}
          className={clsx(
            'inline-flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold transition-all border-b-2 -mb-px',
            activeTab === tab.key
              ? 'border-emerald-500 text-emerald-700'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          )}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>

    {/* Tab content */}
    {activeTab === 'trends' && <LabAnalysisTrendCharts data={data} />}
    {activeTab === 'comparison' && <LabAnalysisComparisonTable data={data} />}
  </div>
);

/* ================================================================== */
/*  Trend charts — grouped by clinical category                        */
/* ================================================================== */

/** Color palette for multiple lines within a group. */
const LINE_COLORS = ['#10b981', '#0ea5e9', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const LabTrendTooltip: React.FC<{
  active?: boolean;
  payload?: Array<{ name: string; value: number; payload: LabTrendPoint }>;
}> = ({ active, payload }) => {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-lg">
      <p className="text-[11px] font-semibold text-slate-700 mb-1">{payload[0]?.payload?.date}</p>
      {payload.map((entry, i) => (
        <p key={i} className="text-[12px]" style={{ color: entry.name ? undefined : '#10b981' }}>
          <span className="font-bold">{entry.name}: </span>
          {entry.value} {entry.payload?.unit}
        </p>
      ))}
      {payload[0]?.payload?.refMin != null && payload[0]?.payload?.refMax != null && (
        <p className="text-[10px] text-slate-400 mt-1">
          Ref: {payload[0].payload.refMin} - {payload[0].payload.refMax}
        </p>
      )}
    </div>
  );
};

/**
 * Compute the representative magnitude of a variable (median of its max values).
 */
const varMagnitude = (points: LabTrendPoint[]): number => {
  const vals = points.map(p => Math.abs(p.value)).sort((a, b) => a - b);
  return vals[Math.floor(vals.length / 2)] || 0;
};

/** Ratio threshold: if largest / smallest magnitude > this, split into separate charts. */
const SCALE_SPLIT_RATIO = 4;

/**
 * Group variables by unit, then further split by scale when values differ
 * drastically (e.g., Fosfatasa Alcalina ~500 vs GOT/GPT ~15 in the same U/L group).
 * This prevents small-value lines from being squished at the bottom.
 */
const groupVariablesByScale = (
  variables: Record<string, LabTrendPoint[]>
): { unit: string; vars: Record<string, LabTrendPoint[]> }[] => {
  // Step 1: group by unit
  const byUnit: Record<string, Record<string, LabTrendPoint[]>> = {};
  for (const [name, points] of Object.entries(variables)) {
    const unit = (points[0]?.unit || '').toLowerCase().replace(/\s/g, '');
    if (!byUnit[unit]) byUnit[unit] = {};
    byUnit[unit][name] = points;
  }

  const result: { unit: string; vars: Record<string, LabTrendPoint[]> }[] = [];

  // Step 2: within each unit group, split by scale if needed
  for (const [, unitVars] of Object.entries(byUnit)) {
    const displayUnit = Object.values(unitVars)[0]?.[0]?.unit || '';
    const entries = Object.entries(unitVars);

    if (entries.length <= 1) {
      result.push({ unit: displayUnit, vars: Object.fromEntries(entries) });
      continue;
    }

    // Compute magnitude for each variable and sort
    const withMag = entries.map(([name, pts]) => ({ name, pts, mag: varMagnitude(pts) }));
    withMag.sort((a, b) => a.mag - b.mag);

    // Cluster: start a new cluster when the ratio to the cluster's min exceeds threshold
    const clusters: { name: string; pts: LabTrendPoint[] }[][] = [[]];
    let clusterMin = withMag[0].mag || 1;

    for (const item of withMag) {
      const ratio = (item.mag || 1) / (clusterMin || 1);
      if (ratio > SCALE_SPLIT_RATIO && clusters[clusters.length - 1].length > 0) {
        clusters.push([]);
        clusterMin = item.mag || 1;
      }
      clusters[clusters.length - 1].push(item);
      if (item.mag < clusterMin) clusterMin = item.mag;
    }

    for (const cluster of clusters) {
      const vars: Record<string, LabTrendPoint[]> = {};
      for (const { name, pts } of cluster) vars[name] = pts;
      result.push({ unit: displayUnit, vars });
    }
  }

  return result;
};

/** Sort date strings that start with DD/MM/YYYY. */
const sortByDate = (a: string, b: string): number => {
  const isoA = a.replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$3-$2-$1');
  const isoB = b.replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$3-$2-$1');
  return isoA.localeCompare(isoB);
};

/** Stroke dash patterns to visually distinguish overlapping lines. */
const DASH_PATTERNS = ['', '8 4', '4 4', '12 4 4 4', '2 4', '8 4 2 4'];

/** Staggered label vertical offsets so labels don't overlap when values are similar. */
const LABEL_OFFSETS = [
  { position: 'top' as const, dy: -10 },
  { position: 'bottom' as const, dy: 14 },
  { position: 'top' as const, dy: -22 },
  { position: 'bottom' as const, dy: 26 },
  { position: 'top' as const, dy: -34 },
  { position: 'bottom' as const, dy: 38 },
];

/** Custom label renderer that staggers positions to avoid overlap. */
const StaggeredLabel: React.FC<{
  x?: number;
  y?: number;
  value?: number;
  index?: number;
  color: string;
  labelConfig: { position: 'top' | 'bottom'; dy: number };
}> = ({ x, y, value, color, labelConfig }) => {
  if (x == null || y == null || value == null) return null;
  return (
    <text
      x={x}
      y={y + labelConfig.dy}
      textAnchor="middle"
      fill={color}
      fontSize={9}
      fontWeight={700}
    >
      {typeof value === 'number' ? (value % 1 === 0 ? value : value.toFixed(1)) : value}
    </text>
  );
};

/** A single sub-chart for variables sharing the same unit. */
const UnitSubChart: React.FC<{
  varEntries: Record<string, LabTrendPoint[]>;
  unit: string;
  colorOffset: number;
}> = ({ varEntries, unit, colorOffset }) => {
  const varNames = Object.keys(varEntries);

  const dateMap: Record<string, Record<string, number>> = {};
  let firstRef: { min?: number; max?: number } = {};

  for (const [name, points] of Object.entries(varEntries)) {
    for (const p of points) {
      if (!dateMap[p.date]) dateMap[p.date] = {};
      dateMap[p.date][name] = p.value;
      if (!firstRef.min && p.refMin != null) firstRef = { min: p.refMin, max: p.refMax };
    }
  }

  const chartData = Object.entries(dateMap)
    .map(([date, vals]) => ({ date, ...vals }))
    .sort((a, b) => sortByDate(a.date, b.date));

  const allVals: number[] = [];
  for (const points of Object.values(varEntries)) {
    for (const p of points) {
      allVals.push(p.value);
      if (p.refMin != null) allVals.push(p.refMin);
      if (p.refMax != null) allVals.push(p.refMax);
    }
  }
  const yMin = Math.floor(Math.min(...allVals) * 0.85);
  const yMax = Math.ceil(Math.max(...allVals) * 1.15);
  const hasRef = firstRef.min != null && firstRef.max != null;

  // Extra top/bottom margin for staggered labels
  const extraMargin = varNames.length > 2 ? 30 : 18;

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-3">
        {varNames.map((name, i) => {
          const ci = (i + colorOffset) % LINE_COLORS.length;
          const dash = DASH_PATTERNS[i % DASH_PATTERNS.length];
          return (
            <span key={name} className="inline-flex items-center gap-1.5 text-[10px] font-medium">
              <svg width="18" height="8">
                <line
                  x1="0"
                  y1="4"
                  x2="18"
                  y2="4"
                  stroke={LINE_COLORS[ci]}
                  strokeWidth={2.5}
                  strokeDasharray={dash || undefined}
                />
              </svg>
              <span style={{ color: LINE_COLORS[ci] }}>{name}</span>
              <span className="text-slate-400">({unit})</span>
            </span>
          );
        })}
      </div>
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: extraMargin, right: 25, left: 0, bottom: extraMargin }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 9, fill: '#64748b' }}
              tickLine={false}
              axisLine={{ stroke: '#e2e8f0' }}
            />
            <YAxis
              domain={[yMin, yMax]}
              tick={{ fontSize: 9, fill: '#64748b' }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<LabTrendTooltip />} />

            {hasRef && (
              <ReferenceArea
                y1={firstRef.min!}
                y2={firstRef.max!}
                fill="#10b981"
                fillOpacity={0.06}
                stroke="#10b981"
                strokeOpacity={0.15}
                strokeDasharray="3 3"
              />
            )}

            {varNames.map((name, i) => {
              const ci = (i + colorOffset) % LINE_COLORS.length;
              const dash = DASH_PATTERNS[i % DASH_PATTERNS.length];
              const labelCfg = LABEL_OFFSETS[i % LABEL_OFFSETS.length];
              const color = LINE_COLORS[ci];

              return (
                <Line
                  key={name}
                  name={name}
                  type="monotone"
                  dataKey={name}
                  stroke={color}
                  strokeWidth={2.5}
                  strokeDasharray={dash || undefined}
                  dot={{
                    r: 3 + (i % 2),
                    fill: color,
                    strokeWidth: 2,
                    stroke: '#fff',
                  }}
                  activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2 }}
                  label={<StaggeredLabel color={color} labelConfig={labelCfg} />}
                  connectNulls
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

/** Render a trend group card — splits into sub-charts per unit AND scale for readability. */
const TrendGroupCard: React.FC<{ group: LabTrendGroup }> = ({ group }) => {
  const unitGroups = groupVariablesByScale(group.variables);

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-4">
      <h4 className="mb-3 text-[13px] font-bold text-slate-700">{group.label}</h4>
      <div className="space-y-4">
        {unitGroups.map((ug, idx) => {
          // Offset colors so each sub-chart continues the palette
          const prevCount = unitGroups
            .slice(0, idx)
            .reduce((sum, g) => sum + Object.keys(g.vars).length, 0);
          return (
            <UnitSubChart
              key={ug.unit}
              varEntries={ug.vars}
              unit={ug.unit}
              colorOffset={prevCount}
            />
          );
        })}
      </div>
    </div>
  );
};

const LabAnalysisTrendCharts: React.FC<{ data: LabAnalysisData }> = ({ data }) => {
  if (data.trendGroups.length === 0) {
    return (
      <div className="py-8 text-center">
        <TrendingUp size={28} className="mx-auto mb-2 text-slate-200" />
        <p className="text-[12px] text-slate-400">
          Se necesitan al menos 2 exámenes con la misma variable para generar tendencias.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {data.trendGroups.map(group => (
        <TrendGroupCard key={group.label} group={group} />
      ))}
    </div>
  );
};

/* ================================================================== */
/*  Comparison table — dates as columns, variables as rows             */
/* ================================================================== */

const LabAnalysisComparisonTable: React.FC<{ data: LabAnalysisData }> = ({ data }) => {
  const variableNames = Object.keys(data.comparison);
  const { examDates } = data;

  if (variableNames.length === 0) {
    return (
      <p className="py-8 text-center text-[12px] text-slate-400">No hay datos para comparar.</p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200/80">
      <table className="w-full min-w-[600px]">
        <thead>
          <tr className="bg-slate-50">
            <th className="sticky left-0 z-10 bg-slate-50 px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-slate-500 border-r border-slate-200">
              Variable
            </th>
            {examDates.map(date => (
              <th
                key={date}
                className="px-4 py-2.5 text-center text-[10px] font-bold uppercase tracking-wide text-slate-500"
              >
                {date}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {variableNames.map((name, i) => (
            <tr
              key={name}
              className={clsx(
                'border-t border-slate-100 transition-colors hover:bg-slate-50/50',
                i % 2 === 1 && 'bg-slate-50/30'
              )}
            >
              <td className="sticky left-0 z-10 bg-white px-4 py-2 text-[11px] font-semibold text-slate-700 border-r border-slate-200">
                {name}
              </td>
              {examDates.map(date => {
                const row = data.comparison[name]?.[date];
                if (!row) {
                  return (
                    <td key={date} className="px-4 py-2 text-center text-[11px] text-slate-300">
                      —
                    </td>
                  );
                }
                const oor = isOutOfRange(row.result, row.refValue);
                return (
                  <td key={date} className="px-4 py-2 text-center">
                    <span
                      className={clsx(
                        'text-[12px] font-bold',
                        oor === true && 'text-red-600',
                        oor === false && 'text-emerald-600',
                        oor === null && 'text-slate-700'
                      )}
                    >
                      {row.result}
                    </span>
                    {row.unit && <span className="ml-1 text-[9px] text-slate-400">{row.unit}</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

/* ================================================================== */
/*  Empty state — shown before first search                            */
/* ================================================================== */

export const LabViewerEmptyState: React.FC = () => (
  <div className="flex flex-col items-center justify-center py-12 text-center">
    <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-300">
      <FlaskConical size={26} />
    </span>
    <p className="text-[13px] font-medium text-slate-400">Selecciona un paciente y busca</p>
    <p className="mt-0.5 text-[11px] text-slate-300">
      Los exámenes de laboratorio Syslab se mostrarán aquí
    </p>
  </div>
);
