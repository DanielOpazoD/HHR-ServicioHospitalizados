import React from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { DateStrip } from '@/components/layout/DateStrip';
import { lazyWithRetry } from '@/utils/lazyWithRetry';
import { AppRouter } from '@/components/AppRouter';

const BookmarkBar = lazyWithRetry(() =>
  import('@/components/bookmarks/BookmarkBar').then(m => ({ default: m.BookmarkBar }))
);
import { BEDS } from '@/constants/beds';
import {
  shouldRenderBookmarkBar,
  shouldRenderDateStrip,
  shouldShowBookmarkToggle,
} from '@/components/layout/app-content/appContentVisibilityController';
import { resolveCensusDateSelection } from '@/components/layout/app-content/appContentCensusDateController';
import type { UseUIStateReturn } from '@/hooks/useUIState';
import type { AppContentRuntime } from '@/components/layout/app-content/useAppContentRuntime';
import type { MedicalIndicationsPatientOption } from '@/shared/contracts/medicalIndications';
import { formatDateToCL } from '@/utils/clinicalUtils';

export interface AppContentChromeProps {
  ui: UseUIStateReturn;
  runtime: AppContentRuntime;
  renderFeatureQuickActions?: (patients: MedicalIndicationsPatientOption[]) => React.ReactNode;
}

const calculateDaysOfStay = (admissionDate?: string): string => {
  if (!admissionDate) return '';
  const parsed = new Date(formatDateToCL(admissionDate).split('-').reverse().join('-'));
  if (Number.isNaN(parsed.getTime())) return '';
  const now = new Date();
  const days = Math.ceil((now.getTime() - parsed.getTime()) / (1000 * 60 * 60 * 24));
  return String(Math.max(days, 1));
};

const buildMedicalIndicationsPatientOptions = (
  record: AppContentRuntime['record']
): MedicalIndicationsPatientOption[] => {
  const bedsById = new Map(BEDS.map(bed => [bed.id, bed]));

  return Object.entries(record?.beds || {})
    .filter(([, patient]) => Boolean(patient.patientName?.trim()))
    .map(([bedId, patient]) => ({
      bedId,
      label: `${bedsById.get(bedId)?.name || bedId} · ${patient.patientName}`,
      patientName: patient.patientName || '',
      rut: patient.rut || '',
      diagnosis: patient.cie10Description || patient.pathology || '',
      age: patient.age || '',
      birthDate: formatDateToCL(patient.birthDate || ''),
      allergies: '',
      admissionDate: formatDateToCL(patient.admissionDate || ''),
      daysOfStay: calculateDaysOfStay(patient.admissionDate),
      treatingDoctor: '',
    }));
};

const canUseCensusDateStripActions = (
  currentModule: UseUIStateReturn['currentModule'],
  canUseCensusExports: boolean
) => currentModule === 'CENSUS' && canUseCensusExports;

const resolveDateStripCensusActions = ({
  canUseCensusActions,
  censusEmail,
  exportManager,
  handleExportExcel,
}: {
  canUseCensusActions: boolean;
  censusEmail: AppContentRuntime['censusEmail'];
  exportManager: AppContentRuntime['exportManager'];
  handleExportExcel: AppContentRuntime['handleExportExcel'];
}) => ({
  onExportExcel: canUseCensusActions ? handleExportExcel : undefined,
  onConfigureEmail: canUseCensusActions ? () => censusEmail.setShowEmailConfig(true) : undefined,
  onSendEmail: canUseCensusActions
    ? async () => {
        await exportManager.handleBackupExcel();
        await censusEmail.sendEmail();
      }
    : undefined,
  onBackupExcel: canUseCensusActions ? exportManager.handleBackupExcel : undefined,
});

