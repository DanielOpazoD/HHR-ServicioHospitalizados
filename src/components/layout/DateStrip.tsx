/**
 * DateStrip Component
 * Navigation bar with date selection, action buttons, and export functionality.
 */

import React, { useRef } from 'react';
import { Search } from 'lucide-react';
import { PdfButtons } from './date-strip/actions/PdfButtons';
import { SaveDropdown } from './date-strip/actions/SaveDropdown';
import { HandoffSaveDropdown } from './date-strip/actions/HandoffSaveDropdown';
import { EmailDropdown } from './date-strip/actions/EmailDropdown';
import { resolveShiftedMonthYear } from '@/components/layout/date-strip/dateStripNavigationController';
import { DateStripDayButtons } from '@/components/layout/date-strip/DateStripDayButtons';
import { DateStripQuickActions } from '@/components/layout/date-strip/DateStripQuickActions';
import { DateStripBookmarkToggle } from '@/components/layout/date-strip/DateStripBookmarkToggle';
import { DateStripYearNavigator } from '@/components/layout/date-strip/DateStripYearNavigator';
import { DateStripMonthNavigator } from '@/components/layout/date-strip/DateStripMonthNavigator';
import type { MedicalIndicationsPatientOption } from '@/shared/contracts/medicalIndications';
import { useDateStripWheelNavigation } from '@/components/layout/date-strip/useDateStripWheelNavigation';
import type { CensusAccessProfile } from '@/shared/access/censusAccessProfile';
import { isSpecialistCensusAccessProfile } from '@/shared/access/censusAccessProfile';
import type { ModuleType } from '@/constants/navigationConfig';

export interface DateNavigationProps {
  selectedYear: number;
  setSelectedYear: React.Dispatch<React.SetStateAction<number>>;
  selectedMonth: number;
  setSelectedMonth: React.Dispatch<React.SetStateAction<number>>;
  selectedDay: number;
  setSelectedDay: React.Dispatch<React.SetStateAction<number>>;
  currentDateString: string;
  daysInMonth: number;
  existingDaysInMonth: number[];
  navigateDays: (delta: number) => void;
}

export interface DateStripActionsProps {
  onExportPDF?: () => void;
  onOpenBedManager?: () => void;
  onExportExcel?: () => void;
  onBackupExcel?: () => Promise<void>;
  onBackupPDF?: () => Promise<void>;
  isArchived?: boolean;
  onBackupExcelStatus?: boolean;
}

export interface EmailConfigProps {
  onConfigureEmail?: () => void;
  onSendEmail?: () => void;
  onCopyShareLink?: () => void;
  emailStatus?: 'idle' | 'loading' | 'success' | 'error';
  emailErrorMessage?: string | null;
}

export interface SyncConfigProps {
  syncStatus?: 'idle' | 'saving' | 'saved' | 'error';
  lastSyncTime?: Date | null;
}

export interface BookmarkConfigProps {
  onToggleBookmarks?: () => void;
  showBookmarks?: boolean;
  role?: string;
}

export interface DateStripProps
  extends
    DateNavigationProps,
    DateStripActionsProps,
    EmailConfigProps,
    SyncConfigProps,
    BookmarkConfigProps {
  isBackingUp: boolean;
  currentModule: ModuleType;
  accessProfile?: CensusAccessProfile;
  medicalIndicationsPatients?: MedicalIndicationsPatientOption[];
  renderFeatureQuickActions?: (patients: MedicalIndicationsPatientOption[]) => React.ReactNode;
  onOpenPatientSearch?: () => void;
}

