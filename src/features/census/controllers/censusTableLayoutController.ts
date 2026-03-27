import type { CSSProperties } from 'react';
import type { TableColumnConfig } from '@/context/TableConfigContext';
import type {
  DiagnosisMode,
  OccupiedBedRow,
  BedTypesById,
} from '@/features/census/types/censusTableTypes';
import type { BedDefinition } from '@/types/domain/base';
import type { PatientData } from '@/features/census/components/patient-row/patientRowDataContracts';
import type { UserRole } from '@/types/auth';
import type { PatientRowAction } from '@/features/census/types/patientRowActionTypes';
import type {
  CensusTableBodyProps,
  CensusTableHeaderProps,
} from '@/features/census/types/censusTableComponentContracts';
import type { CensusAccessProfile } from '@/features/census/types/censusAccessProfile';
import {
  resolveVisibleCensusColumnCount,
  resolveVisibleCensusColumns,
  resolveVisibleCensusTotalWidth,
} from '@/features/census/controllers/censusTableColumnProfileController';

export interface CensusTableLayoutParams {
  currentDateString: string;
  readOnly: boolean;
  columns: TableColumnConfig;
  isEditMode: boolean;
  canDeleteRecord: boolean;
  resetDayDeniedMessage: string;
  onClearAll: () => Promise<void>;
  diagnosisMode: DiagnosisMode;
  accessProfile?: CensusAccessProfile;
  onToggleDiagnosisMode: () => void;
  onResizeColumn: (column: keyof TableColumnConfig) => (width: number) => void;
  occupiedRows: OccupiedBedRow[];
  emptyBeds: BedDefinition[];
  bedTypes: BedTypesById;
  role?: UserRole;
  clinicalDocumentPresenceByBedId: Record<string, boolean>;
  onAction: (action: PatientRowAction, bedId: string, patient: PatientData) => void;
  onActivateEmptyBed: (bedId: string) => void;
  totalWidth: number;
}

export interface CensusTableLayoutBindings {
  headerProps: CensusTableHeaderProps;
  bodyProps: CensusTableBodyProps;
  tableStyle: CSSProperties;
}

export const resolveCensusTableStyle = (totalWidth: number): CSSProperties => ({
  width: `${totalWidth}px`,
  minWidth: '100%',
});

export const buildCensusTableLayoutBindings = (
  params: CensusTableLayoutParams
): CensusTableLayoutBindings => {
  const projectedColumns = resolveVisibleCensusColumns(params.columns, params.accessProfile);
  const visibleColumnCount = resolveVisibleCensusColumnCount(params.columns, params.accessProfile);
  const visibleTotalWidth = resolveVisibleCensusTotalWidth(params.columns, params.accessProfile);

  return {
    headerProps: {
      readOnly: params.readOnly,
      columns: projectedColumns,
      isEditMode: params.isEditMode,
      canDeleteRecord: params.canDeleteRecord,
      resetDayDeniedMessage: params.resetDayDeniedMessage,
      onClearAll: params.onClearAll,
      diagnosisMode: params.diagnosisMode,
      accessProfile: params.accessProfile,
      onToggleDiagnosisMode: params.onToggleDiagnosisMode,
      onResizeColumn: params.onResizeColumn,
    },
    bodyProps: {
      occupiedRows: params.occupiedRows,
      emptyBeds: params.emptyBeds,
      currentDateString: params.currentDateString,
      readOnly: params.readOnly,
      diagnosisMode: params.diagnosisMode,
      columns: projectedColumns,
      visibleColumnCount,
      bedTypes: params.bedTypes,
      role: params.role,
      accessProfile: params.accessProfile,
      clinicalDocumentPresenceByBedId: params.clinicalDocumentPresenceByBedId,
      onAction: params.onAction,
      onActivateEmptyBed: params.onActivateEmptyBed,
    },
    tableStyle: resolveCensusTableStyle(visibleTotalWidth),
  };
};