export const AppContentChrome: React.FC<AppContentChromeProps> = ({
  ui,
  runtime,
  renderFeatureQuickActions,
}) => {
  const { auth, dateNav, censusEmail, fileOps, syncStatus, lastSyncTime, exportManager } = runtime;
  const { isSignatureMode, currentDateString } = dateNav;

  const medicalIndicationsPatients = React.useMemo<MedicalIndicationsPatientOption[]>(() => {
    return buildMedicalIndicationsPatientOptions(runtime.record);
  }, [runtime.record]);

  const canUseCensusActions = canUseCensusDateStripActions(
    ui.currentModule,
    runtime.canUseCensusExports
  );
  const dateStripCensusActions = resolveDateStripCensusActions({
    canUseCensusActions,
    censusEmail,
    exportManager,
    handleExportExcel: runtime.handleExportExcel,
  });

  const openCensusDate = React.useCallback(
    (isoDate: string) => {
      const selection = resolveCensusDateSelection(isoDate);
      if (!selection) {
        return;
      }

      ui.setCurrentModule('CENSUS');
      ui.setCensusViewMode('REGISTER');
      dateNav.setSelectedYear(selection.year);
      dateNav.setSelectedMonth(selection.month);
      dateNav.setSelectedDay(selection.day);
    },
    [dateNav, ui]
  );

  return (
    <>
      {!isSignatureMode && (
        <Navbar
          currentModule={ui.currentModule}
          setModule={ui.setCurrentModule}
          censusViewMode={ui.censusViewMode}
          setCensusViewMode={ui.setCensusViewMode}
          onOpenBedManager={ui.bedManagerModal.open}
          onExportCSV={fileOps.handleExportCSV}
          onImportJSON={fileOps.handleImportJSON}
          userEmail={auth.currentUser?.email}
          onLogout={auth.signOut}
          isFirebaseConnected={auth.isFirebaseConnected}
        />
      )}

      {shouldRenderDateStrip({
        currentModule: ui.currentModule,
        censusViewMode: ui.censusViewMode,
        isSignatureMode,
      }) && (
        <DateStrip
          selectedYear={dateNav.selectedYear}
          setSelectedYear={dateNav.setSelectedYear}
          selectedMonth={dateNav.selectedMonth}
          setSelectedMonth={dateNav.setSelectedMonth}
          selectedDay={dateNav.selectedDay}
          setSelectedDay={dateNav.setSelectedDay}
          currentDateString={currentDateString}
          daysInMonth={dateNav.daysInMonth}
          existingDaysInMonth={dateNav.existingDaysInMonth}
          onExportPDF={ui.showPrintButton ? exportManager.handleExportPDF : undefined}
          onOpenBedManager={ui.currentModule === 'CENSUS' ? ui.bedManagerModal.open : undefined}
          onExportExcel={dateStripCensusActions.onExportExcel}
          onConfigureEmail={dateStripCensusActions.onConfigureEmail}
          onSendEmail={dateStripCensusActions.onSendEmail}
          onBackupExcel={dateStripCensusActions.onBackupExcel}
          isArchived={exportManager.isArchived}
          isBackingUp={exportManager.isBackingUp}
          currentModule={ui.currentModule}
          emailStatus={censusEmail.status}
          emailErrorMessage={censusEmail.error}
          syncStatus={syncStatus}
          lastSyncTime={lastSyncTime}
          onToggleBookmarks={
            shouldShowBookmarkToggle({
              currentModule: ui.currentModule,
              censusViewMode: ui.censusViewMode,
              role: auth.role,
            })
              ? () => ui.setShowBookmarksBar(!ui.showBookmarksBar)
              : undefined
          }
          showBookmarks={ui.showBookmarksBar}
          role={auth.role}
          onBackupPDF={exportManager.handleBackupHandoff}
          navigateDays={dateNav.navigateDays}
          accessProfile={runtime.censusAccessProfile}
          medicalIndicationsPatients={medicalIndicationsPatients}
          renderFeatureQuickActions={renderFeatureQuickActions}
          onOpenPatientSearch={ui.patientSearchModal.open}
        />
      )}

      {shouldRenderBookmarkBar({
        currentModule: ui.currentModule,
        censusViewMode: ui.censusViewMode,
        isSignatureMode,
        showBookmarksBar: ui.showBookmarksBar,
        role: auth.role,
      }) && (
        <React.Suspense fallback={null}>
          <BookmarkBar />
        </React.Suspense>
      )}

      <main className="max-w-screen-2xl mx-auto px-4 pt-4 pb-20 flex-1 w-full print:p-0 print:pb-0 print:max-w-none">
        <AppRouter
          ui={ui}
          currentModule={ui.currentModule}
          censusViewMode={ui.censusViewMode}
          selectedDay={dateNav.selectedDay}
          selectedMonth={dateNav.selectedMonth}
          currentDateString={currentDateString}
          role={auth.role}
          isSignatureMode={isSignatureMode}
          showBedManagerModal={ui.bedManagerModal.isOpen}
          onCloseBedManagerModal={ui.bedManagerModal.close}
          onOpenCensusDate={openCensusDate}
        />
      </main>
    </>
  );
};
