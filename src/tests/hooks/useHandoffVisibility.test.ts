import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useHandoffVisibility } from '@/hooks/useHandoffVisibility';
import {
  createDailyRecordFixture,
  createPatientBedFixture,
} from '@/tests/support/dailyRecordFixtures';

// Mock constants
vi.mock('@/constants/beds', () => ({
  BEDS: [
    { id: 'R1', name: 'Room 1', isExtra: false },
    { id: 'R2', name: 'Room 2', isExtra: false },
    { id: 'E1', name: 'Extra 1', isExtra: true },
  ],
}));

// Mock dateUtils
vi.mock('@/utils/dateUtils', () => ({
  isAdmittedDuringShift: vi.fn().mockReturnValue(true),
}));

describe('useHandoffVisibility', () => {
  const mockRecord = createDailyRecordFixture({
    date: '2024-12-28',
    beds: {
      R1: createPatientBedFixture('R1', {
        patientName: 'Patient A',
        admissionDate: '2024-12-27',
      }),
      R2: createPatientBedFixture('R2', { patientName: '', isBlocked: true }),
      E1: createPatientBedFixture('E1', { patientName: '' }),
    },
    activeExtraBeds: [],
  });

  it('should return empty arrays when record is null', () => {
    const { result } = renderHook(() => useHandoffVisibility(null, 'day'));

    expect(result.current.visibleBeds).toEqual([]);
    expect(result.current.hasAnyPatients).toBe(false);
  });

  it('should filter out extra beds when not active', () => {
    const { result } = renderHook(() => useHandoffVisibility(mockRecord, 'day'));

    const bedIds = result.current.visibleBeds.map(b => b.id);
    expect(bedIds).toContain('R1');
    expect(bedIds).toContain('R2');
    expect(bedIds).not.toContain('E1');
  });

  it('should include active extra beds', () => {
    const recordWithExtraBed = {
      ...mockRecord,
      activeExtraBeds: ['E1'],
    };

    const { result } = renderHook(() => useHandoffVisibility(recordWithExtraBed, 'day'));

    const bedIds = result.current.visibleBeds.map(b => b.id);
    expect(bedIds).toContain('E1');
  });

  it('should show blocked beds', () => {
    const { result } = renderHook(() => useHandoffVisibility(mockRecord, 'day'));

    expect(result.current.shouldShowPatient('R2')).toBe(true);
  });

  it('should detect if there are any patients', () => {
    const { result } = renderHook(() => useHandoffVisibility(mockRecord, 'day'));

    expect(result.current.hasAnyPatients).toBe(true);
  });

  it('should return false for empty bed', () => {
    const recordWithEmptyBed = createDailyRecordFixture({
      date: '2024-12-28',
      beds: {
        R1: createPatientBedFixture('R1', { patientName: '' }),
      },
      activeExtraBeds: [],
    });

    const { result } = renderHook(() => useHandoffVisibility(recordWithEmptyBed, 'day'));

    expect(result.current.shouldShowPatient('R1')).toBe(false);
  });
});
