/** @vitest-environment jsdom */
import '../setup';
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen } from '@testing-library/react';

import { render, createMockDailyRecordContext } from './setup';
import { DataFactory } from '@/tests/factories/DataFactory';
import { bedManagementReducer } from '@/hooks/useBedManagementReducer';
import { applyPatches } from '@/utils/patchUtils';
import { formatTimeHHMM } from '@/utils/dateUtils';
import { CudyrHeader } from '@/features/cudyr/components/CudyrHeader';
import { HandoffCudyrPrint } from '@/features/handoff/components/HandoffCudyrPrint';

describe('CUDYR timestamp flow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-23T10:15:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('propagates the saved CUDYR modification time from reducer output to web header and handoff print', () => {
    const record = DataFactory.createMockDailyRecord('2026-03-23');
    record.beds.R1 = DataFactory.createMockPatient('R1', {
      patientName: 'Paciente Cudyr',
      rut: '1-9',
    });

    const patch = bedManagementReducer(record, {
      type: 'UPDATE_CUDYR',
      bedId: 'R1',
      field: 'changeClothes',
      value: 2,
    });

    expect(patch).not.toBeNull();

    const updatedRecord = applyPatches(record, patch!);
    const expectedTime = formatTimeHHMM(updatedRecord.cudyrUpdatedAt);

    const { container } = render(
      <>
        <CudyrHeader
          occupiedCount={1}
          categorizedCount={0}
          currentDate={updatedRecord.date}
          updatedAt={updatedRecord.cudyrUpdatedAt}
        />
        <HandoffCudyrPrint />
      </>,
      { contextValue: createMockDailyRecordContext(updatedRecord) }
    );

    expect(updatedRecord.cudyrUpdatedAt).toBe('2026-03-23T10:15:00.000Z');
    expect(screen.getByText(new RegExp(`Últ\\. mod\\. ${expectedTime}`))).toBeInTheDocument();
    expect(container).toHaveTextContent(`Últ. mod. CUDYR: ${expectedTime}`);
  });
});
