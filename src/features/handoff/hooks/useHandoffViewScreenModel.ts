import { useEffect, useMemo, useRef, useState } from 'react';

import { useDailyRecordData } from '@/context/DailyRecordContext';
import { useDailyRecordHandoffActions } from '@/context/useDailyRecordScopedActions';
import { useStaffContext } from '@/context/StaffContext';
import { useNotification } from '@/context/UIContext';
import { useAuditContext } from '@/context/AuditContext';
import { useAuth } from '@/context';
import { useHandoffLogic } from '@/hooks';
import { useUIState, type UseUIStateReturn } from '@/hooks/useUIState';
import { getAttributedAuthors } from '@/services/admin/attributionService';
import {
  buildHandoffActionBundles,
  resolveHandoffMedicalBindings,
} from '@/features/handoff/controllers/handoffViewBindingsController';
import { resolveMedicalHandoffCapabilities } from '@/features/handoff/controllers/medicalHandoffAccessController';
import {
  resolveHandoffAuditDescriptor,
  resolveHandoffScreenFrame,
  resolveInitialMedicalScopeFromLocation,
  resolveInitialMedicalSpecialtyFromLocation,
} from '@/features/handoff/controllers/handoffViewController';
import type { Specialty } from '@/types/domain/patientClassification';
import type { MedicalHandoffScope } from '@/types/medicalHandoff';
import type {
  HandoffClinicalEventActions,
  HandoffMedicalActions,
} from '../components/handoffRowContracts';

interface UseHandoffViewScreenModelParams {
  type?: 'nursing' | 'medical';
  readOnly?: boolean;
  ui?: UseUIStateReturn;
  medicalScope?: MedicalHandoffScope;
}

export const useHandoffViewScreenModel = ({
  type = 'nursing',
  readOnly = false,
  ui: propUi,
  medicalScope,
}: UseHandoffViewScreenModelParams) => {
  const initialMedicalSpecialtyFromUrl = useMemo(
    () =>
      resolveInitialMedicalSpecialtyFromLocation(
        typeof window === 'undefined' ? undefined : window.location.search
      ),
    []
  );
  const initialMedicalScopeFromUrl = useMemo(
    () =>
      resolveInitialMedicalScopeFromLocation(
        typeof window === 'undefined' ? undefined : window.location.search
      ),
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
  const { logEvent, userId } = useAuditContext();
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

  const handoffLogic = useHandoffLogic({
    type,
    selectedShift: ui.selectedShift,
    setSelectedShift: ui.setSelectedShift,
    onSuccess: success,
  });

  const {
    selectedShift,
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
    handleMedicalRefreshAsCurrent,
    handleShareLink,
    handleSendWhatsAppManual,
    formatPrintDate,
    handleClinicalEventAdd,
    handleClinicalEventUpdate,
    handleClinicalEventDelete,
  } = handoffLogic;

  const medicalBindings = useMemo(
    () =>
      resolveHandoffMedicalBindings({
        visibleBeds,
        record,
        isMedical,
        medicalScope: effectiveMedicalScope,
        selectedMedicalSpecialty,
        shouldShowPatient,
      }),
    [
      effectiveMedicalScope,
      isMedical,
      record,
      selectedMedicalSpecialty,
      shouldShowPatient,
      visibleBeds,
    ]
  );

  const recordDate = record?.date;
  const screenFrame = useMemo(
    () =>
      resolveHandoffScreenFrame({
        isMedical,
        selectedShift,
        role,
        readOnly,
        recordDate,
      }),
    [isMedical, readOnly, recordDate, role, selectedShift]
  );
  const auditDescriptor = useMemo(
    () =>
      resolveHandoffAuditDescriptor({
        isMedical,
        selectedShift,
      }),
    [isMedical, selectedShift]
  );

  useEffect(() => {
    if (!recordDate) {
      return;
    }

    const currentRecord = recordRef.current;
    if (!currentRecord) {
      return;
    }

    const authors = getAttributedAuthors(
      userId,
      currentRecord,
      isMedical ? undefined : (selectedShift as 'day' | 'night')
    );

    logEventRef.current(
      auditDescriptor.action,
      'dailyRecord',
      recordDate,
      auditDescriptor.details,
      undefined,
      recordDate,
      authors
    );
  }, [auditDescriptor, isMedical, recordDate, selectedShift, userId]);

  useEffect(() => {
    const nextTitle = screenFrame.documentTitle;
    if (!nextTitle) {
      return;
    }

    document.title = nextTitle;
    return () => void (document.title = 'Hospital Hanga Roa');
  }, [screenFrame.documentTitle]);

  const medicalCapabilities = useMemo(
    () =>
      resolveMedicalHandoffCapabilities({
        role,
        readOnly: screenFrame.effectiveReadOnly,
        recordDate,
      }),
    [recordDate, role, screenFrame.effectiveReadOnly]
  );

  const {
    medicalActions,
    clinicalEventActions,
  }: {
    medicalActions: HandoffMedicalActions;
    clinicalEventActions: HandoffClinicalEventActions;
  } = useMemo(
    () =>
      buildHandoffActionBundles({
        capabilities: medicalCapabilities,
        onCreatePrimaryEntry: handleMedicalPrimaryEntryCreate,
        onEntryNoteChange: handleMedicalEntryNoteChange,
        onEntrySpecialtyChange: handleMedicalEntrySpecialtyChange,
        onEntryAdd: handleMedicalEntryAdd,
        onEntryDelete: handleMedicalEntryDelete,
        onRefreshAsCurrent: handleMedicalRefreshAsCurrent,
        onAdd: handleClinicalEventAdd,
        onUpdate: handleClinicalEventUpdate,
        onDelete: handleClinicalEventDelete,
      }),
    [
      handleClinicalEventAdd,
      handleClinicalEventDelete,
      handleClinicalEventUpdate,
      handleMedicalEntryAdd,
      handleMedicalEntryDelete,
      handleMedicalEntryNoteChange,
      handleMedicalEntrySpecialtyChange,
      handleMedicalPrimaryEntryCreate,
      handleMedicalRefreshAsCurrent,
      medicalCapabilities,
    ]
  );

  return {
    ui,
    record,
    isMedical,
    role,
    title: screenFrame.title,
    readOnly: screenFrame.effectiveReadOnly,
    nursesList,
    success,
    schedule,
    noteField,
    deliversList,
    receivesList,
    tensList,
    hasAnyPatients,
    visibleBeds,
    selectedShift,
    setSelectedShift: ui.setSelectedShift,
    selectedMedicalSpecialty: medicalBindings.effectiveSelectedMedicalSpecialty,
    setSelectedMedicalSpecialty,
    medicalBindings,
    medicalCapabilities,
    medicalActions,
    clinicalEventActions,
    formatPrintDate,
    shouldShowPatient,
    handleNursingNoteChange,
    handleShareLink,
    handleSendWhatsAppManual,
    updateHandoffChecklist,
    updateHandoffNovedades,
    updateHandoffStaff,
    updateMedicalHandoffDoctor,
    markMedicalHandoffAsSent,
    resetMedicalHandoffState,
    tableHeaderClass: screenFrame.tableHeaderClass,
    Icon: screenFrame.Icon,
  };
};
