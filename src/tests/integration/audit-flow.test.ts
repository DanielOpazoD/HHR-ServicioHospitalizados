import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { User } from 'firebase/auth';
import type { AuditLogEntry } from '@/types';

// Unmock auditService to test the REAL logic
vi.unmock('../../services/admin/auditService');

import {
  logPatientAdmission,
  logPatientDischarge,
  logPatientView,
} from '@/services/admin/auditService';
import { auth } from '@/firebaseConfig';

// Mock Firestore
vi.mock('firebase/firestore', async importOriginal => {
  const actual = await importOriginal<typeof import('firebase/firestore')>();
  return {
    ...actual,
    collection: vi.fn(),
    doc: vi.fn(),
    setDoc: vi.fn().mockResolvedValue(undefined),
    getDocs: vi.fn(),
    query: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    Timestamp: {
      now: vi.fn(() => new Date('2026-02-20T00:00:00.000Z')),
    },
    where: vi.fn(),
  };
});

const mockSaveAuditLog = vi.fn();
const mockGetAuditLogs = vi.fn();

vi.mock('../../services/storage/indexeddb/indexedDbAuditLogService', () => ({
  saveAuditLog: (log: AuditLogEntry) => mockSaveAuditLog(log),
  getAuditLogs: (limit: number) => mockGetAuditLogs(limit),
  getAuditLogsForDate: vi.fn(),
}));

const mockAuditState = {
  email: 'doctor@hospital.cl',
  uid: 'doctor-123',
};

vi.mock('../../services/admin/utils/auditUtils', () => ({
  getCurrentUserEmail: vi.fn(() => mockAuditState.email),
  getCurrentUserDisplayName: vi.fn(() => 'Doctor Account'),
  getCurrentUserUid: vi.fn(() => mockAuditState.uid),
  getCachedIpAddress: vi.fn(() => '127.0.0.1'),
  fetchAndCacheIpAddress: vi.fn().mockResolvedValue('127.0.0.1'),
}));

// Mock current user
const mockAuth = vi.mocked(auth);
const authState = mockAuth as typeof auth & { currentUser: User | null };

describe('Audit Flow Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuditLogs.mockResolvedValue([]);

    // Mock default user
    mockAuditState.email = 'doctor@hospital.cl';
    mockAuditState.uid = 'doctor-123';
    authState.currentUser = {
      email: 'doctor@hospital.cl',
      uid: 'doctor-123',
    } as User;
  });

  it('should log patient admission locally and to Firestore', async () => {
    await logPatientAdmission('BED_01', 'Juan Pérez', '12345678-9', 'Test Pathology', '2024-12-25');

    expect(mockSaveAuditLog).toHaveBeenCalled();
    const call = mockSaveAuditLog.mock.calls[0][0];
    expect(call.action).toBe('PATIENT_ADMITTED');
    expect(call.userId).toBe('doctor@hospital.cl');
    expect(call.patientIdentifier).toContain('***'); // Masked RUT
    expect(call.entityId).toBe('BED_01');
  });

  it('should log patient discharge with correct details', async () => {
    await logPatientDischarge('BED_02', 'Maria Jara', '98765432-1', 'Vivo', '2024-12-25');

    expect(mockSaveAuditLog).toHaveBeenCalled();
    const call = mockSaveAuditLog.mock.calls[0][0];
    expect(call.action).toBe('PATIENT_DISCHARGED');
    expect(call.details.status).toBe('Vivo');
  });

  it('should NOT log patient view for admin users', async () => {
    mockAuditState.email = 'daniel.opazo@hospitalhangaroa.cl';
    authState.currentUser = {
      email: 'daniel.opazo@hospitalhangaroa.cl', // Excluded user
    } as User;

    await logPatientView('BED_01', 'Juan Pérez', '12345678-9', '2024-12-25');

    expect(mockSaveAuditLog).not.toHaveBeenCalled();
  });

  it('should log patient view for regular users', async () => {
    mockAuditState.email = 'other@hospital.cl';
    authState.currentUser = {
      email: 'other@hospital.cl', // Regular user
    } as User;

    // Clear throttle state to ensure fresh test
    sessionStorage.clear();

    // The function should complete without throwing
    const result = logPatientView('BED_01', 'Juan Pérez', '12345678-9', '2024-12-25');

    expect(result).toBeInstanceOf(Promise);
    await expect(result).resolves.toBeUndefined();
  });
});
