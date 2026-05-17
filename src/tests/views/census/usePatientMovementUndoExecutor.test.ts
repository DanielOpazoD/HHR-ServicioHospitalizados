import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { DataFactory } from '@/tests/factories/DataFactory';
import { usePatientMovementUndoExecutor } from '@/features/census/hooks/usePatientMovementUndoExecutor';
import { createEmptyPatient } from '@/services/factories/patientFactory';

describe('usePatientMovementUndoExecutor', () => {
  it('applies undo and persists updated record on success', async () => {
    const record = DataFactory.createMockDailyRecord('2025-01-01');
    const saveAndUpdate = vi.fn();
    const notifyUndoError = vi.fn();
    const updatedRecord = DataFactory.createMockDailyRecord('2025-01-02');
    const applyUndoRecord = vi.fn(() => updatedRecord);

    const { result } = renderHook(() =>
      usePatientMovementUndoExecutor({
        createEmptyPatient,
        saveAndUpdate,
        notifyUndoError,
      })
    );

    await result.current({
      kind: 'discharge',
      movement: {
        id: 'd-1',
        bedId: 'R1',
        bedName: 'R1',
        patientName: 'Paciente X',
        originalData: DataFactory.createMockPatient('R1', { patientName: 'Restaurado' }),
      },
      record,
      applyUndoRecord,
    });

    expect(notifyUndoError).not.toHaveBeenCalled();
    expect(applyUndoRecord).toHaveBeenCalledTimes(1);
    expect(saveAndUpdate).toHaveBeenCalledWith(updatedRecord);
  });

  it('fires undo success only after persistence accepts the change', async () => {
    const record = DataFactory.createMockDailyRecord('2025-01-01');
    const deferred = Promise.withResolvers<void>();
    const saveAndUpdate = vi.fn().mockReturnValue(deferred.promise);
    const notifyUndoError = vi.fn();
    const onSuccess = vi.fn();
    const updatedRecord = DataFactory.createMockDailyRecord('2025-01-02');
    const applyUndoRecord = vi.fn(() => updatedRecord);

    const { result } = renderHook(() =>
      usePatientMovementUndoExecutor({
        createEmptyPatient,
        saveAndUpdate,
        notifyUndoError,
      })
    );

    const execution = result.current({
      kind: 'discharge',
      movement: {
        id: 'd-1',
        bedId: 'R1',
        bedName: 'R1',
        patientName: 'Paciente X',
        originalData: DataFactory.createMockPatient('R1', { patientName: 'Restaurado' }),
      },
      record,
      applyUndoRecord,
      onSuccess,
    });

    await Promise.resolve();
    expect(onSuccess).not.toHaveBeenCalled();

    deferred.resolve();
    await execution;
    expect(onSuccess).toHaveBeenCalledWith({
      movement: expect.objectContaining({ id: 'd-1' }),
      updatedBed: expect.objectContaining({ patientName: 'Restaurado' }),
    });
  });

  it('notifies undo error when restore validation fails', () => {
    const record = DataFactory.createMockDailyRecord('2025-01-01');
    record.beds.R1 = DataFactory.createMockPatient('R1', { patientName: 'Ocupante' });
    const saveAndUpdate = vi.fn();
    const notifyUndoError = vi.fn();
    const applyUndoRecord = vi.fn();

    const { result } = renderHook(() =>
      usePatientMovementUndoExecutor({
        createEmptyPatient,
        saveAndUpdate,
        notifyUndoError,
      })
    );

    result.current({
      kind: 'transfer',
      movement: {
        id: 't-1',
        bedId: 'R1',
        bedName: 'R1',
        patientName: 'Paciente X',
        originalData: DataFactory.createMockPatient('R1', { patientName: 'Restaurado' }),
      },
      record,
      applyUndoRecord,
    });

    expect(saveAndUpdate).not.toHaveBeenCalled();
    expect(applyUndoRecord).not.toHaveBeenCalled();
    expect(notifyUndoError).toHaveBeenCalledWith('transfer', 'MAIN_BED_OCCUPIED', {
      patientName: 'Paciente X',
      bedName: 'R1',
    });
  });

  it('does nothing when movement has no originalData', () => {
    const record = DataFactory.createMockDailyRecord('2025-01-01');
    const saveAndUpdate = vi.fn();
    const notifyUndoError = vi.fn();
    const applyUndoRecord = vi.fn();

    const { result } = renderHook(() =>
      usePatientMovementUndoExecutor({
        createEmptyPatient,
        saveAndUpdate,
        notifyUndoError,
      })
    );

    result.current({
      kind: 'discharge',
      movement: {
        id: 'd-1',
        bedId: 'R1',
        bedName: 'R1',
        patientName: 'Paciente X',
      },
      record,
      applyUndoRecord,
    });

    expect(saveAndUpdate).not.toHaveBeenCalled();
    expect(notifyUndoError).not.toHaveBeenCalled();
  });
});
