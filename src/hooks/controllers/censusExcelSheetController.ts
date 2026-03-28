import type { CensusExportRecord } from '@/services/contracts/censusExportServiceContracts';
import type { CensusWorkbookSheetDescriptor } from '@/services/exporters/censusMasterWorkbook';

interface BuildCensusSheetDescriptorsParams {
  monthRecords: CensusExportRecord[];
  currentDateString: string;
  now?: Date;
}

export interface CensusWorkbookBuildPlan {
  records: CensusExportRecord[];
  sheetDescriptors: CensusWorkbookSheetDescriptor[];
}

const EXCEL_SHEET_NAME_MAX_LENGTH = 31;

const toSheetDate = (isoDate: string): string => {
  const [year, month, day] = isoDate.split('-');
  return `${day}-${month}-${year}`;
};

const toSheetTime = (date: Date): string => {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

const toSheetTimeToken = (time: string): string => time.replace(':', '-');

const sanitizeSheetName = (sheetName: string): string => {
  const normalized = sheetName.replace(/[\\/?*:[\]]/g, '-').trim();
  return (normalized || 'Hoja').slice(0, EXCEL_SHEET_NAME_MAX_LENGTH);
};

const reserveUniqueName = (desiredName: string, usedNames: Set<string>): string => {
  const baseName = sanitizeSheetName(desiredName);
  if (!usedNames.has(baseName)) {
    usedNames.add(baseName);
    return baseName;
  }

  let index = 2;
  while (index < 200) {
    const candidate = sanitizeSheetName(`${baseName} (${index})`);
    if (!usedNames.has(candidate)) {
      usedNames.add(candidate);
      return candidate;
    }
    index += 1;
  }

  const fallback = sanitizeSheetName(`Hoja-${Date.now()}`);
  usedNames.add(fallback);
  return fallback;
};

const deepCloneRecord = (record: CensusExportRecord): CensusExportRecord =>
  JSON.parse(JSON.stringify(record)) as CensusExportRecord;

const parseTimeParts = (timeValue?: string): { hours: number; minutes: number } | null => {
  if (!timeValue || typeof timeValue !== 'string') {
    return null;
  }

  const match = timeValue.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (Number.isNaN(hours) || Number.isNaN(minutes) || hours > 23 || minutes > 59) {
    return null;
  }

  return { hours, minutes };
};

const resolveDateTime = ({
  dateValue,
  timeValue,
  fallbackDate,
}: {
  dateValue?: string;
  timeValue?: string;
  fallbackDate: string;
}): Date | null => {
  const resolvedDate = dateValue || fallbackDate;
  const timeParts = parseTimeParts(timeValue);

  const isoDateTime = `${resolvedDate}T${
    timeParts
      ? `${String(timeParts.hours).padStart(2, '0')}:${String(timeParts.minutes).padStart(2, '0')}`
      : '00:00'
  }:00`;

  const resolved = new Date(isoDateTime);
  if (Number.isNaN(resolved.getTime())) {
    return null;
  }

  return resolved;
};

const isMovementIncludedInCutoff = (
  movementDate: string | undefined,
  movementTime: string | undefined,
  fallbackDate: string,
  cutoff: Date
): boolean => {
  const movementDateTime = resolveDateTime({
    dateValue: movementDate,
    timeValue: movementTime,
    fallbackDate,
  });
  if (!movementDateTime) {
    return true;
  }
  return movementDateTime.getTime() <= cutoff.getTime();
};

const buildRecordSnapshotAtCutoff = (
  record: CensusExportRecord,
  cutoff: Date
): CensusExportRecord => {
  const snapshot = deepCloneRecord(record);

  Object.entries(snapshot.beds || {}).forEach(([bedId, patient]) => {
    if (!patient) return;

    const admissionDateTime = resolveDateTime({
      dateValue: patient.admissionDate,
      timeValue: patient.admissionTime,
      fallbackDate: record.date,
    });

    if (admissionDateTime && admissionDateTime.getTime() > cutoff.getTime()) {
      // Patient admitted after cutoff: the bed should appear free in this snapshot.
      delete snapshot.beds[bedId];
      return;
    }

    if (patient.clinicalCrib) {
      const cribAdmissionDateTime = resolveDateTime({
        dateValue: patient.clinicalCrib.admissionDate,
        timeValue: patient.clinicalCrib.admissionTime,
        fallbackDate: record.date,
      });
      if (cribAdmissionDateTime && cribAdmissionDateTime.getTime() > cutoff.getTime()) {
        delete patient.clinicalCrib;
      }
    }
  });

  const movementsAfterCutoff = [
    ...(snapshot.discharges || []).map(discharge => ({
      bedId: discharge.bedId,
      movementDate: discharge.movementDate,
      movementTime: discharge.time,
      originalData: discharge.originalData,
    })),
    ...(snapshot.transfers || []).map(transfer => ({
      bedId: transfer.bedId,
      movementDate: transfer.movementDate,
      movementTime: transfer.time,
      originalData: transfer.originalData,
    })),
  ]
    .map(movement => ({
      ...movement,
      movementDateTime: resolveDateTime({
        dateValue: movement.movementDate,
        timeValue: movement.movementTime,
        fallbackDate: record.date,
      }),
    }))
    .filter(
      movement =>
        movement.movementDateTime && movement.movementDateTime.getTime() > cutoff.getTime()
    )
    .sort((a, b) => {
      const aTime = a.movementDateTime?.getTime() ?? 0;
      const bTime = b.movementDateTime?.getTime() ?? 0;
      return aTime - bTime;
    });

  movementsAfterCutoff.forEach(movement => {
    if (!movement.bedId || !movement.originalData) return;
    snapshot.beds[movement.bedId] = JSON.parse(
      JSON.stringify(movement.originalData)
    ) as NonNullable<typeof movement.originalData>;
  });

  snapshot.discharges = (snapshot.discharges || []).filter(discharge =>
    isMovementIncludedInCutoff(discharge.movementDate, discharge.time, record.date, cutoff)
  );
  snapshot.transfers = (snapshot.transfers || []).filter(transfer =>
    isMovementIncludedInCutoff(transfer.movementDate, transfer.time, record.date, cutoff)
  );

  return snapshot;
};

export const buildCensusWorkbookPlan = ({
  monthRecords,
  currentDateString,
  now = new Date(),
}: BuildCensusSheetDescriptorsParams): CensusWorkbookBuildPlan => {
  const usedNames = new Set<string>();
  const normalizedRecords = [...monthRecords].sort((a, b) => a.date.localeCompare(b.date));
  const currentTime = toSheetTime(now);
  const recordsForWorkbook: CensusExportRecord[] = [];
  const sheetDescriptors: CensusWorkbookSheetDescriptor[] = [];

  normalizedRecords.forEach(record => {
    const sheetDate = toSheetDate(record.date);

    if (record.date !== currentDateString) {
      const recordLookupIndex = recordsForWorkbook.push(deepCloneRecord(record)) - 1;
      sheetDescriptors.push({
        recordLookupIndex,
        recordDate: record.date,
        sheetName: reserveUniqueName(sheetDate, usedNames),
      });
      return;
    }

    const currentRecordSnapshot = buildRecordSnapshotAtCutoff(record, now);
    const recordLookupIndex = recordsForWorkbook.push(currentRecordSnapshot) - 1;
    sheetDescriptors.push({
      recordLookupIndex,
      recordDate: record.date,
      sheetName: reserveUniqueName(`${sheetDate} ${toSheetTimeToken(currentTime)}`, usedNames),
      snapshotLabel: `Hora actual ${currentTime}`,
    });
  });

  return {
    records: recordsForWorkbook,
    sheetDescriptors,
  };
};

export const buildCensusWorkbookSheetDescriptors = ({
  monthRecords,
  currentDateString,
  now = new Date(),
}: BuildCensusSheetDescriptorsParams): CensusWorkbookSheetDescriptor[] => {
  return buildCensusWorkbookPlan({
    monthRecords,
    currentDateString,
    now,
  }).sheetDescriptors;
};
