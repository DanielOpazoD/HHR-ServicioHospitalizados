import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAuditStats, formatDuration, getActionCriticality } from '@/hooks/useAuditStats';
import { AuditLogEntry } from '@/types/auditLogTypes';

describe('useAuditStats', () => {
  const FIXED_TS = '2026-01-01T10:00:00.000Z';
  const FIXED_HOUR = new Date(FIXED_TS).getHours();
  const mockLogs: AuditLogEntry[] = [
    {
      id: '1',
      timestamp: FIXED_TS,
      userId: 'user1@test.com',
      action: 'PATIENT_ADMITTED',
      entityType: 'patient',
      entityId: 'R1',
      details: {},
    },
    {
      id: '2',
      timestamp: FIXED_TS,
      userId: 'user1@test.com',
      action: 'USER_LOGIN',
      entityType: 'user',
      entityId: 'user1@test.com',
      details: {},
    },
    {
      id: '3',
      timestamp: FIXED_TS,
      userId: 'user2@test.com',
      action: 'USER_LOGOUT',
      entityType: 'user',
      entityId: 'user2@test.com',
      details: { durationSeconds: 1200 }, // 20m
    },
  ];

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(FIXED_TS));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should calculate basic counts correctly', () => {
    const { result } = renderHook(() => useAuditStats(mockLogs));

    expect(result.current.todayCount).toBe(3);
    expect(result.current.criticalCount).toBe(1); // PATIENT_ADMITTED is critical
    expect(result.current.activeUserCount).toBe(2);
  });

  it('should calculate average session duration', () => {
    const { result } = renderHook(() => useAuditStats(mockLogs));
    expect(result.current.avgSessionMinutes).toBe(20);
  });

  it('should provide hourly activity breakdown', () => {
    const { result } = renderHook(() => useAuditStats(mockLogs));
    expect(result.current.hourlyActivity[FIXED_HOUR]).toBe(3);
  });

  it('should identify top users', () => {
    const { result } = renderHook(() => useAuditStats(mockLogs));
    expect(result.current.topUsers[0].email).toBe('user1@test.com');
    expect(result.current.topUsers[0].count).toBe(2);
  });

  describe('Utilities', () => {
    it('formatDuration should format correctly', () => {
      expect(formatDuration(45)).toBe('45m');
      expect(formatDuration(60)).toBe('1h');
      expect(formatDuration(90)).toBe('1h 30m');
    });

    it('getActionCriticality should return correct level', () => {
      expect(getActionCriticality('PATIENT_ADMITTED')).toBe('critical');
      expect(getActionCriticality('PATIENT_MODIFIED')).toBe('important');
      expect(getActionCriticality('USER_LOGIN')).toBe('info');
    });
  });
});
