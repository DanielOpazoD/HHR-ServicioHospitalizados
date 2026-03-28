import { describe, expect, it } from 'vitest';
import type { DailyRecord } from '@/types/domain/dailyRecord';
import type { ClinicalDocumentRecord } from '@/domain/clinical-documents/entities';
import { PatientStatus, Specialty } from '@/types/domain/patientClassification';
import {
  buildClinicalAISummaryContext,
  buildClinicalAISummaryPrompt,
} from '@/application/ai/clinicalSummaryContextUseCase';

const record: DailyRecord = {
  date: '2026-03-25',
  beds: {
    R1: {
      bedId: 'R1',
      isBlocked: false,
      bedMode: 'Cama',
      hasCompanionCrib: false,
      patientName: 'Paciente Demo',
      rut: '11.111.111-1',
      age: '54',
      pathology: 'Neumonía comunitaria',
      specialty: Specialty.MEDICINA,
      status: PatientStatus.ESTABLE,
      admissionDate: '2026-03-20',
      hasWristband: true,
      devices: ['VVP'],
      surgicalComplication: false,
      isUPC: false,
      location: 'R1',
      handoffNoteDayShift: 'Paciente estable con oxígeno.',
      handoffNoteNightShift: 'Sin eventos durante la noche.',
      medicalHandoffNote: 'Continuar vigilancia respiratoria.',
      medicalHandoffEntries: [
        {
          id: 'entry-1',
          specialty: 'Medicina',
          note: 'Solicitar control de exámenes.',
        },
      ],
      clinicalEvents: [
        {
          id: 'ev-1',
          name: 'Radiografía',
          date: '2026-03-24',
          note: 'Infiltrado basal derecho',
          createdAt: '2026-03-24T09:30:00.000Z',
        },
      ],
    },
  },
  discharges: [],
  transfers: [],
  cma: [],
  lastUpdated: '2026-03-25T10:00:00.000Z',
  nursesDayShift: ['enfermera-a'],
  nursesNightShift: ['enfermera-b'],
  tensDayShift: ['tens-a'],
  tensNightShift: ['tens-b'],
  activeExtraBeds: [],
  handoffNovedadesDayShift: 'Oxígeno a bajo flujo.',
  handoffNovedadesNightShift: 'Sin incidentes.',
  medicalHandoffNovedades: 'Pendiente reevaluación médica.',
  medicalHandoffDoctor: 'Dr. House',
  medicalHandoffBySpecialty: {
    medicinaInterna: {
      note: 'Control gases en la tarde.',
      createdAt: '2026-03-25T08:00:00.000Z',
      updatedAt: '2026-03-25T08:30:00.000Z',
      author: {
        uid: 'u1',
        displayName: 'Dr. House',
        email: 'house@hospital.cl',
      },
      version: 1,
    },
  },
  medicalSignature: {
    doctorName: 'Dr. House',
    signedAt: '2026-03-25T08:40:00.000Z',
  },
};

const documents: ClinicalDocumentRecord[] = [
  {
    id: 'doc-1',
    hospitalId: 'hanga_roa',
    documentType: 'epicrisis',
    templateId: 'epicrisis',
    templateVersion: 1,
    title: 'Epicrisis',
    patientInfoTitle: 'Paciente',
    footerMedicoLabel: 'Médico',
    footerEspecialidadLabel: 'Especialidad',
    patientRut: '11.111.111-1',
    patientName: 'Paciente Demo',
    episodeKey: '11.111.111-1__2026-03-20',
    admissionDate: '2026-03-20',
    sourceDailyRecordDate: '2026-03-25',
    sourceBedId: 'R1',
    patientFields: [],
    sections: [
      {
        id: 'sec-1',
        title: 'Resumen',
        content: 'Paciente con evolución favorable.',
        order: 1,
      },
    ],
    medico: 'Dr. House',
    especialidad: 'Medicina',
    status: 'draft',
    isLocked: false,
    isActiveEpisodeDocument: true,
    currentVersion: 1,
    versionHistory: [],
    audit: {
      createdAt: '2026-03-25T09:00:00.000Z',
      createdBy: {
        uid: 'u1',
        email: 'house@hospital.cl',
        displayName: 'Dr. House',
        role: 'doctor_specialist',
      },
      updatedAt: '2026-03-25T09:10:00.000Z',
      updatedBy: {
        uid: 'u1',
        email: 'house@hospital.cl',
        displayName: 'Dr. House',
        role: 'doctor_specialist',
      },
    },
    renderedText: 'Paciente con evolución favorable y mejoría respiratoria.',
  },
];

describe('clinicalSummaryContextUseCase', () => {
  it('builds a unified clinical context for summaries', () => {
    const context = buildClinicalAISummaryContext({
      record,
      bedId: 'R1',
      documents,
    });

    expect(context.patient.name).toBe('Paciente Demo');
    expect(context.patient.medicalHandoffEntries).toHaveLength(1);
    expect(context.nursingHandoff.novedadesDayShift).toBe('Oxígeno a bajo flujo.');
    expect(context.medicalHandoff.doctor).toBe('Dr. House');
    expect(context.clinicalDocuments[0]).toMatchObject({
      id: 'doc-1',
      title: 'Epicrisis',
    });
  });

  it('builds a summary prompt that includes handoff and document context', () => {
    const context = buildClinicalAISummaryContext({
      record,
      bedId: 'R1',
      documents,
    });

    const prompt = buildClinicalAISummaryPrompt({
      context,
      instruction: 'Resumir para relevo clínico.',
    });

    expect(prompt.systemPrompt).toContain('asistente clínico');
    expect(prompt.userPrompt).toContain('Resumir para relevo clínico.');
    expect(prompt.userPrompt).toContain('Paciente Demo');
    expect(prompt.userPrompt).toContain('Oxígeno a bajo flujo.');
    expect(prompt.userPrompt).toContain('Epicrisis');
  });
});
