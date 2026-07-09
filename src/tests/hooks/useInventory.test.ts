import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useInventory } from '@/hooks/useInventory';
import {
  createDailyRecordFixture,
  createPatientBedFixture,
} from '@/tests/support/dailyRecordFixtures';

describe('useInventory', () => {
  it('should return default values when record is null', () => {
    const { result } = renderHook(() => useInventory(null));

    expect(result.current.occupiedCount).toBe(0);
    expect(result.current.blockedCount).toBe(0);
    expect(result.current.occupancyRate).toBe(0);
    expect(result.current.isFull).toBe(false);
    expect(result.current.occupiedBeds).toEqual([]);
    expect(result.current.blockedBeds).toEqual([]);
  });

  it('should calculate occupied beds correctly', () => {
    const mockRecord = createDailyRecordFixture({
      beds: {
        R1: createPatientBedFixture('R1', { patientName: 'Patient A' }),
        R2: createPatientBedFixture('R2', { patientName: 'Patient B' }),
        R3: createPatientBedFixture('R3', { patientName: '' }),
      },
    });

    const { result } = renderHook(() => useInventory(mockRecord));

    expect(result.current.occupiedBeds).toContain('R1');
    expect(result.current.occupiedBeds).toContain('R2');
    expect(result.current.occupiedCount).toBe(2);
  });

  it('should calculate blocked beds correctly', () => {
    const mockRecord = createDailyRecordFixture({
      beds: {
        R1: createPatientBedFixture('R1', { patientName: '', isBlocked: true }),
        R2: createPatientBedFixture('R2', { patientName: '', isBlocked: false }),
      },
    });

    const { result } = renderHook(() => useInventory(mockRecord));

    expect(result.current.blockedBeds).toContain('R1');
    expect(result.current.blockedCount).toBe(1);
  });

  it('should calculate free beds correctly', () => {
    const mockRecord = createDailyRecordFixture({
      beds: {
        R1: createPatientBedFixture('R1', { patientName: '' }),
        R2: createPatientBedFixture('R2', { patientName: '' }),
      },
    });

    const { result } = renderHook(() => useInventory(mockRecord));

    expect(result.current.freeBeds.length).toBeGreaterThan(0);
  });

  it('should handle empty beds object', () => {
    const mockRecord = createDailyRecordFixture({ beds: {} });

    const { result } = renderHook(() => useInventory(mockRecord));

    expect(result.current.occupiedCount).toBe(0);
    expect(result.current.blockedCount).toBe(0);
  });

  it('should calculate occupancy rate correctly', () => {
    const mockRecord = createDailyRecordFixture({
      beds: {
        R1: createPatientBedFixture('R1', { patientName: 'Patient A' }),
      },
    });

    const { result } = renderHook(() => useInventory(mockRecord));

    expect(result.current.occupancyRate).toBeGreaterThan(0);
  });
});
