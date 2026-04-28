import { describe, expect, it, vi } from 'vitest';
import type { MedicalHandoffAuditActor, PatientData } from '@/types/domain/patient';
import { Specialty } from '@/types/domain/patientClassification';
import {
  executeAddMedicalEntry,
  executeConfirmMedicalEntryContinuity,
  executeCreateMedicalPrimaryEntry,
  executeDeleteMedicalEntry,
  executeRefreshMedicalEntryAsCurrent,
  executeUpdateMedicalEntryNote,
  executeUpdateMedicalEntrySpecialty,
  executeUpdateMedicalPrimaryNote,
} from '@/application/handoff';

const REPORT_DATE = '2026-03-15';
const NOW = '2026-03-15T12:00:00.000Z';

const ACTOR: MedicalHandoffAuditActor = {
  uid: 'doctor-1',
  email: 'doctor@hospital.cl',
  displayName: 'Dr. Test',
  role: 'doctor_urgency',
};

const createPatient = (overrides: Partial<PatientData> = {}): PatientData =>
  ({
    bedId: 'R1',
    isBlocked: false,
    bedMode: 'Cama',
    hasCompanionCrib: false,
    patientName: 'Paciente Test',
    rut: '1-9',
    age: '40',
    pathology: 'Neumonia',
    specialty: Specialty.MEDICINA,
    status: 'Estable',
    admissionDate: '2026-03-01',
    hasWristband: true,
    devices: [],
    surgicalComplication: false,
    isUPC: false,
    ...overrides,
  }) as PatientData;

