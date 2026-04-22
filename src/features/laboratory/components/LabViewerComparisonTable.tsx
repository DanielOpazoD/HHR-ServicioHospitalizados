/**
 * @module LabViewerComparisonTable
 * @description Comparison table with dates as columns and lab variables as rows.
 * Adds clinical grouping, lightweight local pinning and quieter visual emphasis.
 */

import React from 'react';
import clsx from 'clsx';
import { ChevronDown, ChevronRight, FileText, Pin, Search } from 'lucide-react';
import type { LabAnalysisData, LabPatient } from '@/types/domain/laboratory';
import type { ExportConfig } from '../types/labViewerTypes';
import {
  COMPARISON_DISPLAY_GROUPS,
  COMPARISON_PINNABLE_VARIABLES,
} from '../constants/labConstants';
import { isOutOfRange, formatLabResult } from '../controllers/labFormattingController';
import { LabExportConfigDialog } from './LabExportConfigDialog';

const loadLabExcelExporter = async () =>
  import('../services/labExcelService').then(module => module.exportComparisonToExcel);

type ComparisonGroupLabel =
  | 'Hemograma'
  | 'Inflamación'
  | 'Función renal / electrolitos'
  | 'Coagulación'
  | 'Perfil hepático'
  | 'RPC / RAC'
  | 'Metabólico'
  | 'Otros';

interface ComparisonGroup {
  label: ComparisonGroupLabel;
  rows: string[];
}

const GROUP_ORDER: ComparisonGroupLabel[] = [
  'Hemograma',
  'Inflamación',
  'Función renal / electrolitos',
  'Coagulación',
  'Perfil hepático',
  'RPC / RAC',
  'Metabólico',
  'Otros',
];

const getComparisonGroupLabel = (name: string): ComparisonGroupLabel => {
  for (const group of COMPARISON_DISPLAY_GROUPS) {
    if (group.patterns.some(pattern => name.toLowerCase().includes(pattern.toLowerCase()))) {
      return group.label as ComparisonGroupLabel;
    }
  }

  return 'Otros';
};

const buildComparisonGroups = (
  variableNames: string[],
  allVariableNames: string[],
  pinnedVariables: Set<string>
): ComparisonGroup[] => {
  const groupsMap = new Map<ComparisonGroupLabel, string[]>();

  for (const name of variableNames) {
    const groupLabel = getComparisonGroupLabel(name);
    const groupRows = groupsMap.get(groupLabel) || [];
    groupRows.push(name);
    groupsMap.set(groupLabel, groupRows);
  }

  return GROUP_ORDER.map(label => {
    const rows = groupsMap.get(label) || [];
    const orderedRows = [...rows].sort((a, b) => {
      const aPinned = pinnedVariables.has(a);
      const bPinned = pinnedVariables.has(b);
      if (aPinned !== bPinned) {
        return aPinned ? -1 : 1;
      }

      return allVariableNames.indexOf(a) - allVariableNames.indexOf(b);
    });

    return { label, rows: orderedRows };
  }).filter(group => group.rows.length > 0);
};

