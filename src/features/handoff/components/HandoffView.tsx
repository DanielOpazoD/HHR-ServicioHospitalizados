import React, { useEffect, useRef, useState } from 'react';
import { useDailyRecordData } from '@/context/DailyRecordContext';
import { useDailyRecordHandoffActions } from '@/context/useDailyRecordScopedActions';
import { useStaffContext } from '@/context/StaffContext';
import { MessageSquare, Stethoscope, Activity } from 'lucide-react';
import { HandoffHeader } from './HandoffHeader';
import { HandoffChecklistSection } from './HandoffChecklistSection';
import { HandoffCudyrPrint } from './HandoffCudyrPrint';
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
  resolveInitialMedicalSpecialtyFromSearch,
  resolveHandoffScreenState,
  type MedicalHandoffScope,
  resolveHandoffDocumentTitle,
  resolveHandoffTableHeaderClass,
  resolveHandoffTitle,
  shouldShowNightCudyrActions,
} from '@/features/handoff/controllers';
import { ACTIONS, canDoAction } from '@/utils/permissions';
import { Specialty } from '@/types';

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
  medicalScope = 'all',
}) => {
  const initialMedicalSpecialtyFromUrl = React.useMemo(() => {
    if (typeof window === 'undefined') return 'all' as Specialty | 'all';
    return resolveInitialMedicalSpecialtyFromSearch(window.location.search);
  }, []);
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

  useEffect(() => {
    logEventRef.current = logEvent;
  }, [logEvent]);

  useEffect(() => {
    recordRef.current = record;
  }, [record]);

  // Use prop UI state (shared) or local UI state (if direct mount)
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
    handleMedicalEntryAdd,
    handleMedicalEntryDelete,
    handleMedicalEntryNoteChange,
    handleMedicalEntrySpecialtyChange,
    handleMedicalContinuityConfirm,
    handleShareLink,
    handleSendWhatsAppManual,
    formatPrintDate,
    // Clinical Events handlers
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
    specialtyFilteredBeds,
    scopedMedicalSignature,
    scopedMedicalHandoffSentAt,
    hasAnyVisiblePatients,
  } = React.useMemo(
    () =>
      resolveHandoffScreenState({
        visibleBeds,
        record,
        isMedical,
        medicalScope,
        selectedMedicalSpecialty,
        shouldShowPatient,
      }),
    [visibleBeds, record, isMedical, medicalScope, selectedMedicalSpecialty, shouldShowPatient]
  );

  useEffect(() => {
    if (
      selectedMedicalSpecialty !== 'all' &&
      !medicalSpecialties.includes(selectedMedicalSpecialty)
    ) {
      setSelectedMedicalSpecialty('all');
    }
  }, [medicalSpecialties, selectedMedicalSpecialty]);

  // MINSAL Traceability: Log when clinical data is viewed
  const { userId } = useAuditContext();
  const recordDate = record?.date;
  useEffect(() => {
    if (recordDate) {
      const currentRecord = recordRef.current;
      if (!currentRecord) return;

      // Attribution logic for shared accounts (MINSAL requirement)
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
  }, [recordDate, type, selectedShift, isMedical, userId]); // Only log when essential state changes

  // Update document title for PDF export filename
  useEffect(() => {
    const nextTitle = resolveHandoffDocumentTitle({
      isMedical,
      selectedShift,
      recordDate: record?.date,
    });
    if (!nextTitle) return;
    document.title = nextTitle;

    // Cleanup: Reset title when unmounting
    return () => {
      document.title = 'Hospital Hanga Roa';
    };
  }, [record?.date, selectedShift, isMedical]);

  const title = resolveHandoffTitle({ isMedical, selectedShift });
  const canSendMedicalHandoff = canDoAction(role, ACTIONS.HANDOFF_SEND_WHATSAPP);
  const medicalActions: HandoffMedicalActions = {
    onEntryNoteChange: handleMedicalEntryNoteChange,
    onEntrySpecialtyChange: handleMedicalEntrySpecialtyChange,
    onEntryAdd: handleMedicalEntryAdd,
    onEntryDelete: handleMedicalEntryDelete,
    onContinuityConfirm: handleMedicalContinuityConfirm,
  };
  const clinicalEventActions: HandoffClinicalEventActions = {
    onAdd: handleClinicalEventAdd,
    onUpdate: handleClinicalEventUpdate,
    onDelete: handleClinicalEventDelete,
  };

  const handleOpenCudyr = () => {
    if (ui) ui.setCurrentModule('CUDYR');
  };
  const Icon = isMedical ? Stethoscope : MessageSquare;
  // Removed unused headerColor
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
      {/* Print-only Header */}
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

      {/* Main Header (Visible) with integrated Shift Switcher & Actions */}
      <HandoffHeader
        isMedical={isMedical}
        selectedShift={selectedShift}
        setSelectedShift={setSelectedShift}
        readOnly={readOnly}
        showMedicalShareActions={canSendMedicalHandoff}
        medicalSignature={scopedMedicalSignature}
        medicalHandoffSentAt={scopedMedicalHandoffSentAt}
        onSendWhatsApp={handleSendWhatsAppManual}
        onShareLink={handleShareLink}
        extraAction={
          shouldShowNightCudyrActions({ isMedical, selectedShift }) ? (
            <button
              onClick={handleOpenCudyr}
              className="px-3 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-black transition-all shadow-lg flex items-center gap-2"
            >
              <Activity size={14} />
              CUDYR
            </button>
          ) : undefined
        }
      />

      {/* Compact Staff & Checklist Section (Monitor view) */}
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
          scopedMedicalSignature={scopedMedicalSignature}
          scopedMedicalHandoffSentAt={scopedMedicalHandoffSentAt}
          updateMedicalHandoffDoctor={updateMedicalHandoffDoctor}
          markMedicalHandoffAsSent={markMedicalHandoffAsSent}
          resetMedicalHandoffState={resetMedicalHandoffState}
          selectedMedicalSpecialty={selectedMedicalSpecialty}
          setSelectedMedicalSpecialty={setSelectedMedicalSpecialty}
          medicalSpecialties={medicalSpecialties}
          success={success}
          noteField={noteField}
          onNoteChange={handleNursingNoteChange}
          medicalActions={medicalActions}
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

      {/* CUDYR - Night Nursing Print Only */}
      {shouldShowNightCudyrActions({ isMedical, selectedShift }) && (
        <div className="print:break-before-page">
          <HandoffCudyrPrint />
        </div>
      )}
    </div>
  );
};
