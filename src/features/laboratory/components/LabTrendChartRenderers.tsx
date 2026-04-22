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
import type { LabTrendPoint } from '@/types/domain/labAnalyticsTypes';
import { sortByDate } from './LabTrendChartHelpers';
import { DASH_PATTERNS, LABEL_OFFSETS, LINE_COLORS } from '../constants/labChartConstants';

export const StaggeredLabel: React.FC<{
  x?: number;
  y?: number;
  value?: number;
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

export const LabTrendTooltip: React.FC<{
  active?: boolean;
  payload?: Array<{ name: string; value: number; payload: LabTrendPoint }>;
}> = ({ active, payload }) => {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-lg">
      <p className="mb-1 text-[11px] font-semibold text-slate-700">{payload[0]?.payload?.date}</p>
      {payload.map((entry, index) => (
        <p
          key={index}
          className="text-[12px]"
          style={{ color: entry.name ? undefined : '#10b981' }}
        >
          <span className="font-bold">{entry.name}: </span>
          {entry.value} {entry.payload?.unit}
        </p>
      ))}
      {payload[0]?.payload?.refMin != null && payload[0]?.payload?.refMax != null && (
        <p className="mt-1 text-[10px] text-slate-400">
          Ref: {payload[0].payload.refMin} - {payload[0].payload.refMax}
        </p>
      )}
    </div>
  );
};

export const UnitSubChart: React.FC<{
  varEntries: Record<string, LabTrendPoint[]>;
  unit: string;
  colorOffset: number;
}> = ({ varEntries, unit, colorOffset }) => {
  const varNames = Object.keys(varEntries);
  const dateMap: Record<string, Record<string, number>> = {};
  let firstRef: { min?: number; max?: number } = {};

  for (const [name, points] of Object.entries(varEntries)) {
    for (const point of points) {
      if (!dateMap[point.date]) dateMap[point.date] = {};
      dateMap[point.date][name] = point.value;
      if (!firstRef.min && point.refMin != null) {
        firstRef = { min: point.refMin, max: point.refMax };
      }
    }
  }

  const chartData = Object.entries(dateMap)
    .map(([date, vals]) => ({ date, ...vals }))
    .sort((a, b) => sortByDate(a.date, b.date));

  const allVals: number[] = [];
  for (const points of Object.values(varEntries)) {
    for (const point of points) {
      allVals.push(point.value);
      if (point.refMin != null) allVals.push(point.refMin);
      if (point.refMax != null) allVals.push(point.refMax);
    }
  }

  const yMin = Math.floor(Math.min(...allVals) * 0.85);
  const yMax = Math.ceil(Math.max(...allVals) * 1.15);
  const hasRef = firstRef.min != null && firstRef.max != null;
  const extraMargin = varNames.length > 2 ? 30 : 18;

  return (
    <div className="min-w-0">
      <div className="mb-2 flex flex-wrap gap-3">
        {varNames.map((name, index) => {
          const colorIndex = (index + colorOffset) % LINE_COLORS.length;
          const dash = DASH_PATTERNS[index % DASH_PATTERNS.length];

          return (
            <span key={name} className="inline-flex items-center gap-1.5 text-[10px] font-medium">
              <svg width="18" height="8">
                <line
                  x1="0"
                  y1="4"
                  x2="18"
                  y2="4"
                  stroke={LINE_COLORS[colorIndex]}
                  strokeWidth={2.5}
                  strokeDasharray={dash || undefined}
                />
              </svg>
              <span style={{ color: LINE_COLORS[colorIndex] }}>{name}</span>
              <span className="text-slate-400">({unit})</span>
            </span>
          );
        })}
      </div>
      <div className="h-52 min-w-0">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
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

            {varNames.map((name, index) => {
              const colorIndex = (index + colorOffset) % LINE_COLORS.length;
              const dash = DASH_PATTERNS[index % DASH_PATTERNS.length];
              const labelConfig = LABEL_OFFSETS[index % LABEL_OFFSETS.length];
              const color = LINE_COLORS[colorIndex];

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
                    r: 3 + (index % 2),
                    fill: color,
                    strokeWidth: 2,
                    stroke: '#fff',
                  }}
                  activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2 }}
                  label={<StaggeredLabel color={color} labelConfig={labelConfig} />}
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
