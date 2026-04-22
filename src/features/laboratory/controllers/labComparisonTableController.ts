import {
  COMPARISON_DISPLAY_GROUPS,
  COMPARISON_GROUP_ORDER,
  type ComparisonGroupLabel,
} from '../constants/labComparisonGroupingConstants';
import { COMPARISON_PINNABLE_VARIABLES } from '../constants/labComparisonPreferenceConstants';

export interface ComparisonGroup {
  label: ComparisonGroupLabel;
  rows: string[];
}

export const resolveComparisonGroupLabel = (name: string): ComparisonGroupLabel => {
  for (const group of COMPARISON_DISPLAY_GROUPS) {
    if (group.patterns.some(pattern => name.toLowerCase().includes(pattern.toLowerCase()))) {
      return group.label as ComparisonGroupLabel;
    }
  }

  return 'Otros';
};

export const filterComparisonVariableNames = (
  allVariableNames: string[],
  searchQuery: string
): string[] => {
  if (!searchQuery) {
    return allVariableNames;
  }

  const normalizedQuery = searchQuery.toLowerCase();
  return allVariableNames.filter(name => name.toLowerCase().includes(normalizedQuery));
};

export const resolveInitialPinnedVariables = (allVariableNames: string[]): Set<string> =>
  new Set(COMPARISON_PINNABLE_VARIABLES.filter(name => allVariableNames.includes(name)));

export const buildComparisonGroups = (
  variableNames: string[],
  allVariableNames: string[],
  pinnedVariables: Set<string>
): ComparisonGroup[] => {
  const groupsMap = new Map<ComparisonGroupLabel, string[]>();

  for (const name of variableNames) {
    const groupLabel = resolveComparisonGroupLabel(name);
    const groupRows = groupsMap.get(groupLabel) || [];
    groupRows.push(name);
    groupsMap.set(groupLabel, groupRows);
  }

  return COMPARISON_GROUP_ORDER.map(label => {
    const rows = groupsMap.get(label) || [];
    const orderedRows = [...rows].sort((left, right) => {
      const leftPinned = pinnedVariables.has(left);
      const rightPinned = pinnedVariables.has(right);

      if (leftPinned !== rightPinned) {
        return leftPinned ? -1 : 1;
      }

      return allVariableNames.indexOf(left) - allVariableNames.indexOf(right);
    });

    return { label, rows: orderedRows };
  }).filter(group => group.rows.length > 0);
};

export const resolveQualitativeComparisonAlert = (result: string): boolean =>
  /positivo|reactivo|detectado|aislado|presente/i.test(result);