const ComparisonRow: React.FC<{
  name: string;
  examDates: string[];
  data: LabAnalysisData;
  index: number;
  isPinned: boolean;
  canPin: boolean;
  onTogglePin: (name: string) => void;
}> = ({ name, examDates, data, index, isPinned, canPin, onTogglePin }) => (
  <tr
    className={clsx(
      'border-t border-slate-100 hover:bg-slate-50/60',
      index % 2 === 1 && 'bg-slate-50/20'
    )}
  >
    <td className="sticky left-0 z-10 border-r border-slate-200 bg-white px-2 py-1.5 text-[10px] text-slate-700">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate font-semibold">{name}</span>
        {canPin ? (
          <button
            type="button"
            onClick={() => onTogglePin(name)}
            title={isPinned ? `Desanclar ${name}` : `Anclar ${name}`}
            className={clsx(
              'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors',
              isPinned
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-slate-200 bg-white text-slate-400 hover:border-slate-300 hover:text-slate-600'
            )}
          >
            <Pin size={11} className={clsx(isPinned && 'fill-current')} />
          </button>
        ) : null}
      </div>
    </td>
    {examDates.map(date => {
      const row = data.comparison[name]?.[date];
      if (!row) {
        return (
          <td key={date} className="px-1 py-1.5 text-center text-[10px] text-slate-300">
            --
          </td>
        );
      }

      if (row.qualitative) {
        const hasAlert = /positivo|reactivo|detectado|aislado|presente/i.test(row.result);
        return (
          <td key={date} className="px-1 py-1.5 text-center whitespace-nowrap">
            <span
              className={clsx(
                'text-[10px] font-semibold',
                hasAlert ? 'text-red-600' : 'text-slate-700'
              )}
            >
              {row.result.length > 20 ? `${row.result.substring(0, 20)}…` : row.result}
            </span>
          </td>
        );
      }

      const oor = isOutOfRange(row.result, row.refValue);
      const { display } = formatLabResult(row.result, row.unit);
      return (
        <td key={date} className="px-1 py-1.5 text-center whitespace-nowrap">
          <span
            className={clsx(
              'text-[11px] font-semibold',
              oor === true ? 'text-red-600' : 'text-slate-700'
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
  const [collapsedGroups, setCollapsedGroups] = React.useState<Set<ComparisonGroupLabel>>(
    new Set()
  );
  const [pinnedVariables, setPinnedVariables] = React.useState<Set<string>>(
    () => new Set(COMPARISON_PINNABLE_VARIABLES.filter(name => allVariableNames.includes(name)))
  );

  const variableNames = React.useMemo(
    () =>
      searchQuery
        ? allVariableNames.filter(n => n.toLowerCase().includes(searchQuery.toLowerCase()))
        : allVariableNames,
    [allVariableNames, searchQuery]
  );

  const comparisonGroups = React.useMemo(
    () => buildComparisonGroups(variableNames, allVariableNames, pinnedVariables),
    [variableNames, allVariableNames, pinnedVariables]
  );

  const toggleGroup = (label: ComparisonGroupLabel) => {
    setCollapsedGroups(current => {
      const next = new Set(current);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  };

  const togglePin = (name: string) => {
    setPinnedVariables(current => {
      const next = new Set(current);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

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
          <p className="mt-1 text-[12px] text-slate-500">
            Visualiza cambios por variable con bloques clínicos más legibles.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="relative max-w-sm flex-1">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Buscar variable..."
            className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-7 pr-2 text-[11px] text-slate-700 placeholder:text-slate-300 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/10"
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

      {showExportConfig ? (
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
      ) : null}

      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <table className="w-full border-collapse table-fixed">
          <colgroup>
            <col style={{ width: '180px', minWidth: '180px' }} />
            {examDates.map(date => (
              <col key={date} style={{ minWidth: '78px' }} />
            ))}
          </colgroup>
          <thead className="sticky top-0 z-20">
            <tr className="bg-slate-50">
              <th className="sticky left-0 z-30 border-r border-slate-200 bg-slate-50 px-2 py-1.5 text-left text-[9px] font-bold uppercase text-slate-500 whitespace-nowrap">
                Variable
              </th>
              {examDates.map(date => (
                <th
                  key={date}
                  className="px-1 py-1.5 text-center text-[8px] font-bold text-slate-500 whitespace-nowrap"
                >
                  {date}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {comparisonGroups.map(group => {
              const isCollapsed = collapsedGroups.has(group.label);
              return (
                <React.Fragment key={group.label}>
                  <tr className="border-t border-slate-200 bg-slate-50/80">
                    <td colSpan={examDates.length + 1} className="px-2 py-1.5">
                      <button
                        type="button"
                        onClick={() => toggleGroup(group.label)}
                        className="flex w-full items-center justify-between gap-3 text-left"
                      >
                        <span className="inline-flex items-center gap-2">
                          {isCollapsed ? (
                            <ChevronRight size={13} className="text-slate-400" />
                          ) : (
                            <ChevronDown size={13} className="text-slate-400" />
                          )}
                          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-700">
                            {group.label}
                          </span>
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {group.rows.length} variable{group.rows.length === 1 ? '' : 's'}
                        </span>
                      </button>
                    </td>
                  </tr>
                  {!isCollapsed
                    ? group.rows.map((name, index) => (
                        <ComparisonRow
                          key={`${group.label}-${name}`}
                          name={name}
                          examDates={examDates}
                          data={data}
                          index={index}
                          isPinned={pinnedVariables.has(name)}
                          canPin={COMPARISON_PINNABLE_VARIABLES.includes(name)}
                          onTogglePin={togglePin}
                        />
                      ))
                    : null}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
