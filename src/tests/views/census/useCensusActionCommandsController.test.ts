import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useCensusActionCommandsController } from '@/features/census/hooks/useCensusActionCommandsController';
import { useCensusDischargeCommand } from '@/features/census/hooks/useCensusDischargeCommand';
import { useCensusMoveOrCopyCommand } from '@/features/census/hooks/useCensusMoveOrCopyCommand';
import { useCensusRowActionCommand } from '@/features/census/hooks/useCensusRowActionCommand';
import { useCensusTransferCommand } from '@/features/census/hooks/useCensusTransferCommand';

vi.mock('@/features/census/hooks/useCensusDischargeCommand', () => ({
  useCensusDischargeCommand: vi.fn(),
}));

vi.mock('@/features/census/hooks/useCensusMoveOrCopyCommand', () => ({
  useCensusMoveOrCopyCommand: vi.fn(),
}));

vi.mock('@/features/census/hooks/useCensusRowActionCommand', () => ({
  useCensusRowActionCommand: vi.fn(),
}));

vi.mock('@/features/census/hooks/useCensusTransferCommand', () => ({
  useCensusTransferCommand: vi.fn(),
}));

describe('useCensusActionCommandsController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('wires specialized command hooks and exposes their resolved handlers', () => {
    const executeMoveOrCopy = vi.fn();
    const executeDischarge = vi.fn();
    const executeTransfer = vi.fn();
    const handleRowAction = vi.fn();

    vi.mocked(useCensusMoveOrCopyCommand).mockReturnValue(executeMoveOrCopy);
    vi.mocked(useCensusDischargeCommand).mockReturnValue(executeDischarge);
    vi.mocked(useCensusTransferCommand).mockReturnValue(executeTransfer);
    vi.mocked(useCensusRowActionCommand).mockReturnValue(handleRowAction);

    const runtimeRefs = {
      actionStateRef: { current: { type: null, sourceBedId: null, targetBedId: null } },
      dischargeStateRef: { current: { bedId: null, isOpen: false, status: 'Vivo' as const } },
      transferStateRef: {
        current: {
          bedId: null,
          isOpen: false,
          evacuationMethod: 'Avión comercial' as const,
          evacuationMethodOther: '',
          receivingCenter: 'Hospital Salvador' as const,
          receivingCenterOther: '',
          transferEscort: '',
        },
      },
      recordRef: { current: null },
      stabilityRulesRef: {
        current: {
          canPerformActions: true,
          canEditField: () => true,
          isDateLocked: false,
          isDayShiftLocked: false,
          isNightShiftLocked: false,
        },
      },
      clearPatientRef: { current: vi.fn() },
      moveOrCopyPatientRef: { current: vi.fn() },
      addDischargeRef: { current: vi.fn() },
      updateDischargeRef: { current: vi.fn() },
      addTransferRef: { current: vi.fn() },
      updateTransferRef: { current: vi.fn() },
      addCmaRef: { current: vi.fn() },
      copyPatientToDateRef: { current: vi.fn() },
      confirmRef: { current: vi.fn() },
      notifyErrorRef: { current: vi.fn() },
    } as const;

    const setActionState = vi.fn();
    const setDischargeState = vi.fn();
    const setTransferState = vi.fn();

    const { result } = renderHook(() =>
      useCensusActionCommandsController({
        ...runtimeRefs,
        setActionState,
        setDischargeState,
        setTransferState,
        getCurrentTime: () => '10:15',
      })
    );

    expect(useCensusRowActionCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        stabilityRulesRef: runtimeRefs.stabilityRulesRef,
        setActionState,
        setDischargeState,
        setTransferState,
      })
    );
    expect(useCensusMoveOrCopyCommand).toHaveBeenCalled();
    expect(useCensusDischargeCommand).toHaveBeenCalled();
    expect(useCensusTransferCommand).toHaveBeenCalled();
    expect(result.current.executeMoveOrCopy).toBe(executeMoveOrCopy);
    expect(result.current.executeDischarge).toBe(executeDischarge);
    expect(result.current.executeTransfer).toBe(executeTransfer);
    expect(result.current.handleRowAction).toBe(handleRowAction);
  });
});
