import React from 'react';
import type { LabTrendGroup } from '@/types/domain/laboratory';
import { groupVariablesByScale } from './LabTrendChartHelpers';
import { UnitSubChart } from './LabTrendChartRenderers';

/** Render a trend group card -- splits into sub-charts per unit AND scale for readability. */
export const LabTrendGroupCard: React.FC<{ group: LabTrendGroup }> = ({ group }) => {
  const unitGroups = groupVariablesByScale(group.variables);

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-4">
      <h4 className="mb-3 text-[13px] font-bold text-slate-700">{group.label}</h4>
      <div className="space-y-4">
        {unitGroups.map((unitGroup, index) => {
          const prevCount = unitGroups
            .slice(0, index)
            .reduce((sum, candidate) => sum + Object.keys(candidate.vars).length, 0);

          return (
            <UnitSubChart
              key={`${unitGroup.unit}-${index}`}
              varEntries={unitGroup.vars}
              unit={unitGroup.unit}
              colorOffset={prevCount}
            />
          );
        })}
      </div>
    </div>
  );
};
