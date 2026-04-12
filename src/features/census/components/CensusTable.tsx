import React, { useCallback } from 'react';
import { CensusTableHeader } from '@/features/census/components/CensusTableHeader';
import { CensusTableBody } from '@/features/census/components/CensusTableBody';
import { useCensusTableBindingsModel } from '@/features/census/hooks/useCensusTableBindingsModel';
import { useCensusTableDragDrop, DragDropConfirmation } from '@/features/census/drag-drop';
import { useDailyRecordBeds } from '@/context/DailyRecordContext';
import { useDailyRecordBedActions } from '@/context/useDailyRecordScopedActions';
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
  const { isReady, bindings, clinicalDocumentInfoByBedId } = useCensusTableBindingsModel({
    currentDateString,
    readOnly,
    accessProfile,
  });

  const { moveOrCopyPatient } = useDailyRecordBedActions();
  const beds = useDailyRecordBeds();

  const handleMoveToBed = useCallback(
    (sourceBedId: string, targetBedId: string) => {
      moveOrCopyPatient('move', sourceBedId, targetBedId);
    },
    [moveOrCopyPatient]
  );

  const dragDrop = useCensusTableDragDrop(handleMoveToBed, beds ?? {});

  if (!isReady || !bindings) return null;

  const { headerProps, bodyProps, tableStyle } = bindings;

  return (
    <div className="card print:border-none print:shadow-none !overflow-visible">
      <div className="relative overflow-x-auto overflow-y-hidden">
        <table
          data-testid="census-table"
          className="text-left border-collapse print:text-xs relative text-[12px] leading-tight table-fixed"
          style={tableStyle}
        >
          <CensusTableHeader {...headerProps} />
          <CensusTableBody
            {...bodyProps}
            dragDrop={readOnly ? undefined : dragDrop}
            clinicalDocumentInfoByBedId={clinicalDocumentInfoByBedId}
          />
        </table>
      </div>

      {dragDrop.state.pendingMove && (
        <DragDropConfirmation
          move={dragDrop.state.pendingMove}
          onConfirm={dragDrop.confirmationHandlers.onConfirm}
          onCancel={dragDrop.confirmationHandlers.onCancel}
        />
      )}
    </div>
  );
};
