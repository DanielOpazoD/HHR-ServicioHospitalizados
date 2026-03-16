import React, { useEffect, useRef, useState } from 'react';
import { useDailyRecordData } from '@/context/DailyRecordContext';
import { useDailyRecordHandoffActions } from '@/context/useDailyRecordScopedActions';
import { useStaffContext } from '@/context/StaffContext';
import { MessageSquare, Stethoscope } from 'lucide-react';
import { HandoffHeader } from './HandoffHeader';
import { HandoffChecklistSection } from './HandoffChecklistSection';
import { HandoffCudyrPrint } from './HandoffCudyrPrint';
import { HandoffNightCudyrActionButton } from './HandoffNightCudyrActionButton';
import { HandoffPrintHeader } from './HandoffPrintHeader';
import { HandoffMedicalContent } from './HandoffMedicalContent';
import { HandoffNursingContent } from './HandoffNursingContent';
import type { HandoffClinicalEventActions, HandoffMedicalActions } from './handoffRowContracts';
import { useNotification } from '@/context/UIContext';
import { useHandoffLogic } from '@/hooks';
import { useAuditContext } from '@/context/AuditContext';
import { getAttributedAuthors } from '@/services/admin/attributionService';
import { useUIState, UseUIStateReturn } from '@/hooks/useUIState';
import { useAuth } from '@/context';
import {
  resolveInitialMedicalScopeFromSearch,
  resolveInitialMedicalSpecialtyFromSearch,
} from '@/domain/handoff/view';
import { resolveHandoffMedicalScreenState } from '@/application/handoff';
import {
  buildHandoffClinicalEventActions,
  buildHandoffMedicalActions,
  resolveEffectiveSelectedMedicalSpecialty,
} from '@/features/handoff/controllers/handoffViewBindingsController';
import { resolveMedicalHandoffCapabilities } from '@/features/handoff/controllers/medicalHandoffAccessController';
import {
  resolveHandoffDocumentTitle,
  resolveHandoffTableHeaderClass,
  resolveHandoffTitle,
  shouldShowNightCudyrActions,
} from '@/features/handoff/controllers/handoffViewController';
import type { MedicalHandoffScope } from '@/types/medicalHandoff';
import { Specialty } from '@/types/domain/base';

