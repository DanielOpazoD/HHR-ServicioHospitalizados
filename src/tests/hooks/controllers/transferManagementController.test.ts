import { describe, expect, it } from 'vitest';
import type { PatientData } from '@/types/domain/patient';
import type { TransferRequest } from '@/types/transferRequestTypes';
import {
  buildTransferNote,
  buildCreateTransferPayload,
  buildHospitalizedPatients,
  buildTransferPatientSnapshot,
  countActiveTransfers,
  filterVisibleTransfers,
  resolvePreviousTransferStatus,
} from '@/hooks/controllers/transferManagementController';

const buildPatient = (overrides: Partial<PatientData> = {}): PatientData =>
  ({
    bedId: 'R1',
    isBlocked: false,
    bedMode: 'Cama',
    hasCompanionCrib: false,
    patientName: 'Paciente Demo',
    rut: '1-9',
    age: '42',
    pathology: 'Diag',
    diagnosisComments: 'Secundario',
    biologicalSex: 'Masculino',
    ...overrides,
  }) as PatientData;

describe('transferManagementController', () => {
  it('builds hospitalized patients list from active beds', () => {
    const patients = buildHospitalizedPatients({
      R1: buildPatient(),
      R2: buildPatient({ patientName: '', bedId: 'R2' }),
      R3: buildPatient({ patientName: 'Bloqueada', bedId: 'R3', isBlocked: true }),
    });

    expect(patients).toEqual([{ id: 'R1', name: 'Paciente Demo', bedId: 'R1', diagnosis: 'Diag' }]);
  });

  it('builds patient snapshot and create payload', () => {
    const patient = buildPatient();
    const snapshot = buildTransferPatientSnapshot(patient, '2026-03-03');
    expect(snapshot).toMatchObject({
      name: 'Paciente Demo',
      age: 42,
      sex: 'M',
      admissionDate: '2026-03-03',
    });

    const payload = buildCreateTransferPayload(
      {
        patientId: 'R1',
        bedId: 'R1',
        destinationHospital: 'Hospital Base',
        transferReason: 'Complejidad',
        requestingDoctor: 'Dr. Uno',
        transferNotes: [
          buildTransferNote('Nota inicial', 'admin@test.com', '2026-03-03T10:30:00Z'),
        ],
      },
      patient,
      '2026-03-03',
      'admin@test.com',
      '2026-03-03'
    );

    expect(payload.patientSnapshot.name).toBe('Paciente Demo');
    expect(payload.createdBy).toBe('admin@test.com');
    expect(payload.status).toBe('REQUESTED');
    expect(payload.transferNotes).toHaveLength(1);
    expect(payload.transferNotes?.[0]).toMatchObject({
      content: 'Nota inicial',
      createdBy: 'admin@test.com',
    });
  });

  it('filters visible transfers and resolves previous status', () => {
    const transfers = [
      { id: '1', archived: false, status: 'REQUESTED' },
      { id: '2', archived: true, status: 'TRANSFERRED' },
      { id: '3', archived: false, status: 'TRANSFERRED' },
    ] as TransferRequest[];

    const visible = filterVisibleTransfers(transfers);
    expect(visible).toHaveLength(2);
    expect(countActiveTransfers(visible)).toBe(1);

    expect(
      resolvePreviousTransferStatus({
        statusHistory: [
          { from: null, to: 'REQUESTED' },
          { from: 'REQUESTED', to: 'ACCEPTED' },
          { from: 'ACCEPTED', to: 'TRANSFERRED' },
        ],
      } as TransferRequest)
    ).toBe('ACCEPTED');
  });
});
