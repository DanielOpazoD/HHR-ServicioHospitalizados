/**
 * @module LabViewerComparisonTable
 * @description Comparison table with dates as columns and lab variables as rows.
 * Adds clinical grouping, lightweight local pinning and quieter visual emphasis.
 */

import React from 'react';
import type { LabPatient } from '@/types/domain/labExamTypes';
import type { LabAnalysisData } from '@/types/domain/labAnalyticsTypes';
import { writeClipboardText } from '@/shared/runtime/browserClipboardRuntime';
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
  const [copyFeedback, setCopyFeedback] = React.useState<'idle' | 'copied' | 'error'>('idle');
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

  React.useEffect(() => {
    if (copyFeedback === 'idle') {
      return undefined;
    }

    const timeout = window.setTimeout(() => setCopyFeedback('idle'), 1600);
    return () => window.clearTimeout(timeout);
  }, [copyFeedback]);

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

  const handleRutCopy = async () => {
    if (!patient?.rut) {
      return;
    }

    try {
      await writeClipboardText(patient.rut);
      setCopyFeedback('copied');
    } catch {
      setCopyFeedback('error');
    }
  };

  if (allVariableNames.length === 0) {
    return (
      <p className="py-8 text-center text-[12px] text-slate-400">No hay datos para comparar.</p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-600">
              Comparación
            </p>
            {patient?.rut ? (
              <button
                type="button"
                onClick={handleRutCopy}
                title={`Copiar RUT ${patient.rut}`}
                className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 transition-colors hover:bg-emerald-100"
              >
                {copyFeedback === 'copied'
                  ? 'RUT copiado'
                  : copyFeedback === 'error'
                    ? 'No se pudo copiar'
                    : `RUT ${patient.rut}`}
              </button>
            ) : null}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="text-[14px] font-bold text-slate-800">Tabla resumida por fechas</h3>
            {patient?.patientName ? (
              <span className="truncate text-[11px] text-slate-500">{patient.patientName}</span>
            ) : null}
          </div>
          <p className="mt-0.5 text-[11px] leading-5 text-slate-500">
            Compara variables por fecha en una vista más compacta.
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

      <div className="rounded-xl border border-slate-200/80 bg-white shadow-sm">
        <table className="w-full border-collapse table-fixed">
          <colgroup>
            <col style={{ width: '156px', minWidth: '156px' }} />
            {examDates.map(date => (
              <col key={date} style={{ minWidth: '70px' }} />
            ))}
          </colgroup>
          <thead className="sticky top-0 z-20">
            <tr className="bg-slate-50">
              <th className="sticky left-0 z-30 border-r border-slate-200 bg-slate-50 px-2 py-1 text-left text-[8px] font-bold uppercase text-slate-500 whitespace-nowrap">
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
