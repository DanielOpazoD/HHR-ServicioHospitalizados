export type DetailedStaffingShift = 'day' | 'night';
export type DetailedStaffingRole = 'nurse' | 'tens';
export type DetailedStaffingSlotType = 'standard' | 'extra';

export interface DetailedStaffAssignment {
  id: string;
  name: string;
  role: DetailedStaffingRole;
  slotType: DetailedStaffingSlotType;
  standardSlotIndex?: number;
  startTime: string;
  endTime: string;
}

export interface DetailedStaffingShiftState {
  nurses: DetailedStaffAssignment[];
  tens: DetailedStaffAssignment[];
}

export interface DailyRecordStaffingDetailsV1 {
  day: DetailedStaffingShiftState;
  night: DetailedStaffingShiftState;
}
