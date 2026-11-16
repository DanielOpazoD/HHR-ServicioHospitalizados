import React, { useRef, useState } from 'react';
import { TransferModal } from '@/components/modals/actions/TransferModal';
import type { DischargeData } from '@/features/census/contracts/censusMovementContracts';
import {
  DEFAULT_EVACUATION_METHOD,
  DEFAULT_RECEIVING_CENTER,
  DEFAULT_TRANSFER_ESCORT,
} from '@/constants/clinicalMovementConstants';
import type { DischargeMovementActions } from '@/types/movements';

export const DischargeToTransferModal = ({
  discharge,
  recordDate,
  onClose,
  convert,
}: {
  discharge: DischargeData;
  recordDate: string;
  onClose: () => void;
  convert: DischargeMovementActions['convertDischargeToTransfer'];
}) => {
  const [fields, setFields] = useState({
    evacuationMethod: DEFAULT_EVACUATION_METHOD,
    evacuationMethodOther: '',
    receivingCenter: DEFAULT_RECEIVING_CENTER,
    receivingCenterOther: '',
    transferEscort: DEFAULT_TRANSFER_ESCORT as string,
    diagnosis: discharge.diagnosis,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  return (
    <TransferModal
      isOpen
      isEditing
      recordDate={recordDate}
      title="Convertir alta a traslado"
      confirmText="Convertir a traslado"
      notice={`Se corregirá el egreso de ${discharge.patientName}. El alta será reemplazada por un traslado conservando el caso histórico.`}
      {...fields}
      initialTime={discharge.time}
      initialMovementDate={discharge.movementDate}
      saving={saving}
      saveError={error}
      onUpdate={(field, value) => setFields(previous => ({ ...previous, [field]: value }))}
      onClose={onClose}
      onConfirm={async data => {
        if (pending.current) return;
        pending.current = true;
        setSaving(true);
        setError('');
        try {
          await convert(discharge.id, { ...fields, ...data }, recordDate);
          onClose();
        } catch {
          setError('No se pudo convertir el alta. Compruebe la conexión y vuelva a intentarlo.');
        } finally {
          pending.current = false;
          setSaving(false);
        }
      }}
    />
  );
};
