import React from 'react';
import { EmptyBedRow } from '@/features/census/components/EmptyBedRow';
import { PatientRow } from '@/features/census/components/PatientRow';
import { CensusEmptyBedsDividerRow } from '@/features/census/components/CensusEmptyBedsDividerRow';
import {
  resolvePatientRowMenuAlign,
  shouldRenderEmptyBedsDivider,
} from '@/features/census/controllers/censusTableBodyController';
import { resolveIsNewAdmissionForRecord } from '@/features/census/controllers/patientRowNewAdmissionIndicatorController';
import type { CensusTableBodyProps } from '@/features/census/types/censusTableComponentContracts';

export const CensusTableBody: React.FC<CensusTableBodyProps> = ({
  occupiedRows,
  emptyBeds,
  currentDateString,
  readOnly,
  diagnosisMode,
  bedTypes,
  role,
  clinicalDocumentPresenceByBedId,
  onAction,
  onActivateEmptyBed,
}) => {
  const showEmptyBedsDivider = shouldRenderEmptyBedsDivider(emptyBeds.length);

  return (
    <tbody>
      {occupiedRows.map((row, index) => (
        <PatientRow
          key={row.id}
          bed={row.bed}
          data={row.data}
          currentDateString={currentDateString}
          onAction={onAction}
          readOnly={readOnly}
          actionMenuAlign={resolvePatientRowMenuAlign(index, occupiedRows.length)}
          diagnosisMode={diagnosisMode}
          isSubRow={row.isSubRow}
          bedType={bedTypes[row.bed.id]}
          role={role}
          indicators={{
            hasClinicalDocument:
              !row.isSubRow && Boolean(clinicalDocumentPresenceByBedId[row.bed.id]),
            isNewAdmission:
              !row.isSubRow &&
              resolveIsNewAdmissionForRecord({
                recordDate: currentDateString,
                admissionDate: row.data.admissionDate,
                admissionTime: row.data.admissionTime,
              }),
          }}
        />
      ))}

      {showEmptyBedsDivider ? (
        <CensusEmptyBedsDividerRow emptyBedsCount={emptyBeds.length} />
      ) : null}

      {emptyBeds.map(bed => (
        <EmptyBedRow
          key={bed.id}
          bed={bed}
          readOnly={readOnly}
          onClick={() => onActivateEmptyBed(bed.id)}
        />
      ))}
    </tbody>
  );
};
