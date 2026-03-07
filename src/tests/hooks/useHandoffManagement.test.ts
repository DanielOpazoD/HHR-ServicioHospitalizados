import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import * as whatsappService from '@/services/integrations/whatsapp/whatsappService';

const mockNotifySuccess = vi.fn();
const mockNotifyError = vi.fn();

// Mock dependencies before importing the hook
vi.mock('@/context/UIContext', () => ({
  useNotification: () => ({
    success: mockNotifySuccess,
    error: mockNotifyError,
  }),
}));

vi.mock('@/context/AuditContext', () => ({
  useAuditContext: () => ({
    logEvent: vi.fn(),
    logDebouncedEvent: vi.fn(),
    userId: 'test-user',
  }),
}));

vi.mock('@/services/integrations/whatsapp/whatsappService', () => ({
  formatHandoffMessage: vi.fn().mockReturnValue('Test message'),
  sendWhatsAppMessage: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('@/services/admin/attributionService', () => ({
  getAttributedAuthors: vi.fn().mockReturnValue([]),
}));

import { useHandoffManagement } from '@/hooks/useHandoffManagement';
import { DailyRecord, DailyRecordPatch } from '@/types';

describe('useHandoffManagement', () => {
  let mockRecord: DailyRecord;
  let mockSaveAndUpdate: (updatedRecord: DailyRecord) => Promise<void>;
  let mockPatchRecord: (partial: DailyRecordPatch) => Promise<void>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSaveAndUpdate = vi.fn().mockResolvedValue(undefined);
    mockPatchRecord = vi.fn().mockResolvedValue(undefined);
    mockRecord = {
      date: '2024-12-28',
      beds: { R1: { patientName: 'Test' } },
      handoffDayChecklist: {},
      handoffNightChecklist: {},
      handoffNovedadesDayShift: '',
      handoffNovedadesNightShift: '',
      medicalHandoffNovedades: '',
    } as unknown as DailyRecord;
  });

  it('should return all management functions', () => {
    const { result } = renderHook(() =>
      useHandoffManagement(mockRecord, mockSaveAndUpdate, mockPatchRecord)
    );

    expect(typeof result.current.updateHandoffChecklist).toBe('function');
    expect(typeof result.current.updateHandoffNovedades).toBe('function');
    expect(typeof result.current.updateMedicalSpecialtyNote).toBe('function');
    expect(typeof result.current.confirmMedicalSpecialtyNoChanges).toBe('function');
    expect(typeof result.current.updateHandoffStaff).toBe('function');
    expect(typeof result.current.updateMedicalSignature).toBe('function');
    expect(typeof result.current.updateMedicalHandoffDoctor).toBe('function');
    expect(typeof result.current.markMedicalHandoffAsSent).toBe('function');
    expect(typeof result.current.ensureMedicalHandoffSignatureLink).toBe('function');
    expect(typeof result.current.sendMedicalHandoff).toBe('function');
  });

  it('should not update checklist when record is null', () => {
    const { result } = renderHook(() =>
      useHandoffManagement(null, mockSaveAndUpdate, mockPatchRecord)
    );

    act(() => {
      result.current.updateHandoffChecklist('day', 'checked', true);
    });

    expect(mockSaveAndUpdate).not.toHaveBeenCalled();
  });

  it('should update day checklist', () => {
    const { result } = renderHook(() =>
      useHandoffManagement(mockRecord, mockSaveAndUpdate, mockPatchRecord)
    );

    act(() => {
      result.current.updateHandoffChecklist('day', 'checked', true);
    });

    expect(mockSaveAndUpdate).toHaveBeenCalled();
  });

  it('should update night checklist', () => {
    const { result } = renderHook(() =>
      useHandoffManagement(mockRecord, mockSaveAndUpdate, mockPatchRecord)
    );

    act(() => {
      result.current.updateHandoffChecklist('night', 'checked', true);
    });

    expect(mockSaveAndUpdate).toHaveBeenCalled();
  });

  it('should update novedades for day shift', () => {
    const { result } = renderHook(() =>
      useHandoffManagement(mockRecord, mockSaveAndUpdate, mockPatchRecord)
    );

    act(() => {
      result.current.updateHandoffNovedades('day', 'Test novedades');
    });

    expect(mockSaveAndUpdate).toHaveBeenCalled();
  });

  it('should update specialty medical handoff and refresh legacy summary', async () => {
    const { result } = renderHook(() =>
      useHandoffManagement(mockRecord, mockSaveAndUpdate, mockPatchRecord)
    );

    await act(async () => {
      await result.current.updateMedicalSpecialtyNote('cirugia', 'Paciente estable', {
        uid: 'doctor-1',
        displayName: 'Dr. Cirugía',
        email: 'cirugia@hospitalhangaroa.cl',
        role: 'doctor_urgency',
      });
    });

    expect(mockSaveAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        medicalHandoffBySpecialty: expect.objectContaining({
          cirugia: expect.objectContaining({
            note: 'Paciente estable',
            version: 1,
            author: expect.objectContaining({
              displayName: 'Dr. Cirugía',
            }),
          }),
        }),
        medicalHandoffNovedades: expect.stringContaining('Cirugía'),
      })
    );
  });

  it('should confirm no changes for a specialty when no update was made today', async () => {
    mockRecord.medicalHandoffBySpecialty = {
      pediatria: {
        note: 'Sin requerimientos nuevos',
        createdAt: '2024-12-20T10:00:00.000Z',
        updatedAt: '2024-12-27T10:00:00.000Z',
        author: {
          uid: 'ped-1',
          displayName: 'Dra. Pediatría',
          email: 'pediatria@hospitalhangaroa.cl',
          specialty: 'pediatria',
        },
        version: 2,
      },
    };

    const { result } = renderHook(() =>
      useHandoffManagement(mockRecord, mockSaveAndUpdate, mockPatchRecord)
    );

    await act(async () => {
      await result.current.confirmMedicalSpecialtyNoChanges({
        specialty: 'pediatria',
        actor: {
          uid: 'admin-1',
          displayName: 'Admin',
          email: 'admin@hospitalhangaroa.cl',
          role: 'admin',
        },
        comment: 'Condición actual sin cambios',
      });
    });

    expect(mockSaveAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        medicalHandoffBySpecialty: expect.objectContaining({
          pediatria: expect.objectContaining({
            dailyContinuity: expect.objectContaining({
              '2024-12-28': expect.objectContaining({
                status: 'confirmed_no_changes',
                comment: 'Condición actual sin cambios',
              }),
            }),
          }),
        }),
      })
    );
  });

  it('should update staff list', () => {
    const { result } = renderHook(() =>
      useHandoffManagement(mockRecord, mockSaveAndUpdate, mockPatchRecord)
    );

    act(() => {
      result.current.updateHandoffStaff('day', 'delivers', ['Nurse 1', 'Nurse 2']);
    });

    expect(mockSaveAndUpdate).toHaveBeenCalled();
  });

  it('should mark medical handoff as sent', async () => {
    const { result } = renderHook(() =>
      useHandoffManagement(mockRecord, mockSaveAndUpdate, mockPatchRecord)
    );

    await act(async () => {
      await result.current.markMedicalHandoffAsSent('Dr. Test');
    });

    expect(mockPatchRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        medicalHandoffDoctor: 'Dr. Test',
        medicalHandoffSentAt: expect.any(String),
        medicalHandoffSentAtByScope: expect.objectContaining({
          all: expect.any(String),
        }),
      })
    );
  });

  it('should scope sent timestamp when sending filtered medical handoff', async () => {
    const { result } = renderHook(() =>
      useHandoffManagement(mockRecord, mockSaveAndUpdate, mockPatchRecord)
    );

    await act(async () => {
      await result.current.markMedicalHandoffAsSent('Dr. UPC', 'upc');
    });

    expect(mockPatchRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        medicalHandoffDoctor: 'Dr. UPC',
        medicalHandoffSentAtByScope: expect.objectContaining({
          upc: expect.any(String),
        }),
      })
    );
  });

  it('should create and persist a signature token before returning the share link', async () => {
    const { result } = renderHook(() =>
      useHandoffManagement(mockRecord, mockSaveAndUpdate, mockPatchRecord)
    );

    let link = '';
    await act(async () => {
      link = await result.current.ensureMedicalHandoffSignatureLink('upc');
    });

    expect(mockPatchRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        medicalSignatureLinkTokenByScope: expect.objectContaining({
          upc: expect.any(String),
        }),
      })
    );
    expect(link).toContain('mode=signature');
    expect(link).toContain('scope=upc');
    expect(link).toContain('token=');
  });

  it('does not mark the handoff as sent when WhatsApp delivery fails', async () => {
    mockRecord.medicalHandoffDoctor = 'Dr. Error';
    vi.mocked(whatsappService.sendWhatsAppMessage).mockResolvedValueOnce({
      success: false,
      error: 'Falla remota',
    });

    const { result } = renderHook(() =>
      useHandoffManagement(mockRecord, mockSaveAndUpdate, mockPatchRecord)
    );

    await act(async () => {
      await result.current.sendMedicalHandoff('Template content', 'group-xyz');
    });

    expect(mockPatchRecord).not.toHaveBeenCalledWith(
      expect.objectContaining({
        medicalHandoffSentAt: expect.any(String),
      })
    );
    expect(mockNotifyError).toHaveBeenCalledWith('Error al enviar', 'Falla remota');
  });

  it('reports an error when attempting to send without an active record', async () => {
    const { result } = renderHook(() =>
      useHandoffManagement(null, mockSaveAndUpdate, mockPatchRecord)
    );

    await act(async () => {
      await result.current.sendMedicalHandoff('Template content', 'group-xyz');
    });

    expect(mockNotifyError).toHaveBeenCalledWith(
      'Error al enviar',
      'No hay entrega médica disponible para enviar.'
    );
  });
});
