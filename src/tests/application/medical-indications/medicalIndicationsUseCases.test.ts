import { describe, expect, it, vi } from 'vitest';
import {
  executeArchiveMedicalIndicationTemplate,
  executeCreateMedicalIndicationRecord,
  executeCreateMedicalIndicationTemplate,
} from '@/application/medical-indications/medicalIndicationsUseCases';
import type {
  MedicalIndicationRecordPort,
  MedicalIndicationTemplatePort,
} from '@/application/ports/medicalIndicationPort';
import type { MedicalIndicationsPatientOption } from '@/shared/contracts/medicalIndications';

const patient: MedicalIndicationsPatientOption = {
  bedId: 'R1',
  label: 'R1 - Ana Test',
  patientName: 'Ana Test',
  rut: '11.111.111-1',
  diagnosis: 'Neumonia',
  age: '63',
  birthDate: '1963-01-01',
  allergies: 'No conocidas',
  admissionDate: '2026-05-27',
  daysOfStay: '3',
  treatingDoctor: 'Dra. Rapa Nui',
  clinicalEpisodeId: 'ep_ana_20260527',
};

describe('medicalIndications use cases', () => {
  it('creates personal templates scoped to the Firebase user id and audits the action', async () => {
    const templatePort: MedicalIndicationTemplatePort = {
      listActiveByUser: vi.fn(),
      create: vi.fn().mockResolvedValue(undefined),
      update: vi.fn(),
      archive: vi.fn(),
      markUsed: vi.fn(),
    };
    const writeAuditEvent = vi
      .fn()
      .mockResolvedValue({ status: 'success', data: null, errors: [] });

    const template = await executeCreateMedicalIndicationTemplate(
      {
        userId: 'user_doctor',
        userLabel: 'doctor@example.com',
        text: 'Control de signos vitales cada 6 horas',
        now: '2026-05-29T10:00:00.000Z',
      },
      { templatePort, writeAuditEvent }
    );

    expect(template.userId).toBe('user_doctor');
    expect(template.text).toBe('Control de signos vitales cada 6 horas');
    expect(templatePort.create).toHaveBeenCalledWith(template, undefined);
    expect(writeAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'doctor@example.com',
        action: 'MEDICAL_INDICATION_TEMPLATE_CREATED',
        entityType: 'medicalIndicationTemplate',
        entityId: template.id,
      })
    );
  });

  it('archives personal templates instead of hard deleting them', async () => {
    const templatePort: MedicalIndicationTemplatePort = {
      listActiveByUser: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      archive: vi.fn().mockResolvedValue(undefined),
      markUsed: vi.fn(),
    };
    const writeAuditEvent = vi
      .fn()
      .mockResolvedValue({ status: 'success', data: null, errors: [] });

    await executeArchiveMedicalIndicationTemplate(
      {
        templateId: 'tpl-1',
        userId: 'user_doctor',
        userLabel: 'doctor@example.com',
        now: '2026-05-29T11:00:00.000Z',
      },
      { templatePort, writeAuditEvent }
    );

    expect(templatePort.archive).toHaveBeenCalledWith(
      'tpl-1',
      'user_doctor',
      '2026-05-29T11:00:00.000Z',
      undefined
    );
  });

  it('persists generated indications as a shared clinical record before printing', async () => {
    const recordPort: MedicalIndicationRecordPort = {
      create: vi.fn().mockResolvedValue(undefined),
    };
    const writeAuditEvent = vi
      .fn()
      .mockResolvedValue({ status: 'success', data: null, errors: [] });

    const record = await executeCreateMedicalIndicationRecord(
      {
        patient,
        targetDate: '2026-05-31',
        generatedAt: '2026-05-29T10:42:00.000Z',
        generatedByUserId: 'user_doctor',
        generatedByName: 'Dra. Test',
        generatedByRole: 'doctor_specialist',
        generatedByAuditLabel: 'doctor@example.com',
        generatedFromTemplateIds: ['tpl-1'],
        content: {
          reposo: 'Relativo',
          regimen: 'Liviano',
          kineType: 'motora',
          kineTimes: '2 veces/dia',
          treatingDoctor: 'Dra. Rapa Nui',
          pendingNotes: 'Revisar examenes',
          indications: ['Control de signos vitales cada 6 horas'],
        },
      },
      { recordPort, writeAuditEvent }
    );

    expect(record).toMatchObject({
      episodeId: 'ep_ana_20260527',
      targetDate: '2026-05-31',
      generatedAt: '2026-05-29T10:42:00.000Z',
      daysOfStayForTargetDate: '5',
      generatedFromTemplateIds: ['tpl-1'],
    });
    expect(recordPort.create).toHaveBeenCalledWith(record, undefined);
    expect(writeAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'MEDICAL_INDICATION_RECORD_CREATED',
        entityType: 'medicalIndicationRecord',
        entityId: record.id,
        patientRut: '11.111.111-1',
        recordDate: '2026-05-31',
      })
    );
  });
});
