import React from 'react';
import { NameInput } from './NameInput';
import { RutPassportInput } from './RutPassportInput';
import { AgeInput } from './AgeInput';
import { DiagnosisInput } from './DiagnosisInput';
import { SpecialtyCell } from './SpecialtyCell';
import { StatusSelect } from './StatusSelect';
import { AdmissionInput } from './AdmissionInput';
import { DevicesCell } from './DevicesCell';
import { CheckboxCell } from './CheckboxCell';
import { UpcChecklistPopover } from './UpcChecklistPopover';
import type {
  PatientInputClinicalSectionBindings,
  PatientInputFlagsSectionBindings,
  PatientInputFlowSectionBindings,
  PatientInputIdentitySectionBindings,
} from '@/features/census/components/patient-row/patientInputSectionContracts';
import type { CensusAccessProfile } from '@/features/census/types/censusAccessProfile';
import { isSpecialistCensusAccessProfile } from '@/features/census/types/censusAccessProfile';
import { isUpcEligibleBedId } from '@/shared/census/upcBedPolicy';
import { useAuth } from '@/context/AuthContext';
import type { UpcChecklistRecord } from '@/features/census/contracts/censusUpcContracts';
import { logger } from '@/services/utils/loggerService';

const patientInputFlagsLogger = logger.child('PatientInputFlagsSection');
const REMOTE_FIELD_LOCK_REASON =
  'Firebase actualizó este dato. Revise el registro antes de editarlo.';
const REMOTE_EPISODE_LOCK_REASON =
  'Firebase actualizó el paciente o episodio de esta cama. Revise el registro antes de editar.';

const isRemoteLocked = (locked?: boolean): boolean => Boolean(locked);

export const PatientInputIdentitySection: React.FC<PatientInputIdentitySectionBindings> = ({
  shared,
  hasRutError,
  handleDebouncedText,
  onDemo,
  onChange,
}) => (
  <>
    <NameInput
      data={shared.data}
      isSubRow={shared.isSubRow}
      isEmpty={shared.isEmpty}
      readOnly={shared.isLocked}
      onChange={handleDebouncedText}
    />
    <RutPassportInput
      value={shared.data.rut || ''}
      documentType={shared.data.documentType || 'RUT'}
      isSubRow={shared.isSubRow}
      isClinicalCribPatient={shared.isSubRow || shared.data.bedMode === 'Cuna'}
      isEmpty={shared.isEmpty}
      hasName={!!shared.data.patientName && !shared.isEmpty}
      patientName={shared.data.patientName || ''}
      currentDateString={shared.currentDateString}
      admissionDate={shared.data.admissionDate}
      onChange={handleDebouncedText('rut')}
      onToggleType={onChange.toggleDocType}
      readOnly={true}
      hasError={hasRutError}
    />
    <AgeInput
      data={shared.data}
      isSubRow={shared.isSubRow}
      isEmpty={shared.isEmpty}
      readOnly={shared.isLocked}
      onOpenDemographics={onDemo}
    />
  </>
);

export const PatientInputClinicalSection: React.FC<
  PatientInputClinicalSectionBindings & { accessProfile?: CensusAccessProfile }
> = ({ shared, diagnosisMode, handleDebouncedText, onChange, accessProfile = 'default' }) => {
  const fieldLocks = shared.clinicalFieldLocks;
  const allClinicalLocked = isRemoteLocked(fieldLocks?.allClinical);
  const diagnosisLocked = allClinicalLocked || isRemoteLocked(fieldLocks?.diagnosis);
  const specialtyLocked = allClinicalLocked || isRemoteLocked(fieldLocks?.specialty);
  const statusLocked = allClinicalLocked || isRemoteLocked(fieldLocks?.status);
  const readOnlyReason = allClinicalLocked ? REMOTE_EPISODE_LOCK_REASON : REMOTE_FIELD_LOCK_REASON;
  const baseClinicalReadOnly = shared.isLocked || shared.clinicalEditingDisabled;

  return (
    <>
      <DiagnosisInput
        data={shared.data}
        isSubRow={shared.isSubRow}
        isEmpty={shared.isEmpty}
        readOnly={baseClinicalReadOnly || diagnosisLocked}
        readOnlyReason={diagnosisLocked ? readOnlyReason : undefined}
        diagnosisMode={diagnosisMode}
        onChange={handleDebouncedText}
        onMultipleUpdate={onChange.multiple}
        onDeliveryRouteChange={onChange.deliveryRoute}
      />
      <SpecialtyCell
        data={shared.data}
        isSubRow={shared.isSubRow}
        isEmpty={shared.isEmpty}
        readOnly={baseClinicalReadOnly || specialtyLocked}
        readOnlyReason={specialtyLocked ? readOnlyReason : undefined}
        onChange={onChange.text}
        onMultipleUpdate={onChange.multiple}
      />
      {!isSpecialistCensusAccessProfile(accessProfile) && (
        <StatusSelect
          data={shared.data}
          isSubRow={shared.isSubRow}
          isEmpty={shared.isEmpty}
          readOnly={baseClinicalReadOnly || statusLocked}
          readOnlyReason={statusLocked ? readOnlyReason : undefined}
          onChange={onChange.text}
        />
      )}
    </>
  );
};

