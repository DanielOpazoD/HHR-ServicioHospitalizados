import { describe, expect, it } from 'vitest';
import {
  buildAppShellReadyTelemetry,
  resolveSanitizedCurrentModule,
  shouldRecordAppShellTelemetry,
} from '@/components/layout/app-content/appContentShellEffectsController';

describe('appContentShellEffectsController', () => {
  it('sanitizes inaccessible modules by role', () => {
    expect(
      resolveSanitizedCurrentModule({
        role: 'doctor_specialist',
        currentModule: 'AUDIT',
      })
    ).toBe('CENSUS');
  });

  it('builds app shell telemetry with fallback viewer role', () => {
    expect(
      buildAppShellReadyTelemetry({
        role: undefined as never,
        currentModule: 'CENSUS',
      })
    ).toEqual({
      category: 'daily_record',
      operation: 'app_shell_ready',
      status: 'success',
      context: {
        module: 'CENSUS',
        role: 'viewer',
      },
    });
  });

  it('only records telemetry when it is still pending and not in signature mode', () => {
    expect(
      shouldRecordAppShellTelemetry({
        alreadyRecorded: false,
        isSignatureMode: false,
      })
    ).toBe(true);

    expect(
      shouldRecordAppShellTelemetry({
        alreadyRecorded: true,
        isSignatureMode: false,
      })
    ).toBe(false);

    expect(
      shouldRecordAppShellTelemetry({
        alreadyRecorded: false,
        isSignatureMode: true,
      })
    ).toBe(false);
  });
});
