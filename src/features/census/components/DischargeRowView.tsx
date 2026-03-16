import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { CensusMovementPrimaryCells } from '@/features/census/components/CensusMovementPrimaryCells';
import { CensusMovementDateActionsCells } from '@/features/census/components/CensusMovementDateActionsCells';
import type { DischargeRowViewModel } from '@/features/census/types/censusMovementRowViewModelTypes';
import type { DischargeData } from '@/types/domain/movements';
import { IEEHFormDialog } from '@/features/census/components/IEEHFormDialog';
import { FileText } from 'lucide-react';

interface DischargeRowViewProps {
  viewModel: DischargeRowViewModel;
  recordDate: string;
  dischargeItem?: DischargeData;
  onUpdateDischarge?: (updatedItem: DischargeData) => void;
}

export const DischargeRowView: React.FC<DischargeRowViewProps> = ({
  viewModel,
  recordDate,
  dischargeItem,
  onUpdateDischarge,
}) => {
  const [showDialog, setShowDialog] = useState(false);

  return (
    <tr className="border-b border-slate-100 last:border-0 hover:bg-slate-50 print:border-slate-300">
      <CensusMovementPrimaryCells viewModel={viewModel} />
      <td className="p-2 text-xs text-slate-500">{viewModel.dischargeTypeLabel}</td>
      <td className="p-2">
        <span
          className={clsx(
            'rounded-full px-2 py-1 text-[11px] font-bold print:border print:border-slate-400',
            viewModel.statusBadgeClassName
          )}
        >
          {viewModel.statusLabel}
        </span>
      </td>
      <CensusMovementDateActionsCells
        recordDate={recordDate}
        movementDate={viewModel.movementDate}
        movementTime={viewModel.movementTime}
        actions={viewModel.actions}
      >
        {/* IEEH PDF Button aligned with actions */}
        {dischargeItem?.originalData && (
          <button
            type="button"
            onClick={() => setShowDialog(true)}
            title="Generar Informe Estadístico de Egreso (IEEH)"
            className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded hover:bg-emerald-100 hover:border-emerald-300 transition-colors h-7"
          >
            <FileText size={12} />
            IEEH
          </button>
        )}
      </CensusMovementDateActionsCells>

      {/* Dialog rendered via Portal at body level to avoid table clipping */}
      {showDialog &&
        dischargeItem?.originalData &&
        createPortal(
          <IEEHFormDialog
            isOpen={showDialog}
            onClose={() => setShowDialog(false)}
            patient={dischargeItem.originalData}
            baseDischargeData={{
              dischargeDate: dischargeItem.movementDate || recordDate,
              dischargeTime: dischargeItem.time,
            }}
            savedIeehData={dischargeItem.ieehData}
            onSaveData={
              onUpdateDischarge
                ? ieehData => onUpdateDischarge({ ...dischargeItem, ieehData })
                : undefined
            }
          />,
          document.body
        )}
    </tr>
  );
};
