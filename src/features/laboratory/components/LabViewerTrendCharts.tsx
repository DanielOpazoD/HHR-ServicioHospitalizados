/**
 * @module LabViewerTrendCharts
 * @description Trend line charts grouped by clinical category with scale-aware sub-charts.
 */

import React from 'react';
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
import { Download, TrendingUp } from 'lucide-react';
import { LabChartErrorBoundary } from './LabChartErrorBoundary';
import type { LabAnalysisData, LabTrendPoint, LabTrendGroup } from '@/types/domain/laboratory';
import {
  LINE_COLORS,
  DASH_PATTERNS,
  LABEL_OFFSETS,
  SCALE_SPLIT_RATIO,
} from '../constants/labConstants';

/* ================================================================== */
/*  Helpers                                                            */
/* ================================================================== */

/**
 * Compute the representative magnitude of a variable (median of its max values).
 */
const varMagnitude = (points: LabTrendPoint[]): number => {
  const vals = points.map(p => Math.abs(p.value)).sort((a, b) => a - b);
  return vals[Math.floor(vals.length / 2)] || 0;
};

/** Cluster sorted items by magnitude ratio. Groups split when ratio exceeds threshold. */
const clusterByMagnitude = (
  sortedItems: { name: string; pts: LabTrendPoint[]; mag: number }[],
  ratio: number
): { name: string; pts: LabTrendPoint[] }[][] => {
  const clusters: { name: string; pts: LabTrendPoint[] }[][] = [[]];
  let clusterMin = sortedItems[0]?.mag || 1;
  for (const item of sortedItems) {
    const r = (item.mag || 1) / (clusterMin || 1);
    if (r > ratio && clusters[clusters.length - 1].length > 0) {
      clusters.push([]);
      clusterMin = item.mag || 1;
    }
    clusters[clusters.length - 1].push(item);
    if (item.mag < clusterMin) clusterMin = item.mag;
  }
  return clusters;
};

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

    const clusters = clusterByMagnitude(withMag, SCALE_SPLIT_RATIO);

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

/* ================================================================== */
/*  Sub-components                                                     */
/* ================================================================== */

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

/** Render a trend group card -- splits into sub-charts per unit AND scale for readability. */
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

/* ================================================================== */
/*  Main export                                                        */
/* ================================================================== */

/**
 * Export chart container as PNG using native SVG serialization + Canvas.
 * Avoids html2canvas dependency by cloning the container, inlining styles,
 * and rendering via foreignObject → Canvas → PNG.
 */
const exportChartsAsPng = async (container: HTMLDivElement) => {
  const clone = container.cloneNode(true) as HTMLDivElement;
  clone.style.background = '#ffffff';
  clone.style.padding = '16px';

  const width = container.offsetWidth * 2;
  const height = container.offsetHeight * 2;

  const svgNs = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNs, 'svg');
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));

  const foreignObject = document.createElementNS(svgNs, 'foreignObject');
  foreignObject.setAttribute('width', '100%');
  foreignObject.setAttribute('height', '100%');
  foreignObject.setAttribute('transform', 'scale(2)');
  foreignObject.appendChild(clone);
  svg.appendChild(foreignObject);

  const svgData = new XMLSerializer().serializeToString(svg);
  const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
  const svgUrl = URL.createObjectURL(svgBlob);

  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0);
    }
    URL.revokeObjectURL(svgUrl);
    const pngUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = pngUrl;
    a.download = `laboratorio_tendencias_${new Date().toISOString().substring(0, 10)}.png`;
    a.click();
  };
  img.src = svgUrl;
};

export const LabViewerTrendCharts: React.FC<{ data: LabAnalysisData }> = ({ data }) => {
  const chartsRef = React.useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = React.useState(false);

  if (data.trendGroups.length === 0) {
    return (
      <div className="py-8 text-center">
        <TrendingUp size={28} className="mx-auto mb-2 text-slate-200" />
        <p className="text-[12px] text-slate-400">
          Se necesitan al menos 2 examenes con la misma variable para generar tendencias.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button
          type="button"
          disabled={isExporting}
          onClick={async () => {
            if (!chartsRef.current) return;
            setIsExporting(true);
            try {
              await exportChartsAsPng(chartsRef.current);
            } finally {
              setIsExporting(false);
            }
          }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-[11px] font-medium text-emerald-700 transition-colors hover:bg-emerald-50 disabled:opacity-50"
        >
          <Download size={12} />
          {isExporting ? 'Exportando...' : 'Descargar PNG'}
        </button>
      </div>
      <div ref={chartsRef} className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {data.trendGroups.map(group => (
          <LabChartErrorBoundary key={group.label} chartLabel={group.label}>
            <TrendGroupCard group={group} />
          </LabChartErrorBoundary>
        ))}
      </div>
    </div>
  );
};
