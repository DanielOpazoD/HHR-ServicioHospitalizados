import React from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { DateStrip } from '@/components/layout/DateStrip';
import { SettingsModal } from '@/components/modals/SettingsModal';
import { TestAgent } from '@/components/debug/TestAgent';
import { SyncWatcher } from '@/components/shared/SyncWatcher';
import { BookmarkBar } from '@/components/bookmarks/BookmarkBar';
import StorageStatusBadge from '@/components/layout/StorageStatusBadge';
import { PinLockScreen } from '@/components/security/PinLockScreen';
import { AppRouter } from '@/components/AppRouter';
import { AppProviders } from '@/components/AppProviders';

import { useAuth } from '@/context/AuthContext';
import { UseUIStateReturn } from '@/hooks/useUIState';
import { useCensusContext } from '@/context/CensusContext';
import { useExportManager } from '@/hooks/useExportManager';
import { canEditModule, getVisibleModules } from '@/utils/permissions';
import {
  shouldRenderBookmarkBar,
  shouldRenderDateStrip,
} from '@/components/layout/app-content/appContentVisibilityController';
import { useAppContentEventBridge } from '@/components/layout/app-content/useAppContentEventBridge';
import { CensusEmailConfigModal } from '@/views/LazyViews';
import {
  resolveSpecialistCapabilities,
  resolveSpecialistCensusAccessProfile,
} from '@/shared/access/specialistAccessPolicy';
import { canVerifyArchiveStatusForModule } from '@/shared/access/operationalAccessPolicy';
import { ReminderModal } from '@/components/reminders/ReminderModal';
import { ReminderCenterProvider } from '@/context/ReminderCenterContext';

interface AppContentProps {
  ui: UseUIStateReturn;
}

const loadCensusMasterExcelExporter = async () =>
  import('@/services/exporters/censusMasterExport').then(
    module => module.generateCensusMasterExcel
  );

