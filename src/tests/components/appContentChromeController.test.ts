import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildMedicalIndicationsPatientOptions,
  canUseCensusDateStripActions,
  resolveBookmarkToggleAction,
  resolveDateStripCensusActions,
} from '@/components/layout/app-content/appContentChromeController';

describe('appContentChromeController', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-22T10:00:00.000Z'));
  });

  it('builds medical indication options only for occupied beds', () => {
    const result = buildMedicalIndicationsPatientOptions({
      beds: {
        R1: {
          patientName: 'Ana Test',
          rut: '1-9',
          cie10Description: 'Diagnostico A',
          age: '34a',
          birthDate: '1991-04-02',
          admissionDate: '2026-04-20',
        },
        R2: {
          patientName: '   ',
        },
      },
    } as never);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      bedId: 'R1',
      patientName: 'Ana Test',
      diagnosis: 'Diagnostico A',
      daysOfStay: '3',
    });
  });

  it('enables census date strip actions only on census with export access', () => {
    expect(canUseCensusDateStripActions('CENSUS', true)).toBe(true);
    expect(canUseCensusDateStripActions('CENSUS', false)).toBe(false);
    expect(canUseCensusDateStripActions('NURSING_HANDOFF', true)).toBe(false);
  });

  it('builds enabled census actions when the user can export', async () => {
    const setShowEmailConfig = vi.fn();
    const handleBackupExcel = vi.fn().mockResolvedValue(undefined);
    const sendEmail = vi.fn().mockResolvedValue(undefined);
    const handleExportExcel = vi.fn();

    const actions = resolveDateStripCensusActions({
      canUseCensusActions: true,
      censusEmail: {
        setShowEmailConfig,
        sendEmail,
      } as never,
      exportManager: {
        handleBackupExcel,
      } as never,
      handleExportExcel,
    });

    actions.onConfigureEmail?.();
    actions.onExportExcel?.();
    await actions.onSendEmail?.();

    expect(setShowEmailConfig).toHaveBeenCalledWith(true);
    expect(handleExportExcel).toHaveBeenCalledTimes(1);
    expect(handleBackupExcel).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(actions.onBackupExcel).toBe(handleBackupExcel);
  });

  it('returns no-op actions as undefined when census exports are unavailable', () => {
    const actions = resolveDateStripCensusActions({
      canUseCensusActions: false,
      censusEmail: {} as never,
      exportManager: {} as never,
      handleExportExcel: vi.fn(),
    });

    expect(actions).toEqual({
      onExportExcel: undefined,
      onConfigureEmail: undefined,
      onSendEmail: undefined,
      onBackupExcel: undefined,
    });
  });

  it('builds the bookmark toggle action only when it is allowed', () => {
    const setShowBookmarksBar = vi.fn();
    const toggle = resolveBookmarkToggleAction({
      canShowBookmarkToggle: true,
      showBookmarksBar: true,
      setShowBookmarksBar,
    });

    toggle?.();
    expect(setShowBookmarksBar).toHaveBeenCalledWith(false);

    expect(
      resolveBookmarkToggleAction({
        canShowBookmarkToggle: false,
        showBookmarksBar: true,
        setShowBookmarksBar,
      })
    ).toBeUndefined();
  });
});
