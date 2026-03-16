import React from 'react';

import type { DischargeData } from '@/types/domain/movements';
import { resolveDischargeRowViewModel } from '@/features/census/controllers/dischargeRowViewController';
import { DischargeRowView } from '@/features/census/components/DischargeRowView';

interface DischargeRowProps {
  item: DischargeData;
  recordDate: string;
  onUndo: (id: string) => Promise<void>;
  onEdit: (item: DischargeData) => void;
  onUpdate: (item: DischargeData) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export const DischargeRow: React.FC<DischargeRowProps> = React.memo(
  ({ item, recordDate, onUndo, onEdit, onUpdate, onDelete }) => {
    const viewModel = resolveDischargeRowViewModel(item, {
      undoDischarge: onUndo,
      editDischarge: onEdit,
      deleteDischarge: onDelete,
    });

    return (
      <DischargeRowView
        viewModel={viewModel}
        recordDate={recordDate}
        dischargeItem={item}
        onUpdateDischarge={onUpdate}
      />
    );
  }
);

DischargeRow.displayName = 'DischargeRow';
