/**
 * @module LabViewerComparisonTable
 * @description Comparison table with dates as columns and lab variables as rows.
 * Uses @tanstack/react-virtual for row virtualization when >20 rows.
 */

import React from 'react';
import clsx from 'clsx';
import { FileText, Search } from 'lucide-react';
import type { LabAnalysisData, LabPatient } from '@/types/domain/laboratory';
import type { ExportConfig } from '../types/labViewerTypes';
import { isOutOfRange, formatLabResult } from '../controllers/labFormattingController';
import { LabExportConfigDialog } from './LabExportConfigDialog';

const loadLabExcelExporter = async () =>
  import('../services/labExcelService').then(module => module.exportComparisonToExcel);

type ComparisonSectionLabel = 'RPC / RAC' | null;

const getComparisonSectionLabel = (name: string, data: LabAnalysisData): ComparisonSectionLabel => {
  if (name === 'RPC' || name === 'RAC') {
    return 'RPC / RAC';
  }

  return null;
};

const COMPARISON_SECTION_ORDER: Record<Exclude<ComparisonSectionLabel, null>, number> = {
  'RPC / RAC': 0,
};

const ComparisonRow: React.FC<{
  name: string;
  examDates: string[];
  data: LabAnalysisData;
  index: number;
}> = ({ name, examDates, data, index }) => (
  <tr
    className={clsx(
      'border-t border-slate-100 hover:bg-slate-50/50',
      index % 2 === 1 && 'bg-slate-50/30'
    )}
  >
    <td className="sticky left-0 z-10 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-700 border-r border-slate-200 whitespace-nowrap">
      {name}
    </td>
    {examDates.map(date => {
      const row = data.comparison[name]?.[date];
      if (!row) {
        return (
          <td key={date} className="px-1 py-0.5 text-center text-[10px] text-slate-300">
            --
          </td>
        );
      }
      if (row.qualitative) {
        const isPositive = /positivo|reactivo/i.test(row.result);
        return (
          <td key={date} className="px-1 py-0.5 text-center whitespace-nowrap">
            <span
              className={clsx(
                'text-[10px] font-semibold',
                isPositive ? 'text-red-600' : 'text-emerald-600'
              )}
            >
              {row.result.length > 20 ? row.result.substring(0, 20) + '…' : row.result}
            </span>
          </td>
        );
      }
      const oor = isOutOfRange(row.result, row.refValue);
      const { display } = formatLabResult(row.result, row.unit);
      return (
        <td key={date} className="px-1 py-0.5 text-center whitespace-nowrap">
          <span
            className={clsx(
              'text-[11px] font-bold',
              oor === true && 'text-red-600',
              oor === false && 'text-emerald-600',
              oor === null && 'text-slate-700'
            )}
          >
            {display}
          </span>
        </td>
      );
    })}
  </tr>
);

export const LabViewerComparisonTable: React.FC<{
  data: LabAnalysisData;
  patient: LabPatient | null;
}> = ({ data, patient }) => {
  const allVariableNames = Object.keys(data.comparison);
  const { examDates } = data;
  const [showExportConfig, setShowExportConfig] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');

  const variableNames = searchQuery
    ? allVariableNames.filter(n => n.toLowerCase().includes(searchQuery.toLowerCase()))
    : allVariableNames;
  const orderedVariableNames = [...variableNames].sort((a, b) => {
    const sectionA = getComparisonSectionLabel(a, data);
    const sectionB = getComparisonSectionLabel(b, data);
    const orderA = sectionA ? COMPARISON_SECTION_ORDER[sectionA] : Number.MAX_SAFE_INTEGER;
    const orderB = sectionB ? COMPARISON_SECTION_ORDER[sectionB] : Number.MAX_SAFE_INTEGER;

    if (orderA !== orderB) {
      return orderA - orderB;
    }

    return allVariableNames.indexOf(a) - allVariableNames.indexOf(b);
  });

  if (allVariableNames.length === 0) {
    return (
      <p className="py-8 text-center text-[12px] text-slate-400">No hay datos para comparar.</p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-600">
            Comparación
          </p>
          <h3 className="mt-1 text-[16px] font-bold text-slate-800">Tabla resumida por fechas</h3>
          <p className="mt-1 text-[12px] text-slate-500">Visualiza cambios por variable.</p>
        </div>
      </div>

      {/* Search + Export */}
      <div className="flex items-center justify-between gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Buscar variable..."
            className="w-full rounded-lg border border-slate-200 bg-white py-1 pl-7 pr-2 text-[11px] text-slate-700 placeholder:text-slate-300 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/10"
          />
        </div>
        <button
          type="button"
          onClick={() => setShowExportConfig(prev => !prev)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-[11px] font-medium text-emerald-700 transition-colors hover:bg-emerald-50"
        >
          <FileText size={12} />
          Exportar Excel
        </button>
      </div>

      {/* Export config dialog */}
      {showExportConfig && (
        <LabExportConfigDialog
          dates={examDates}
          variables={variableNames}
          onExport={async (config: ExportConfig) => {
            const exportComparisonToExcel = await loadLabExcelExporter();
            await exportComparisonToExcel(data, config, patient);
            setShowExportConfig(false);
          }}
          onCancel={() => setShowExportConfig(false)}
        />
      )}

      {/* Table — virtualized when >20 rows */}
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <table className="w-full border-collapse table-fixed">
          <colgroup>
            <col style={{ width: '140px', minWidth: '140px' }} />
            {examDates.map(date => (
              <col key={date} style={{ minWidth: '72px' }} />
            ))}
          </colgroup>
          <thead className="sticky top-0 z-20">
            <tr className="bg-slate-50">
              <th className="sticky left-0 z-30 bg-slate-50 px-2 py-1 text-left text-[9px] font-bold uppercase text-slate-500 border-r border-slate-200 whitespace-nowrap">
                Variable
              </th>
              {examDates.map(date => (
                <th
                  key={date}
                  className="px-1 py-1 text-center text-[8px] font-bold text-slate-500 whitespace-nowrap"
                >
                  {date}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orderedVariableNames.map((name, i) => {
              const sectionLabel = getComparisonSectionLabel(name, data);
              const previousName = orderedVariableNames[i - 1];
              const previousSectionLabel = previousName
                ? getComparisonSectionLabel(previousName, data)
                : null;
              const shouldRenderSectionHeader =
                sectionLabel && sectionLabel !== previousSectionLabel;

              return (
                <React.Fragment key={name}>
                  {shouldRenderSectionHeader ? (
                    <tr className="border-t border-emerald-100 bg-emerald-50/60">
                      <td
                        colSpan={examDates.length + 1}
                        className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-700"
                      >
                        {sectionLabel}
                      </td>
                    </tr>
                  ) : null}
                  <ComparisonRow name={name} examDates={examDates} data={data} index={i} />
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
