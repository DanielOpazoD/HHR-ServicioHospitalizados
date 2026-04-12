import { useMemo } from 'react';

import { buildCensusTableLayoutBindings } from '@/features/census/controllers/censusTableLayoutController';
import { useClinicalDocumentPresenceByBed } from '@/features/census/hooks/useClinicalDocumentPresenceByBed';
import { useCensusTableViewModel } from '@/features/census/hooks/useCensusTableViewModel';
import { canReadClinicalDocuments } from '@/application/clinical-documents/clinicalDocumentAccessPolicy';
import type { CensusAccessProfile } from '@/features/census/types/censusAccessProfile';

interface UseCensusTableBindingsModelParams {
  currentDateString: string;
  readOnly?: boolean;
  accessProfile?: CensusAccessProfile;
}

export const useCensusTableBindingsModel = ({
  currentDateString,
  readOnly = false,
  accessProfile = 'default',
}: UseCensusTableBindingsModelParams) => {
  const tableViewModel = useCensusTableViewModel({ currentDateString });
  const canReadClinical = canReadClinicalDocuments(tableViewModel.role);
  const clinicalDocumentPresence = useClinicalDocumentPresenceByBed({
    unifiedRows: tableViewModel.unifiedRows,
    currentDateString,
    enabled: canReadClinical,
  }) ?? {
    byBedId: {},
    infoByBedId: {},
  };
  const clinicalDocumentPresenceByBedId = clinicalDocumentPresence.byBedId ?? {};

  const bindings = useMemo(() => {
    if (!tableViewModel.beds) {
      return null;
    }

    return buildCensusTableLayoutBindings({
      currentDateString,
      readOnly,
      columns: tableViewModel.columns,
      isEditMode: tableViewModel.isEditMode,
      canDeleteRecord: tableViewModel.canDeleteRecord,
      resetDayDeniedMessage: tableViewModel.resetDayDeniedMessage,
      onClearAll: tableViewModel.handleClearAll,
      diagnosisMode: tableViewModel.diagnosisMode,
      accessProfile,
      onToggleDiagnosisMode: tableViewModel.toggleDiagnosisMode,
      onResizeColumn: tableViewModel.handleColumnResize,
      unifiedRows: tableViewModel.unifiedRows,
      bedTypes: tableViewModel.bedTypes,
      role: tableViewModel.role,
      clinicalDocumentPresenceByBedId,
      onAction: tableViewModel.handleRowAction,
      onActivateEmptyBed: tableViewModel.activateEmptyBed,
      totalWidth: tableViewModel.totalWidth,
    });
  }, [
    clinicalDocumentPresenceByBedId,
    currentDateString,
    readOnly,
    accessProfile,
    tableViewModel.activateEmptyBed,
    tableViewModel.bedTypes,
    tableViewModel.beds,
    tableViewModel.canDeleteRecord,
    tableViewModel.columns,
    tableViewModel.diagnosisMode,
    tableViewModel.handleClearAll,
    tableViewModel.handleColumnResize,
    tableViewModel.handleRowAction,
    tableViewModel.isEditMode,
    tableViewModel.unifiedRows,
    tableViewModel.resetDayDeniedMessage,
    tableViewModel.role,
    tableViewModel.toggleDiagnosisMode,
    tableViewModel.totalWidth,
  ]);

  return {
    isReady: Boolean(tableViewModel.beds) && Boolean(bindings),
    bindings,
    clinicalDocumentInfoByBedId: clinicalDocumentPresence.infoByBedId ?? {},
  };
};