interface HandoffViewProps {
  type?: 'nursing' | 'medical';
  readOnly?: boolean;
  ui?: UseUIStateReturn;
  medicalScope?: MedicalHandoffScope;
}
export const HandoffView: React.FC<HandoffViewProps> = ({
  type = 'nursing',
  readOnly = false,
  ui: propUi,
  medicalScope,
}) => {
  const initialMedicalSpecialtyFromUrl = React.useMemo(
    () =>
      typeof window === 'undefined'
        ? ('all' as Specialty | 'all')
        : resolveInitialMedicalSpecialtyFromSearch(window.location.search),
    []
  );
  const initialMedicalScopeFromUrl = React.useMemo(
    () =>
      typeof window === 'undefined'
        ? ('all' as MedicalHandoffScope)
        : resolveInitialMedicalScopeFromSearch(window.location.search),
    []
  );
  const effectiveMedicalScope = medicalScope ?? initialMedicalScopeFromUrl;
  const { record } = useDailyRecordData();
  const {
    updateHandoffChecklist,
    updateHandoffNovedades,
    updateHandoffStaff,
    updateMedicalHandoffDoctor,
    markMedicalHandoffAsSent,
    resetMedicalHandoffState,
  } = useDailyRecordHandoffActions();
  const { nursesList } = useStaffContext();
  const { success } = useNotification();
  const { logEvent } = useAuditContext();
  const { role } = useAuth();
  const logEventRef = useRef(logEvent);
  const recordRef = useRef(record);
  const [selectedMedicalSpecialty, setSelectedMedicalSpecialty] = useState<Specialty | 'all'>(
    initialMedicalSpecialtyFromUrl
  );
  useEffect(() => void (logEventRef.current = logEvent), [logEvent]);
  useEffect(() => void (recordRef.current = record), [record]);
  const localUi = useUIState();
  const ui = propUi || localUi;
  const {
    selectedShift,
    setSelectedShift,
    isMedical,
    visibleBeds,
    hasAnyPatients,
    schedule,
    noteField,
    deliversList,
    receivesList,
    tensList,
    shouldShowPatient,
    handleNursingNoteChange,
    handleMedicalPrimaryEntryCreate,
    handleMedicalEntryAdd,
    handleMedicalEntryDelete,
    handleMedicalEntryNoteChange,
    handleMedicalEntrySpecialtyChange,
    handleMedicalContinuityConfirm,
    handleShareLink,
    handleSendWhatsAppManual,
    formatPrintDate,
    handleClinicalEventAdd,
    handleClinicalEventUpdate,
    handleClinicalEventDelete,
  } = useHandoffLogic({
    type,
    selectedShift: ui.selectedShift,
    setSelectedShift: ui.setSelectedShift,
    onSuccess: success,
  });

  const {
    scopedMedicalScope,
    effectiveVisibleBeds,
    medicalSpecialties,
    scopedMedicalSignature,
    scopedMedicalHandoffSentAt,
  } = React.useMemo(
    () =>
      resolveHandoffMedicalScreenState({
        visibleBeds,
        record,
        isMedical,
        medicalScope: effectiveMedicalScope,
        selectedMedicalSpecialty: 'all',
        shouldShowPatient,
      }),
    [visibleBeds, record, isMedical, effectiveMedicalScope, shouldShowPatient]
  );
  const effectiveSelectedMedicalSpecialty = React.useMemo(
    () => resolveEffectiveSelectedMedicalSpecialty(selectedMedicalSpecialty, medicalSpecialties),
    [medicalSpecialties, selectedMedicalSpecialty]
  );
  const { specialtyFilteredBeds, hasAnyVisiblePatients } = React.useMemo(
    () =>
      resolveHandoffMedicalScreenState({
        visibleBeds,
        record,
        isMedical,
        medicalScope: effectiveMedicalScope,
        selectedMedicalSpecialty: effectiveSelectedMedicalSpecialty,
        shouldShowPatient,
      }),
    [
      visibleBeds,
      record,
      isMedical,
      effectiveMedicalScope,
      effectiveSelectedMedicalSpecialty,
      shouldShowPatient,
    ]
  );
  const { userId } = useAuditContext();
  const recordDate = record?.date;
  useEffect(() => {
    if (recordDate) {
      const currentRecord = recordRef.current;
      if (!currentRecord) return;
      const authors = getAttributedAuthors(
        userId,
        currentRecord,
        isMedical ? undefined : (selectedShift as 'day' | 'night')
      );
      logEventRef.current(
        isMedical ? 'VIEW_MEDICAL_HANDOFF' : 'VIEW_NURSING_HANDOFF',
        'dailyRecord',
        recordDate,
        {
          view: isMedical ? 'medical_handoff' : 'nursing_handoff',
          shift: selectedShift,
        },
        undefined,
        recordDate,
        authors
      );
    }
  }, [recordDate, type, selectedShift, isMedical, userId]);
  useEffect(() => {
    const nextTitle = resolveHandoffDocumentTitle({
      isMedical,
      selectedShift,
      recordDate: record?.date,
    });
    if (!nextTitle) return;
    document.title = nextTitle;
    return () => {
      document.title = 'Hospital Hanga Roa';
    };
  }, [record?.date, selectedShift, isMedical]);

  const title = resolveHandoffTitle({ isMedical, selectedShift });
  const medicalCapabilities = React.useMemo(
    () =>
      resolveMedicalHandoffCapabilities({
        role,
        readOnly,
        recordDate: record?.date,
      }),
    [readOnly, record?.date, role]
  );
  const medicalActions: HandoffMedicalActions = React.useMemo(
    () =>
      buildHandoffMedicalActions({
        capabilities: medicalCapabilities,
        onCreatePrimaryEntry: handleMedicalPrimaryEntryCreate,
        onEntryNoteChange: handleMedicalEntryNoteChange,
        onEntrySpecialtyChange: handleMedicalEntrySpecialtyChange,
        onEntryAdd: handleMedicalEntryAdd,
        onEntryDelete: handleMedicalEntryDelete,
        onContinuityConfirm: handleMedicalContinuityConfirm,
      }),
    [
      handleMedicalContinuityConfirm,
      handleMedicalEntryAdd,
      handleMedicalEntryDelete,
      handleMedicalEntryNoteChange,
      handleMedicalEntrySpecialtyChange,
      handleMedicalPrimaryEntryCreate,
      medicalCapabilities,
    ]
  );
  const clinicalEventActions: HandoffClinicalEventActions = React.useMemo(
    () =>
      buildHandoffClinicalEventActions({
        canEditClinicalEvents: medicalCapabilities.canEditClinicalEvents,
        onAdd: handleClinicalEventAdd,
        onUpdate: handleClinicalEventUpdate,
        onDelete: handleClinicalEventDelete,
      }),
    [
      handleClinicalEventAdd,
      handleClinicalEventDelete,
      handleClinicalEventUpdate,
      medicalCapabilities.canEditClinicalEvents,
    ]
  );

  const handleOpenCudyr = () => ui?.setCurrentModule('CUDYR');
  const Icon = isMedical ? Stethoscope : MessageSquare;
  const tableHeaderClass = resolveHandoffTableHeaderClass({ isMedical, selectedShift });
  if (!record) {
    return (
      <div className="p-8 text-center text-slate-500 font-sans">
        Seleccione una fecha para ver la Entrega de Turno.
      </div>
    );
  }
  return (
    <div className="space-y-3 print:space-y-2 animate-fade-in pb-20 font-sans max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 print:max-w-none print:w-full print:px-0 print:pb-0">
      <HandoffPrintHeader
        title={title}
        dateString={formatPrintDate()}
        Icon={Icon}
        isMedical={isMedical}
        schedule={schedule}
        selectedShift={selectedShift}
        deliversList={deliversList}
        receivesList={receivesList}
        tensList={tensList}
      />
      <HandoffHeader
        isMedical={isMedical}
        selectedShift={selectedShift}
        setSelectedShift={setSelectedShift}
        readOnly={readOnly}
        showMedicalShareActions={medicalCapabilities.canShareSignatureLinks}
        medicalSignature={scopedMedicalSignature}
        medicalHandoffSentAt={scopedMedicalHandoffSentAt}
        onSendWhatsApp={handleSendWhatsAppManual}
        onShareLink={handleShareLink}
        extraAction={
          medicalCapabilities.canOpenNightCudyr &&
          shouldShowNightCudyrActions({ isMedical, selectedShift }) ? (
            <HandoffNightCudyrActionButton onClick={handleOpenCudyr} />
          ) : undefined
        }
      />
      <HandoffChecklistSection
        isMedical={isMedical}
        selectedShift={selectedShift}
        record={record}
        deliversList={deliversList}
        receivesList={receivesList}
        nursesList={nursesList}
        readOnly={readOnly}
        onUpdateStaff={updateHandoffStaff}
        onUpdateChecklist={updateHandoffChecklist}
      />
      {isMedical ? (
        <HandoffMedicalContent
          record={record}
          effectiveVisibleBeds={effectiveVisibleBeds}
          specialtyFilteredBeds={specialtyFilteredBeds}
          readOnly={readOnly}
          role={role}
          canCopySpecialistLink={medicalCapabilities.canCopySpecialistLink}
          scopedMedicalSignature={scopedMedicalSignature}
          scopedMedicalHandoffSentAt={scopedMedicalHandoffSentAt}
          showDeliverySection={medicalCapabilities.canShowDeliverySection}
          canEditDoctorName={medicalCapabilities.canEditDoctorName}
          canSignMedicalHandoff={medicalCapabilities.canSign}
          updateMedicalHandoffDoctor={
            medicalCapabilities.canEditDoctorName ? updateMedicalHandoffDoctor : undefined
          }
          markMedicalHandoffAsSent={
            medicalCapabilities.canSign ? markMedicalHandoffAsSent : undefined
          }
          resetMedicalHandoffState={
            medicalCapabilities.canRestoreSignatures ? resetMedicalHandoffState : undefined
          }
          selectedMedicalSpecialty={effectiveSelectedMedicalSpecialty}
          setSelectedMedicalSpecialty={setSelectedMedicalSpecialty}
          medicalSpecialties={medicalSpecialties}
          success={success}
          noteField={noteField}
          onNoteChange={handleNursingNoteChange}
          medicalActions={medicalActions}
          clinicalEventActions={clinicalEventActions}
          tableHeaderClass={tableHeaderClass}
          shouldShowPatient={shouldShowPatient}
          scopedMedicalScope={scopedMedicalScope}
          hasAnyVisiblePatients={hasAnyVisiblePatients}
        />
      ) : (
        <HandoffNursingContent
          visibleBeds={visibleBeds}
          record={record}
          noteField={noteField}
          onNoteChange={handleNursingNoteChange}
          medicalActions={medicalActions}
          tableHeaderClass={tableHeaderClass}
          readOnly={readOnly}
          hasAnyPatients={hasAnyPatients}
          shouldShowPatient={shouldShowPatient}
          clinicalEventActions={clinicalEventActions}
          selectedShift={selectedShift}
          updateHandoffNovedades={updateHandoffNovedades}
        />
      )}
      {shouldShowNightCudyrActions({ isMedical, selectedShift }) && (
        <div className="print:break-before-page">
          <HandoffCudyrPrint />
        </div>
      )}
    </div>
  );
};
