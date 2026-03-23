import React from 'react';
import { NameInput } from './NameInput';
import { RutPassportInput } from './RutPassportInput';
import { AgeInput } from './AgeInput';
import { DiagnosisInput } from './DiagnosisInput';
import { DualSpecialtyCell } from './DualSpecialtyCell';
import { StatusSelect } from './StatusSelect';
import { AdmissionInput } from './AdmissionInput';
import { DevicesCell } from './DevicesCell';
import { CheckboxCell } from './CheckboxCell';
import type {
  PatientInputClinicalSectionBindings,
  PatientInputFlagsSectionBindings,
  PatientInputFlowSectionBindings,
  PatientInputIdentitySectionBindings,
} from '@/features/census/components/patient-row/patientInputSectionContracts';
import type { CensusAccessProfile } from '@/features/census/types/censusAccessProfile';
import { isSpecialistCensusAccessProfile } from '@/features/census/types/censusAccessProfile';

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
> = ({ shared, diagnosisMode, handleDebouncedText, onChange, accessProfile = 'default' }) => (
  <>
    <DiagnosisInput
      data={shared.data}
      isSubRow={shared.isSubRow}
      isEmpty={shared.isEmpty}
      readOnly={shared.isLocked}
      diagnosisMode={diagnosisMode}
      onChange={handleDebouncedText}
      onMultipleUpdate={onChange.multiple}
      onDeliveryRouteChange={onChange.deliveryRoute}
    />
    <DualSpecialtyCell
      data={shared.data}
      isSubRow={shared.isSubRow}
      isEmpty={shared.isEmpty}
      readOnly={shared.isLocked}
      onChange={onChange.text}
      onMultipleUpdate={onChange.multiple}
    />
    {!isSpecialistCensusAccessProfile(accessProfile) && (
      <StatusSelect
        data={shared.data}
        isSubRow={shared.isSubRow}
        isEmpty={shared.isEmpty}
        readOnly={shared.isLocked}
        onChange={onChange.text}
      />
    )}
  </>
);

export const PatientInputFlowSection: React.FC<
  PatientInputFlowSectionBindings & { accessProfile?: CensusAccessProfile }
> = ({ shared, handleDebouncedText, onChange, accessProfile = 'default' }) => (
  <>
    <AdmissionInput
      data={shared.data}
      isSubRow={shared.isSubRow}
      isEmpty={shared.isEmpty}
      readOnly={shared.isLocked}
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
      />
    )}
  </>
);

export const PatientInputFlagsSection: React.FC<PatientInputFlagsSectionBindings> = ({
  shared,
  onChange,
}) => (
  <>
    <CheckboxCell
      data={shared.data}
      isSubRow={shared.isSubRow}
      isEmpty={shared.isEmpty}
      readOnly={shared.isLocked}
      field="surgicalComplication"
      onChange={onChange.check}
      title="Comp. Qx"
      colorClass="text-red-600"
    />
    <CheckboxCell
      data={shared.data}
      isSubRow={shared.isSubRow}
      isEmpty={shared.isEmpty}
      readOnly={shared.isLocked}
      field="isUPC"
      onChange={onChange.check}
      title="UPC"
      colorClass="text-purple-600"
      isLastColumn
    />
  </>
);
