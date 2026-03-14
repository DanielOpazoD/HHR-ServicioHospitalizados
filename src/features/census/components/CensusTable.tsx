import React from 'react';
import { CensusTableHeader } from '@/features/census/components/CensusTableHeader';
import { CensusTableBody } from '@/features/census/components/CensusTableBody';
import { useCensusTableBindingsModel } from '@/features/census/hooks/useCensusTableBindingsModel';
import type { CensusAccessProfile } from '@/features/census/types/censusAccessProfile';
export type { DiagnosisMode } from '@/features/census/types/censusTableTypes';

interface CensusTableProps {
  currentDateString: string;
  readOnly?: boolean;
  accessProfile?: CensusAccessProfile;
}

export const CensusTable: React.FC<CensusTableProps> = ({
  currentDateString,
  readOnly = false,
  accessProfile = 'default',
}) => {
  const { isReady, bindings } = useCensusTableBindingsModel({
    currentDateString,
    readOnly,
    accessProfile,
  });

  if (!isReady || !bindings) return null;

  const { headerProps, bodyProps, tableStyle } = bindings;

  return (
    <div className="card print:border-none print:shadow-none !overflow-visible">
      <div className="overflow-x-auto overflow-y-hidden">
        <table
          data-testid="census-table"
          className="text-left border-collapse print:text-xs relative text-[12px] leading-tight table-fixed"
          style={tableStyle}
        >
          <CensusTableHeader {...headerProps} />
          <CensusTableBody {...bodyProps} />
        </table>
      </div>
    </div>
  );
};
