import { describe, expect, it, vi } from 'vitest';
import {
  buildAuthorizedSharedAccessUser,
  resolveSharedCensusPathInfo,
} from '@/features/census/controllers/sharedCensusModeController';
import { systemDateProvider } from '@/features/census/controllers/dateProvider';

const toDate = (value: Date | { toDate: () => Date }): Date =>
  value instanceof Date ? value : value.toDate();

describe('sharedCensusModeController critical coverage', () => {
  it('resolves shared census paths with and without invitation ids', () => {
    expect(resolveSharedCensusPathInfo('')).toEqual({
      isSharedCensusMode: false,
      invitationId: null,
    });

    expect(resolveSharedCensusPathInfo('/censo-compartido/')).toEqual({
      isSharedCensusMode: true,
      invitationId: null,
    });

    expect(resolveSharedCensusPathInfo('/censo-publico/invite-123/details')).toEqual({
      isSharedCensusMode: true,
      invitationId: 'invite-123',
    });
  });

  it('builds a shared access viewer with normalized defaults', () => {
    const now = new Date('2026-03-23T10:00:00.000Z');
    const user = buildAuthorizedSharedAccessUser({
      uid: 'viewer-1',
      email: 'TEST@HHR.CL',
      now,
    });

    expect(user).toMatchObject({
      id: 'viewer-1',
      email: 'test@hhr.cl',
      displayName: 'TEST',
      role: 'viewer',
      createdBy: 'local-auth',
      isActive: true,
    });
    expect(user.createdAt).toEqual(now);
    expect(toDate(user.expiresAt).getTime()).toBeGreaterThan(now.getTime());
  });
});

describe('dateProvider critical coverage', () => {
  it('returns the current system date instance', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-23T12:34:56.000Z'));

    const current = systemDateProvider();

    expect(current.toISOString()).toBe('2026-03-23T12:34:56.000Z');
    vi.useRealTimers();
  });
});
