import React from 'react';
import { lazyWithRetry } from '@/utils/lazyWithRetry';
import { SyncWatcher } from '@/components/shared/SyncWatcher';
import StorageStatusBadge from '@/components/layout/StorageStatusBadge';
import { PinLockScreen } from '@/components/security/PinLockScreen';
import { CensusEmailConfigModal } from '@/views/LazyViews';
import type { UseUIStateReturn } from '@/hooks/useUIState';
import type { AppContentRuntime } from '@/components/layout/app-content/useAppContentRuntime';

const SettingsModal = lazyWithRetry(() =>
  import('@/components/modals/SettingsModal').then(m => ({ default: m.SettingsModal }))
);
const TestAgent = lazyWithRetry(() =>
  import('@/components/debug/TestAgent').then(m => ({ default: m.TestAgent }))
);
const ReminderModal = lazyWithRetry(() =>
  import('@/components/reminders/ReminderModal').then(m => ({ default: m.ReminderModal }))
);

export interface AppContentOverlaysProps {
  ui: UseUIStateReturn;
  runtime: AppContentRuntime;
}

export const AppContentOverlays: React.FC<AppContentOverlaysProps> = ({ ui, runtime }) => {
  const {
    censusEmail,
    dateNav: { currentDateString },
    nurseSignature,
    record,
  } = runtime;

  return (
    <>
      <React.Suspense fallback={null}>
        <SettingsModal
          isOpen={ui.settingsModal.isOpen}
          onClose={ui.settingsModal.close}
          onRunTest={() => ui.setIsTestAgentRunning(true)}
        />
      </React.Suspense>
      <React.Suspense fallback={null}>
        <ReminderModal />
      </React.Suspense>

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
          />
        </React.Suspense>
      )}

      <React.Suspense fallback={null}>
        <TestAgent
          isRunning={ui.isTestAgentRunning}
          onComplete={() => ui.setIsTestAgentRunning(false)}
          currentRecord={record}
        />
      </React.Suspense>

      <SyncWatcher />
      <PinLockScreen />
      <StorageStatusBadge />
    </>
  );
};
