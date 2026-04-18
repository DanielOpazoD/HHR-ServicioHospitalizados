import type { ShiftType } from '@/types/domain/shift';
import type { HandoffPdfStaffingRecord } from '@/services/pdf/contracts/handoffPdfContracts';
import { calculateHospitalizedDays } from '@/utils/clinicalDayUtils';
import { resolveHandoffShiftStaff } from '@/services/staff/dailyRecordStaffing';
import { getShiftSchedule } from '@/utils/clinicalDayUtils';
import { resolveDetailedStaffingState } from '@/services/staff/dailyRecordDetailedStaffing';
import {
  normalizeStaffSelectionValue,
  shouldOmitExtraStaffSelection,
} from '@/services/staff/staffSelectionPresentation';
import type {
  DetailedStaffAssignment,
  DetailedStaffingRole,
  DetailedStaffingShift,
} from '@/types/domain/dailyRecordStaffingDetails';

export interface Schedule {
  dayStart?: string;
  dayEnd?: string;
  nightStart?: string;
  nightEnd?: string;
}

/**
 * Helper to convert image to DataURI for embedding in PDF.
 */
export const getBase64ImageFromURL = (url: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = url;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0);
      const dataURL = canvas.toDataURL('image/png');
      resolve(dataURL);
    };
    img.onerror = error => reject(error);
  });
};

/**
 * Re-export centralized utility
 */
export { calculateHospitalizedDays };

const formatDetailedAssignmentsForPdf = ({
  record,
  shift,
  role,
}: {
  record: HandoffPdfStaffingRecord;
  shift: DetailedStaffingShift;
  role: DetailedStaffingRole;
}): string[] => {
  if (!record.date) return [];

  const detail = resolveDetailedStaffingState(record, record.date);
  const schedule = getShiftSchedule(record.date);
  const standardTimes =
    shift === 'day'
      ? { startTime: schedule.dayStart, endTime: schedule.dayEnd }
      : { startTime: schedule.nightStart, endTime: schedule.nightEnd };
  const assignments = detail[shift][role === 'nurse' ? 'nurses' : 'tens'];

  return assignments.flatMap((assignment: DetailedStaffAssignment) => {
    if (assignment.slotType === 'extra' && shouldOmitExtraStaffSelection(assignment.name)) {
      return [];
    }

    const displayName = normalizeStaffSelectionValue(assignment.name);
    const showSchedule =
      displayName !== 'Vacante' &&
      (assignment.slotType === 'extra' ||
        assignment.startTime !== standardTimes.startTime ||
        assignment.endTime !== standardTimes.endTime);

    return [
      showSchedule ? `${displayName} (${assignment.startTime}-${assignment.endTime})` : displayName,
    ];
  });
};

/**
 * Get staff info for nursing handoff.
 */
export const getHandoffStaffInfo = (record: HandoffPdfStaffingRecord, selectedShift: ShiftType) => {
  const { receives } = resolveHandoffShiftStaff(record, selectedShift);
  const delivers = formatDetailedAssignmentsForPdf({
    record,
    shift: selectedShift,
    role: 'nurse',
  });
  const tens = formatDetailedAssignmentsForPdf({
    record,
    shift: selectedShift,
    role: 'tens',
  });
  const detailedReceives =
    selectedShift === 'day'
      ? formatDetailedAssignmentsForPdf({
          record,
          shift: 'night',
          role: 'nurse',
        })
      : receives.map(name => normalizeStaffSelectionValue(name));

  return { delivers, receives: detailedReceives, tens };
};
