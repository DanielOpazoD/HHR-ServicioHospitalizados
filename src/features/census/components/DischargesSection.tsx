import React, { Suspense, lazy, useState } from 'react';
import { createPortal } from 'react-dom';
import type { DischargeData } from '@/features/census/contracts/censusMovementContracts';
import { useDailyRecordMovementActions } from '@/context/useDailyRecordScopedActions';
import { CheckCircle } from 'lucide-react';
import { DISCHARGES_TABLE_HEADERS } from '@/features/census/controllers/censusDischargesTableController';
import { CensusMovementSection } from '@/features/census/components/CensusMovementSection';
import { DischargeRow } from '@/features/census/components/DischargeRow';
import { useDischargesSectionModel } from '@/features/census/hooks/useDischargesSectionModel';

const ConversionModal = lazy(() =>
  import('./DischargeToTransferModal').then(module => ({
    default: module.DischargeToTransferModal,
  }))
);

// Interface for props removed as data comes from context

export const DischargesSection: React.FC = () => {
  const {
    recordDate,
    sectionModel,
    handleEditDischarge,
    updateDischarge,
    handleConvertDischargeToCma,
  } = useDischargesSectionModel();

  const [conversion, setConversion] = useState<{ discharge: DischargeData; date: string } | null>(
    null
  );
  const { convertDischargeToTransfer } = useDailyRecordMovementActions();
  return (
    <>
      <CensusMovementSection
        model={sectionModel}
        title="Altas"
        emptyMessage="No hay altas registradas para este día."
        icon={<CheckCircle size={18} />}
        iconClassName="bg-green-50 text-green-600"
        headers={DISCHARGES_TABLE_HEADERS}
        getItemKey={item => item.id}
        renderRow={item => (
          <DischargeRow
            item={item}
            recordDate={recordDate}
            onUndo={sectionModel.handleUndo}
            onEdit={handleEditDischarge}
            onUpdate={async updatedItem => {
              await updateDischarge(
                updatedItem.id,
                updatedItem.status,
                updatedItem.dischargeType,
                updatedItem.dischargeTypeOther,
                updatedItem.time,
                updatedItem.movementDate,
                updatedItem.ieehData,
                updatedItem.diagnosis
              );
            }}
            onDelete={sectionModel.handleDelete}
            onConvertToTransfer={discharge => setConversion({ discharge, date: recordDate })}
            onConvertToCma={handleConvertDischargeToCma}
          />
        )}
      />
      {conversion &&
        createPortal(
          <Suspense fallback={null}>
            <ConversionModal
              discharge={conversion.discharge}
              recordDate={conversion.date}
              convert={convertDischargeToTransfer}
              onClose={() => setConversion(null)}
            />
          </Suspense>,
          document.body
        )}
    </>
  );
};
