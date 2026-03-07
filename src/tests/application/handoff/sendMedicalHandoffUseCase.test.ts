import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/services/integrations/whatsapp/whatsappService', () => ({
  formatHandoffMessage: vi.fn((_template, data) => `Formatted: ${data.signedBy}`),
  sendWhatsAppMessage: vi.fn().mockResolvedValue({ success: true }),
}));

import { executeSendMedicalHandoff } from '@/application/handoff/sendMedicalHandoffUseCase';
import { DataFactory } from '@/tests/factories/DataFactory';
import { Specialty, PatientStatus } from '@/types';
import { sendWhatsAppMessage } from '@/services/integrations/whatsapp/whatsappService';

describe('sendMedicalHandoffUseCase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends handoff and patches sent metadata', async () => {
    const record = DataFactory.createMockDailyRecord('2026-03-05', {
      beds: {
        R1: {
          ...DataFactory.createMockPatient('R1', {
            patientName: 'Paciente',
            rut: '1-9',
            pathology: 'Test',
            specialty: Specialty.MEDICINA,
            status: PatientStatus.ESTABLE,
          }),
          isBlocked: false,
        },
      } as never,
      medicalHandoffDoctor: 'Dr. House',
      activeExtraBeds: [],
    });

    const patchRecord = vi.fn().mockResolvedValue(undefined);

    const outcome = await executeSendMedicalHandoff({
      record,
      templateContent: 'Template',
      targetGroupId: 'group-id',
      patchRecord,
      getPreviousDay: vi.fn().mockResolvedValue(null),
    });

    expect(outcome.status).toBe('success');
    expect(patchRecord).toHaveBeenCalled();
    expect(outcome.data?.doctorName).toBe('Dr. House');
  });

  it('falls back to the previous day doctor when the current record has no doctor assigned', async () => {
    const record = DataFactory.createMockDailyRecord('2026-03-05', {
      beds: {
        R1: {
          ...DataFactory.createMockPatient('R1', {
            patientName: 'Paciente',
            rut: '1-9',
            pathology: 'Test',
            specialty: Specialty.MEDICINA,
            status: PatientStatus.ESTABLE,
          }),
          isBlocked: false,
        },
      } as never,
      medicalHandoffDoctor: '',
      activeExtraBeds: [],
    });

    const patchRecord = vi.fn().mockResolvedValue(undefined);

    const outcome = await executeSendMedicalHandoff({
      record,
      templateContent: 'Template',
      targetGroupId: 'group-id',
      patchRecord,
      getPreviousDay: vi.fn().mockResolvedValue({
        ...record,
        medicalHandoffDoctor: 'Dra. Turno Previo',
      }),
    });

    expect(outcome.status).toBe('success');
    expect(outcome.data?.doctorName).toBe('Dra. Turno Previo');
  });

  it('returns failed when WhatsApp delivery reports a remote error', async () => {
    vi.mocked(sendWhatsAppMessage).mockResolvedValueOnce({
      success: false,
      error: 'Falla remota',
    });

    const record = DataFactory.createMockDailyRecord('2026-03-05', {
      beds: {
        R1: {
          ...DataFactory.createMockPatient('R1', {
            patientName: 'Paciente',
            rut: '1-9',
            pathology: 'Test',
            specialty: Specialty.MEDICINA,
            status: PatientStatus.ESTABLE,
          }),
          isBlocked: false,
        },
      } as never,
      medicalHandoffDoctor: 'Dr. House',
      activeExtraBeds: [],
    });

    const patchRecord = vi.fn().mockResolvedValue(undefined);

    const outcome = await executeSendMedicalHandoff({
      record,
      templateContent: 'Template',
      targetGroupId: 'group-id',
      patchRecord,
      getPreviousDay: vi.fn().mockResolvedValue(null),
    });

    expect(outcome.status).toBe('failed');
    expect(outcome.issues[0]?.message).toBe('Falla remota');
  });
});
