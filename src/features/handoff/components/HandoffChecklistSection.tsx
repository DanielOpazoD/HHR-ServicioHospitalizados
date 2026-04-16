import React from 'react';
import type { DailyRecord } from '@/domain/handoff/recordContracts';
import { HandoffStaffSelector } from './HandoffStaffSelector';
import { HandoffStaffDisplay } from './HandoffStaffDisplay';
import { HandoffChecklistDay } from './HandoffChecklistDay';
import { HandoffChecklistNight } from './HandoffChecklistNight';
import { HandoffShiftSwitcher } from './HandoffShiftSwitcher';
import { buildHandoffChecklistSectionViewModel } from '@/features/handoff/controllers/handoffViewController';

interface HandoffChecklistSectionProps {
  isMedical: boolean;
  selectedShift: 'day' | 'night';
  setSelectedShift?: (shift: 'day' | 'night') => void;
  record: DailyRecord;
  deliversList: string[];
  receivesList: string[];
  nursesList: string[];
  readOnly: boolean;
  onUpdateStaff: (
    shift: 'day' | 'night',
    type: 'delivers' | 'receives' | 'tens',
    list: string[]
  ) => void;
  onUpdateChecklist: (shift: 'day' | 'night', field: string, value: boolean | string) => void;
  /** Optional action rendered at the right of the shift tabs row (e.g. CUDYR button) */
  extraAction?: React.ReactNode;
}

export const HandoffChecklistSection: React.FC<HandoffChecklistSectionProps> = ({
  isMedical,
  selectedShift,
  setSelectedShift,
  record,
  deliversList,
  receivesList,
  nursesList,
  readOnly,
  onUpdateStaff,
  onUpdateChecklist,
  extraAction,
}) => {
  const checklistSectionViewModel = buildHandoffChecklistSectionViewModel({
    isMedical,
    selectedShift,
    readOnly,
    hasShiftSwitcher: Boolean(setSelectedShift),
  });
  const { shouldRender, showShiftSwitcher, isReceivesEditable, activeChecklistShift } =
    checklistSectionViewModel;

  if (!shouldRender) return null;

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 p-3 print:hidden ring-1 ring-black/[0.02]">
      {/* Row 1: Shift tabs + CUDYR action (same line) */}
      <div className="flex items-center gap-3 mb-2.5 pb-2.5 border-b border-slate-100/80">
        {showShiftSwitcher && setSelectedShift && (
          <HandoffShiftSwitcher selectedShift={selectedShift} setSelectedShift={setSelectedShift} />
        )}
        <div className="flex-1" />
        {extraAction}
      </div>

      {/* Row 2: Staff names — min-h ensures consistent height between day/night shifts */}
      <div className="flex flex-wrap gap-x-6 gap-y-2 items-center mb-2.5 pb-2.5 border-b border-slate-100/80 min-h-[32px]">
        <HandoffStaffDisplay label="Entrega" type="delivers" nurses={deliversList} compact />

        {isReceivesEditable ? (
          <HandoffStaffSelector
            label="Recibe"
            type="receives"
            bgClass=""
            selectedNurses={receivesList}
            availableNurses={nursesList}
            onUpdate={list => onUpdateStaff(selectedShift, 'receives', list)}
            readOnly={false}
            compact
          />
        ) : (
          <HandoffStaffDisplay label="Recibe" type="receives" nurses={receivesList} compact />
        )}

        <div className="flex-1" />
      </div>

      {/* Row 3: Checklist — min-h ensures consistent height between day/night */}
      <div className="min-h-[28px]">
        {activeChecklistShift === 'day' ? (
          <HandoffChecklistDay
            data={record.handoffDayChecklist}
            onUpdate={(field, val) => onUpdateChecklist('day', field, val)}
            readOnly={readOnly}
          />
        ) : (
          <HandoffChecklistNight
            data={record.handoffNightChecklist}
            onUpdate={(field, val) => onUpdateChecklist('night', field, val)}
            readOnly={readOnly}
          />
        )}
      </div>
    </div>
  );
};