describe('medicalPatientHandoffUseCases', () => {
  it('updates the primary note preserving legacy mirror fields', async () => {
    const persistMedicalFields = vi.fn().mockResolvedValue(undefined);
    const patient = createPatient({ medicalHandoffNote: 'Nota antigua' });

    const outcome = await executeUpdateMedicalPrimaryNote({
      medicalAuditActor: ACTOR,
      now: NOW,
      patient,
      persistMedicalFields,
      recordDate: REPORT_DATE,
      value: 'Paciente estable',
    });

    expect(outcome.status).toBe('success');
    expect(outcome.data?.previousEntry?.note).toBe('Nota antigua');
    expect(outcome.data?.fields.medicalHandoffNote).toBe('Paciente estable');
    expect(outcome.data?.fields.medicalHandoffAudit?.lastSpecialistUpdateBy?.displayName).toBe(
      ACTOR.displayName
    );
    expect(persistMedicalFields).toHaveBeenCalledWith(
      expect.objectContaining({
        medicalHandoffEntries: expect.arrayContaining([
          expect.objectContaining({
            note: 'Paciente estable',
            currentStatus: 'updated_by_specialist',
          }),
        ]),
      })
    );
  });

  it('creates or updates an entry note and specialty through the application boundary', async () => {
    const persistMedicalFields = vi.fn().mockResolvedValue(undefined);
    const patient = createPatient({
      medicalHandoffEntries: [
        {
          id: 'entry-1',
          specialty: Specialty.CIRUGIA,
          note: 'Nota previa',
        },
      ],
    });

    const noteOutcome = await executeUpdateMedicalEntryNote({
      entryId: 'entry-1',
      medicalAuditActor: ACTOR,
      now: NOW,
      patient,
      persistMedicalFields,
      recordDate: REPORT_DATE,
      value: 'Nota actualizada',
    });
    const specialtyOutcome = await executeUpdateMedicalEntrySpecialty({
      entryId: 'entry-1',
      patient,
      persistMedicalFields,
      specialty: Specialty.PEDIATRIA,
    });

    expect(noteOutcome.status).toBe('success');
    expect(noteOutcome.data?.previousEntry?.note).toBe('Nota previa');
    expect(noteOutcome.data?.entry?.note).toBe('Nota actualizada');
    expect(noteOutcome.data?.entry?.originalNoteAt).toBe(NOW);
    expect(noteOutcome.data?.entry?.originalNoteBy?.displayName).toBe(ACTOR.displayName);
    expect(specialtyOutcome.status).toBe('success');
    expect(specialtyOutcome.data?.entry?.specialty).toBe(Specialty.PEDIATRIA);
  });

  it('adds a secondary entry and returns no_effect when the primary already exists', async () => {
    const persistMedicalFields = vi.fn().mockResolvedValue(undefined);
    const emptyPatient = createPatient();
    const existingPatient = createPatient({
      medicalHandoffEntries: [
        {
          id: 'primary-entry',
          specialty: Specialty.MEDICINA,
          note: 'Ya existe',
        },
      ],
    });

    const addOutcome = await executeAddMedicalEntry({
      patient: emptyPatient,
      persistMedicalFields,
    });
    const createPrimaryOutcome = await executeCreateMedicalPrimaryEntry({
      patient: existingPatient,
      persistMedicalFields,
    });

    expect(addOutcome.status).toBe('success');
    expect(addOutcome.data?.fields.medicalHandoffEntries).toHaveLength(2);
    expect(createPrimaryOutcome.status).toBe('success');
    expect(createPrimaryOutcome.reason).toBe('no_effect');
    expect(persistMedicalFields).toHaveBeenCalledTimes(1);
  });

  it('returns missing_entry when trying to delete an absent medical entry', async () => {
    const outcome = await executeDeleteMedicalEntry({
      entryId: 'missing',
      patient: createPatient(),
      persistMedicalFields: vi.fn().mockResolvedValue(undefined),
    });

    expect(outcome.status).toBe('failed');
    expect(outcome.reason).toBe('missing_entry');
  });

  it('does not create a medical entry from stale update identifiers', async () => {
    const persistMedicalFields = vi.fn().mockResolvedValue(undefined);
    const patient = createPatient({
      medicalHandoffEntries: [
        {
          id: 'entry-1',
          specialty: Specialty.MEDICINA,
          note: 'Nota vigente',
        },
      ],
    });

    const noteOutcome = await executeUpdateMedicalEntryNote({
      entryId: 'missing-entry',
      medicalAuditActor: ACTOR,
      now: NOW,
      patient,
      persistMedicalFields,
      recordDate: REPORT_DATE,
      value: 'Nota no debe persistir',
    });
    const specialtyOutcome = await executeUpdateMedicalEntrySpecialty({
      entryId: 'missing-entry',
      patient,
      persistMedicalFields,
      specialty: Specialty.CIRUGIA,
    });

    expect(noteOutcome.status).toBe('failed');
    expect(noteOutcome.reason).toBe('missing_entry');
    expect(specialtyOutcome.status).toBe('failed');
    expect(specialtyOutcome.reason).toBe('missing_entry');
    expect(persistMedicalFields).not.toHaveBeenCalled();
  });

  it('validates continuity confirmation for actor and note content', async () => {
    const persistMedicalFields = vi.fn().mockResolvedValue(undefined);
    const patient = createPatient({
      medicalHandoffEntries: [
        {
          id: 'entry-1',
          specialty: Specialty.MEDICINA,
          note: 'Paciente estable',
        },
        {
          id: 'entry-2',
          specialty: Specialty.CIRUGIA,
          note: '',
        },
      ],
    });

    const missingActorOutcome = await executeConfirmMedicalEntryContinuity({
      entryId: 'entry-1',
      medicalAuditActor: null,
      now: NOW,
      patient,
      persistMedicalFields,
      recordDate: REPORT_DATE,
    });
    const emptyNoteOutcome = await executeConfirmMedicalEntryContinuity({
      entryId: 'entry-2',
      medicalAuditActor: ACTOR,
      now: NOW,
      patient,
      persistMedicalFields,
      recordDate: REPORT_DATE,
    });
    const successOutcome = await executeConfirmMedicalEntryContinuity({
      entryId: 'entry-1',
      medicalAuditActor: ACTOR,
      now: NOW,
      patient,
      persistMedicalFields,
      recordDate: REPORT_DATE,
    });

    expect(missingActorOutcome.reason).toBe('missing_audit_actor');
    expect(emptyNoteOutcome.reason).toBe('empty_entry_note');
    expect(successOutcome.status).toBe('success');
    expect(successOutcome.data?.entry?.currentStatus).toBe('confirmed_current');
  });

  it('refreshes a note as current while preserving the original note metadata', async () => {
    const persistMedicalFields = vi.fn().mockResolvedValue(undefined);
    const patient = createPatient({
      medicalHandoffEntries: [
        {
          id: 'entry-1',
          specialty: Specialty.MEDICINA,
          note: 'Paciente estable',
          originalNoteAt: '2026-03-01T09:00:00.000Z',
          originalNoteBy: {
            uid: 'doctor-base',
            email: 'base@hospital.cl',
            displayName: 'Dr. Base',
            role: 'doctor_urgency',
          },
          updatedAt: '2026-03-01T09:00:00.000Z',
          updatedBy: {
            uid: 'doctor-base',
            email: 'base@hospital.cl',
            displayName: 'Dr. Base',
            role: 'doctor_urgency',
          },
        },
      ],
    });

    const outcome = await executeRefreshMedicalEntryAsCurrent({
      entryId: 'entry-1',
      medicalAuditActor: ACTOR,
      now: NOW,
      patient,
      persistMedicalFields,
      recordDate: REPORT_DATE,
    });

    expect(outcome.status).toBe('success');
    expect(outcome.data?.entry?.originalNoteAt).toBe('2026-03-01T09:00:00.000Z');
    expect(outcome.data?.entry?.originalNoteBy?.displayName).toBe('Dr. Base');
    expect(outcome.data?.entry?.updatedAt).toBe(NOW);
    expect(outcome.data?.entry?.updatedBy?.displayName).toBe(ACTOR.displayName);
    expect(outcome.data?.entry?.currentStatus).toBe('updated_by_specialist');
  });

  it('returns missing_patient when no patient is available', async () => {
    const outcome = await executeUpdateMedicalPrimaryNote({
      medicalAuditActor: ACTOR,
      patient: null,
      persistMedicalFields: vi.fn().mockResolvedValue(undefined),
      recordDate: REPORT_DATE,
      value: 'Sin paciente',
    });

    expect(outcome.status).toBe('failed');
    expect(outcome.reason).toBe('missing_patient');
  });
});
