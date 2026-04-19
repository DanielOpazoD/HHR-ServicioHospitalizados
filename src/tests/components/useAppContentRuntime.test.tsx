import { renderHook, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCensusContext } from '@/context/CensusContext';
import { useAuth } from '@/context/AuthContext';
import { useExportManager } from '@/hooks/useExportManager';
import { useAppContentRuntime } from '@/components/layout/app-content/useAppContentRuntime';

const mockGenerateCensusMasterExcel = vi.fn();

vi.mock('@/services/exporters/censusMasterExport', () => ({
  generateCensusMasterExcel: (...args: unknown[]) => mockGenerateCensusMasterExcel(...args),
}));

vi.mock('@/context/CensusContext', () => ({
  useCensusContext: vi.fn(),
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/hooks/useExportManager', () => ({
  useExportManager: vi.fn(),
}));

describe('useAppContentRuntime', () => {
  type CensusValue = ReturnType<typeof useCensusContext>;
  type AuthValue = ReturnType<typeof useAuth>;
  type ExportManagerValue = ReturnType<typeof useExportManager>;

  const ui = {
    currentModule: 'CENSUS',
    setCurrentModule: vi.fn(),
    censusViewMode: 'REGISTER',
    setCensusViewMode: vi.fn(),
    bedManagerModal: { isOpen: false, open: vi.fn(), close: vi.fn() },
    settingsModal: { isOpen: false, open: vi.fn(), close: vi.fn() },
    showPrintButton: true,
    showBookmarksBar: true,
    setShowBookmarksBar: vi.fn(),
    isTestAgentRunning: false,
    setIsTestAgentRunning: vi.fn(),
    selectedShift: 'day',
    setSelectedShift: vi.fn(),
  } as const;

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useCensusContext).mockReturnValue({
      dailyRecord: { record: { date: '2026-03-27' }, syncStatus: 'synced', lastSyncTime: 'now' },
      dateNav: {
        isSignatureMode: false,
        currentDateString: '2026-03-27',
        selectedYear: 2026,
        selectedMonth: 2,
        selectedDay: 27,
        setSelectedYear: vi.fn(),
        setSelectedMonth: vi.fn(),
        setSelectedDay: vi.fn(),
        daysInMonth: 31,
        existingDaysInMonth: [1, 4],
        navigateDays: vi.fn(),
      },
      censusEmail: {
        showEmailConfig: false,
        setShowEmailConfig: vi.fn(),
        sendEmail: vi.fn(),
        status: 'idle',
        error: null,
        recipients: [],
        setRecipients: vi.fn(),
        recipientLists: [],
        activeRecipientListId: null,
        setActiveRecipientListId: vi.fn(),
        createRecipientList: vi.fn(),
        renameActiveRecipientList: vi.fn(),
        deleteRecipientList: vi.fn(),
        recipientsSource: 'local',
        isRecipientsSyncing: false,
        recipientsSyncError: null,
        message: '',
        onMessageChange: vi.fn(),
        onResetMessage: vi.fn(),
        isAdminUser: true,
        testModeEnabled: false,
        setTestModeEnabled: vi.fn(),
        testRecipient: '',
        setTestRecipient: vi.fn(),
      },
      fileOps: { handleExportCSV: vi.fn(), handleImportJSON: vi.fn() },
      nurseSignature: 'Night Nurse',
    } as unknown as CensusValue);

    vi.mocked(useAuth).mockReturnValue({
      currentUser: { email: 'admin@hospital.cl' },
      role: 'admin',
      signOut: vi.fn(),
      isFirebaseConnected: true,
    } as unknown as AuthValue);

    vi.mocked(useExportManager).mockReturnValue({
      isArchived: false,
      isBackingUp: false,
      handleExportPDF: vi.fn(),
      handleBackupExcel: vi.fn(),
      handleBackupHandoff: vi.fn(),
    } as unknown as ExportManagerValue);
  });

  it('flushes the active editor before exporting excel', async () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    const blurSpy = vi.spyOn(input, 'blur');
    input.focus();

    const { result } = renderHook(() => useAppContentRuntime({ ui: ui as never }));

    await act(async () => {
      await result.current.handleExportExcel();
    });

    expect(blurSpy).toHaveBeenCalledTimes(1);
    expect(mockGenerateCensusMasterExcel).toHaveBeenCalledWith(2026, 2, 27);

    blurSpy.mockRestore();
    document.body.removeChild(input);
  });

  it('resolves export permissions and passes archive verification into useExportManager', () => {
    renderHook(() => useAppContentRuntime({ ui: ui as never }));

    expect(useExportManager).toHaveBeenCalledWith(
      expect.objectContaining({
        currentModule: 'CENSUS',
        selectedShift: 'day',
        canVerifyArchiveStatus: true,
        flushBeforeExport: expect.any(Function),
      })
    );
  });

  it('disables census exports for restricted specialist roles', () => {
    vi.mocked(useAuth).mockReturnValue({
      currentUser: { email: 'doctor@hospital.cl' },
      role: 'doctor_urgency',
      signOut: vi.fn(),
      isFirebaseConnected: true,
    } as unknown as AuthValue);

    const { result } = renderHook(() => useAppContentRuntime({ ui: ui as never }));

    expect(result.current.canUseCensusExports).toBe(false);
  });

  it('derives the excel export handler from the selected date', async () => {
    const { result } = renderHook(() => useAppContentRuntime({ ui: ui as never }));

    await act(async () => {
      await result.current.handleExportExcel();
    });

    expect(mockGenerateCensusMasterExcel).toHaveBeenCalledWith(2026, 2, 27);
  });
});
