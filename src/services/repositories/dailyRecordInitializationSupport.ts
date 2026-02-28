import { BEDS } from '@/constants';
import { BedType, DailyRecord, PatientData } from '@/types';
import { clonePatient, createEmptyPatient } from '@/services/factories/patientFactory';

export const preserveCIE10FromPreviousDay = (
  newBeds: Record<string, PatientData>,
  prevBeds: Record<string, PatientData>
): void => {
  for (const bedId of Object.keys(newBeds)) {
    const newPatient = newBeds[bedId];
    const prevPatient = prevBeds[bedId];

    if (!newPatient || !prevPatient) continue;

    const isSamePatient =
      prevPatient.patientName &&
      newPatient.patientName &&
      prevPatient.patientName.trim().toLowerCase() === newPatient.patientName.trim().toLowerCase();

    if (!isSamePatient) continue;

    if (!newPatient.cie10Code && prevPatient.cie10Code) {
      newPatient.cie10Code = prevPatient.cie10Code;
    }
    if (!newPatient.cie10Description && prevPatient.cie10Description) {
      newPatient.cie10Description = prevPatient.cie10Description;
    }

    if (newPatient.clinicalCrib && prevPatient.clinicalCrib) {
      const isSameCribPatient =
        prevPatient.clinicalCrib.patientName &&
        newPatient.clinicalCrib.patientName &&
        prevPatient.clinicalCrib.patientName.trim().toLowerCase() ===
          newPatient.clinicalCrib.patientName.trim().toLowerCase();

      if (!isSameCribPatient) continue;

      if (!newPatient.clinicalCrib.cie10Code && prevPatient.clinicalCrib.cie10Code) {
        newPatient.clinicalCrib.cie10Code = prevPatient.clinicalCrib.cie10Code;
      }
      if (!newPatient.clinicalCrib.cie10Description && prevPatient.clinicalCrib.cie10Description) {
        newPatient.clinicalCrib.cie10Description = prevPatient.clinicalCrib.cie10Description;
      }
    }
  }
};

const clonePatientForNewDay = (prevPatient: PatientData): PatientData => {
  const clonedPatient = clonePatient(prevPatient);
  clonedPatient.cudyr = undefined;

  if (clonedPatient.clinicalCrib) {
    clonedPatient.clinicalCrib.cudyr = undefined;
  }

  const prevNightNote = prevPatient.handoffNoteNightShift || prevPatient.handoffNote || '';
  clonedPatient.handoffNoteDayShift = prevNightNote;
  clonedPatient.handoffNoteNightShift = prevNightNote;

  if (clonedPatient.clinicalCrib && prevPatient.clinicalCrib) {
    const cribPrevNight =
      prevPatient.clinicalCrib.handoffNoteNightShift || prevPatient.clinicalCrib.handoffNote || '';
    clonedPatient.clinicalCrib.handoffNoteDayShift = cribPrevNight;
    clonedPatient.clinicalCrib.handoffNoteNightShift = cribPrevNight;
  }

  return clonedPatient;
};

const buildEmptyBeds = (): Record<string, PatientData> => {
  const initialBeds: Record<string, PatientData> = {};
  BEDS.forEach(bed => {
    initialBeds[bed.id] = createEmptyPatient(bed.id);
  });
  return initialBeds;
};

const resolveInheritedStaff = (prevRecord: DailyRecord | null) => {
  if (!prevRecord) {
    return {
      nursesDay: ['', ''],
      nursesNight: ['', ''],
      tensDay: ['', '', ''],
      tensNight: ['', '', ''],
    };
  }

  const isNightShiftEmpty =
    !prevRecord.nursesNightShift || prevRecord.nursesNightShift.every(n => !n);
  const prevNurses = !isNightShiftEmpty
    ? prevRecord.nursesNightShift
    : prevRecord.nurses || ['', ''];
  const nursesDay = [...(prevNurses || ['', ''])];
  while (nursesDay.length < 2) nursesDay.push('');

  const isNightTensEmpty = !prevRecord.tensNightShift || prevRecord.tensNightShift.every(t => !t);
  const rawTens = !isNightTensEmpty
    ? prevRecord.tensNightShift || ['', '', '']
    : prevRecord.tensDayShift || ['', '', ''];
  const tensDay = [...rawTens];
  while (tensDay.length < 3) tensDay.push('');

  return {
    nursesDay: nursesDay.slice(0, 2),
    nursesNight: ['', ''],
    tensDay: tensDay.slice(0, 3),
    tensNight: ['', '', ''],
  };
};

const shouldClonePreviousPatient = (prevPatient: PatientData): boolean =>
  Boolean(
    prevPatient.patientName ||
    prevPatient.isBlocked ||
    prevPatient.cie10Code ||
    prevPatient.cie10Description ||
    prevPatient.pathology ||
    prevPatient.diagnosisComments
  );

const buildBedsFromPreviousRecord = (
  initialBeds: Record<string, PatientData>,
  prevRecord: DailyRecord
): Record<string, PatientData> => {
  const nextBeds = { ...initialBeds };

  BEDS.forEach(bed => {
    const prevPatient = prevRecord.beds[bed.id];
    if (!prevPatient) return;

    if (shouldClonePreviousPatient(prevPatient)) {
      nextBeds[bed.id] = clonePatientForNewDay(prevPatient);
    } else {
      nextBeds[bed.id].bedMode = prevPatient.bedMode || nextBeds[bed.id].bedMode;
      nextBeds[bed.id].hasCompanionCrib = prevPatient.hasCompanionCrib || false;
    }

    if (prevPatient.location && bed.isExtra) {
      nextBeds[bed.id].location = prevPatient.location;
    }
  });

  return nextBeds;
};

export const buildInitializedDayRecord = (
  date: string,
  prevRecord: DailyRecord | null
): DailyRecord => {
  const dateObj = new Date(`${date}T00:00:00`);
  const initialBeds = buildEmptyBeds();
  const inheritedStaff = resolveInheritedStaff(prevRecord);
  const beds = prevRecord ? buildBedsFromPreviousRecord(initialBeds, prevRecord) : initialBeds;

  return {
    date,
    beds,
    discharges: [],
    transfers: [],
    cma: [],
    bedTypeOverrides: prevRecord
      ? { ...(prevRecord.bedTypeOverrides || {}) }
      : ({} as Record<string, BedType>),
    lastUpdated: new Date().toISOString(),
    dateTimestamp: dateObj.getTime(),
    nurses: ['', ''],
    nursesDayShift: inheritedStaff.nursesDay,
    nursesNightShift: inheritedStaff.nursesNight,
    tensDayShift: inheritedStaff.tensDay,
    tensNightShift: inheritedStaff.tensNight,
    activeExtraBeds: prevRecord ? [...(prevRecord.activeExtraBeds || [])] : [],
    handoffNovedadesDayShift: prevRecord
      ? prevRecord.handoffNovedadesNightShift || prevRecord.handoffNovedadesDayShift || ''
      : '',
  };
};
