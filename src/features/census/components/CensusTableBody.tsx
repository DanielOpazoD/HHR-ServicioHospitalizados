import React from 'react';
import { EmptyBedRow } from '@/features/census/components/EmptyBedRow';
import { PatientRow } from '@/features/census/components/PatientRow';
import { CensusEmptyBedsDividerRow } from '@/features/census/components/CensusEmptyBedsDividerRow';
import {
  buildResolvedOccupiedRows,
  shouldRenderEmptyBedsDivider,
} from '@/features/census/controllers/censusTableBodyController';
import type { CensusTableBodyProps } from '@/features/census/types/censusTableComponentContracts';

export const CensusTableBody: React.FC<CensusTableBodyProps> = ({
  occupiedRows,
  emptyBeds,
  currentDateString,
  readOnly,
  diagnosisMode,
  columns,
  visibleColumnCount,
  bedTypes,
  role,
  accessProfile,
  clinicalDocumentPresenceByBedId,
  onAction,
  onActivateEmptyBed,
}) => {
  const showEmptyBedsDivider = shouldRenderEmptyBedsDivider(emptyBeds.length);
  const resolvedOccupiedRows = buildResolvedOccupiedRows({
    occupiedRows,
    currentDateString,
    clinicalDocumentPresenceByBedId,
  });

  return (
    <tbody>
      {resolvedOccupiedRows.map(({ row, actionMenuAlign, indicators }) => (
        <PatientRow
          key={row.id}
          bed={row.bed}
          data={row.data}
          currentDateString={currentDateString}
          onAction={onAction}
          readOnly={readOnly}
          actionMenuAlign={actionMenuAlign}
          diagnosisMode={diagnosisMode}
          isSubRow={row.isSubRow}
          bedType={bedTypes[row.bed.id]}
          role={role}
          accessProfile={accessProfile}
          indicators={indicators}
        />
      ))}

      {showEmptyBedsDivider ? (
        <CensusEmptyBedsDividerRow
          emptyBedsCount={emptyBeds.length}
          visibleColumnCount={visibleColumnCount}
        />
      ) : null}

      {emptyBeds.map(bed => (
        <EmptyBedRow
          key={bed.id}
          bed={bed}
          columns={columns}
          visibleColumnCount={visibleColumnCount}
          readOnly={readOnly}
          onClick={() => onActivateEmptyBed(bed.id)}
        />
      ))}
    </tbody>
  );
};