export const AppContent: React.FC<AppContentProps> = ({ ui }) => {
  // 1. Consume Domain Context
  const {
    dailyRecord: dailyRecordHook,
    dateNav,
    censusEmail,
    fileOps,
    nurseSignature,
    sharedCensus,
  } = useCensusContext();

  const auth = useAuth();
  const { record, syncStatus, lastSyncTime } = dailyRecordHook;
  const { isSignatureMode, currentDateString } = dateNav;
  const specialistCapabilities = React.useMemo(
    () => resolveSpecialistCapabilities(auth.role),
    [auth.role]
  );
  const specialistCensusAccess = specialistCapabilities.isSpecialist;
  const { currentModule, setCurrentModule, censusLocalViewMode, setCensusLocalViewMode } = ui;

  const canVerifyArchiveStatus = React.useMemo(() => {
    return canVerifyArchiveStatusForModule(auth.role, ui.currentModule);
  }, [auth.role, ui.currentModule]);

  // Export Manager Hook
  const exportManager = useExportManager({
    currentDateString,
    selectedYear: dateNav.selectedYear,
    selectedMonth: dateNav.selectedMonth,
    selectedDay: dateNav.selectedDay,
    record,
    currentModule: ui.currentModule,
    selectedShift: ui.selectedShift,
    canVerifyArchiveStatus,
  });

  useAppContentEventBridge({
    setCurrentModule,
    setSelectedShift: ui.setSelectedShift,
  });

  React.useEffect(() => {
    const visibleModules = getVisibleModules(auth.role);
    if (!visibleModules.includes(currentModule)) {
      setCurrentModule(visibleModules[0] || 'CENSUS');
    }
  }, [auth.role, currentModule, setCurrentModule]);

  React.useEffect(() => {
    if (specialistCensusAccess && censusLocalViewMode !== 'TABLE') {
      setCensusLocalViewMode('TABLE');
    }
  }, [censusLocalViewMode, setCensusLocalViewMode, specialistCensusAccess]);

  const handleExportExcel = React.useCallback(async () => {
    const generateCensusMasterExcel = await loadCensusMasterExcelExporter();
    await generateCensusMasterExcel(
      dateNav.selectedYear,
      dateNav.selectedMonth,
      dateNav.selectedDay
    );
  }, [dateNav.selectedDay, dateNav.selectedMonth, dateNav.selectedYear]);

  return (
    <AppProviders dailyRecordHook={dailyRecordHook}>
      <ReminderCenterProvider>
        <div className="min-h-screen bg-slate-100 font-sans flex flex-col print:bg-white print:p-0">
          {/* Navigation */}
          {!isSignatureMode && (
            <Navbar
              currentModule={ui.currentModule}
              setModule={ui.setCurrentModule}
              censusViewMode={ui.censusViewMode}
              setCensusViewMode={ui.setCensusViewMode}
              onOpenBedManager={ui.bedManagerModal.open}
              onExportCSV={fileOps.handleExportCSV}
              onImportJSON={fileOps.handleImportJSON}
              onOpenSettings={ui.settingsModal.open}
              userEmail={auth.currentUser?.email}
              onLogout={auth.signOut}
              isFirebaseConnected={auth.isFirebaseConnected}
              isSharedMode={sharedCensus.isSharedCensusMode}
            />
          )}

          {/* Date Strip - Hide in Analytics mode */}
          {shouldRenderDateStrip({
            currentModule: ui.currentModule,
            censusViewMode: ui.censusViewMode,
            isSignatureMode,
            isSharedCensusMode: sharedCensus.isSharedCensusMode,
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
              onExportExcel={ui.currentModule === 'CENSUS' ? handleExportExcel : undefined}
              onConfigureEmail={
                ui.currentModule === 'CENSUS'
                  ? () => censusEmail.setShowEmailConfig(true)
                  : undefined
              }
              onSendEmail={
                ui.currentModule === 'CENSUS'
                  ? async () => {
                      await exportManager.handleBackupExcel();
                      await censusEmail.sendEmail();
                    }
                  : undefined
              }
              onCopyShareLink={
                ui.currentModule === 'CENSUS'
                  ? () => censusEmail.copyShareLink('viewer')
                  : undefined
              }
              onBackupExcel={
                ui.currentModule === 'CENSUS' ? exportManager.handleBackupExcel : undefined
              }
              isArchived={exportManager.isArchived}
              isBackingUp={exportManager.isBackingUp}
              currentModule={ui.currentModule}
              emailStatus={censusEmail.status}
              emailErrorMessage={censusEmail.error}
              syncStatus={syncStatus}
              lastSyncTime={lastSyncTime}
              onToggleBookmarks={() => ui.setShowBookmarksBar(!ui.showBookmarksBar)}
              showBookmarks={ui.showBookmarksBar}
              role={auth.role}
              localViewMode={ui.censusLocalViewMode}
              setLocalViewMode={ui.setCensusLocalViewMode}
              onBackupPDF={exportManager.handleBackupHandoff}
              navigateDays={dateNav.navigateDays}
              accessProfile={resolveSpecialistCensusAccessProfile(auth.role)}
            />
          )}

          {/* Favorites Bookmark Bar - Hide in Analytics mode */}
          {shouldRenderBookmarkBar({
            currentModule: ui.currentModule,
            censusViewMode: ui.censusViewMode,
            isSignatureMode,
            isSharedCensusMode: sharedCensus.isSharedCensusMode,
            showBookmarksBar: ui.showBookmarksBar,
            role: auth.role,
          }) && <BookmarkBar />}

          {/* Main Content */}
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
              sharedCensus={sharedCensus}
            />
          </main>

          {/* Global Modals */}
          <SettingsModal
            isOpen={ui.settingsModal.isOpen}
            onClose={ui.settingsModal.close}
            onRunTest={() => ui.setIsTestAgentRunning(true)}
          />
          <ReminderModal />

          {censusEmail.showEmailConfig && (
            <React.Suspense fallback={null}>
              <CensusEmailConfigModal
                isOpen={true}
                onClose={() => censusEmail.setShowEmailConfig(false)}
                recipients={censusEmail.recipients}
                onRecipientsChange={censusEmail.setRecipients}
                recipientLists={censusEmail.recipientLists}
                activeRecipientListId={censusEmail.activeRecipientListId}
                onActiveRecipientListChange={censusEmail.setActiveRecipientListId}
                onCreateRecipientList={censusEmail.createRecipientList}
                onRenameRecipientList={censusEmail.renameActiveRecipientList}
                onDeleteRecipientList={censusEmail.deleteRecipientList}
                recipientsSource={censusEmail.recipientsSource}
                isRecipientsSyncing={censusEmail.isRecipientsSyncing}
                recipientsSyncError={censusEmail.recipientsSyncError}
                message={censusEmail.message}
                onMessageChange={censusEmail.onMessageChange}
                onResetMessage={censusEmail.onResetMessage}
                date={currentDateString}
                nursesSignature={nurseSignature}
                isAdminUser={censusEmail.isAdminUser}
                testModeEnabled={censusEmail.testModeEnabled}
                onTestModeChange={censusEmail.setTestModeEnabled}
                testRecipient={censusEmail.testRecipient}
                onTestRecipientChange={censusEmail.setTestRecipient}
                excelSheetConfig={censusEmail.excelSheetConfig}
                onExcelSheetConfigChange={censusEmail.setExcelSheetConfig}
              />
            </React.Suspense>
          )}

          {!sharedCensus.isSharedCensusMode && (
            <TestAgent
              isRunning={ui.isTestAgentRunning}
              onComplete={() => ui.setIsTestAgentRunning(false)}
              currentRecord={record}
            />
          )}

          {!sharedCensus.isSharedCensusMode && (
            <>
              <SyncWatcher />
            </>
          )}

          <PinLockScreen />
          <StorageStatusBadge />
        </div>
      </ReminderCenterProvider>
    </AppProviders>
  );
};
