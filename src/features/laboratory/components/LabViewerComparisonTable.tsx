/**
 * @module LabViewerComparisonTable
 * @description Comparison table with dates as columns and lab variables as rows.
 * Adds clinical grouping, lightweight local pinning and quieter visual emphasis.
 */

import React from 'react';
import type { LabPatient } from '@/types/domain/labExamTypes';
import type { LabAnalysisData } from '@/types/domain/labAnalyticsTypes';
import type { ExportConfig } from '../types/labViewerTypes';
import type { ComparisonGroupLabel } from '../constants/labComparisonGroupingConstants';
import {
  buildComparisonGroups,
  filterComparisonVariableNames,
  resolveInitialPinnedVariables,
} from '../controllers/labComparisonTableController';
import { LabExportConfigDialog } from './LabExportConfigDialog';
import { LabViewerComparisonTableBody } from './LabViewerComparisonTableBody';
import { LabViewerComparisonToolbar } from './LabViewerComparisonToolbar';

const loadLabExcelExporter = async () =>
  import('../services/labExcelService').then(module => module.exportComparisonToExcel);

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
  const [pinnedVariables, setPinnedVariables] = React.useState<Set<string>>(() =>
    resolveInitialPinnedVariables(allVariableNames)
  );

  const variableNames = React.useMemo(
    () => filterComparisonVariableNames(allVariableNames, searchQuery),
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

      <LabViewerComparisonToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onToggleExportConfig={() => setShowExportConfig(previous => !previous)}
      />

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
          <LabViewerComparisonTableBody
            comparisonGroups={comparisonGroups}
            examDates={examDates}
            data={data}
            collapsedGroups={collapsedGroups}
            pinnedVariables={pinnedVariables}
            onToggleGroup={toggleGroup}
            onTogglePin={togglePin}
          />
        </table>
      </div>
    </div>
  );
};