export const PatientInputFlowSection: React.FC<
  PatientInputFlowSectionBindings & { accessProfile?: CensusAccessProfile }
> = ({ shared, handleDebouncedText, onChange, accessProfile = 'default' }) => (
  <>
    <AdmissionInput
      data={shared.data}
      isSubRow={shared.isSubRow}
      isEmpty={shared.isEmpty}
      readOnly={shared.isLocked}
      currentDateString={shared.currentDateString}
      isNewAdmission={shared.isNewAdmission}
      onChange={handleDebouncedText}
      onMultipleUpdate={onChange.multiple}
    />
    {!isSpecialistCensusAccessProfile(accessProfile) && (
      <DevicesCell
        data={shared.data}
        isSubRow={shared.isSubRow}
        isEmpty={shared.isEmpty}
        readOnly={shared.isLocked}
        currentDateString={shared.currentDateString}
        onDevicesChange={onChange.devices}
        onDeviceDetailsChange={onChange.deviceDetails}
        onDeviceHistoryChange={onChange.deviceHistory}
        onDeviceBundleChange={onChange.multiple}
      />
    )}
  </>
);

export const PatientInputFlagsSection: React.FC<PatientInputFlagsSectionBindings> = ({
  shared,
  onChange,
}) => {
  const upcEligible = isUpcEligibleBedId(shared.data.bedId);
  const { currentUser } = useAuth();
  const fieldLocks = shared.clinicalFieldLocks;
  const allClinicalLocked = isRemoteLocked(fieldLocks?.allClinical);
  const surgicalComplicationLocked =
    allClinicalLocked || isRemoteLocked(fieldLocks?.surgicalComplication);
  const upcLocked = allClinicalLocked || isRemoteLocked(fieldLocks?.upc);
  const readOnlyReason = allClinicalLocked ? REMOTE_EPISODE_LOCK_REASON : REMOTE_FIELD_LOCK_REASON;
  const baseClinicalReadOnly = shared.isLocked || shared.clinicalEditingDisabled;
  const upcActor = currentUser
    ? { uid: currentUser.uid, displayName: currentUser.displayName || currentUser.email || '' }
    : null;

  const handleUpcSave = (record: UpcChecklistRecord) => {
    try {
      onChange.multiple?.({
        upcChecklist: record,
        isUPC: record.classification !== null,
      });
    } catch (err) {
      patientInputFlagsLogger.error('Failed to save UPC checklist', err);
    }
  };

  return (
    <>
      <CheckboxCell
        data={shared.data}
        isSubRow={shared.isSubRow}
        isEmpty={shared.isEmpty}
        readOnly={baseClinicalReadOnly || surgicalComplicationLocked}
        readOnlyReason={surgicalComplicationLocked ? readOnlyReason : undefined}
        field="surgicalComplication"
        onChange={onChange.check}
        title="Comp. Qx"
        colorClass="text-red-600"
      />
      <UpcChecklistPopover
        data={shared.data}
        isSubRow={shared.isSubRow}
        isEmpty={shared.isEmpty}
        readOnly={baseClinicalReadOnly || upcLocked}
        readOnlyReason={upcLocked ? readOnlyReason : undefined}
        checklist={shared.data.upcChecklist}
        onSave={handleUpcSave}
        eligible={upcEligible}
        actor={upcActor}
      />
    </>
  );
};