export const DateStrip: React.FC<DateStripProps> = ({
  selectedYear,
  setSelectedYear,
  selectedMonth,
  setSelectedMonth,
  selectedDay,
  setSelectedDay,
  currentDateString: _currentDateString,
  navigateDays,
  daysInMonth,
  existingDaysInMonth,
  onExportPDF,
  onOpenBedManager,
  onExportExcel,
  onBackupExcel,
  onBackupPDF,
  isArchived = false,
  onConfigureEmail,
  onSendEmail,
  onCopyShareLink,
  emailStatus = 'idle',
  emailErrorMessage,
  syncStatus: _syncStatus,
  lastSyncTime: _lastSyncTime,
  onToggleBookmarks,
  showBookmarks,
  role,
  isBackingUp,
  currentModule,
  accessProfile = 'default',
  medicalIndicationsPatients = [],
  renderFeatureQuickActions,
  onOpenPatientSearch,
}) => {
  const daysContainerRef = useRef<HTMLDivElement>(null);

  const isGuest = role === 'viewer';

  const changeMonth = (delta: number) => {
    const nextMonthYear = resolveShiftedMonthYear({
      month: selectedMonth,
      year: selectedYear,
      delta,
    });

    setSelectedMonth(nextMonthYear.month);
    setSelectedYear(nextMonthYear.year);
    setSelectedDay(1);
  };

  const today = new Date();
  const isCurrentMonth = today.getMonth() === selectedMonth && today.getFullYear() === selectedYear;
  const specialistCensusAccess =
    currentModule === 'CENSUS' && isSpecialistCensusAccessProfile(accessProfile);
  const isHandoffModule =
    currentModule === 'NURSING_HANDOFF' || currentModule === 'MEDICAL_HANDOFF';
  const canShowRoleRestrictedActions = !isGuest && !specialistCensusAccess;

  useDateStripWheelNavigation({ containerRef: daysContainerRef, navigateDays });

  return (
    <div
      className="bg-white border-b border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.06)] sticky top-[56px] z-40 print:hidden h-[40px] flex items-center"
      style={{ transform: 'translateZ(0)' }}
    >
      <div className="max-w-screen-2xl mx-auto px-2 py-0.5 w-full">
        <div className="flex items-center justify-center gap-2 w-full">
          <div className="flex items-center gap-1 shrink-0 min-w-0">
            {!isGuest && onToggleBookmarks && (
              <DateStripBookmarkToggle
                onToggleBookmarks={onToggleBookmarks}
                showBookmarks={showBookmarks}
              />
            )}

            {currentModule === 'NURSING_HANDOFF' && !isGuest && (
              <HandoffSaveDropdown
                onExportPDF={onExportPDF}
                onBackupPDF={onBackupPDF}
                isArchived={isArchived}
                isBackingUp={isBackingUp}
                showFirebaseBackupOption={false}
              />
            )}

            {currentModule === 'CENSUS' && canShowRoleRestrictedActions && (
              <SaveDropdown
                onExportExcel={onExportExcel}
                onBackupExcel={onBackupExcel}
                isArchived={isArchived}
                isBackingUp={isBackingUp}
                showFirebaseBackupOption={false}
              />
            )}

            {canShowRoleRestrictedActions && (
              <EmailDropdown
                onSendEmail={onSendEmail}
                onCopyShareLink={onCopyShareLink}
                onConfigureEmail={onConfigureEmail}
                emailStatus={emailStatus}
                emailErrorMessage={emailErrorMessage}
              />
            )}

            {currentModule === 'CENSUS' && <PdfButtons onExportPDF={onExportPDF} />}
          </div>

          <div className="h-4 w-px bg-slate-200/70" />

          <DateStripYearNavigator selectedYear={selectedYear} setSelectedYear={setSelectedYear} />

          <div className="h-4 w-px bg-slate-200/70" />

          <DateStripMonthNavigator
            selectedMonth={selectedMonth}
            onChangeMonth={changeMonth}
            onSelectMonth={(month: number) => {
              setSelectedMonth(month);
              setSelectedDay(1);
            }}
          />

          <div className="h-4 w-px bg-slate-200/70" />

          <div
            ref={daysContainerRef}
            className="flex gap-1 py-0.5 overflow-hidden justify-center shrink-0"
          >
            <DateStripDayButtons
              selectedDay={selectedDay}
              setSelectedDay={setSelectedDay}
              daysInMonth={daysInMonth}
              existingDaysInMonth={existingDaysInMonth}
              selectedYear={selectedYear}
              selectedMonth={selectedMonth}
              isCurrentMonth={isCurrentMonth}
              today={today}
              currentModule={currentModule}
            />
          </div>

          <div className="h-4 w-px bg-slate-200/70" />

          <div className="flex items-center justify-end gap-1 min-w-0 shrink-0">
            {!isHandoffModule && onOpenPatientSearch && (
              <button
                onClick={onOpenPatientSearch}
                className="flex h-[30px] items-center justify-center gap-1 px-3 py-0 bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-700 rounded-lg border border-slate-200 transition-colors text-[10px] font-semibold min-w-[96px]"
                title="Buscar paciente (Ctrl+K)"
              >
                <Search size={13} />
                <span className="hidden sm:inline">Buscar</span>
              </button>
            )}

            <DateStripQuickActions
              onOpenBedManager={specialistCensusAccess ? undefined : onOpenBedManager}
              renderFeatureQuickActions={renderFeatureQuickActions}
              hideClinicalQuickActions={isHandoffModule}
              medicalIndicationsPatients={
                currentModule === 'CENSUS' ? medicalIndicationsPatients : []
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
};
