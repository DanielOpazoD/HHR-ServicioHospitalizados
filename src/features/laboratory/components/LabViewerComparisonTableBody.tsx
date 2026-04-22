import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { LabAnalysisData } from '@/types/domain/labAnalyticsTypes';
import type { ComparisonGroup } from '../controllers/labComparisonTableController';
import type { ComparisonGroupLabel } from '../constants/labComparisonGroupingConstants';
import { LabViewerComparisonRow } from './LabViewerComparisonRow';

interface LabViewerComparisonTableBodyProps {
  comparisonGroups: ComparisonGroup[];
  examDates: string[];
  data: LabAnalysisData;
  collapsedGroups: Set<ComparisonGroupLabel>;
  pinnedVariables: Set<string>;
  onToggleGroup: (label: ComparisonGroupLabel) => void;
  onTogglePin: (name: string) => void;
}

export const LabViewerComparisonTableBody: React.FC<LabViewerComparisonTableBodyProps> = ({
  comparisonGroups,
  examDates,
  data,
  collapsedGroups,
  pinnedVariables,
  onToggleGroup,
  onTogglePin,
}) => (
  <tbody>
    {comparisonGroups.map(group => {
      const isCollapsed = collapsedGroups.has(group.label);

      return (
        <React.Fragment key={group.label}>
          <tr className="border-t border-slate-200 bg-slate-50/80">
            <td colSpan={examDates.length + 1} className="px-2 py-1">
              <button
                type="button"
                onClick={() => onToggleGroup(group.label)}
                className="flex w-full items-center justify-between gap-3 text-left"
              >
                <span className="inline-flex items-center gap-2">
                  {isCollapsed ? (
                    <ChevronRight size={13} className="text-slate-400" />
                  ) : (
                    <ChevronDown size={13} className="text-slate-400" />
                  )}
                  <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-700">
                    {group.label}
                  </span>
                </span>
                <span className="text-[9px] text-slate-400">
                  {group.rows.length} variable{group.rows.length === 1 ? '' : 's'}
                </span>
              </button>
            </td>
          </tr>
          {!isCollapsed
            ? group.rows.map((name, index) => (
                <LabViewerComparisonRow
                  key={`${group.label}-${name}`}
                  name={name}
                  examDates={examDates}
                  data={data}
                  index={index}
                  isPinned={pinnedVariables.has(name)}
                  onTogglePin={onTogglePin}
                />
              ))
            : null}
        </React.Fragment>
      );
    })}
  </tbody>
);
